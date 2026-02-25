/**
 * Spotify playback via the backend iframe (where Realtime AI audio works).
 * Uses postMessage to send commands and receives playback state from the backend.
 * Use this instead of useSpotifyPlayer when the backend iframe is loaded - same
 * document context that successfully plays Realtime AI audio.
 */
import { useCallback, useEffect, useState } from 'react';
import type { PlaybackState } from './useSpotifyPlayer';

export interface UseSpotifyViaBackendOptions {
  /** Send message to backend iframe. Called with { type: 'spotify_*', ... } */
  sendToIframe: (msg: object) => void;
  /** Whether the backend iframe is loaded and we can send messages */
  isIframeReady: boolean;
}

export interface UseSpotifyViaBackendResult {
  ready: boolean;
  deviceId: string | null;
  error: string | null;
  playbackState: PlaybackState | null;
  autoplayBlocked: boolean;
  play: (uriOrUris: string | string[]) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  activateElement: () => void;
}

const EVENT_STATE = 'spotify-backend-playback-state';
const EVENT_READY = 'spotify-backend-ready';

export function useSpotifyViaBackend({
  sendToIframe,
  isIframeReady,
}: UseSpotifyViaBackendOptions): UseSpotifyViaBackendResult {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);

  useEffect(() => {
    const onState = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d === 'object') {
        setPlaybackState({
          trackName: d.trackName ?? null,
          trackUri: d.trackUri ?? null,
          artistNames: d.artistNames ?? '',
          albumImageUrl: d.albumImageUrl ?? null,
          position: Number(d.position) || 0,
          duration: Number(d.duration) || 0,
          paused: Boolean(d.paused),
        });
      }
    };
    const onReady = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.deviceId) {
        setDeviceId(d.deviceId);
        setReady(true);
        setError(null);
      }
    };
    window.addEventListener(EVENT_STATE, onState);
    window.addEventListener(EVENT_READY, onReady);
    return () => {
      window.removeEventListener(EVENT_STATE, onState);
      window.removeEventListener(EVENT_READY, onReady);
    };
  }, []);

  const play = useCallback(
    async (uriOrUris: string | string[]): Promise<boolean> => {
      if (!isIframeReady || !sendToIframe) return false;
      const uris = Array.isArray(uriOrUris) ? uriOrUris : [uriOrUris];
      const uri = uris[0];
      const queueUris = uris.length > 1 ? uris.slice(1) : undefined;
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('spotify_play_result', handler);
          clearTimeout(t);
          resolve(ok);
        };
        const handler = (e: Event) => {
          const d = (e as CustomEvent).detail;
          finish(Boolean(d?.ok));
        };
        window.addEventListener('spotify_play_result', handler);
        sendToIframe({ type: 'spotify_play', uri, queueUris });
        const t = setTimeout(() => finish(false), 10000);
      });
    },
    [isIframeReady, sendToIframe]
  );

  const pause = useCallback(async () => {
    if (isIframeReady) sendToIframe({ type: 'spotify_pause' });
  }, [isIframeReady, sendToIframe]);

  const resume = useCallback(async () => {
    if (isIframeReady) sendToIframe({ type: 'spotify_resume' });
  }, [isIframeReady, sendToIframe]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (isIframeReady) sendToIframe({ type: 'spotify_seek', positionMs });
    },
    [isIframeReady, sendToIframe]
  );

  const activateElement = useCallback(() => {
    // Backend calls activateElement internally before play/resume
  }, []);

  return {
    ready,
    deviceId,
    error,
    playbackState,
    autoplayBlocked: false,
    play,
    pause,
    resume,
    seek,
    activateElement,
  };
}

/** Dispatch these from RealtimeBridge when receiving postMessage from backend. */
export function dispatchSpotifyBackendState(state: Partial<PlaybackState>) {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, { detail: state }));
}
export function dispatchSpotifyBackendReady(deviceId: string) {
  window.dispatchEvent(new CustomEvent(EVENT_READY, { detail: { deviceId } }));
}
