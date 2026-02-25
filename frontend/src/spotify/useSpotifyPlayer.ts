import { useCallback, useEffect, useRef, useState } from 'react';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

/**
 * Chrome 74+ fix: SDK iframe uses display:none which blocks audio. Must be visible.
 * Keep iframe in viewport (1x1px corner) - some WebViews mute content at -9999px.
 * CRITICAL: allow="encrypted-media" enables full-track playback; without it only 30s previews play.
 * Use opacity 0.01 not 0: WKWebView (macOS Tauri) may mute fully invisible iframes.
 */
function fixSpotifyIframeAudio(): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="sdk.scdn.co"], iframe[src*="spotify.com"]');
  iframes.forEach((iframe) => {
    iframe.setAttribute('allow', 'encrypted-media; autoplay');
    iframe.style.setProperty('display', 'block', 'important');
    iframe.style.setProperty('position', 'fixed', 'important');
    iframe.style.setProperty('bottom', '0', 'important');
    iframe.style.setProperty('right', '0', 'important');
    iframe.style.setProperty('width', '1px', 'important');
    iframe.style.setProperty('height', '1px', 'important');
    iframe.style.setProperty('opacity', '0.01', 'important');
    iframe.style.setProperty('pointer-events', 'none', 'important');
  });
}

/** Watch for Spotify iframe and fix it immediately (encrypted-media must be set early for full playback). */
function observeSpotifyIframe(): () => void {
  fixSpotifyIframeAudio();
  const observer = new MutationObserver(() => fixSpotifyIframeAudio());
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

export interface PlaybackState {
  trackName: string | null;
  trackUri: string | null;
  artistNames: string;
  albumImageUrl: string | null;
  position: number;
  duration: number;
  paused: boolean;
}

export interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (state?: unknown) => void) => void;
  removeListener: (event: string, cb?: (state?: unknown) => void) => void;
  getCurrentState: () => Promise<{
    track_window?: {
      current_track?: { name: string; uri: string; artists?: { name: string }[] };
    };
    position?: number;
    duration?: number;
    paused?: boolean;
  } | null>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  getVolume: () => Promise<number>;
  activateElement: () => Promise<void>;
  _options: { getOAuthToken: (cb: (token: string) => void) => void };
}

export interface UseSpotifyPlayerResult {
  ready: boolean;
  deviceId: string | null;
  error: string | null;
  playbackState: PlaybackState | null;
  /** True when browser blocked audio; user must click to enable. */
  autoplayBlocked: boolean;
  play: (uriOrUris: string | string[]) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  setVolume: (volume: number) => void;
  seek: (positionMs: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  reconnect: () => void;
  /** Call from click handler before play – required for browser autoplay. */
  activateElement: () => void;
}

/**
 * Loads the Spotify Web Playback SDK and creates a player when accessToken is set.
 * Requires Spotify Premium and a token from PKCE login (see spotifyAuth.ts + /api/spotify/token).
 */
function emptyPlaybackState(): PlaybackState {
  return {
    trackName: null,
    trackUri: null,
    artistNames: '',
    albumImageUrl: null,
    position: 0,
    duration: 0,
    paused: true,
  };
}

export interface UseSpotifyPlayerOptions {
  /** Return a valid token (e.g. refresh if expired). When provided, the SDK gets this token when it calls getOAuthToken. */
  getValidToken?: () => Promise<string | null>;
  /** Called when the SDK reports authentication_error. Use to refresh token and update state so the player can re-init. */
  onAuthenticationError?: () => void;
}

export function useSpotifyPlayer(
  accessToken: string | null,
  options?: UseSpotifyPlayerOptions
): UseSpotifyPlayerResult {
  const { getValidToken, onAuthenticationError } = options ?? {};
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const lastPlayAtRef = useRef<number>(0);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const onAuthErrorRef = useRef(onAuthenticationError);
  onAuthErrorRef.current = onAuthenticationError;
  const getValidTokenRef = useRef(getValidToken);
  getValidTokenRef.current = getValidToken;

  const updateStateFromPlayer = useCallback(async () => {
    const player = playerRef.current;
    const token = getValidTokenRef.current ? await getValidTokenRef.current() : tokenRef.current;
    if (!player) return;

    const state = await player.getCurrentState();
    const needsApiFallback = !state || (state.track_window?.current_track && (!state.duration || state.duration === 0));

    if (needsApiFallback && token) {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            item?: { name?: string; uri?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] }; duration_ms?: number };
            progress_ms?: number;
            is_playing?: boolean;
          };
          if (data?.item) {
            const item = data.item;
            const albumImages = item.album?.images;
            const albumImageUrl = Array.isArray(albumImages) && albumImages.length > 0 ? albumImages[0].url : null;
            setPlaybackState({
              trackName: item.name ?? null,
              trackUri: item.uri ?? null,
              artistNames: item.artists?.map((a) => a.name).join(', ') ?? '',
              albumImageUrl,
              position: (data.progress_ms ?? 0) / 1000,
              duration: (item.duration_ms ?? 0) / 1000,
              paused: !data.is_playing,
            });
            return;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!state) {
      setPlaybackState(emptyPlaybackState());
      return;
    }

    const track = state.track_window?.current_track as { name?: string; uri?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } } | undefined;
    const albumImages = track?.album?.images;
    const albumImageUrl = Array.isArray(albumImages) && albumImages.length > 0 ? albumImages[0].url : null;
    let durationSec = state.duration ?? 0;
    const positionSec = state.position ?? 0;

