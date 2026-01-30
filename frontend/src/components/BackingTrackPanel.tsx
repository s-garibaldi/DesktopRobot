/**
 * Backing Track panel: Command button → STT (frontend only) → parse → ElevenLabs → play with loop.
 * While playing, parent must disable AI backend mic; on stop, parent restores previous mic state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseBackingTrackCommand,
  generateBackingTrack,
  useBackingTrackPlayback,
} from '../backingTrack';
import './BackingTrackPanel.css';

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export type BackingTrackStatus = 'idle' | 'listening' | 'generating' | 'playing' | 'error';

interface BackingTrackPanelProps {
  /** Called when playback starts: parent should set AI mic to disabled. */
  onPlayingStart: () => void;
  /** Called when playback stops: parent should restore previous AI mic state. */
  onPlayingStop: () => void;
  /** API key for ElevenLabs (e.g. from VITE_ELEVENLABS_API_KEY). Empty = show config hint. */
  elevenLabsApiKey: string;
}

export default function BackingTrackPanel({
  onPlayingStart,
  onPlayingStop,
  elevenLabsApiKey,
}: BackingTrackPanelProps) {
  const [status, setStatus] = useState<BackingTrackStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const { error: playbackError, play, stop } = useBackingTrackPlayback();

  const runCommand = useCallback(
    async (text: string) => {
      if (!elevenLabsApiKey.trim()) {
        setStatus('error');
        setStatusMessage('Set VITE_ELEVENLABS_API_KEY in .env to use backing tracks.');
        return;
      }
      const spec = parseBackingTrackCommand(text);
      setStatus('generating');
      setStatusMessage(`Generating: ${spec.chords?.join(' ') || 'chords'} ${spec.bpm} bpm ${spec.style}…`);
      try {
        const audioBuffer = await generateBackingTrack(spec, elevenLabsApiKey.trim());
        onPlayingStart();
        await play(audioBuffer);
        setStatus('playing');
        setStatusMessage('Playing (looped). Click Stop to stop.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setStatusMessage(msg);
        onPlayingStop();
      }
    },
    [elevenLabsApiKey, play, onPlayingStart, onPlayingStop]
  );

  const finalTranscriptRef = useRef('');

  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? window : null;
    const Ctor =
      win &&
      ((win as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
        (win as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition);
    if (!Ctor) {
      setStatus('error');
      setStatusMessage('Speech recognition not supported in this browser.');
      return;
    }
    finalTranscriptRef.current = '';
    setTranscript('');
    setStatusMessage('Listening… say your backing track command.');
    setStatus('listening');
    const recognition = new Ctor() as SpeechRecognitionInstance;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      let text = '';
      for (let i = 0; i < results.length; i++) {
        text += results[i][0]?.transcript ?? '';
      }
      finalTranscriptRef.current = text;
      setTranscript(text);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus('idle');
      const text = finalTranscriptRef.current.trim();
      if (text) runCommand(text);
    };
    recognition.onerror = (e: { error: string }) => {
      recognitionRef.current = null;
      setStatus('idle');
      if (e.error !== 'aborted') setStatusMessage(`Recognition: ${e.error}`);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setStatus('idle');
      setStatusMessage('Could not start speech recognition.');
    }
  }, [runCommand]);

  const handleStop = useCallback(() => {
    stop();
    setStatus('idle');
    setStatusMessage('');
    onPlayingStop();
  }, [stop, onPlayingStop]);

  useEffect(() => {
    if (playbackError) {
      setStatus('error');
      setStatusMessage(playbackError);
    }
  }, [playbackError]);

  const handleCommandClick = useCallback(() => {
    if (status === 'listening') {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      setStatus('idle');
      if (transcript.trim()) runCommand(transcript.trim());
      return;
    }
    if (status === 'playing') {
      handleStop();
      return;
    }
    startListening();
  }, [status, transcript, startListening, runCommand, handleStop]);

  const buttonLabel =
    status === 'listening'
      ? 'Processing…'
      : status === 'playing'
        ? 'Stop'
        : 'Command';

  return (
    <div className="backing-track-panel">
      <div className="backing-track-panel-header">
        <span className="icon">🎵</span>
        <span>Backing Track</span>
      </div>
      <div className="backing-track-panel-body">
        <p className="backing-track-hint">
          Output is one measure (4 beats), full backing (chords, bass, pads, percussion). No solos. Loops until Stop. No mic sent to AI.
        </p>

        <div className="backing-track-text-input-row">
          <label htmlFor="backing-track-request" className="backing-track-label">
            Type request (for testing)
          </label>
          <input
            id="backing-track-request"
            type="text"
            className="backing-track-text-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (textInput.trim()) runCommand(textInput.trim());
              }
            }}
            disabled={status === 'generating'}
          />
          <button
            type="button"
            className="backing-track-generate-button"
            onClick={() => textInput.trim() && runCommand(textInput.trim())}
            disabled={status === 'generating' || !textInput.trim()}
          >
            Generate
          </button>
        </div>

        <div className="backing-track-command-row">
          <span className="backing-track-voice-label">Or use voice:</span>
          <button
            type="button"
            className={`backing-track-command-button ${status === 'listening' ? 'recording' : ''}`}
            onClick={handleCommandClick}
            disabled={status === 'generating'}
          >
            {buttonLabel}
          </button>
          {status === 'playing' && (
            <button
              type="button"
              className="backing-track-stop-button"
              onClick={handleStop}
            >
              Stop
            </button>
          )}
        </div>
        {transcript && status === 'listening' && (
          <p className="backing-track-status listening">Heard: {transcript}</p>
        )}
        <p className={`backing-track-status ${status}`} role="status">
          {statusMessage}
        </p>
      </div>
    </div>
  );
}
