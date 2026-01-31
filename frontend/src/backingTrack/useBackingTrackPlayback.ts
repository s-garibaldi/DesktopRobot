/**
 * Plays backing track audio with seamless looping.
 * Uses Web Audio API's native loop (sample-accurate, gapless).
 * Supports pause and resume.
 */

import { useCallback, useRef, useState } from 'react';

export interface UseBackingTrackPlaybackResult {
  isPlaying: boolean;
  isPaused: boolean;
  error: string | null;
  play: (audioArrayBuffer: ArrayBuffer) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export function useBackingTrackPlayback(): UseBackingTrackPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentSourceStartTimeRef = useRef<number>(0);
  const isStoppedRef = useRef(false);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    try {
      currentSourceRef.current?.stop();
      currentSourceRef.current = null;
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close();
      }
      audioContextRef.current = null;
    } catch {
      // ignore
    }
    bufferRef.current = null;
    pausedAtRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setError(null);
  }, []);

  const pause = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer || isStoppedRef.current) return;

    const pos = Math.min(
      buffer.duration - 0.001,
      Math.max(0, ctx.currentTime - currentSourceStartTimeRef.current)
    );

    try {
      currentSourceRef.current?.stop();
      currentSourceRef.current = null;
    } catch {
      // already stopped
    }

    pausedAtRef.current = pos;
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const startPlayback = useCallback(
    (ctx: AudioContext, buffer: AudioBuffer, offset = 0) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(ctx.destination);
      source.start(ctx.currentTime, offset);
      currentSourceRef.current = source;
      currentSourceStartTimeRef.current = ctx.currentTime;
    },
    []
  );

  const resume = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = bufferRef.current;
    const pausedAt = pausedAtRef.current;
    if (!ctx || !buffer || pausedAt == null) return;

    isStoppedRef.current = false;
    startPlayback(ctx, buffer, pausedAt);
    pausedAtRef.current = null;
    setIsPlaying(true);
    setIsPaused(false);
  }, [startPlayback]);

  const play = useCallback(
    async (audioArrayBuffer: ArrayBuffer) => {
      stop();
      setError(null);
      isStoppedRef.current = false;

      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const buffer = await ctx.decodeAudioData(audioArrayBuffer.slice(0));
        bufferRef.current = buffer;

        startPlayback(ctx, buffer);
        setIsPlaying(true);
        setIsPaused(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsPlaying(false);
        stop();
      }
    },
    [stop, startPlayback]
  );

  return { isPlaying, isPaused, error, play, stop, pause, resume };
}
