/**
 * Plays backing track audio with seamless loop and short crossfade.
 * Uses Web Audio API for precise crossfade timing.
 */

import { useCallback, useRef, useState } from 'react';

const CROSSFADE_MS = 800;

export interface UseBackingTrackPlaybackResult {
  isPlaying: boolean;
  error: string | null;
  play: (audioArrayBuffer: ArrayBuffer) => Promise<void>;
  stop: () => void;
}

export function useBackingTrackPlayback(): UseBackingTrackPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentGainRef = useRef<GainNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppedRef = useRef(false);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    const t = loopTimeoutRef.current;
    if (t) {
      clearTimeout(t);
      loopTimeoutRef.current = null;
    }
    try {
      currentSourceRef.current?.stop();
      currentSourceRef.current = null;
      currentGainRef.current = null;
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close();
      }
      audioContextRef.current = null;
    } catch {
      // ignore
    }
    setIsPlaying(false);
    setError(null);
  }, []);

  const play = useCallback(async (audioArrayBuffer: ArrayBuffer) => {
    stop();
    setError(null);
    isStoppedRef.current = false;

    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = await ctx.decodeAudioData(audioArrayBuffer.slice(0));
      const durationSec = buffer.duration;
      const crossfadeSec = CROSSFADE_MS / 1000;
      const startNextInSec = Math.max(0, durationSec - crossfadeSec);

      const startNextLoop = () => {
        if (isStoppedRef.current || !audioContextRef.current) return;

        const startTime = ctx.currentTime;
        const prevSource = currentSourceRef.current;
        const prevGain = currentGainRef.current;

        const newSource = ctx.createBufferSource();
        newSource.buffer = buffer;
        const newGain = ctx.createGain();
        newGain.gain.setValueAtTime(0, startTime);
        newGain.gain.linearRampToValueAtTime(1, startTime + crossfadeSec);
        newSource.connect(newGain);
        newGain.connect(ctx.destination);

        newSource.start(startTime);
        currentSourceRef.current = newSource;
        currentGainRef.current = newGain;

        if (prevSource && prevGain) {
          prevGain.gain.setValueAtTime(1, startTime);
          prevGain.gain.linearRampToValueAtTime(0, startTime + crossfadeSec);
          try {
            prevSource.stop(startTime + crossfadeSec);
          } catch {
            // already stopped
          }
        }

        loopTimeoutRef.current = setTimeout(() => {
          loopTimeoutRef.current = null;
          startNextLoop();
        }, startNextInSec * 1000);
      };

      const firstGain = ctx.createGain();
      firstGain.gain.setValueAtTime(1, ctx.currentTime);
      firstGain.connect(ctx.destination);
      const firstSource = ctx.createBufferSource();
      firstSource.buffer = buffer;
      firstSource.connect(firstGain);
      firstSource.start(ctx.currentTime);
      currentSourceRef.current = firstSource;
      currentGainRef.current = firstGain;

      loopTimeoutRef.current = setTimeout(() => {
        loopTimeoutRef.current = null;
        startNextLoop();
      }, startNextInSec * 1000);

      setIsPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsPlaying(false);
      stop();
    }
  }, [stop]);

  return { isPlaying, error, play, stop };
}
