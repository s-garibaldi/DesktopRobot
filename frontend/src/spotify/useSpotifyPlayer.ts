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
  play: (uri: string) => Promise<void>;
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
    position: 0,
    duration: 0,
    paused: true,
  };
}

export function useSpotifyPlayer(accessToken: string | null): UseSpotifyPlayerResult {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const updateStateFromPlayer = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    const state = await player.getCurrentState();
    if (!state) {
      setPlaybackState(emptyPlaybackState());
      return;
    }
    const track = state.track_window?.current_track;
    setPlaybackState({
      trackName: track?.name ?? null,
      trackUri: track?.uri ?? null,
      artistNames: track?.artists?.map((a) => a.name).join(', ') ?? '',
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
          const t = tokenRef.current;
          if (t) cb(t);
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
        if (!cancelled) setError(message);
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

  const play = useCallback(async (uri: string) => {
    const player = playerRef.current;
    const devId = deviceId;
    const token = tokenRef.current;
    if (!player || !devId || !token) return;

    setError(null);
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri] }),
      });
      await updateStateFromPlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
