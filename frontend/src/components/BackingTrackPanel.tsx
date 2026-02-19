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

export interface ProjectTrack {
  id: string;
  name: string;
  source: 'project';
  key?: string | null;
  genre?: string | null;
  bpm?: number | null;
  scales?: string[] | null;
}

const KEYS = ['', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'];
const GENRES = ['', 'Blues', 'Rock', 'Jazz', 'Bossa Nova', 'Country', 'Folk', 'Funk', 'Reggae', 'Latin', 'Pop', 'R&B', 'Classical', 'Metal', 'Punk', 'Soul', 'Gospel', 'Bluegrass', 'World', 'Electronic', 'Other'];

interface BackingTrackPanelProps {
  /** Called when playback starts: parent should set AI mic to disabled. */
  onPlayingStart: () => void;
  /** Called when playback stops: parent should restore previous AI mic state. */
  onPlayingStop: () => void;
  /** API key for ElevenLabs (e.g. from VITE_ELEVENLABS_API_KEY). Empty = show config hint. */
  elevenLabsApiKey: string;
  /** Backend URL for upload/list/serve of project-stored backing tracks. */
  backendUrl: string;
  /** Optional: called with handlers so parent can trigger actions (e.g. voice commands). */
  onHandlersReady?: (handlers: BackingTrackHandlers) => void;
  /** Optional: called when ElevenLabs music generation starts (face can show thinking). */
  onGenerationStart?: () => void;
  /** Optional: called when ElevenLabs music generation ends (success or error). */
  onGenerationEnd?: () => void;
}

const PROJECT_PREFIX = 'project:';

export default function BackingTrackPanel({
  onPlayingStart,
  onPlayingStop,
  elevenLabsApiKey,
  backendUrl,
  onHandlersReady,
  onGenerationStart,
  onGenerationEnd,
}: BackingTrackPanelProps) {
  const [status, setStatus] = useState<BackingTrackStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [projectTracks, setProjectTracks] = useState<ProjectTrack[]>([]);
  const [savedLoops, setSavedLoops] = useState<SavedLoopMeta[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [hasTrackToSave, setHasTrackToSave] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, _setPendingImportFiles] = useState<File[] | null>(null);
  const [trackJustUploaded, setTrackJustUploaded] = useState<{ filename: string } | null>(null);
  const [editingTrack, setEditingTrack] = useState<ProjectTrack | null>(null);
  const [importKey, setImportKey] = useState('');
  const [importGenre, setImportGenre] = useState('');
  const [importBpm, setImportBpm] = useState('');
  const [importScales, setImportScales] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const currentBufferRef = useRef<ArrayBuffer | null>(null);
  const currentSpecRef = useRef<{ chords?: string[]; bpm?: number; style?: string } | null>(null);

  const { error: playbackError, play, stop, pause, resume } = useBackingTrackPlayback();

  const refreshProjectTracks = useCallback(async () => {
    if (!backendUrl) return;
    try {
      const res = await fetch(`${backendUrl}/api/backing-tracks`, { mode: 'cors' });
      if (res.ok) {
        const list = (await res.json()) as ProjectTrack[];
        setProjectTracks(list);
      }
    } catch {
      // ignore
    }
  }, [backendUrl]);

  const refreshSavedLoops = useCallback(async () => {
    try {
      const list = await listSavedLoops();
      setSavedLoops(list);
    } catch {
      // ignore
    }
  }, []);

  const refreshAllTracks = useCallback(async () => {
    await Promise.all([refreshProjectTracks(), refreshSavedLoops()]);
  }, [refreshProjectTracks, refreshSavedLoops]);

  useEffect(() => {
    refreshAllTracks();
  }, [refreshAllTracks]);

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
    async (selectValue: string) => {
      if (!selectValue) return;
      try {
        let audio: ArrayBuffer;
        let name: string;

        if (selectValue.startsWith(PROJECT_PREFIX)) {
          const filename = selectValue.slice(PROJECT_PREFIX.length);
          const res = await fetch(`${backendUrl}/api/backing-tracks/${encodeURIComponent(filename)}`, { mode: 'cors' });
          if (!res.ok) throw new Error('Could not fetch track');
          audio = await res.arrayBuffer();
          name = filename.replace(/\.[^.]+$/, '') || filename;
        } else {
          const saved = await loadLoop(selectValue);
          if (!saved?.audio) throw new Error('Could not load saved loop');
          audio = saved.audio;
          name = saved.name;
        }

        currentBufferRef.current = audio;
        currentSpecRef.current = null;
        setHasTrackToSave(true);
        onPlayingStart();
        await play(audio);
        setStatus('playing');
        setStatusMessage(`Playing: ${name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Load failed: ${msg}`);
      }
    },
    [backendUrl, play, onPlayingStart]
  );

  const handlePlaySelectedSaved = useCallback(() => {
    if (selectedSavedId) handleLoadSaved(selectedSavedId);
  }, [selectedSavedId, handleLoadSaved]);

  const handleEditTrack = useCallback(() => {
    if (!selectedSavedId || !selectedSavedId.startsWith(PROJECT_PREFIX)) return;
    const filename = selectedSavedId.slice(PROJECT_PREFIX.length);
    const track = projectTracks.find((t) => t.id === filename);
    if (!track) return;
    setEditingTrack(track);
    setImportKey(track.key ?? '');
    setImportGenre(track.genre ?? '');
    setImportBpm(track.bpm ? String(track.bpm) : '');
    setImportScales(track.scales ?? []);
  }, [selectedSavedId, projectTracks]);

  const handleSaveEditedTrack = useCallback(
    async () => {
      const track = editingTrack;
      if (!track || !backendUrl) {
        setStatusMessage('Error: Missing track or backend URL');
        return;
      }
      setImporting(true);
      setStatusMessage('Saving changes...');
      console.log('Saving metadata for track:', track.id);
      try {
        const url = `${backendUrl}/api/backing-tracks/${encodeURIComponent(track.id)}`;
        console.log('PATCH URL:', url);
        const body = {
          key: importKey || undefined,
          genre: importGenre || undefined,
          bpm: importBpm ? parseInt(importBpm, 10) : undefined,
          scales: importScales.length > 0 ? importScales : undefined,
        };
        console.log('Request body:', body);
        
        const res = await fetch(url, {
          method: 'PATCH',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        console.log('Response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('Update successful:', data);
          setEditingTrack(null);
          setImportKey('');
          setImportGenre('');
          setImportBpm('');
          setImportScales([]);
          await refreshProjectTracks();
          setStatusMessage('✅ Track updated successfully!');
        } else {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          console.error('Update failed:', err);
          setStatusMessage(`❌ ${err?.error ?? 'Update failed'}`);
        }
      } catch (err) {
        console.error('Update error:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setStatusMessage(`❌ Update failed: ${msg}`);
      } finally {
        setImporting(false);
      }
    },
    [editingTrack, backendUrl, importKey, importGenre, importBpm, importScales, refreshProjectTracks]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingTrack(null);
    setImportKey('');
    setImportGenre('');
    setImportBpm('');
    setImportScales([]);
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      if (!backendUrl) {
        setStatusMessage('Backend not configured. Set Realtime Service URL.');
        return;
      }

      // Upload and analyze first file (single file for now to match drag-and-drop UX)
      const file = files[0];
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) {
        setStatusMessage('Please select MP3, WAV, M4A, or AAC files only.');
        e.target.value = '';
        return;
      }

      setImporting(true);
      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${backendUrl}/api/backing-tracks`, {
          method: 'POST',
          mode: 'cors',
          body: formData,
        });
        
        if (res.ok) {
          const data = (await res.json()) as { id: string; key?: string; genre?: string; bpm?: number };
          setTrackJustUploaded({ filename: data.id });
          await refreshProjectTracks();
          
          // Start analysis
          setIsAnalyzing(true);
          setStatusMessage('Analyzing audio... This may take 10-30 seconds.');
          try {
            const analysisRes = await fetch(`${backendUrl}/api/backing-tracks/analyze`, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: data.id }),
            });
            
            if (analysisRes.ok) {
              const analysisData = (await analysisRes.json()) as {
                analysis: { bpm?: number; key?: string; genre?: string; scales?: string[] };
              };
              setImportKey(analysisData.analysis.key ?? '');
              setImportGenre(analysisData.analysis.genre ?? '');
              setImportBpm(analysisData.analysis.bpm ? String(analysisData.analysis.bpm) : '');
              setImportScales(analysisData.analysis.scales ?? []);
              setStatusMessage('✅ Analysis complete! Review and save track info below.');
            } else {
              setImportKey('');
              setImportGenre('');
              setImportBpm('');
              setImportScales([]);
              setStatusMessage('⚠️ Analysis failed. Please add track info manually.');
            }
          } catch {
            setImportKey('');
            setImportGenre('');
            setImportBpm('');
            setImportScales([]);
            setStatusMessage('⚠️ Analysis failed. Please add track info manually.');
          } finally {
            setIsAnalyzing(false);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setStatusMessage(`❌ ${err?.error ?? 'Upload failed'}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setStatusMessage(`❌ ${msg}`);
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    },
    [backendUrl, refreshProjectTracks]
  );


  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (!files?.length || !backendUrl) return;
      const file = files[0];
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) {
        setStatusMessage('Drag MP3, WAV, M4A, or AAC files only.');
        return;
      }
      setImporting(true);
      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${backendUrl}/api/backing-tracks`, {
          method: 'POST',
          mode: 'cors',
          body: formData,
        });
        if (res.ok) {
          const data = (await res.json()) as { id: string; key?: string; genre?: string; bpm?: number };
          setTrackJustUploaded({ filename: data.id });
          await refreshProjectTracks();
          
          // Start analysis
          setIsAnalyzing(true);
          setStatusMessage('Analyzing audio... This may take 10-30 seconds.');
          try {
            const analysisRes = await fetch(`${backendUrl}/api/backing-tracks/analyze`, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: data.id }),
            });
            
            if (analysisRes.ok) {
              const analysisData = (await analysisRes.json()) as {
                analysis: { bpm?: number; key?: string; genre?: string; scales?: string[] };
              };
              setImportKey(analysisData.analysis.key ?? '');
              setImportGenre(analysisData.analysis.genre ?? '');
              setImportBpm(analysisData.analysis.bpm ? String(analysisData.analysis.bpm) : '');
              setImportScales(analysisData.analysis.scales ?? []);
              setStatusMessage('Analysis complete! Review and save track info below.');
            } else {
              setImportKey('');
              setImportGenre('');
              setImportBpm('');
              setImportScales([]);
              setStatusMessage('Analysis failed. Please add track info manually.');
            }
          } catch {
            setImportKey('');
            setImportGenre('');
            setImportBpm('');
            setImportScales([]);
            setStatusMessage('Analysis failed. Please add track info manually.');
          } finally {
            setIsAnalyzing(false);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setStatusMessage(err?.error ?? 'Upload failed.');
        }
      } catch {
        setStatusMessage('Upload failed.');
      } finally {
        setImporting(false);
      }
    },
    [backendUrl, refreshProjectTracks]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleSaveMetadataForUploaded = useCallback(
    async () => {
      const track = trackJustUploaded;
      if (!track || !backendUrl) return;
      setImporting(true);
      try {
        const res = await fetch(`${backendUrl}/api/backing-tracks/${encodeURIComponent(track.filename)}`, {
          method: 'PATCH',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: importKey || undefined,
            genre: importGenre || undefined,
            bpm: importBpm ? parseInt(importBpm, 10) : undefined,
            scales: importScales.length > 0 ? importScales : undefined,
          }),
        });
        if (res.ok) {
          setTrackJustUploaded(null);
          setImportKey('');
          setImportGenre('');
          setImportBpm('');
          setImportScales([]);
          await refreshProjectTracks();
          setStatusMessage('Metadata saved.');
        } else {
          const err = await res.json().catch(() => ({}));
          setStatusMessage(err?.error ?? 'Save failed.');
        }
      } catch {
        setStatusMessage('Save failed.');
      } finally {
        setImporting(false);
      }
    },
    [trackJustUploaded, backendUrl, importKey, importGenre, importBpm, importScales, refreshProjectTracks]
  );

  const handleDismissMetadataForUploaded = useCallback(() => {
    setTrackJustUploaded(null);
    setImportKey('');
    setImportGenre('');
    setImportBpm('');
    setImportScales([]);
  }, []);


  const triggerImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handlePause = useCallback(() => {
    pause();
    setStatus('paused');
    setStatusMessage('Paused. Click Play to resume.');
    // Turn backend mic back ON when paused so user can talk to AI
    onPlayingStop();
  }, [pause, onPlayingStop]);

  const handleResume = useCallback(() => {
    resume();
    setStatus('playing');
    setStatusMessage('Playing (looped). Pause or Stop.');
    // Turn backend mic back OFF when resuming playback
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

  // Listen for backing track play commands from backend AI
  useEffect(() => {
    const handleBackendPlay = async (event: Event) => {
      const customEvent = event as CustomEvent<{ filename: string; metadata: any; backendUrl: string }>;
      const { filename, metadata, backendUrl } = customEvent.detail;
      
      if (!filename || !backendUrl) return;
      
      try {
        // Fetch and play the track
        const res = await fetch(`${backendUrl}/api/backing-tracks/${encodeURIComponent(filename)}`, { mode: 'cors' });
        if (!res.ok) {
          setStatusMessage(`❌ Could not load ${filename}`);
          return;
        }
        
        const audio = await res.arrayBuffer();
        const displayName = filename.replace(/\.[^.]+$/, '') || filename;
        
        currentBufferRef.current = audio;
        currentSpecRef.current = null;
        setHasTrackToSave(true);
        onPlayingStart();
        await play(audio);
        setStatus('playing');
        
        // Build status message with metadata
        const parts = [displayName];
        if (metadata?.key) parts.push(metadata.key);
        if (metadata?.genre) parts.push(metadata.genre);
        if (metadata?.bpm) parts.push(`${metadata.bpm} BPM`);
        setStatusMessage(`Playing: ${parts.join(' • ')}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`❌ Failed to play: ${msg}`);
        onPlayingStop();
      }
    };
    
    window.addEventListener('backend-play-backing-track', handleBackendPlay);
    return () => window.removeEventListener('backend-play-backing-track', handleBackendPlay);
  }, [backendUrl, play, onPlayingStart, onPlayingStop]);

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
          <div
            className={`backing-track-drop-zone ${isDragOver ? 'active' : ''} ${importing ? 'disabled' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !importing && importInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !importing && importInputRef.current?.click()}
            aria-label="Drop audio file or click to select"
          >
            {importing ? 'Uploading…' : 'Drag MP3 here to upload'}
          </div>
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
              onChange={handleFileSelect}
              aria-label="Import audio files"
            />
            <button
              type="button"
              className="backing-track-import-button"
              onClick={triggerImport}
              disabled={importing || status === 'generating'}
            >
              {importing ? 'Uploading…' : 'Import'}
            </button>
          </div>
          <p className="backing-track-import-hint">
            Drag a file or click Import. Tracks are automatically analyzed and saved to the project.
          </p>
          {trackJustUploaded && (
            <div className="backing-track-import-metadata">
              <p className="backing-track-label">
                {isAnalyzing ? 'Analyzing audio...' : `Track info for "${trackJustUploaded.filename.replace(/\.[^.]+$/, '')}"`}
              </p>
              {isAnalyzing && (
                <p className="backing-track-analyzing-hint">
                  Detecting BPM, key, genre, and scales... This may take 10-30 seconds.
                </p>
              )}
              <div className="backing-track-metadata-row">
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">Key</span>
                  <select
                    value={importKey}
                    onChange={(e) => setImportKey(e.target.value)}
                    className="backing-track-metadata-select"
                    aria-label="Key"
                    disabled={isAnalyzing}
                  >
                    {KEYS.map((k) => (
                      <option key={k || '__none'} value={k}>{k || '—'}</option>
                    ))}
                  </select>
                </label>
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">Genre</span>
                  <select
                    value={importGenre}
                    onChange={(e) => setImportGenre(e.target.value)}
                    className="backing-track-metadata-select"
                    aria-label="Genre"
                    disabled={isAnalyzing}
                  >
                    {GENRES.map((g) => (
                      <option key={g || '__none'} value={g}>{g || '—'}</option>
                    ))}
                  </select>
                </label>
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">BPM</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    placeholder="—"
                    value={importBpm}
                    onChange={(e) => setImportBpm(e.target.value)}
                    className="backing-track-metadata-input"
                    aria-label="BPM"
                    disabled={isAnalyzing}
                  />
                </label>
              </div>
              {importScales.length > 0 && (
                <div className="backing-track-scales-section">
                  <span className="backing-track-metadata-label">Recommended scales for soloing:</span>
                  <div className="backing-track-scales-list">
                    {importScales.map((scale, idx) => (
                      <span key={idx} className="backing-track-scale-badge">
                        {scale}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="backing-track-metadata-actions">
                <button
                  type="button"
                  className="backing-track-confirm-import-button"
                  onClick={handleSaveMetadataForUploaded}
                  disabled={importing || isAnalyzing}
                >
                  {importing ? 'Saving…' : 'Save info'}
                </button>
                <button
                  type="button"
                  className="backing-track-cancel-import-button"
                  onClick={handleDismissMetadataForUploaded}
                  disabled={importing || isAnalyzing}
                >
                  Skip
                </button>
              </div>
            </div>
          )}
          {editingTrack && (
            <div className="backing-track-import-metadata">
              <p className="backing-track-label">Edit track info for &quot;{editingTrack.name}&quot;</p>
              <div className="backing-track-metadata-row">
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">Key</span>
                  <select
                    value={importKey}
                    onChange={(e) => setImportKey(e.target.value)}
                    className="backing-track-metadata-select"
                    aria-label="Key"
                  >
                    {KEYS.map((k) => (
                      <option key={k || '__none'} value={k}>{k || '—'}</option>
                    ))}
                  </select>
                </label>
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">Genre</span>
                  <select
                    value={importGenre}
                    onChange={(e) => setImportGenre(e.target.value)}
                    className="backing-track-metadata-select"
                    aria-label="Genre"
                  >
                    {GENRES.map((g) => (
                      <option key={g || '__none'} value={g}>{g || '—'}</option>
                    ))}
                  </select>
                </label>
                <label className="backing-track-metadata-field">
                  <span className="backing-track-metadata-label">BPM</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    placeholder="—"
                    value={importBpm}
                    onChange={(e) => setImportBpm(e.target.value)}
                    className="backing-track-metadata-input"
                    aria-label="BPM"
                  />
                </label>
              </div>
              {importScales.length > 0 && (
                <div className="backing-track-scales-section">
                  <span className="backing-track-metadata-label">Recommended scales:</span>
                  <div className="backing-track-scales-list">
                    {importScales.map((scale, idx) => (
                      <span key={idx} className="backing-track-scale-badge">
                        {scale}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="backing-track-metadata-actions">
                <button
                  type="button"
                  className="backing-track-confirm-import-button"
                  onClick={handleSaveEditedTrack}
                  disabled={importing}
                >
                  {importing ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="backing-track-cancel-import-button"
                  onClick={handleCancelEdit}
                  disabled={importing}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {(projectTracks.length > 0 || savedLoops.length > 0) ? (
            <div className="backing-track-saved-row">
              <select
                id="backing-track-saved"
                className="backing-track-saved-select"
                value={selectedSavedId}
                onChange={(e) => setSelectedSavedId(e.target.value)}
              >
                <option value="">— Select a loop —</option>
                {projectTracks.length > 0 && (
                  <optgroup label="Project (saved to disk)">
                    {projectTracks.map((t) => {
                      const parts = [t.name];
                      if (t.key || t.genre || t.bpm) {
                        const meta = [t.key, t.genre, t.bpm ? `${t.bpm} BPM` : null].filter(Boolean);
                        parts.push(`(${meta.join(' • ')})`);
                      }
                      return (
                        <option key={t.id} value={`${PROJECT_PREFIX}${t.id}`}>
                          {parts.join(' ')}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {savedLoops.length > 0 && (
                  <optgroup label="Saved (browser)">
                    {savedLoops.map((loop) => (
                      <option key={loop.id} value={loop.id}>
                        {loop.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                className="backing-track-play-saved-button"
                onClick={handlePlaySelectedSaved}
                disabled={!selectedSavedId || status === 'generating'}
              >
                Play
              </button>
              {selectedSavedId && selectedSavedId.startsWith(PROJECT_PREFIX) && !editingTrack && (
                <button
                  type="button"
                  className="backing-track-edit-button"
                  onClick={handleEditTrack}
                  disabled={status === 'generating'}
                >
                  Edit
                </button>
              )}
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
