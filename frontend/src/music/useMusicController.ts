/**
 * React hook that wires MusicController to Spotify playback.
 * Provides queue state and actions to UI components.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { musicController } from './MusicController';
import { handleMusicControllerEvent } from './events';
import type { MusicQueue, NowPlaying, PlaybackStatus, QueueItem } from './types';

export interface UseMusicControllerOptions {
  /** play(uri, queueUris?) returns Promise<boolean>; pass queueUris to load a list for auto-play */
  play: (uri: string, queueUris?: string[]) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  /** progressMs, durationMs, paused from Spotify - for UI only */
  playbackState?: {
    trackUri: string | null;
    position: number;
    duration: number;
    paused: boolean;
  } | null;
  /** Called when Spotify reports track ended */
  onTrackEnded?: () => void;
}

export function useMusicController(options: UseMusicControllerOptions) {
  const {
    play,
    pause,
    resume,
    seek,
    playbackState,
    onTrackEnded,
  } = options;

  const [queue, setQueue] = useState<MusicQueue>(() => musicController.getQueue());
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(() => musicController.getNowPlaying());
  const [status, setStatus] = useState<PlaybackStatus>(() => musicController.getPlaybackStatus());
  const lastTrackUriRef = useRef<string | null>(null);
  const trackEndedFiredForUriRef = useRef<string | null>(null);
  const uriNullDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const adapter = {
      playUri: async (uri: string, _positionMs?: number, queueUris?: string[]) =>
        play(uri, queueUris),
      pause,
      resume,
      seek,
    };
    musicController.setPlaybackAdapter(adapter);
    return () => musicController.setPlaybackAdapter(null);
  }, [play, pause, resume, seek]);

  useEffect(() => {
    const unsub = musicController.subscribe((event) => {
      switch (event.type) {
        case 'QUEUE_UPDATED':
          setQueue(event.queue);
          handleMusicControllerEvent(event);
          break;
        case 'NOW_PLAYING':
          setNowPlaying(event.nowPlaying ?? null);
          setStatus(event.status);
          handleMusicControllerEvent(event);
          break;
        case 'PLAYBACK_STATUS':
          setStatus(event.status);
          handleMusicControllerEvent(event);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, []);

  // Poll Spotify playback state for progress/duration UI (Spotify SDK returns seconds)
  // Use item.durationMs when Spotify returns 0 (connectivity/sync delay)
  useEffect(() => {
    const np = musicController.getNowPlaying();
    if (!playbackState?.trackUri && !np) return;
    const posMs = (playbackState?.position ?? 0) * 1000;
    let durMs = (playbackState?.duration ?? 0) * 1000;
    if (durMs <= 0 && np?.item.durationMs) durMs = np.item.durationMs;
    if (np) musicController.updateProgress(posMs, durMs);
  }, [playbackState?.trackUri, playbackState?.position, playbackState?.duration]);

  // Detect track ended and auto-advance to next in queue.
  // Two detection paths (Spotify SDK is inconsistent):
  // 1) trackUri goes from non-null to null (player stopped)
  // 2) position reached end of track (position >= duration - 0.5s) - only when uri matches our current track
  useEffect(() => {
    const uri = playbackState?.trackUri ?? null;
    const pos = playbackState?.position ?? 0;
    const dur = playbackState?.duration ?? 0;
    const currentTrackUri = musicController.getNowPlaying()?.item.uri ?? null;

    // Reset "fired" ref when we're on a different track (new song started)
    if (uri && uri !== trackEndedFiredForUriRef.current) {
      trackEndedFiredForUriRef.current = null;
    }

    const fireTrackEnded = () => {
      if (trackEndedFiredForUriRef.current === uri) return;
      trackEndedFiredForUriRef.current = uri ?? 'unknown';
      musicController.onTrackEnded();
      onTrackEnded?.();
    };

    // Path 1: uri went from non-null to null. Debounce: SDK briefly reports null during track switch.
    if (lastTrackUriRef.current && !uri) {
      lastTrackUriRef.current = null;
      if (uriNullDebounceRef.current) clearTimeout(uriNullDebounceRef.current);
      uriNullDebounceRef.current = setTimeout(() => {
        uriNullDebounceRef.current = null;
        fireTrackEnded();
      }, 600);
    } else {
      if (uri) {
        if (uriNullDebounceRef.current) {
          clearTimeout(uriNullDebounceRef.current);
          uriNullDebounceRef.current = null;
        }
      }
      lastTrackUriRef.current = uri;
    }

    // Path 2: position at/near end of track (fallback when SDK doesn't emit null)
    // Only fire when Spotify's uri matches our current track - avoids firing on stale data when starting a new song
    if (
      uri &&
      uri === currentTrackUri &&
      dur > 0 &&
      pos >= Math.max(0, dur - 0.5) &&
      !playbackState?.paused
    ) {
      fireTrackEnded();
    }
  }, [playbackState?.trackUri, playbackState?.position, playbackState?.duration, playbackState?.paused, onTrackEnded]);

  const addToQueue = useCallback((item: Parameters<typeof musicController.addToQueue>[0]) => {
    musicController.addToQueue(item);
  }, []);

  const addNext = useCallback((item: Parameters<typeof musicController.addNext>[0]) => {
    musicController.addNext(item);
  }, []);

  const removeAt = useCallback((index: number) => {
    musicController.removeAt(index);
  }, []);

  const move = useCallback((from: number, to: number) => {
    musicController.move(from, to);
  }, []);

  const clear = useCallback(() => {
    musicController.clear();
  }, []);

  const next = useCallback(() => musicController.next(), []);

  const previous = useCallback(() => musicController.previous(), []);

  const playIndex = useCallback((index: number) => musicController.playIndex(index), []);
  const playItem = useCallback((item: QueueItem) => musicController.playItem(item), []);

  const playUri = useCallback(
    (uri: string, item?: Partial<{ id: string; title: string; artist: string; albumArtUrl: string }>) =>
      musicController.playUri(uri, item),
    []
  );

  const addAndPlay = useCallback((items: Parameters<typeof musicController.addAndPlay>[0]) => {
    return musicController.addAndPlay(items);
  }, []);

  const addToQueueAndStartIfIdle = useCallback(
    (items: Parameters<typeof musicController.addToQueueAndStartIfIdle>[0]) => {
      return musicController.addToQueueAndStartIfIdle(items);
    },
    []
  );

  const togglePause = useCallback(async () => {
    if (status === 'playing') {
      await musicController.pause();
    } else if (status === 'paused' && nowPlaying) {
      await musicController.resume();
    }
  }, [status, nowPlaying]);

  const resumePlayback = useCallback(() => musicController.resume(), []);

  const seekTo = useCallback((positionMs: number) => {
    return musicController.seek(positionMs);
  }, []);

  return {
    queue,
    nowPlaying,
    status,
    addToQueue,
    addNext,
    removeAt,
    move,
    clear,
    next,
    previous,
    playIndex,
    playItem,
    playUri,
    addAndPlay,
    addToQueueAndStartIfIdle,
    togglePause,
    resume: resumePlayback,
    seekTo,
  };
}
