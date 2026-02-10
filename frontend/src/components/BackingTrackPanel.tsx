/**
 * Backing Track panel: Command button → STT (frontend only) → parse → ElevenLabs → play with loop.
 * While playing, parent must disable AI backend mic; on stop, parent restores previous mic state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseBackingTrackCommand,
  generateBackingTrack,
  useBackingTrackPlayback,
  saveLoop,
  loadLoop,
  listSavedLoops,
  type SavedLoopMeta,
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

export type BackingTrackStatus = 'idle' | 'listening' | 'generating' | 'playing' | 'paused' | 'error';

export interface BackingTrackHandlers {
  runCommand: (text: string) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  save: () => void;
}

interface BackingTrackPanelProps {
  /** Called when playback starts: parent should set AI mic to disabled. */
  onPlayingStart: () => void;
  /** Called when playback stops: parent should restore previous AI mic state. */
  onPlayingStop: () => void;
  /** API key for ElevenLabs (e.g. from VITE_ELEVENLABS_API_KEY). Empty = show config hint. */
  elevenLabsApiKey: string;
  /** Optional: called with handlers so parent can trigger actions (e.g. voice commands). */
  onHandlersReady?: (handlers: BackingTrackHandlers) => void;
  /** Optional: called when ElevenLabs music generation starts (face can show thinking). */
  onGenerationStart?: () => void;
  /** Optional: called when ElevenLabs music generation ends (success or error). */
  onGenerationEnd?: () => void;
}

