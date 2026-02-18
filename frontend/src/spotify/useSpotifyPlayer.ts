import { useCallback, useEffect, useRef, useState } from 'react';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

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
  _options: { getOAuthToken: (cb: (token: string) => void) => void };
}

export interface UseSpotifyPlayerResult {
  ready: boolean;
  deviceId: string | null;
  error: string | null;
  playbackState: PlaybackState | null;
  play: (uriOrUris: string | string[]) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  setVolume: (volume: number) => void;
  seek: (positionMs: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
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
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const onAuthErrorRef = useRef(onAuthenticationError);
  onAuthErrorRef.current = onAuthenticationError;
  const getValidTokenRef = useRef(getValidToken);
  getValidTokenRef.current = getValidToken;

  const updateStateFromPlayer = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    const state = await player.getCurrentState();
    if (!state) {
      setPlaybackState(emptyPlaybackState());
      return;
    }
    const track = state.track_window?.current_track as { name?: string; uri?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } } | undefined;
    const albumImages = track?.album?.images;
    const albumImageUrl = Array.isArray(albumImages) && albumImages.length > 0 ? albumImages[0].url : null;
    setPlaybackState({
      trackName: track?.name ?? null,
      trackUri: track?.uri ?? null,
      artistNames: track?.artists?.map((a) => a.name).join(', ') ?? '',
      albumImageUrl,
      position: state.position ?? 0,
      duration: state.duration ?? 0,
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

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        if (!cancelled) {
          setDeviceId(device_id);
          setReady(true);
          setError(null);
          updateStateFromPlayer();
        }
      });

      player.addListener('not_ready', () => {
        if (!cancelled) setDeviceId(null);
      });

      player.addListener('player_state_changed', () => {
        if (!cancelled) updateStateFromPlayer();
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        if (!cancelled) setError(message);
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        if (!cancelled) {
          setError(message);
          onAuthErrorRef.current?.();
        }
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        if (!cancelled) setError(message);
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
      if (pollInterval) clearInterval(pollInterval);
      script.remove();
      window.onSpotifyWebPlaybackSDKReady = undefined;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [accessToken, updateStateFromPlayer]);

  const play = useCallback(async (uriOrUris: string | string[]): Promise<boolean> => {
    const player = playerRef.current;
    const devId = deviceId;
    if (!player || !devId) return false;

    setError(null);

    const uris = Array.isArray(uriOrUris) ? uriOrUris : [uriOrUris];
    if (uris.length === 0) return false;

    const getToken = getValidTokenRef.current;
    const tokenToUse = getToken ? await getToken() : tokenRef.current;
    if (!tokenToUse) return false;

    const doPlay = async (token: string): Promise<boolean> => {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris, position_ms: 0 }),
      });
      if (res.ok) {
        await updateStateFromPlayer();
        return true;
      }
      if (res.status === 404) {
        const text = await res.text();
        const noDevice = /no active device|device not found/i.test(text);
        if (noDevice) return false;
      }
      const errBody = await res.text();
      let errMsg = `Playback failed (${res.status})`;
      try {
        const j = JSON.parse(errBody);
        if (j?.error?.message) errMsg = j.error.message;
      } catch {
        if (errBody) errMsg = errBody.slice(0, 200);
      }
      setError(errMsg);
      return true;
    };

    const ensureDeviceListed = async (token: string): Promise<boolean> => {
      const maxAttempts = 25;
      const delayMs = 800;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { devices?: { id: string }[] };
        const devices = data.devices ?? [];
        if (devices.some((d) => d.id === devId)) return true;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return false;
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
      let listed = await ensureDeviceListed(tokenToUse);
      if (!listed) {
        await transferPlayback(tokenToUse, false);
        await new Promise((r) => setTimeout(r, 1500));
        for (let i = 0; i < 10; i++) {
          const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: { Authorization: `Bearer ${tokenToUse}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { devices?: { id: string }[] };
            if ((data.devices ?? []).some((d) => d.id === devId)) {
              listed = true;
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!listed) {
        setError('Device not ready yet. Wait a few seconds and try again, or refresh the page.');
        return false;
      }
      await transferPlayback(tokenToUse, true);
      await new Promise((r) => setTimeout(r, 600));
      let ok = await doPlay(tokenToUse);
      for (let retry = 0; !ok && retry < 3; retry++) {
        await new Promise((r) => setTimeout(r, 500));
        ok = await doPlay(tokenToUse);
      }
      if (!ok) {
        setError('Playback could not start. Wait a moment and try again, or refresh the page and reconnect Spotify.');
      }
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
  }, [deviceId, updateStateFromPlayer]);

  const pause = useCallback(async () => {
    await playerRef.current?.pause();
    await updateStateFromPlayer();
  }, [updateStateFromPlayer]);

  const resume = useCallback(async () => {
    await playerRef.current?.resume();
    await updateStateFromPlayer();
  }, [updateStateFromPlayer]);

  const togglePlay = useCallback(async () => {
    await playerRef.current?.togglePlay();
    await updateStateFromPlayer();
  }, [updateStateFromPlayer]);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.setVolume(Math.max(0, Math.min(1, volume)));
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    await playerRef.current?.seek(positionMs);
    await updateStateFromPlayer();
  }, [updateStateFromPlayer]);

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
    play,
    pause,
    resume,
    togglePlay,
    setVolume,
    seek,
    skipNext,
    skipPrevious,
  };
}
