import { useState, useCallback, useRef, useEffect } from 'react';

export type MicrophoneStatus =
  | 'idle'       // Not requested yet
  | 'requesting' // getUserMedia in progress
  | 'granted'    // Stream active
  | 'denied'     // Permission denied
  | 'error';    // Other error (no device, etc.)

export interface UseMicrophoneResult {
  /** Current microphone stream when status is 'granted'. Null otherwise. */
  stream: MediaStream | null;
  /** Current status. */
  status: MicrophoneStatus;
  /** Error message when status is 'denied' or 'error'. */
  error: string | null;
  /** Whether getUserMedia is supported in this environment. */
  isSupported: boolean;
  /** Request microphone access and start the stream. */
  requestAccess: () => Promise<void>;
  /** Stop all tracks and release the stream. */
  stop: () => void;
  /** Optional: current volume level 0–1 for UI (only when stream is active). */
  volumeLevel: number;
  /** Approximate dBFS (decibels relative to full scale), e.g. -60 (quiet) to 0 (loud). */
  volumeDb: number;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microphone permission was denied. Allow access in system settings and try again.';
    }
    if (err.name === 'NotFoundError') {
      return 'No microphone found. Connect a microphone and try again.';
    }
    if (err.name === 'NotReadableError') {
      return 'Microphone is in use by another app or could not be read.';
    }
    return err.message;
  }
  return 'Failed to access microphone.';
}

export function useMicrophone(): UseMicrophoneResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [volumeDb, setVolumeDb] = useState(-60);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const timeDomainRef = useRef<Uint8Array | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    timeDomainRef.current = null;
    setVolumeLevel(0);
    setVolumeDb(-60);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setStatus('idle');
    setError(null);
  }, [stream]);

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stream]);

  const requestAccess = useCallback(async () => {
    if (!isSupported) {
      setStatus('error');
      setError('Microphone is not supported in this environment.');
      return;
    }
    setStatus('requesting');
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      setStream(mediaStream);
      setStatus('granted');

      // Volume meter + dB: use AnalyserNode with time domain for RMS-based dB
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        const bufferLength = analyser.fftSize;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        timeDomainRef.current = new Uint8Array(bufferLength);

        const MIN_DB = -60; // floor for display (avoid -Infinity)

        const updateLevel = () => {
          if (!analyserRef.current || !dataArrayRef.current || !timeDomainRef.current) return;
          const analyserNode = analyserRef.current;
          analyserNode.getByteFrequencyData(
            dataArrayRef.current as unknown as Uint8Array<ArrayBuffer>
          );
          analyserNode.getByteTimeDomainData(
            timeDomainRef.current as unknown as Uint8Array<ArrayBuffer>
          );
          const freqSum = dataArrayRef.current.reduce((a, b) => a + b, 0);
          const freqAvg = freqSum / dataArrayRef.current.length;
          setVolumeLevel(Math.min(1, freqAvg / 128));
          // RMS from time domain (samples 0-255, 128 = silence) -> dBFS
          const timeDomain = timeDomainRef.current;
          let sumSq = 0;
          for (let i = 0; i < timeDomain.length; i++) {
            const n = (timeDomain[i] - 128) / 128;
            sumSq += n * n;
          }
          const rms = Math.sqrt(sumSq / timeDomain.length) || 0.001;
          const db = 20 * Math.log10(Math.max(rms, 0.001));
          setVolumeDb(Math.max(MIN_DB, Math.round(db)));
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch {
        // Volume meter is optional; ignore if AudioContext fails
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setStatus(err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') ? 'denied' : 'error');
    }
  }, [isSupported]);

  return {
    stream,
    status,
    error,
    isSupported,
    requestAccess,
    stop,
    volumeLevel,
    volumeDb,
  };
}