export default function BackingTrackPanel({
  onPlayingStart,
  onPlayingStop,
  elevenLabsApiKey,
  onHandlersReady,
  onGenerationStart,
  onGenerationEnd,
}: BackingTrackPanelProps) {
  const [status, setStatus] = useState<BackingTrackStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [savedLoops, setSavedLoops] = useState<SavedLoopMeta[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [hasTrackToSave, setHasTrackToSave] = useState(false);
  const [importing, setImporting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const currentBufferRef = useRef<ArrayBuffer | null>(null);
  const currentSpecRef = useRef<{ chords?: string[]; bpm?: number; style?: string } | null>(null);

  const { error: playbackError, isPaused, play, stop, pause, resume } = useBackingTrackPlayback();

  const refreshSavedLoops = useCallback(async () => {
    try {
      const list = await listSavedLoops();
      setSavedLoops(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSavedLoops();
  }, [refreshSavedLoops]);

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
      onGenerationStart?.();
      try {
        const audioBuffer = await generateBackingTrack(spec, elevenLabsApiKey.trim());
        currentBufferRef.current = audioBuffer;
        currentSpecRef.current = spec;
        setHasTrackToSave(true);
        onPlayingStart();
        await play(audioBuffer);
        setStatus('playing');
        setStatusMessage('Playing (looped). Pause or Stop.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setStatusMessage(msg);
        onPlayingStop();
      } finally {
        onGenerationEnd?.();
      }
    },
    [elevenLabsApiKey, play, onPlayingStart, onPlayingStop, onGenerationStart, onGenerationEnd]
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
    // Keep currentBufferRef/currentSpecRef so user can still save after stopping
  }, [stop, onPlayingStop]);

  const handleSave = useCallback(async () => {
    const buffer = currentBufferRef.current;
    if (!buffer) {
      setStatusMessage('No track to save. Generate or load one first.');
      return;
    }
    try {
      await saveLoop(buffer, {
        spec: currentSpecRef.current ?? undefined,
      });
      await refreshSavedLoops();
      setStatusMessage('Saved to library.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Save failed: ${msg}`);
    }
  }, [refreshSavedLoops]);

  const handleLoadSaved = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const saved = await loadLoop(id);
        if (!saved?.audio) {
          setStatusMessage('Could not load saved loop.');
          return;
        }
        currentBufferRef.current = saved.audio;
        currentSpecRef.current = saved.spec ?? null;
        setHasTrackToSave(true);
        onPlayingStart();
        await play(saved.audio);
        setStatus('playing');
        setStatusMessage(`Playing: ${saved.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Load failed: ${msg}`);
      }
    },
    [play, onPlayingStart]
  );

  const handlePlaySelectedSaved = useCallback(() => {
    if (selectedSavedId) handleLoadSaved(selectedSavedId);
  }, [selectedSavedId, handleLoadSaved]);

  const handleImportFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setImporting(true);
      let ok = 0;
      let fail = 0;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            const buffer = await file.arrayBuffer();
            const name = file.name.replace(/\.[^.]+$/, '') || file.name;
            await saveLoop(buffer, { name });
            ok++;
          } catch {
            fail++;
          }
        }
        await refreshSavedLoops();
        setStatusMessage(
          ok > 0 ? `Imported ${ok} track(s)${fail > 0 ? `; ${fail} failed` : ''}.` : `Import failed for ${fail} file(s).`
        );
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    },
    [refreshSavedLoops]
  );

  const triggerImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handlePause = useCallback(() => {
    pause();
    setStatus('paused');
    setStatusMessage('Paused. Click Play to resume.');
    // Do not call onPlayingStop — backing track mode stays active until full stop or idle
  }, [pause]);

  const handleResume = useCallback(() => {
    resume();
    setStatus('playing');
    setStatusMessage('Playing (looped). Pause or Stop.');
    onPlayingStart();
  }, [resume, onPlayingStart]);

  useEffect(() => {
    if (playbackError) {
      setStatus('error');
      setStatusMessage(playbackError);
    }
  }, [playbackError]);

  useEffect(() => {
    onHandlersReady?.({
      runCommand,
      stop: handleStop,
      pause: handlePause,
      resume: handleResume,
      save: handleSave,
    });
  }, [onHandlersReady, runCommand, handleStop, handlePause, handleResume, handleSave]);

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
    if (status === 'paused') {
      handleResume();
      return;
    }
    startListening();
  }, [status, transcript, startListening, runCommand, handleStop, handleResume]);

  const buttonLabel =
    status === 'listening'
      ? 'Processing…'
      : status === 'playing'
        ? 'Stop'
        : status === 'paused'
          ? 'Resume'
          : 'Command';

  return (
    <div className="backing-track-panel">
      <div className="backing-track-panel-header">
        <span className="icon">🎵</span>
        <span>Backing Track</span>
      </div>
      <div className="backing-track-panel-body">
        <p className="backing-track-hint">
          Full backing (4 chord min, bass, pads, percussion). No solos. Seamless loop, 2–8 bars from BPM. Loops until Stop. No mic sent to AI.
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
          {(status === 'playing' || status === 'paused') && (
            <>
              <button
                type="button"
                className="backing-track-pause-button"
                onClick={status === 'playing' ? handlePause : handleResume}
              >
                {status === 'playing' ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className="backing-track-stop-button"
                onClick={handleStop}
              >
                Stop
              </button>
            </>
          )}
          {hasTrackToSave && (
            <button
              type="button"
              className="backing-track-save-button"
              onClick={handleSave}
            >
              Save
            </button>
          )}
        </div>

        <div className="backing-track-saved-section">
          <div className="backing-track-saved-header">
            <label htmlFor="backing-track-saved" className="backing-track-label">
              Saved loops
            </label>
            <input
              ref={importInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac"
              multiple
              className="backing-track-import-input"
              onChange={handleImportFiles}
              aria-label="Import audio files"
            />
            <button
              type="button"
              className="backing-track-import-button"
              onClick={triggerImport}
              disabled={importing || status === 'generating'}
            >
              {importing ? 'Importing…' : 'Import file(s)'}
            </button>
          </div>
          <p className="backing-track-import-hint">
            Add pre-downloaded backing tracks (e.g. from TrueFire): use Import file(s) and choose the audio files from your computer.
          </p>
          {savedLoops.length > 0 ? (
            <div className="backing-track-saved-row">
              <select
                id="backing-track-saved"
                className="backing-track-saved-select"
                value={selectedSavedId}
                onChange={(e) => setSelectedSavedId(e.target.value)}
              >
                <option value="">— Select a loop —</option>
                {savedLoops.map((loop) => (
                  <option key={loop.id} value={loop.id}>
                    {loop.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="backing-track-play-saved-button"
                onClick={handlePlaySelectedSaved}
                disabled={!selectedSavedId || status === 'generating'}
              >
                Play
              </button>
            </div>
          ) : null}
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
