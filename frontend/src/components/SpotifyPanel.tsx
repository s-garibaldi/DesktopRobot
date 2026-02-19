import { useCallback, useEffect, useState } from 'react';
import {
  useSpotifyMetadata,
  useSpotifyPlayer,
  buildAuthUrl,
  generatePkce,
  SPOTIFY_PLAYBACK_SCOPES,
} from '../spotify';
import type { PlaybackState, SpotifyTrack } from '../spotify';
import { useMusicController, NowPlayingPanel, QueuePanel } from '../music';
import '../music/music.css';

const SPOTIFY_TOKEN_KEY = 'spotify_access_token';
const SPOTIFY_REFRESH_KEY = 'spotify_refresh_token';
const SPOTIFY_EXPIRES_AT_KEY = 'spotify_expires_at';
const SPOTIFY_CODE_VERIFIER_KEY = 'spotify_code_verifier';

/** Consider token expired this many ms before actual expiry so we refresh in time. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Redirect URI for Spotify OAuth. Must match exactly what is in the Spotify Dashboard. */
function getSpotifyRedirectUri(): string {
  const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined;
  if (envUri && envUri.trim()) return envUri.trim().replace(/\/$/, '') + '/';
  if (typeof window === 'undefined') return 'http://127.0.0.1:1420/';
  const origin = window.location.origin;
  const spotifyOrigin = origin.replace(/localhost/i, '127.0.0.1');
  return `${spotifyOrigin.endsWith('/') ? spotifyOrigin : `${spotifyOrigin}/`}`;
}

function loadStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SPOTIFY_TOKEN_KEY);
}

interface SpotifyPanelProps {
  backendUrl: string;
  onPlaybackStateChange?: (state: PlaybackState | null) => void;
  onStop?: () => void;
}

