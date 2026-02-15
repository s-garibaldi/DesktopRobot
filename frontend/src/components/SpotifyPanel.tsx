import { useCallback, useEffect, useState } from 'react';
import {
  useSpotifyMetadata,
  useSpotifyPlayer,
  buildAuthUrl,
  generatePkce,
  SPOTIFY_PLAYBACK_SCOPES,
} from '../spotify';
import type { SpotifyTrack } from '../spotify';

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
}

export default function SpotifyPanel({ backendUrl }: SpotifyPanelProps) {
  const [token, setToken] = useState<string | null>(loadStoredToken);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(false);

  const { searchTracks, loading: searchLoading, error: searchError } = useSpotifyMetadata(backendUrl);
  const {
    ready: playerReady,
    error: playerError,
    playbackState,
    play,
    pause,
    resume,
    togglePlay,
    setVolume,
    seek,
    skipNext,
    skipPrevious,
  } = useSpotifyPlayer(token);

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
    async (track: SpotifyTrack) => {
      const uri = `spotify:track:${track.id}`;
      await play(uri);
    },
    [play]
  );

  const handlePause = useCallback(async () => {
    await pause();
  }, [pause]);

  const handleResume = useCallback(async () => {
    await resume();
  }, [resume]);

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
                  onClick={skipPrevious}
                  title="Previous"
                  aria-label="Previous"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  className="spotify-transport-btn spotify-play-pause"
                  onClick={togglePlay}
                  title={playbackState?.paused ? 'Play' : 'Pause'}
                  aria-label={playbackState?.paused ? 'Play' : 'Pause'}
                >
                  {playbackState?.paused ? '▶' : '⏸'}
                </button>
                <button
                  type="button"
                  className="spotify-transport-btn"
                  onClick={skipNext}
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