    // When SDK returns duration 0 but we have a track, fetch duration from Web API /tracks (doesn't require active player)
    if (track?.uri && durationSec <= 0 && token) {
      try {
        const id = track.uri.replace(/^spotify:track:/, '');
        if (id) {
          const tr = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (tr.ok) {
            const trackData = (await tr.json()) as { duration_ms?: number };
            if (trackData?.duration_ms) durationSec = trackData.duration_ms / 1000;
          }
        }
      } catch {
        // ignore
      }
    }

    setPlaybackState({
      trackName: track?.name ?? null,
      trackUri: track?.uri ?? null,
      artistNames: track?.artists?.map((a) => a.name).join(', ') ?? '',
      albumImageUrl,
      position: positionSec,
      duration: durationSec,
      paused: state.paused ?? true,
    });
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setReady(false);
      setDeviceId(null);
      setError(null);
      setPlaybackState(null);
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      return;
    }

    const stopObserving = observeSpotifyIframe();
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function initPlayer() {
      if (!window.Spotify || cancelled) return;

      const player = new window.Spotify.Player({
        name: 'Desktop Robot',
        getOAuthToken: (cb) => {
          const getValid = getValidTokenRef.current;
          if (getValid) {
            getValid().then((t) => {
              if (t && !cancelled) cb(t);
            });
          } else {
            const t = tokenRef.current;
            if (t) cb(t);
          }
        },
        volume: 0.5,
      });

      player.addListener('ready', (state?: unknown) => {
        const { device_id } = (state ?? {}) as { device_id?: string };
        if (!cancelled && device_id) {
          setDeviceId(device_id);
          setReady(true);
          setError(null);
          updateStateFromPlayer();
          fixSpotifyIframeAudio();
          player.setVolume(0.5);
          // Retry fix - iframe may appear after ready; also ensures audio works in Tauri/WebView
          setTimeout(() => fixSpotifyIframeAudio(), 300);
          setTimeout(() => {
            fixSpotifyIframeAudio();
            player.setVolume(0.5);
          }, 800);
        }
      });

      player.addListener('not_ready', () => {
        if (!cancelled) setDeviceId(null);
      });

      player.addListener('player_state_changed', () => {
        if (!cancelled) {
          fixSpotifyIframeAudio();
          updateStateFromPlayer();
        }
      });

      player.addListener('autoplay_failed', () => {
        if (!cancelled) setAutoplayBlocked(true);
      });

      player.addListener('initialization_error', (state?: unknown) => {
        if (!cancelled) setError((state as { message?: string })?.message ?? 'Unknown error');
      });

      player.addListener('authentication_error', (state?: unknown) => {
        if (!cancelled) {
          const msg = (state as { message?: string })?.message ?? 'Auth error';
          setError(msg);
          onAuthErrorRef.current?.();
        }
      });

      player.addListener('playback_error', (state?: unknown) => {
        if (cancelled) return;
        const msg = (state as { message?: string })?.message ?? 'Playback error';
        if (/no list was loaded/i.test(msg)) return;
        setError(msg);
      });

      player.connect();
      playerRef.current = player;

      pollInterval = setInterval(() => {
        if (!cancelled && playerRef.current) updateStateFromPlayer();
      }, 1000);
    }

    if (window.Spotify) {
      initPlayer();
      return () => {
        cancelled = true;
        stopObserving();
        if (pollInterval) clearInterval(pollInterval);
        playerRef.current?.disconnect();
        playerRef.current = null;
      };
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!cancelled) initPlayer();
    };

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      stopObserving();
      if (pollInterval) clearInterval(pollInterval);
      script.remove();
      window.onSpotifyWebPlaybackSDKReady = undefined;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [accessToken, updateStateFromPlayer, reconnectTrigger]);

  const reconnect = useCallback(() => {
    setError(null);
    setAutoplayBlocked(false);
    setReady(false);
    setDeviceId(null);
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    setReconnectTrigger((t) => t + 1);
  }, []);

  const callActivateElement = useCallback(() => {
    try {
      fixSpotifyIframeAudio();
      playerRef.current?.activateElement?.();
      setAutoplayBlocked(false);
    } catch {
      // ignore
    }
  }, []);

  const play = useCallback(async (uriOrUris: string | string[]): Promise<boolean> => {
    callActivateElement();
    const player = playerRef.current;
    const devId = deviceId;
    if (!player || !devId) return false;

    setError(null);

    const uris = Array.isArray(uriOrUris) ? uriOrUris : [uriOrUris];
    if (uris.length === 0) return false;

    const getToken = getValidTokenRef.current;
    const tokenToUse = getToken ? await getToken() : tokenRef.current;
    if (!tokenToUse) return false;

    let lastPlayError = '';

    const doPlay = async (token: string, urisToPlay: string[], useDeviceId: boolean): Promise<boolean> => {
      const url = useDeviceId
        ? `https://api.spotify.com/v1/me/player/play?device_id=${devId}`
        : 'https://api.spotify.com/v1/me/player/play';
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: urisToPlay, position_ms: 0 }),
      });
      if (res.ok) {
        await updateStateFromPlayer();
        return true;
      }
      const errBody = await res.text();
      let errMsg = `Playback failed (${res.status})`;
      try {
        const j = JSON.parse(errBody);
        if (j?.error?.message) errMsg = j.error.message;
      } catch {
        if (errBody) errMsg = errBody.slice(0, 200);
      }
      lastPlayError = errMsg;
      if (res.status === 404) {
        const noDevice = /no active device|device not found/i.test(errBody);
        if (noDevice) return false;
      }
      if (res.status === 403) {
        setError(null);
        return false;
      }
      setError(errMsg);
      return true;
    };

    const transferPlayback = async (token: string, withPlay: boolean): Promise<boolean> => {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_ids: [devId], play: withPlay }),
      });
      return res.ok;
    };

    try {
      fixSpotifyIframeAudio();
      for (let i = 0; i < 12; i++) {
        const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        });
        if (devicesRes.ok) {
          const data = (await devicesRes.json()) as { devices?: { id: string }[] };
          if ((data.devices ?? []).some((d) => d.id === devId)) break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      await transferPlayback(tokenToUse, false);
      await new Promise((r) => setTimeout(r, 600));
      const cooldownMs = 800;
      const elapsed = Date.now() - lastPlayAtRef.current;
      if (lastPlayAtRef.current > 0 && elapsed < cooldownMs) {
        await new Promise((r) => setTimeout(r, cooldownMs - elapsed));
      }
      lastPlayAtRef.current = Date.now();
      let ok = await doPlay(tokenToUse, uris, true);
      for (let retry = 0; !ok && retry < 5; retry++) {
        await new Promise((r) => setTimeout(r, 600));
        await transferPlayback(tokenToUse, retry % 2 === 0);
        await new Promise((r) => setTimeout(r, 700));
        ok = await doPlay(tokenToUse, uris, true);
        if (!ok && uris.length > 1) {
          ok = await doPlay(tokenToUse, [uris[0]], true);
        }
        if (!ok && /404|no active device|device not found/i.test(lastPlayError)) {
          ok = await doPlay(tokenToUse, uris, false);
        }
      }
      // Final attempt: transfer with play=true to wake device, then play
      if (!ok) {
        await transferPlayback(tokenToUse, true);
        await new Promise((r) => setTimeout(r, 1200));
        ok = await doPlay(tokenToUse, uris, true);
      }
      if (!ok) {
        const detail = lastPlayError ? ` (${lastPlayError})` : '';
        setError(`Playback could not start${detail}. Try refreshing the page and reconnecting Spotify.`);
      }
      if (ok) fixSpotifyIframeAudio();
      await updateStateFromPlayer();
      if (ok) {
        const resumeViaApi = async () => {
          await new Promise((r) => setTimeout(r, 400));
          try {
            const rres = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${tokenToUse}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            });
            if (rres.ok) await updateStateFromPlayer();
          } catch {
            // ignore
          }
        };
        resumeViaApi();
      }
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [deviceId, updateStateFromPlayer, callActivateElement]);

  /** Pause playback. Prefer SDK pause (more reliable for Web Playback SDK device); fall back to Web API. */
  const pause = useCallback(async () => {
    const player = playerRef.current;
    const devId = deviceId;
    const token = getValidTokenRef.current ? await getValidTokenRef.current() : tokenRef.current;

    // Try SDK pause first - most reliable when playing via Web Playback SDK
    if (player) {
      try {
        await player.pause();
        await updateStateFromPlayer();
        return;
      } catch (e) {
        console.warn('[Spotify] SDK pause failed, trying Web API:', e);
      }
    }

    // Fall back to Web API (omit device_id to pause active device)
    if (token) {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          await updateStateFromPlayer();
          return;
        }
        const errBody = await res.text();
        console.warn('[Spotify] Web API pause failed:', res.status, errBody);
        if (devId) {
          const res2 = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${devId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res2.ok) {
            await updateStateFromPlayer();
            return;
          }
        }
      } catch (e) {
        console.warn('[Spotify] Web API pause error:', e);
      }
    }
    await updateStateFromPlayer();
  }, [deviceId, updateStateFromPlayer]);

  const resume = useCallback(async () => {
    callActivateElement();
    const devId = deviceId;
    const token = getValidTokenRef.current ? await getValidTokenRef.current() : tokenRef.current;
    if (devId && token) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          await updateStateFromPlayer();
          return;
        }
      } catch {
        // fall through to SDK
      }
    }
    await playerRef.current?.resume();
    await updateStateFromPlayer();
  }, [deviceId, updateStateFromPlayer]);

  const togglePlay = useCallback(async () => {
    const paused = playbackState?.paused ?? true;
    if (paused) await resume();
    else await pause();
  }, [playbackState?.paused, pause, resume]);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.setVolume(Math.max(0, Math.min(1, volume)));
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    const devId = deviceId;
    const token = getValidTokenRef.current ? await getValidTokenRef.current() : tokenRef.current;
    if (devId && token) {
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${devId}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          await updateStateFromPlayer();
          return;
        }
      } catch {
        // fall through to SDK
      }
    }
    await playerRef.current?.seek(positionMs);
    await updateStateFromPlayer();
  }, [deviceId, updateStateFromPlayer]);

  const skipNext = useCallback(async () => {
    const token = tokenRef.current;
    const devId = deviceId;
    if (!token || !devId) return;
    setError(null);
    try {
      await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${devId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await updateStateFromPlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [deviceId, updateStateFromPlayer]);

  const skipPrevious = useCallback(async () => {
    const token = tokenRef.current;
    const devId = deviceId;
    if (!token || !devId) return;
    setError(null);
    try {
      await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${devId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await updateStateFromPlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [deviceId, updateStateFromPlayer]);

  return {
    ready,
    deviceId,
    error,
    playbackState,
    autoplayBlocked,
    play,
    pause,
    resume,
    togglePlay,
    setVolume,
    seek,
    skipNext,
    skipPrevious,
    reconnect,
    activateElement: callActivateElement,
  };
}
