import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSpotifyMetadata,
  useSpotifyPlayer,
  useSpotifyViaBackend,
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
  /** When true, use backend iframe for playback (same context as Realtime AI audio) */
  useBackendForPlayback?: boolean;
  sendToBackendIframe?: (msg: object) => void;
}

export default function SpotifyPanel({ backendUrl, onPlaybackStateChange, onStop, useBackendForPlayback = false, sendToBackendIframe }: SpotifyPanelProps) {
  const [token, setToken] = useState<string | null>(loadStoredToken);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [agentPlaybackError, setAgentPlaybackError] = useState<string | null>(null);
  const [showStartPlaybackHint, setShowStartPlaybackHint] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);
  const [skipSeconds, setSkipSeconds] = useState(10);
  const [volume, setVolumeState] = useState(0.5);
  const tokenExchangeInProgressRef = useRef(false);

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
      // Refresh token invalid/revoked; clear stored tokens to stop retry loop
      localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_REFRESH_KEY);
      localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
      setToken(null);
      setCallbackError('Spotify session expired. Please connect again.');
    } catch {
      // fall through: keep existing token
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
      setCallbackError('Spotify session expired. Please connect again.');
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
        setCallbackError('Spotify session expired. Please connect again.');
      }
    } catch {
      localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_REFRESH_KEY);
      localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
      setToken(null);
      setCallbackError('Spotify session expired. Please connect again.');
    }
  }, [backendUrl]);

  const sendToBackend = useCallback(
    (msg: object) => sendToBackendIframe?.(msg),
    [sendToBackendIframe]
  );

  const backendPlayer = useSpotifyViaBackend({
    sendToIframe: sendToBackend,
    isIframeReady: useBackendForPlayback && !!sendToBackendIframe,
  });

  const frontendPlayer = useSpotifyPlayer(token, { getValidToken, onAuthenticationError });

  const useBackend = useBackendForPlayback && !!sendToBackendIframe;
  const player = useBackend ? backendPlayer : frontendPlayer;
  const playerReady = player.ready;
  const playerError = player.error;
  const playbackState = player.playbackState;
  const autoplayBlocked = player.autoplayBlocked;
  const play = player.play;
  const pause = player.pause;
  const resume = player.resume;
  const seek = player.seek;
  const activateElement = player.activateElement;
  const setVolume = useBackend ? () => {} : (frontendPlayer as { setVolume?: (n: number) => void }).setVolume ?? (() => {});
  const reconnectPlayer = useBackend ? () => {} : (frontendPlayer as { reconnect?: () => void }).reconnect ?? (() => {});

  // Send token to backend when using backend playback; re-send when iframe reloads
  useEffect(() => {
    const sendToken = () => {
      if (useBackend && token && sendToBackendIframe) {
        sendToBackendIframe({ type: 'spotify_set_token', token });
      }
    };
    sendToken();
    window.addEventListener('backend-iframe-loaded', sendToken);
    return () => window.removeEventListener('backend-iframe-loaded', sendToken);
  }, [useBackend, token, sendToBackendIframe]);

  // MusicController + Spotify adapter; queueUris loads a list so playback auto-starts
  const playWithRetry = useCallback(
    async (uri: string, queueUris?: string[]) => {
      const uris = queueUris && queueUris.length > 0 ? [uri, ...queueUris] : uri;
      let ok = await play(uris);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 600));
        ok = await play(uris);
      }
      if (!ok) {
        await new Promise((r) => setTimeout(r, 1500));
        ok = await play(uris);
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

  const handleStartPlayback = useCallback(async () => {
    activateElement();
    if (music.queue.items.length > 0) {
      music.playIndex(0);
    } else if (music.nowPlaying) {
      if (autoplayBlocked) {
        await music.togglePause();
        await music.resume();
      } else {
        music.resume();
      }
    }
  }, [activateElement, music, autoplayBlocked]);

  // Handle redirect from Spotify (callback with ?code=...)
  // Guard: code is single-use; React Strict Mode double-invokes effects, so prevent duplicate exchange.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    if (tokenExchangeInProgressRef.current) return;
    tokenExchangeInProgressRef.current = true;

    // Try sessionStorage first; fallback to state param (survives localhost → 127.0.0.1 redirect)
    let codeVerifier = sessionStorage.getItem(SPOTIFY_CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      const stateParam = params.get('state');
      if (stateParam) {
        try {
          codeVerifier = decodeURIComponent(stateParam);
        } catch {
          // ignore decode errors
        }
      }
    }
    const redirectUri = getSpotifyRedirectUri();

    if (!codeVerifier) {
      tokenExchangeInProgressRef.current = false;
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
          let msg = data.error ?? 'Failed to get token';
          if (/invalid.*authorization.*code/i.test(msg)) {
            msg += ' — Click Connect with Spotify again to get a fresh login.';
          }
          setCallbackError(codeVerifier ? msg : 'Session lost after redirect. Close the app, reopen it, then try Connect with Spotify again.');
        }
      } catch (e) {
        setCallbackError(e instanceof Error ? e.message : String(e));
      } finally {
        tokenExchangeInProgressRef.current = false;
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

  // Merge MusicController nowPlaying with SDK playbackState so displays stay in sync when we skip.
  // MusicController updates immediately; SDK lags. Prefer our queue state for track identity.
  // Ensure position/duration are in seconds (not ms) - SDK uses seconds, MusicController uses ms.
  const toSeconds = (v: number, isFromMs: boolean) =>
    isFromMs ? v / 1000 : v > 7200 ? v / 1000 : v; // >2h in sec = likely ms
  useEffect(() => {
    if (!token) {
      onPlaybackStateChange?.(null);
      return;
    }
    if (!playbackState) {
      onPlaybackStateChange?.(null);
      return;
    }
    const np = music.nowPlaying;
    const useQueueTrack =
      np && (music.status === 'playing' || music.status === 'paused');
    const pos =
      useQueueTrack && playbackState.duration <= 0
        ? np.progressMs / 1000
        : toSeconds(playbackState.position, false);
    const dur =
      useQueueTrack && playbackState.duration <= 0
        ? np.durationMs / 1000
        : toSeconds(playbackState.duration, false);
    const merged: PlaybackState = useQueueTrack
      ? {
          ...playbackState,
          trackName: np!.item.title,
          trackUri: np!.item.uri,
          artistNames: np!.item.artist,
          albumImageUrl: np!.item.albumArtUrl ?? playbackState.albumImageUrl,
          position: pos,
          duration: dur,
        }
      : { ...playbackState, position: pos, duration: dur };
    onPlaybackStateChange?.(merged);
  }, [token, playbackState, music.nowPlaying, music.status, onPlaybackStateChange]);

  // When we're connected (have token) and not handling a callback, clear any stale token-exchange error so it doesn't keep showing.
  useEffect(() => {
    if (token && !new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('code')) {
      setCallbackError(null);
      setAgentPlaybackError(null);
    }
  }, [token]);

  // Listen for playback failures when agent tries to play without Spotify connected
  useEffect(() => {
    const handler = () => setAgentPlaybackError('Connect Spotify to play music from the AI.');
    window.addEventListener('spotify-playback-failed', handler);
    return () => window.removeEventListener('spotify-playback-failed', handler);
  }, []);

  // When AI requests playback, show hint to click Start playback (browsers require user gesture for audio)
  useEffect(() => {
    const handler = () => setShowStartPlaybackHint(true);
    window.addEventListener('spotify-agent-requested-playback', handler);
    return () => window.removeEventListener('spotify-agent-requested-playback', handler);
  }, []);

  // Clear the hint once playback is actually running
  useEffect(() => {
    if (music.status === 'playing' && showStartPlaybackHint) {
      setShowStartPlaybackHint(false);
    }
  }, [music.status, showStartPlaybackHint]);

  // When there's no token and we're not restoring: auto-redirect to Spotify so user doesn't have to click Connect.
  useEffect(() => {
    if (token) return;
    if (restoringSession) return;
    if (callbackError) return; // avoid redirect loop after a failed callback
    // Don't redirect if we're handling the OAuth callback (URL has ?code=...)
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code')) return;
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
    if (!clientId) return;

    // 800ms gives user a moment to see the connect screen before auto-redirect
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
    }, 800);

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
    setAgentPlaybackError(null);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const tracks = await searchTracks(searchQuery.trim(), 15);
    setSearchResults(tracks);
  }, [searchQuery, searchTracks]);

  const playTrack = useCallback(
    (track: SpotifyTrack) => {
      activateElement();
      const uri = `spotify:track:${track.id}`;
      const item = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: track.name,
        artist: Array.isArray(track.artists) ? track.artists.map((a) => a.name).join(', ') : String(track.artists ?? ''),
        uri,
        albumArtUrl: track.album?.images?.[0]?.url,
        durationMs: track.duration_ms,
      };
      music.addAndPlay([item]);
    },
    [music, activateElement]
  );

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

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

  const lastRestartAtRef = useRef(0);
  const handleRestart = useCallback(async () => {
    const now = Date.now();
    if (now - lastRestartAtRef.current < 800) return; // Debounce: prevent accidental double-click
    lastRestartAtRef.current = now;
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
        case 'skip': {
          void music.next().then((ok) => {
            if (!ok) void handleStop();
          });
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('spotify-voice-command', handler);
    return () => window.removeEventListener('spotify-voice-command', handler);
  }, [music, playbackState?.position, playbackState?.duration, handleStop, handleRestart]);

  const handleForward = useCallback(() => {
    if (!playbackState || playbackState.duration <= 0) return;
    const posMs = playbackState.position * 1000;
    const durMs = playbackState.duration * 1000;
    seek(Math.min(durMs, posMs + skipSeconds * 1000));
  }, [playbackState, skipSeconds, seek]);

  const handleRewind = useCallback(() => {
    if (!playbackState) return;
    const posMs = playbackState.position * 1000;
    seek(Math.max(0, posMs - skipSeconds * 1000));
  }, [playbackState, skipSeconds, seek]);

  const errorMsg = callbackError ?? agentPlaybackError ?? searchError ?? playerError;

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
        <div className="spotify-panel-header-actions">
          <button type="button" className="spotify-reconnect-btn" onClick={reconnectPlayer} title="Reconnect player (fixes 404 errors)">
            Reconnect
          </button>
          <button type="button" className="spotify-logout-btn" onClick={handleLogout} title="Disconnect">
            Disconnect
          </button>
        </div>
      </div>

      <NowPlayingPanel
        nowPlaying={music.nowPlaying}
        status={music.status}
        onPlayPause={() => {
          activateElement();
          music.togglePause();
        }}
        onNext={() => {
          activateElement();
          music.next();
        }}
        onPrevious={() => {
          activateElement();
          music.previous();
        }}
        onSeek={music.seekTo}
        volume={playerReady ? volume : undefined}
        onVolumeChange={
          playerReady
            ? (v) => {
                setVolumeState(v);
                setVolume(v);
              }
            : undefined
        }
        onStop={playerReady ? handleStop : undefined}
        onRestart={playerReady ? handleRestart : undefined}
        skipSeconds={skipSeconds}
        onSkipSecondsChange={setSkipSeconds}
        onRewind={playerReady ? handleRewind : undefined}
        onForward={playerReady ? handleForward : undefined}
      />

      <QueuePanel
        queue={music.queue}
        onRemoveAt={music.removeAt}
        onMove={music.move}
        onClear={music.clear}
        onPlayItem={(item) => {
          activateElement();
          music.playItem(item);
        }}
      />

      {(playerReady && (music.queue.items.length > 0 || music.nowPlaying)) || autoplayBlocked || showStartPlaybackHint ? (
        <div className="spotify-start-row">
          <button
            type="button"
            className={`spotify-start-btn ${autoplayBlocked || showStartPlaybackHint ? 'spotify-start-btn-urgent' : ''}`}
            onClick={() => {
              setShowStartPlaybackHint(false);
              handleStartPlayback();
            }}
            title={autoplayBlocked ? 'Click to enable audio' : 'Click to start playback (required by browser)'}
          >
            {autoplayBlocked ? '🔊 Click to enable audio' : showStartPlaybackHint ? '▶ Click to play (browser requires this)' : '▶ Start playback'}
          </button>
          <span className="spotify-start-hint">
            {autoplayBlocked ? 'Audio was blocked. Click the button above to hear the music.' : showStartPlaybackHint ? 'The AI queued a song — click above to hear it.' : "If songs don't play, click here first"}
          </span>
        </div>
      ) : null}

      {restoringSession && (
        <p className="spotify-panel-hint">Restoring session…</p>
      )}

      {errorMsg && (
        <div className="spotify-panel-error-row">
          <p className="spotify-panel-error">{errorMsg}</p>
          <button type="button" className="spotify-reconnect-inline-btn" onClick={reconnectPlayer}>
            Reconnect
          </button>
        </div>
      )}

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