export default function SpotifyPanel({ backendUrl, onPlaybackStateChange, onStop }: SpotifyPanelProps) {
  const [token, setToken] = useState<string | null>(loadStoredToken);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(false);
  const [skipSeconds, setSkipSeconds] = useState(10);

  const { searchTracks, loading: searchLoading, error: searchError } = useSpotifyMetadata(backendUrl);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const expStr = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_EXPIRES_AT_KEY) : null;
    const exp = expStr ? Number(expStr) : 0;
    const now = Date.now();
    if (exp > now + REFRESH_BUFFER_MS) {
      const t = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_TOKEN_KEY) : null;
      if (t) return t;
    }
    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_REFRESH_KEY) : null;
    if (!refreshToken || !backendUrl) {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_TOKEN_KEY) : null;
    }
    try {
      const res = await fetch(`${backendUrl}/api/spotify/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        mode: 'cors',
      });
      const data = await res.json();
      if (data.success && data.access_token) {
        const newExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
        localStorage.setItem(SPOTIFY_TOKEN_KEY, data.access_token);
        localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, String(newExpiresAt));
        if (data.refresh_token) localStorage.setItem(SPOTIFY_REFRESH_KEY, data.refresh_token);
        setToken(data.access_token);
        return data.access_token;
      }
    } catch {
      // fall through
    }
    return typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_TOKEN_KEY) : null;
  }, [backendUrl]);

  const onAuthenticationError = useCallback(async () => {
    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_REFRESH_KEY) : null;
    if (!refreshToken || !backendUrl) {
      localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_REFRESH_KEY);
      localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
      setToken(null);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/spotify/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        mode: 'cors',
      });
      const data = await res.json();
      if (data.success && data.access_token) {
        const newExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
        localStorage.setItem(SPOTIFY_TOKEN_KEY, data.access_token);
        localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, String(newExpiresAt));
        if (data.refresh_token) localStorage.setItem(SPOTIFY_REFRESH_KEY, data.refresh_token);
        setToken(data.access_token);
      } else {
        localStorage.removeItem(SPOTIFY_TOKEN_KEY);
        localStorage.removeItem(SPOTIFY_REFRESH_KEY);
        localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
        setToken(null);
      }
    } catch {
      localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_REFRESH_KEY);
      localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
      setToken(null);
    }
  }, [backendUrl]);

  const {
    ready: playerReady,
    error: playerError,
    playbackState,
    play,
    pause,
    resume,
    setVolume,
    seek,
  } = useSpotifyPlayer(token, { getValidToken, onAuthenticationError });

  // MusicController + Spotify adapter
  const playWithRetry = useCallback(
    async (uri: string) => {
      const delayMs = 800;
      await new Promise((r) => setTimeout(r, delayMs));
      let ok = await play(uri);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 2000));
        ok = await play(uri);
      }
      return ok;
    },
    [play]
  );

  const music = useMusicController({
    play: playWithRetry,
    pause,
    resume,
    seek,
    playbackState: playbackState
      ? {
          trackUri: playbackState.trackUri,
          position: playbackState.position,
          duration: playbackState.duration,
          paused: playbackState.paused,
        }
      : null,
  });

  // Handle redirect from Spotify (callback with ?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const codeVerifier = sessionStorage.getItem(SPOTIFY_CODE_VERIFIER_KEY);
    const redirectUri = getSpotifyRedirectUri();

    if (!codeVerifier) {
      setCallbackError('Missing code verifier. Try connecting again.');
      window.history.replaceState({}, '', window.location.pathname || '/');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/spotify/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
          }),
          mode: 'cors',
        });
        const data = await res.json();

        if (data.success && data.access_token) {
          const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
          localStorage.setItem(SPOTIFY_TOKEN_KEY, data.access_token);
          if (data.refresh_token) localStorage.setItem(SPOTIFY_REFRESH_KEY, data.refresh_token);
          localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, String(expiresAt));
          setToken(data.access_token);
          setCallbackError(null);
        } else {
          const msg = data.error ?? 'Failed to get token';
          setCallbackError(codeVerifier ? msg : 'Session lost after redirect. Close the app, reopen it, then try Connect with Spotify again.');
        }
      } catch (e) {
        setCallbackError(e instanceof Error ? e.message : String(e));
      } finally {
        sessionStorage.removeItem(SPOTIFY_CODE_VERIFIER_KEY);
        window.history.replaceState({}, '', window.location.pathname || '/');
      }
    })();
  }, [backendUrl]);

  // On app load (e.g. Tauri opens): restore session by refreshing token if expired.
  useEffect(() => {
    const storedToken = loadStoredToken();
    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_REFRESH_KEY) : null;
    const expiresAtStr = typeof localStorage !== 'undefined' ? localStorage.getItem(SPOTIFY_EXPIRES_AT_KEY) : null;
    const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
    const now = Date.now();
    const tokenStillValid = expiresAt > now + REFRESH_BUFFER_MS;

    if (tokenStillValid && storedToken) return;
    if (!refreshToken || !backendUrl) {
      if (!tokenStillValid && storedToken) {
        localStorage.removeItem(SPOTIFY_TOKEN_KEY);
        localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
        setToken(null);
      }
      return;
    }

    setRestoringSession(true);
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/spotify/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
          mode: 'cors',
        });
        const data = await res.json();
        if (data.success && data.access_token) {
          const newExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
          localStorage.setItem(SPOTIFY_TOKEN_KEY, data.access_token);
          localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, String(newExpiresAt));
          if (data.refresh_token) localStorage.setItem(SPOTIFY_REFRESH_KEY, data.refresh_token);
          setToken(data.access_token);
          setCallbackError(null);
        } else {
          localStorage.removeItem(SPOTIFY_TOKEN_KEY);
          localStorage.removeItem(SPOTIFY_REFRESH_KEY);
          localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
          setToken(null);
        }
      } catch {
        // Keep existing token; user may need to reconnect if it fails
      } finally {
        setRestoringSession(false);
      }
    })();
  }, [backendUrl]);

  useEffect(() => {
    onPlaybackStateChange?.(token ? playbackState : null);
  }, [token, playbackState, onPlaybackStateChange]);

  // When we're connected (have token) and not handling a callback, clear any stale token-exchange error so it doesn't keep showing.
  useEffect(() => {
    if (token && !new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('code')) {
      setCallbackError(null);
    }
  }, [token]);

  // When there's no token and we're not restoring: auto-redirect to Spotify so user doesn't have to click Connect.
  useEffect(() => {
    if (token) return;
    if (restoringSession) return;
    if (callbackError) return; // avoid redirect loop after a failed callback
    // Don't redirect if we're handling the OAuth callback (URL has ?code=...)
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code')) return;
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
    if (!clientId) return;

    const t = setTimeout(async () => {
      const redirectUri = getSpotifyRedirectUri();
      const { codeVerifier, codeChallenge } = await generatePkce();
      sessionStorage.setItem(SPOTIFY_CODE_VERIFIER_KEY, codeVerifier);
      const state = encodeURIComponent(codeVerifier);
      const url = buildAuthUrl({
        clientId,
        redirectUri,
        codeChallenge,
        state,
        scopes: SPOTIFY_PLAYBACK_SCOPES,
      });
      window.location.href = url;
    }, 400);

    return () => clearTimeout(t);
  }, [token, restoringSession, callbackError]);

  const handleConnect = useCallback(async () => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
    if (!clientId) {
      setCallbackError('VITE_SPOTIFY_CLIENT_ID not set in frontend .env');
      return;
    }
    const redirectUri = getSpotifyRedirectUri();
    const { codeVerifier, codeChallenge } = await generatePkce();
    sessionStorage.setItem(SPOTIFY_CODE_VERIFIER_KEY, codeVerifier);
    // Pass code_verifier in state so it survives redirect from localhost to 127.0.0.1 (different origin = no sessionStorage)
    const state = encodeURIComponent(codeVerifier);
    const url = buildAuthUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scopes: SPOTIFY_PLAYBACK_SCOPES,
    });
    window.location.href = url;
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(SPOTIFY_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_REFRESH_KEY);
    localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
    setToken(null);
    setSearchResults([]);
    setSearchQuery('');
    setCallbackError(null);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const tracks = await searchTracks(searchQuery.trim(), 15);
    setSearchResults(tracks);
  }, [searchQuery, searchTracks]);

  const playTrack = useCallback(
    (track: SpotifyTrack) => {
      const uri = `spotify:track:${track.id}`;
      const item = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: track.name,
        artist: track.artists?.join(', ') ?? '',
        uri,
        albumArtUrl: track.album?.images?.[0]?.url,
      };
      music.addAndPlay([item]);
    },
    [music]
  );

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pct = Number(e.target.value);
      if (playbackState && playbackState.duration > 0) {
        const positionMs = (pct / 100) * playbackState.duration;
        seek(positionMs);
      }
    },
    [playbackState, seek]
  );

  const handleStop = useCallback(async () => {
    onStop?.();
    music.clear();
    try {
      await pause();
      await seek(0);
    } catch {
      // Face already switched to neutral; ignore playback errors
    }
  }, [pause, seek, onStop, music]);

  const handleRestart = useCallback(async () => {
    await seek(0);
    await resume();
  }, [seek, resume]);

  // Voice commands when Spotify face is active (from RealtimeBridge → spotify-voice-command)
  useEffect(() => {
    const handler = (e: Event) => {
      const { action, seconds } = (e as CustomEvent<{ action: string; seconds?: number }>).detail ?? {};
      if (!action || typeof action !== 'string') return;
      const pos = playbackState?.position ?? 0;
      const dur = playbackState?.duration ?? 0;
      switch (action) {
        case 'pause':
          void music.togglePause();
          break;
        case 'play':
          void music.resume();
          break;
        case 'stop':
          void handleStop();
          break;
        case 'restart':
          void handleRestart();
          break;
        case 'rewind':
          music.seekTo(Math.max(0, pos - (seconds ?? 15) * 1000));
          break;
        case 'forward':
          music.seekTo(Math.min(dur || 999999, pos + (seconds ?? 15) * 1000));
          break;
        default:
          break;
      }
    };
    window.addEventListener('spotify-voice-command', handler);
    return () => window.removeEventListener('spotify-voice-command', handler);
  }, [music, playbackState?.position, playbackState?.duration, handleStop, handleRestart]);

  const handleForward = useCallback(() => {
    if (!playbackState || playbackState.duration <= 0) return;
    const ms = Math.min(playbackState.duration, playbackState.position + skipSeconds * 1000);
    seek(ms);
  }, [playbackState, skipSeconds, seek]);

  const handleRewind = useCallback(() => {
    if (!playbackState) return;
    const ms = Math.max(0, playbackState.position - skipSeconds * 1000);
    seek(ms);
  }, [playbackState, skipSeconds, seek]);

  const seekPercent =
    playbackState && playbackState.duration > 0
      ? Math.min(100, (playbackState.position / playbackState.duration) * 100)
      : 0;

  const errorMsg = callbackError ?? searchError ?? playerError;

  if (!token) {
    return (
      <div className="spotify-panel">
        <h3 className="spotify-panel-title">Spotify</h3>
        <p className="spotify-panel-hint">Connect your Spotify account to play music (Premium required).</p>
        {errorMsg && <p className="spotify-panel-error">{errorMsg}</p>}
        <button type="button" className="spotify-connect-btn" onClick={handleConnect}>
          Connect with Spotify
        </button>
        <p className="spotify-panel-env-hint">
          To fix &quot;Invalid redirect URI&quot;: in Spotify Dashboard → your app → Settings → Redirect URIs, add this <strong>exact</strong> value (copy-paste, no spaces):
        </p>
        <p className="spotify-panel-redirect-uri" title="Copy into Spotify Dashboard Redirect URIs">
          <code>{getSpotifyRedirectUri()}</code>
        </p>
        <p className="spotify-panel-env-hint">
          Optional: set <code>VITE_SPOTIFY_REDIRECT_URI</code> in frontend <code>.env</code> to this same value so the URI never changes. Spotify does not allow <code>localhost</code>—use <code>127.0.0.1</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="spotify-panel">
      <div className="spotify-panel-header">
        <h3 className="spotify-panel-title">Spotify</h3>
        <button type="button" className="spotify-logout-btn" onClick={handleLogout} title="Disconnect">
          Disconnect
        </button>
      </div>

      <NowPlayingPanel
        nowPlaying={music.nowPlaying}
        status={music.status}
        onPlayPause={music.togglePause}
        onNext={music.next}
        onPrevious={music.previous}
        onSeek={music.seekTo}
      />

      <QueuePanel
        queue={music.queue}
        onRemoveAt={music.removeAt}
        onMove={music.move}
        onClear={music.clear}
        onPlayIndex={music.playIndex}
      />

      {restoringSession && (
        <p className="spotify-panel-hint">Restoring session…</p>
      )}

      {errorMsg && <p className="spotify-panel-error">{errorMsg}</p>}

      {!playerReady && !restoringSession && (
        <p className="spotify-panel-hint">Loading player… Make sure Spotify Premium is active on this account.</p>
      )}

      <div className="spotify-search-row">
        <input
          type="text"
          className="spotify-search-input"
          placeholder="Search tracks…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          type="button"
          className="spotify-search-btn"
          onClick={handleSearch}
          disabled={searchLoading}
        >
          {searchLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {playerReady && (
        <>
          {(playbackState?.trackName || (playbackState && playbackState.duration > 0)) && (
            <div className="spotify-now-playing">
              <div className="spotify-now-playing-info">
                <span className="spotify-now-playing-title">
                  {playbackState?.trackName ?? '—'}
                </span>
                {playbackState?.artistNames && (
                  <span className="spotify-now-playing-artist">{playbackState.artistNames}</span>
                )}
              </div>
              <div className="spotify-progress-row">
                <span className="spotify-time-label">
                  {formatDuration(Math.floor(playbackState?.position ?? 0))}
                </span>
                <input
                  type="range"
                  className="spotify-seek-slider"
                  min="0"
                  max="100"
                  value={seekPercent}
                  onChange={handleSeek}
                  title="Seek"
                />
                <span className="spotify-time-label">
                  {formatDuration(playbackState?.duration ?? 0)}
                </span>
              </div>
              <div className="spotify-transport-row">
                <button
                  type="button"
                  className="spotify-transport-btn"
                  onClick={() => music.previous()}
                  title="Previous"
                  aria-label="Previous"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  className="spotify-transport-btn spotify-play-pause"
                  onClick={() => music.togglePause()}
                  title={playbackState?.paused ? 'Play' : 'Pause'}
                  aria-label={playbackState?.paused ? 'Play' : 'Pause'}
                >
                  {playbackState?.paused ? '▶' : '⏸'}
                </button>
                <button
                  type="button"
                  className="spotify-transport-btn"
                  onClick={() => music.next()}
                  title="Next"
                  aria-label="Next"
                >
                  ⏭
                </button>
                <label className="spotify-volume-label">
                  Vol
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="50"
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  />
                </label>
              </div>
              <div className="spotify-extra-controls">
                <button
                  type="button"
                  className="spotify-transport-btn"
                  onClick={handleStop}
                  title="Stop"
                  aria-label="Stop"
                >
                  ⏹ Stop
                </button>
                <button
                  type="button"
                  className="spotify-transport-btn"
                  onClick={handleRestart}
                  title="Restart song"
                  aria-label="Restart song"
                >
                  ↺ Restart
                </button>
                <div className="spotify-skip-row">
                  <label className="spotify-skip-label">
                    Skip
                    <input
                      type="number"
                      className="spotify-skip-input"
                      min={1}
                      max={600}
                      value={skipSeconds}
                      onChange={(e) => setSkipSeconds(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
                      title="Seconds to skip"
                    />
                    s
                  </label>
                  <button
                    type="button"
                    className="spotify-transport-btn"
                    onClick={handleRewind}
                    title={`Rewind ${skipSeconds} s`}
                    aria-label={`Rewind ${skipSeconds} seconds`}
                  >
                    ⏪ −{skipSeconds}s
                  </button>
                  <button
                    type="button"
                    className="spotify-transport-btn"
                    onClick={handleForward}
                    title={`Forward ${skipSeconds} s`}
                    aria-label={`Forward ${skipSeconds} seconds`}
                  >
                    +{skipSeconds}s ⏩
                  </button>
                </div>
              </div>
            </div>
          )}
          {!(playbackState?.trackName) && (
            <div className="spotify-controls-row">
              <label className="spotify-volume-label">
                Volume
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="50"
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                />
              </label>
            </div>
          )}
        </>
      )}

      <ul className="spotify-track-list">
        {searchResults.map((track) => (
          <li key={track.id} className="spotify-track-item">
            {track.album.images[0] && (
              <img
                src={track.album.images[0].url}
                alt=""
                className="spotify-track-art"
                width={48}
                height={48}
              />
            )}
            <div className="spotify-track-info">
              <span className="spotify-track-name">{track.name}</span>
              <span className="spotify-track-meta">
                {track.artists.map((a) => a.name).join(', ')} · {track.album.name} · {formatDuration(track.duration_ms)}
              </span>
            </div>
            {playerReady && (
              <button
                type="button"
                className="spotify-play-track-btn"
                onClick={() => playTrack(track)}
                title={`Play ${track.name}`}
              >
                ▶ Play
              </button>
            )}
          </li>
        ))}
      </ul>
      {searchResults.length === 0 && !searchLoading && (
        <p className="spotify-panel-hint">Search for a song to see results.</p>
      )}
    </div>
  );
}
