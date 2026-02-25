import { useState, useRef, useEffect, useCallback } from 'react';
import { Emotion } from '../App';
import { useMicrophone } from '../hooks/useMicrophone';
import { useVoiceCommandMicOnOff } from '../hooks/useVoiceCommandMicOnOff';
import { setMetronomeBpm } from './metronome/metronomeStore';
import MicrophonePanel from './MicrophonePanel';
import BackingTrackPanel, { type BackingTrackHandlers } from './BackingTrackPanel';
import MetronomePanel from './metronome/MetronomePanel';
import SpotifyPanel from './SpotifyPanel';
import { musicController } from '../music';
import type { PlaybackState } from '../spotify';
import './RealtimeBridge.css';

interface RealtimeBridgeProps {
  onEmotionChange: (emotion: Emotion) => void;
  currentEmotion: Emotion;
  onGuitarTabDisplayCommand?: (action: 'show' | 'close', description?: string) => void;
  onSpotifyPlaybackStateChange?: (state: PlaybackState | null) => void;
  onSpotifyStop?: () => void;
}

export type ActiveMode = 'backing_track' | 'metronome' | 'backend_mic' | null;

const RealtimeBridge: React.FC<RealtimeBridgeProps> = ({ 
  onEmotionChange, 
  currentEmotion,
  onGuitarTabDisplayCommand,
  onSpotifyPlaybackStateChange,
  onSpotifyStop,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallingTool, setIsCallingTool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeUrl, setRealtimeUrl] = useState(
    () => (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://localhost:3000'
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [lastEmotionChange, setLastEmotionChange] = useState<number>(0);
  const [agentConfig] = useState('musicalCompanion'); // Musical Companion as the only agent
  /** Only one of these can be active: opening phrase enters that mode; backing_track/metronome exit on "stop" or idle; backend_mic exits only on "microphone off". */
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const activeModeRef = useRef<ActiveMode>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const {
    stream: micStream,
    status: micStatus,
    error: micError,
    isSupported: micSupported,
    volumeLevel: micVolumeLevel,
    volumeDb: micVolumeDb,
    requestAccess: micRequestAccess,
    stop: micStop,
  } = useMicrophone();

  // Keep frontend mic stream in a ref for future use (sending to backend).
  const frontendMicStreamRef = useRef<MediaStream | null>(null);
  const micStatusRef = useRef(micStatus);
  useEffect(() => {
    frontendMicStreamRef.current = micStream ?? null;
  }, [micStream]);
  micStatusRef.current = micStatus;

  // Auto-enable frontend microphone when the app starts (e.g. Tauri app launch).
  useEffect(() => {
    if (micSupported && micStatus === 'idle') {
      micRequestAccess();
    }
  // Run once on mount; micSupported and micStatus are stable for initial request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Use refs to track state inside the message handler to avoid infinite loops
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isCallingToolRef = useRef(false);
  
  // Track PTT state from backend - used to determine when to show listening face
  const isPTTActiveRef = useRef(false);
  const isPTTUserSpeakingRef = useRef(false);
  const handleMetronomeCommandRef = useRef<(action: 'start' | 'stop' | 'setBpm' | 'pause' | 'play', bpm?: number) => void>(() => {});
  /** Backend sends one BPM number → we set it and start. Ref so message handler can call it. */
  const startMetronomeFromBackendBpmRef = useRef<(bpm: number) => void>(() => {});
  /** Backend can command chord display; ref so message handler can call the callback. */
  const onGuitarTabDisplayCommandRef = useRef<((action: 'show' | 'close', description?: string) => void) | undefined>(undefined);
  /** Set when metronome starts (voice or backend); voice hook ignores stop/pause for a few seconds to avoid false triggers. */
  const lastMetronomeStartTimeRef = useRef(0);
  /** Set when chord display is shown from backend; voice hook ignores "close display" for a few seconds so AI saying it doesn't dismiss. */
  const lastGuitarTabDisplayFromBackendTimeRef = useRef(0);

  // Check if realtime service is available
  const checkRealtimeService = async () => {
    try {
      console.log('Checking realtime service at:', realtimeUrl);
      const response = await fetch(`${realtimeUrl}/api/session`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Service response status:', response.status);
      
      if (response.ok) {
        setIsConnected(true);
        setError(null);
        console.log('Realtime service is available');
      } else {
        throw new Error(`Service responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Realtime service check failed:', error);
      setIsConnected(false);
      setError(`Cannot connect to realtime service: ${error}`);
    }
  };

  // Enhanced emotion change handler with debouncing.
  // `force=true` bypasses debounce for system-triggered state changes (e.g., audio in/out).
  const handleEmotionChange = (emotion: Emotion, source: string = 'unknown', force: boolean = false) => {
    // Chord tab stays on until user says "close display"; ignore backend-driven emotion changes while on guitarTabs
    if (currentEmotion === 'guitarTabs') {
      return;
    }
    // Spotify face stays until user switches; ignore backend-driven emotion changes while on spotify
    if (currentEmotion === 'spotify') {
      return;
    }
    // Metronome stays on until user says "stop" or "pause"; ignore backend-driven emotion changes while on metronome
    if (currentEmotion === 'metronome') {
      return;
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastEmotionChange;
    
    // Always reset activity timer when activity is detected (even if emotion change is debounced)
    // This ensures idle timeout doesn't trigger during active transitions
    if (emotion !== 'time' && source !== 'idle_timeout') {
      lastActivityTimeRef.current = now;
    }
    
    // Debounce emotion changes to prevent rapid switching
    if (force || timeSinceLastChange > 400) { // 400ms debounce to match faster transitions
      console.log(`Emotion change: ${currentEmotion} -> ${emotion} (from ${source})`);
      onEmotionChange(emotion);
      setLastEmotionChange(now);
    } else {
      console.log(`Emotion change debounced: ${emotion} (from ${source})`);
    }
  };

  type BackendBridgeLog = {
    type: 'bridge_log';
    payload: {
      id: string;
      direction: 'client' | 'server';
      eventName: string;
      eventType?: string;
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      details?: {
        errorMessage?: string;
        errorType?: string;
        status?: number;
      };
    };
  };

  const AUDIO_INPUT_START_TYPES = new Set([
    // OpenAI Realtime / WebRTC transport events (server-side VAD)
    'input_audio_buffer.speech_started',
    // Push-to-talk (client events). Treat as "about to speak" / listening.
    'input_audio_buffer.clear',
  ]);

  const AUDIO_INPUT_STOP_TYPES = new Set([
    // OpenAI Realtime / WebRTC transport events (server-side VAD)
    'input_audio_buffer.speech_stopped',
    // Push-to-talk end (client events)
    'input_audio_buffer.commit',
  ]);

  const RESPONSE_AUDIO_START_TYPES = new Set([
    // AI is actually outputting audio (speaking)
    'response.audio_transcript.delta',
    'response.audio.delta',
  ]);

  // Note: We intentionally don't detect response END from bridge_log events
  // because 'response.done' fires when generation completes, but audio may still be playing.
  // Speaking END is handled by 'ai_speaking_end' from actual audio element pause/ended events.

  const TOOL_CALL_TYPES = new Set([
    // Tool/function call events - AI is thinking and calling APIs
    'agent_tool_start',
    'response.function_call_arguments.delta',
    'response.function_call_arguments.done',
  ]);

  const TOOL_END_TYPES = new Set([
    'agent_tool_end',
  ]);

  const deriveAudioInputStateFromBackendLog = (log: BackendBridgeLog['payload']): 'start' | 'stop' | null => {
    const eventType = log.eventType;
    if (!eventType) return null;
    if (AUDIO_INPUT_START_TYPES.has(eventType)) return 'start';
    if (AUDIO_INPUT_STOP_TYPES.has(eventType)) return 'stop';
    return null;
  };

  const deriveToolCallStateFromBackendLog = (log: BackendBridgeLog['payload']): 'start' | 'end' | null => {
    const eventType = log.eventType;
    const eventName = (log.eventName || '').toLowerCase();
    
    // Check for tool call start events
    if (eventType && TOOL_CALL_TYPES.has(eventType)) return 'start';
    if (eventType && TOOL_END_TYPES.has(eventType)) return 'end';
    
    // Fallback: check eventName for tool/function call patterns
    if (eventName.includes('agent_tool_start') || 
        eventName.includes('function call:') ||
        eventName.includes('function_call_arguments')) return 'start';
    if (eventName.includes('agent_tool_end') || 
        eventName.includes('function call result:')) return 'end';
    
    return null;
  };

  const deriveResponseAudioStateFromBackendLog = (log: BackendBridgeLog['payload']): 'start' | null => {
    const eventType = log.eventType;
    const eventName = (log.eventName || '').toLowerCase();
    
    // Check for actual audio output events (AI speaking)
    // Note: We only detect START here. END is handled by 'ai_speaking_end' from audio element
    if (eventType && RESPONSE_AUDIO_START_TYPES.has(eventType)) return 'start';
    
    // Fallback: check eventName for audio output patterns
    if (eventName.includes('response.audio_transcript.delta') || 
        eventName.includes('response.audio.delta')) return 'start';
    
    // We intentionally don't return 'end' for response.done because 
    // audio may still be playing. Speaking ends via ai_speaking_end event.
    return null;
  };

  // Origin of the backend iframe (so we accept postMessages from it)
  const backendOrigin = (() => {
    try {
      return new URL(realtimeUrl).origin;
    } catch {
      return 'http://localhost:3000';
    }
  })();

  // Treat localhost and 127.0.0.1 with same port as same origin (avoids dropped messages)
  const isAcceptedOrigin = (origin: string): boolean => {
    if (origin === backendOrigin) return true;
    try {
      const a = new URL(origin);
      const b = new URL(backendOrigin);
      if (a.port !== b.port) return false;
      const hostA = a.hostname.toLowerCase();
      const hostB = b.hostname.toLowerCase();
      const localhostLike = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
      if (localhostLike(hostA) && localhostLike(hostB)) return true;
      return hostA === hostB;
    } catch {
      return false;
    }
  };

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      const isClientAction = data?.type === 'play_spotify_track' || data?.type === 'spotify_stop' || data?.type === 'music_play_track' || data?.type === 'music_add_to_queue' || data?.type === 'music_next' || data?.type === 'music_previous' || data?.type === 'music_pause' || data?.type === 'music_resume' || data?.type === 'music_clear' || data?.type === 'music_play_index' || data?.type === 'music_remove_at' || data?.type === 'music_move' || data?.type === 'play_backing_track' || data?.type === 'metronome_set_bpm' || data?.type === 'guitar_tab_display';
      if (isClientAction) {
        console.log('[RealtimeBridge] Client action received:', data?.type, 'origin=', event.origin, 'expected~', backendOrigin);
      }

      const fromLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(String(event.origin || ''));
      const accept = isAcceptedOrigin(event.origin) || (isClientAction && fromLocalhost);
      if (!accept) {
        if (isClientAction) {
          console.warn('[RealtimeBridge] Message rejected (origin mismatch):', event.origin, 'vs', backendOrigin);
        }
        return;
      }
      try {
          console.log('Processing message from realtime service:', data);

          // Backend log bridge events (sanitized, high-volume). We only map selected ones to emotions.
          if (data?.type === 'bridge_log' && data?.payload) {
            const log = data as BackendBridgeLog;
            
            // Check for audio input events (user speaking)
            const audioState = deriveAudioInputStateFromBackendLog(log.payload);
            if (audioState === 'start') {
              // Only show listening face if:
              // 1. AI is NOT currently speaking (speaking takes priority)
              // 2. PTT mode is OFF (VAD mode), OR PTT is ON AND button is pressed
              const pttAllowsListening = !isPTTActiveRef.current || isPTTUserSpeakingRef.current;
              const shouldShowListening = pttAllowsListening && !isSpeakingRef.current;
              
              if (shouldShowListening) {
                isListeningRef.current = true;
                setIsListening(true);
                lastActivityTimeRef.current = Date.now();
                handleEmotionChange('listening', `backend_audio_input:${log.payload.eventType}`, true);
              }
              return;
            }
            if (audioState === 'stop') {
              // Only process stop if we were actually showing listening
              if (isListeningRef.current) {
                isListeningRef.current = false;
                setIsListening(false);
                lastActivityTimeRef.current = Date.now();
                // DON'T transition to neutral here - keep listening face visible
                // The AI will respond with thinking or speaking, which will naturally
                // transition the face. This prevents the brief neutral flash between
                // listening and thinking/speaking.
                // Neutral will be triggered by ai_speaking_end when AI finishes.
              }
              return;
            }
            
            // Check for tool/function call events (AI is thinking and calling APIs)
            const toolState = deriveToolCallStateFromBackendLog(log.payload);
            if (toolState === 'start') {
              lastActivityTimeRef.current = Date.now();
              isCallingToolRef.current = true;
              setIsCallingTool(true);
              
              // Clear listening state if active (AI is now processing)
              if (isListeningRef.current) {
                isListeningRef.current = false;
                setIsListening(false);
              }
              
              // Show thinking face (unless AI is already speaking)
              if (!isSpeakingRef.current) {
                handleEmotionChange('thinking', `backend_tool_call:${log.payload.eventType || log.payload.eventName}`, true);
              }
              return;
            }
            if (toolState === 'end') {
              isCallingToolRef.current = false;
              setIsCallingTool(false);
              lastActivityTimeRef.current = Date.now();
              // After tool call ends, go to neutral unless AI starts speaking, metronome is running, or we just showed guitar tab
              const justShowedGuitarTab = Date.now() - lastGuitarTabDisplayFromBackendTimeRef.current < 3000;
              if (!isSpeakingRef.current && !isListeningRef.current && activeModeRef.current !== 'metronome' && !justShowedGuitarTab) {
                handleEmotionChange('neutral', `backend_tool_end:${log.payload.eventType || log.payload.eventName}`, true);
              }
              return;
            }
            
            // Check for AI audio output events (AI speaking)
            const responseAudioState = deriveResponseAudioStateFromBackendLog(log.payload);
            if (responseAudioState === 'start') {
              lastActivityTimeRef.current = Date.now();
              // AI is outputting audio - show speaking face
              // Speaking takes priority over everything except explicit user interruption
              
              // If we were thinking (calling tools), transition to speaking now
              if (isCallingToolRef.current) {
                isCallingToolRef.current = false;
                setIsCallingTool(false);
              }
              
              // If we were in listening state, clear it (AI speaking takes priority)
              if (isListeningRef.current) {
                isListeningRef.current = false;
                setIsListening(false);
              }
              
              // Show speaking face
              isSpeakingRef.current = true;
              setIsSpeaking(true);
              handleEmotionChange('speaking', `backend_response_audio:${log.payload.eventType || log.payload.eventName}`, true);
              return;
            }
            // Note: Speaking END is handled by 'ai_speaking_end' from audio element,
            // not from bridge_log events. This ensures we wait for actual audio playback to finish.
            
            return;
          }

          // Handle different types of events from the realtime service
          switch (data.type) {
            case 'session_status':
              setIsConnected(data.connected);
              // Reset activity timer when connection status changes
              if (data.connected) {
                lastActivityTimeRef.current = Date.now();
              }
              break;
              
            case 'ai_speaking_start':
              isSpeakingRef.current = true;
              setIsSpeaking(true);
              lastActivityTimeRef.current = Date.now();
              handleEmotionChange('speaking', 'ai_speaking_start', true);
              break;
              
            case 'ai_speaking_end':
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              lastActivityTimeRef.current = Date.now();
              // Audio playback finished → neutral, but not when metronome is running or we just showed guitar tab
              const justShowedGuitarTabOnSpeakingEnd = Date.now() - lastGuitarTabDisplayFromBackendTimeRef.current < 3000;
              if (!isListeningRef.current && !isCallingToolRef.current && activeModeRef.current !== 'metronome' && !justShowedGuitarTabOnSpeakingEnd) {
                handleEmotionChange('neutral', 'ai_speaking_end', true);
              }
              break;
              
            case 'error':
              setError(data.message);
              handleEmotionChange('metronome', 'error');
              break;
              
            case 'ptt_state':
              // Update PTT state refs from backend
              isPTTActiveRef.current = data.isPTTActive;
              isPTTUserSpeakingRef.current = data.isPTTUserSpeaking;
              console.log(`PTT state updated: active=${data.isPTTActive}, speaking=${data.isPTTUserSpeaking}`);
              break;

            case 'spotify_playback_state':
              window.dispatchEvent(new CustomEvent('spotify-backend-playback-state', { detail: data }));
              break;

            case 'spotify_ready':
              window.dispatchEvent(new CustomEvent('spotify-backend-ready', { detail: { deviceId: data.deviceId } }));
              break;

            case 'spotify_play_result':
              window.dispatchEvent(new CustomEvent('spotify_play_result', { detail: { ok: data.ok } }));
              break;

            case 'metronome_set_bpm': {
              // Flow: backend decided one BPM → we set it in the metronome and start (no voice-command path)
              const bpm = data.bpm;
              if (typeof bpm === 'number' && bpm >= 40 && bpm <= 240) {
                const startFromBackend = startMetronomeFromBackendBpmRef.current;
                if (typeof startFromBackend === 'function') {
                  startFromBackend(bpm);
                  console.log('RealtimeBridge: metronome_set_bpm from backend', bpm);
                }
              }
              break;
            }

            case 'guitar_tab_display': {
              const handler = onGuitarTabDisplayCommandRef.current;
              if (typeof handler !== 'function') break;
              if (data.action === 'close') {
                handler('close');
                console.log('RealtimeBridge: guitar_tab_display close from backend');
              } else if (data.action === 'show' && data.chord != null) {
                lastGuitarTabDisplayFromBackendTimeRef.current = Date.now();
                handler('show', String(data.chord));
                console.log('RealtimeBridge: guitar_tab_display show from backend', data.chord);
              }
              break;
            }

            case 'play_backing_track': {
              const filename = data.filename;
              if (typeof filename === 'string' && filename) {
                console.log('RealtimeBridge: play_backing_track from backend', filename, data.metadata);
                // Dispatch custom event for BackingTrackPanel to handle
                window.dispatchEvent(new CustomEvent('backend-play-backing-track', {
                  detail: { 
                    filename, 
                    metadata: data.metadata,
                    backendUrl: realtimeUrl,
                  }
                }));
              }
              break;
            }

            case 'play_spotify_track':
            case 'music_play_track': {
              const uri = data.uri;
              if (typeof uri === 'string' && uri.startsWith('spotify:track:')) {
                console.log('[RealtimeBridge] music_play_track from backend', uri, data.trackName);
                onEmotionChange('spotify');
                lastKnownMicEnabledRef.current = false;
                sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
                // Notify SpotifyPanel that AI requested playback (browsers need user click for audio)
                window.dispatchEvent(new CustomEvent('spotify-agent-requested-playback'));
                const albumArtUrl = typeof data.albumArtUrl === 'string' ? data.albumArtUrl : undefined;
                const durationMs = typeof data.durationMs === 'number' && data.durationMs > 0 ? data.durationMs : undefined;
                musicController.playUri(uri, {
                  title: typeof data.trackName === 'string' ? data.trackName : 'Unknown',
                  artist: typeof data.artists === 'string' ? data.artists : '',
                  albumArtUrl,
                  durationMs,
                }).then((ok) => {
                  if (!ok) {
                    window.dispatchEvent(new CustomEvent('spotify-playback-failed', { detail: { reason: 'not_connected' } }));
                  }
                });
              }
              break;
            }

            case 'music_add_to_queue': {
              const items = data.items;
              if (Array.isArray(items) && items.length > 0) {
                const valid = items.filter(
                  (it: unknown) =>
                    it &&
                    typeof it === 'object' &&
                    typeof (it as { uri?: unknown }).uri === 'string' &&
                    (it as { uri: string }).uri.startsWith('spotify:track:')
                );
                if (valid.length > 0) {
                  onEmotionChange('spotify');
                  lastKnownMicEnabledRef.current = false;
                  sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
                  window.dispatchEvent(new CustomEvent('spotify-agent-requested-playback'));
                  const mapped = valid.map((it: { uri: string; title?: string; artist?: string; albumArtUrl?: unknown; durationMs?: number }) => ({
                    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    uri: (it as { uri: string }).uri,
                    title: (it as { title?: string }).title ?? 'Unknown',
                    artist: (it as { artist?: string }).artist ?? '',
                    albumArtUrl: typeof (it as { albumArtUrl?: unknown }).albumArtUrl === 'string' ? (it as { albumArtUrl: string }).albumArtUrl : undefined,
                    durationMs: typeof (it as { durationMs?: number }).durationMs === 'number' && (it as { durationMs: number }).durationMs > 0 ? (it as { durationMs: number }).durationMs : undefined,
                  }));
                  musicController.addToQueueAndStartIfIdle(mapped).then((ok) => {
                    if (!ok) {
                      window.dispatchEvent(new CustomEvent('spotify-playback-failed', { detail: { reason: 'not_connected' } }));
                    }
                  });
                }
              }
              break;
            }

            case 'music_next':
              musicController.next();
              break;

            case 'music_previous':
              musicController.previous();
              break;

            case 'music_pause':
              musicController.pause();
              break;

            case 'music_resume':
              musicController.resume();
              break;

            case 'music_clear':
              musicController.clear();
              break;

            case 'music_play_index': {
              const idx = data.index;
              if (typeof idx === 'number' && idx >= 0) {
                musicController.playIndex(idx).then((ok) => {
                  if (!ok && idx === 0) {
                    musicController.resume();
                  }
                });
              }
              break;
            }

            case 'music_remove_at': {
              const idx = data.index;
              if (typeof idx === 'number' && idx >= 0) {
                musicController.removeAt(idx);
              }
              break;
            }

            case 'music_move': {
              const from = data.from;
              const to = data.to;
              if (typeof from === 'number' && typeof to === 'number' && from >= 0 && to >= 0) {
                musicController.move(from, to);
              }
              break;
            }

            case 'spotify_stop': {
              console.log('[RealtimeBridge] spotify_stop from backend (queue empty)');
              window.dispatchEvent(new CustomEvent('spotify-queue-stopped'));
              onSpotifyStop?.();
              lastKnownMicEnabledRef.current = true;
              sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: true });
              break;
            }

          }
        } catch (error) {
          console.error('Error handling message from realtime service:', error);
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [backendOrigin, onEmotionChange, currentEmotion, lastEmotionChange, onSpotifyStop]);
  // Note: We use refs (isListeningRef, isSpeakingRef, isCallingToolRef) instead of state
  // variables in the dependency array to avoid infinite re-render loops

  // Forward MusicController state to backend so spotify_queue_get can answer "what's in the queue"
  useEffect(() => {
    let origin = '*';
    try {
      origin = new URL(realtimeUrl).origin;
    } catch {
      // ignore
    }
    const sendState = () => {
      const q = musicController.getQueue();
      const np = musicController.getNowPlaying();
      const status = musicController.getPlaybackStatus();
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'music_state_update',
            queue: q.items,
            currentIndex: q.currentIndex,
            nowPlaying: np ? { title: np.item.title, artist: np.item.artist } : null,
            status,
          },
          origin
        );
      }
    };
    sendState();
    const unsub = musicController.subscribe((event) => {
      if (event.type === 'QUEUE_UPDATED' || event.type === 'NOW_PLAYING') {
        sendState();
      }
    });
    return unsub;
  }, [realtimeUrl]);

  // FACE_EVENT from MusicController - stable events for face state (GROOVING when playing, NEUTRAL when stopped)
  useEffect(() => {
    const handler = (e: Event) => {
      const state = (e as CustomEvent<{ state: 'GROOVING' | 'NEUTRAL' }>).detail?.state;
      if (state === 'GROOVING') onEmotionChange('spotify');
      if (state === 'NEUTRAL' && currentEmotion === 'spotify') onEmotionChange('neutral');
    };
    window.addEventListener('FACE_EVENT', handler);
    return () => window.removeEventListener('FACE_EVENT', handler);
  }, [onEmotionChange, currentEmotion]);

  // Check service availability on mount and periodically
  useEffect(() => {
    checkRealtimeService();
    const interval = setInterval(checkRealtimeService, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [realtimeUrl]);

  // Send message to iframe (target origin for postMessage)
  const iframeOrigin = (() => {
    try {
      return new URL(realtimeUrl).origin;
    } catch {
      return '*';
    }
  })();
  const sendMessageToIframe = (message: any) => {
    if (iframeRef.current?.contentWindow) {
      console.log('Sending message to iframe:', message);
      iframeRef.current.contentWindow.postMessage(message, iframeOrigin);
    }
  };

  // Forward Spotify track events from frontend to backend iframe (for queue controller).
  useEffect(() => {
    const origin = (() => {
      try {
        return new URL(realtimeUrl).origin;
      } catch {
        return '*';
      }
    })();
    const forwardToIframe = (message: object) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, origin);
      }
    };
    const onTrackStarted = (e: Event) => {
      const d = (e as CustomEvent<{ trackName?: string; artists?: string }>).detail;
      forwardToIframe({ type: 'spotify_track_started', trackName: d?.trackName ?? '', artists: d?.artists ?? '' });
    };
    const onTrackEnded = () => forwardToIframe({ type: 'spotify_track_ended' });
    window.addEventListener('spotify-track-started', onTrackStarted);
    window.addEventListener('spotify-track-ended', onTrackEnded);
    return () => {
      window.removeEventListener('spotify-track-started', onTrackStarted);
      window.removeEventListener('spotify-track-ended', onTrackEnded);
    };
  }, [realtimeUrl]);

  const lastKnownMicEnabledRef = useRef(true);
  const savedMicBeforeBackingTrackRef = useRef(true);
  const savedMicBeforeMetronomeRef = useRef(true);
  const metronomeStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActiveModeAndRef = useCallback((mode: ActiveMode) => {
    setActiveMode(mode);
    activeModeRef.current = mode;
  }, []);

  /** Duration to show "thinking" while "generating" metronome sound/timing before switching to metronome face. */
  const METRONOME_PREPARE_MS = 600;

  const handleMicCommand = useCallback((payload: { type: 'set_backend_mic_enabled'; enabled: boolean }) => {
    const mode = activeModeRef.current;
    if (payload.enabled) {
      // "hey bot" — only enter backend_mic mode when not in backing_track or metronome (or already in backend_mic)
      if (mode === 'backing_track' || mode === 'metronome') return;
      setActiveModeAndRef('backend_mic');
      backingTrackHandlersRef.current?.stop();
      if (metronomeStartTimeoutRef.current) {
        clearTimeout(metronomeStartTimeoutRef.current);
        metronomeStartTimeoutRef.current = null;
      }
      onEmotionChange('neutral');
      lastKnownMicEnabledRef.current = true;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: true });
    } else {
      // "microphone off" — always send to backend so mic turns off regardless of frontend mode
      console.log('[METRONOME STOP?] handleMicCommand(mic OFF) — clears active mode, was:', mode);
      setActiveModeAndRef(null);
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
    }
  }, [setActiveModeAndRef, onEmotionChange]);

  const handleStartMetronome = useCallback(() => {
    if (activeModeRef.current !== 'metronome') {
      setActiveModeAndRef('metronome');
      savedMicBeforeMetronomeRef.current = lastKnownMicEnabledRef.current;
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
      backingTrackHandlersRef.current?.stop();
    }
    handleEmotionChange('thinking', 'metronome_preparing', true);
    if (metronomeStartTimeoutRef.current) clearTimeout(metronomeStartTimeoutRef.current);
    metronomeStartTimeoutRef.current = setTimeout(() => {
      metronomeStartTimeoutRef.current = null;
      handleEmotionChange('metronome', 'metronome_started', true);
    }, METRONOME_PREPARE_MS);
  }, [setActiveModeAndRef]);

  /** Single path for backend: receive one BPM number → input into metronome and start. Used only by metronome_set_bpm message. */
  const startMetronomeFromBackendBpm = useCallback((bpm: number) => {
    setMetronomeBpm(bpm);
    lastMetronomeStartTimeRef.current = Date.now();
    savedMicBeforeMetronomeRef.current = lastKnownMicEnabledRef.current;
    lastKnownMicEnabledRef.current = false;
    sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
    backingTrackHandlersRef.current?.stop();
    setActiveModeAndRef('metronome');
    handleStartMetronome();
  }, [setActiveModeAndRef, handleStartMetronome]);
  startMetronomeFromBackendBpmRef.current = startMetronomeFromBackendBpm;
  onGuitarTabDisplayCommandRef.current = onGuitarTabDisplayCommand ?? undefined;

  useEffect(() => {
    return () => {
      if (metronomeStartTimeoutRef.current) {
        clearTimeout(metronomeStartTimeoutRef.current);
        metronomeStartTimeoutRef.current = null;
      }
    };
  }, []);

  const backingTrackHandlersRef = useRef<BackingTrackHandlers | null>(null);
  const handleBackingTrackHandlersReady = useCallback((handlers: BackingTrackHandlers) => {
    backingTrackHandlersRef.current = handlers;
  }, []);

  const handleStopMetronome = useCallback(() => {
    if (activeModeRef.current !== 'metronome') return;
    setActiveModeAndRef(null);
    lastKnownMicEnabledRef.current = savedMicBeforeMetronomeRef.current;
    sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: savedMicBeforeMetronomeRef.current });
    if (metronomeStartTimeoutRef.current) {
      clearTimeout(metronomeStartTimeoutRef.current);
      metronomeStartTimeoutRef.current = null;
    }
  }, [setActiveModeAndRef]);

  const handleMetronomeCommand = useCallback((action: 'start' | 'stop' | 'setBpm' | 'pause' | 'play', bpm?: number) => {
    const mode = activeModeRef.current;
    if (action === 'stop' || action === 'pause') {
      if (mode !== 'metronome') return;
      console.log('[METRONOME STOP?] handleMetronomeCommand(', action, ') — voice command');
      setActiveModeAndRef(null);
      lastKnownMicEnabledRef.current = savedMicBeforeMetronomeRef.current;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: savedMicBeforeMetronomeRef.current });
      if (metronomeStartTimeoutRef.current) {
        clearTimeout(metronomeStartTimeoutRef.current);
        metronomeStartTimeoutRef.current = null;
      }
      onEmotionChange('neutral');
      return;
    }
    // Allow starting metronome when in backend_mic (e.g. backend sent start_metronome after user said "play metronome for rumba")
    if (mode === 'backing_track') return;
    if (mode === 'backend_mic' && action !== 'start') return;
    if (mode === null || mode === 'backend_mic') {
      savedMicBeforeMetronomeRef.current = lastKnownMicEnabledRef.current;
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
      backingTrackHandlersRef.current?.stop();
      setActiveModeAndRef('metronome');
    }
    if (action === 'play') {
      handleStartMetronome();
      return;
    }
    if (bpm !== undefined) {
      setMetronomeBpm(bpm);
      if (action === 'start') {
        lastMetronomeStartTimeRef.current = Date.now();
        handleStartMetronome();
      }
    }
  }, [setActiveModeAndRef, onEmotionChange]);

  // Keep ref current so message handler (metronome_set_bpm) can call it; sync assign so it's set before any postMessage is processed
  handleMetronomeCommandRef.current = handleMetronomeCommand;

  const handleBackingTrackCommand = useCallback(
    (action: 'describe' | 'pause' | 'play' | 'save' | 'stop', description?: string) => {
      const mode = activeModeRef.current;
      if (mode === 'metronome' || mode === 'backend_mic') return;
      const h = backingTrackHandlersRef.current;
      if (!h) return;
      if (mode === null) {
        setActiveModeAndRef('backing_track');
        savedMicBeforeBackingTrackRef.current = lastKnownMicEnabledRef.current;
        lastKnownMicEnabledRef.current = false;
        sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
      }
      if (action === 'stop') {
        h.stop();
        setActiveModeAndRef(null);
        lastKnownMicEnabledRef.current = savedMicBeforeBackingTrackRef.current;
        sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: savedMicBeforeBackingTrackRef.current });
        return;
      }
      switch (action) {
        case 'describe':
          void h.runCommand(description ?? '');
          break;
        case 'pause':
          h.pause();
          break;
        case 'play':
          h.resume();
          break;
        case 'save':
          h.save();
          break;
      }
    },
    [setActiveModeAndRef]
  );

  const handleGuitarTabDisplayCommand = useCallback(
    (action: 'show' | 'close', description?: string) => {
      if (!onGuitarTabDisplayCommand) return;
      onGuitarTabDisplayCommand(action, description);
    },
    [onGuitarTabDisplayCommand]
  );

  const handleSpotifyCommand = useCallback((action: 'pause' | 'play' | 'stop' | 'restart' | 'rewind' | 'forward' | 'skip', seconds?: number) => {
    if (action === 'play') {
      setActiveModeAndRef(null);
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
    }
    if (action === 'stop') {
      setActiveModeAndRef('backend_mic');
      lastKnownMicEnabledRef.current = true;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: true });
    }
    window.dispatchEvent(new CustomEvent('spotify-voice-command', { detail: { action, seconds } }));
  }, [setActiveModeAndRef]);

  useVoiceCommandMicOnOff(
    micStatus === 'granted' && isConnected && iframeLoaded && !isSpeaking,
    handleMicCommand,
    handleMetronomeCommand,
    handleBackingTrackCommand,
    handleGuitarTabDisplayCommand,
    handleSpotifyCommand,
    {
      lastMetronomeStartTime: lastMetronomeStartTimeRef,
      lastGuitarTabDisplayFromBackendTime: lastGuitarTabDisplayFromBackendTimeRef,
    },
    currentEmotion === 'spotify'
  );

  const handleBackingTrackPlayingStart = useCallback(() => {
    setActiveModeAndRef('backing_track');
    savedMicBeforeBackingTrackRef.current = lastKnownMicEnabledRef.current;
    sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
  }, [setActiveModeAndRef]);

  const handleBackingTrackPlayingStop = useCallback(() => {
    if (activeModeRef.current === 'backing_track') {
      setActiveModeAndRef(null);
      sendMessageToIframe({
        type: 'set_backend_mic_enabled',
        enabled: savedMicBeforeBackingTrackRef.current,
      });
      lastKnownMicEnabledRef.current = savedMicBeforeBackingTrackRef.current;
    }
  }, [setActiveModeAndRef]);

  // Idle timeout: switch to "time" display after 30s of no activity when NOT in metronome/backing_track.
  // Metronome and backing track are NOT stopped by idle — they run until user says "stop" or "pause".
  const IDLE_TIMEOUT_MS = 30000;
  useEffect(() => {
    if (!isConnected) return;

    const checkIdleTimeout = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;
      const isTransitioning = (now - lastEmotionChange) < 500;
      const mode = activeModeRef.current;

      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
        // Do not stop metronome or backing track on idle — they run until user says "stop" or "pause"
        if (mode === 'metronome' || mode === 'backing_track') {
          // Only switch to time display if desired; do not exit mode or restore mic
          if (currentEmotion !== 'time' && currentEmotion !== 'metronome' && currentEmotion !== 'guitarTabs' && currentEmotion !== 'spotify' && !isTransitioning) {
            setLastEmotionChange(now);
            handleEmotionChange('time', 'idle_timeout', true);
          }
          return;
        }
        if (currentEmotion !== 'time' && currentEmotion !== 'metronome' && currentEmotion !== 'guitarTabs' && currentEmotion !== 'spotify' && !isTransitioning) {
          console.log('Idle timeout reached, switching to time display');
          setLastEmotionChange(now);
          handleEmotionChange('time', 'idle_timeout', true);
        }
      }
    };

    const interval = setInterval(checkIdleTimeout, 1000);
    return () => clearInterval(interval);
  }, [isConnected, currentEmotion, onEmotionChange, lastEmotionChange, setActiveModeAndRef]);

  const handleBackingTrackGenerationStart = () => {
    lastActivityTimeRef.current = Date.now();
    handleEmotionChange('thinking', 'backing_track_generation', true);
  };

  const handleBackingTrackGenerationEnd = () => {
    if (currentEmotion === 'thinking') {
      handleEmotionChange('neutral', 'backing_track_generation_done', true);
    }
  };

  // When user enables frontend mic, enter backend_mic mode and enable backend mic (when connected)
  const handleMicRequestAccess = useCallback(() => {
    micRequestAccess();
    if (isConnected && iframeLoaded) {
      setActiveModeAndRef('backend_mic');
      backingTrackHandlersRef.current?.stop();
      if (metronomeStartTimeoutRef.current) {
        clearTimeout(metronomeStartTimeoutRef.current);
        metronomeStartTimeoutRef.current = null;
      }
      onEmotionChange('neutral');
      lastKnownMicEnabledRef.current = true;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: true });
    }
  }, [isConnected, iframeLoaded, setActiveModeAndRef, onEmotionChange]);

  // When user disables frontend mic, exit backend_mic mode and mute backend mic (when connected)
  const handleMicStop = useCallback(() => {
    micStop();
    if (isConnected && iframeLoaded) {
      if (activeModeRef.current === 'backend_mic') setActiveModeAndRef(null);
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
    }
  }, [isConnected, iframeLoaded, setActiveModeAndRef]);

  // Handle iframe load
  const handleIframeLoad = () => {
    console.log('Realtime iframe loaded');
    setIframeLoaded(true);
    
    // Wait a bit for the iframe to fully initialize
    setTimeout(() => {
      // Send initial configuration to the iframe
      sendMessageToIframe({
        type: 'bridge_ready',
        emotionIntegration: true
      });
      // Start with backend mic off; user must say "hey bot" or click Enable to turn it on
      lastKnownMicEnabledRef.current = false;
      sendMessageToIframe({ type: 'set_backend_mic_enabled', enabled: false });
    }, 1000);
  };

  // Build the iframe URL with the selected agent configuration
  const iframeSrc = `${realtimeUrl}/?agentConfig=${agentConfig}`;

  return (
    <div className="realtime-bridge">
      <div className="bridge-header">
        <h3>OpenAI Realtime Voice Chat</h3>
        <div className="current-emotion-display">
          Current: <strong>{currentEmotion}</strong>
          {activeMode && (
            <span className="active-mode-display"> · Mode: <strong>{activeMode.replace('_', ' ')}</strong></span>
          )}
        </div>
      </div>

      <div className="bridge-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Realtime Service Connected' : '🔴 Realtime Service Disconnected'}
        </div>
        {isListening && <div className="status-indicator listening">🎤 Listening...</div>}
        {isCallingTool && <div className="status-indicator thinking">💭 AI Calling Tools...</div>}
        {isSpeaking && <div className="status-indicator speaking">🔊 AI Speaking...</div>}
        {iframeLoaded && <div className="status-indicator loaded">📱 Interface Loaded</div>}
      </div>

      {error && (
        <div className="error-message">
          <div>
            <strong>Connection Error:</strong> {error}
          </div>
          <button onClick={checkRealtimeService} className="retry-button">
            Retry Connection
          </button>
        </div>
      )}

      <MicrophonePanel
        status={micStatus}
        error={micError}
        isSupported={micSupported}
        volumeLevel={micVolumeLevel}
        volumeDb={micVolumeDb}
        onRequestAccess={handleMicRequestAccess}
        onStop={handleMicStop}
      />

      <BackingTrackPanel
        onPlayingStart={handleBackingTrackPlayingStart}
        onPlayingStop={handleBackingTrackPlayingStop}
        elevenLabsApiKey={import.meta.env?.VITE_ELEVENLABS_API_KEY ?? ''}
        backendUrl={realtimeUrl}
        onHandlersReady={handleBackingTrackHandlersReady}
        onGenerationStart={handleBackingTrackGenerationStart}
        onGenerationEnd={handleBackingTrackGenerationEnd}
      />

      <MetronomePanel
        currentEmotion={currentEmotion}
        onEmotionChange={onEmotionChange}
        onStartMetronome={handleStartMetronome}
        onStopMetronome={handleStopMetronome}
      />

      <SpotifyPanel
            backendUrl={realtimeUrl}
            onPlaybackStateChange={onSpotifyPlaybackStateChange}
            onStop={onSpotifyStop}
            useBackendForPlayback={isConnected && iframeLoaded}
            sendToBackendIframe={sendMessageToIframe}
          />

      {micStatus === 'granted' && isConnected && (
        <p className="voice-command-hint">
          Voice: <strong>&quot;microphone off&quot;</strong> / <strong>&quot;hey bot&quot;</strong>;
          <strong> &quot;apple&quot;</strong> (chime), then say BPM — or &quot;apple&quot; + number; <strong>&quot;stop&quot;</strong> (apple + carrot);
          <strong> &quot;carrot&quot;</strong> (chime), then say description — or &quot;carrot&quot; + description in one phrase;
          <strong> &quot;eggplant&quot;</strong> (chime), then say chord — or &quot;eggplant&quot; + chord; <strong>&quot;close display&quot;</strong> (back to neutral);
          <strong> &quot;pause&quot;</strong> / <strong>&quot;play&quot;</strong> / <strong>&quot;save&quot;</strong> for carrot.
          When Spotify is showing: <strong>&quot;pause&quot;</strong> / <strong>&quot;play&quot;</strong> / <strong>&quot;stop&quot;</strong> / <strong>&quot;restart&quot;</strong> / <strong>&quot;skip song&quot;</strong> (or &quot;next&quot;); <strong>&quot;rewind X seconds&quot;</strong> / <strong>&quot;fast forward X seconds&quot;</strong>. Ask the AI to &quot;play Song A, Song B, and Song C&quot; for a queue.
        </p>
      )}

      <div className="bridge-controls">
        <div className="url-input">
          <label>
            Realtime Service URL:
            <input 
              type="text" 
              value={realtimeUrl}
              onChange={(e) => setRealtimeUrl(e.target.value)}
              placeholder="http://localhost:3000"
            />
          </label>
          <button onClick={checkRealtimeService} className="check-button">
            Check Service
          </button>
        </div>
        
        <div className="agent-config-selector">
          <div className="agent-description">
            <span>🎵 <strong>Musical Companion:</strong> AI companion for guitar chords, songwriting, and music theory!</span>
          </div>
        </div>
      </div>

      <div className="iframe-container">
        {isConnected ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="OpenAI Realtime Chat"
            className="realtime-iframe"
            onLoad={handleIframeLoad}
            allow="microphone; camera; autoplay"
          />
        ) : (
          <div className="iframe-placeholder">
            <div className="placeholder-content">
              <h4>Realtime Service Not Available</h4>
              <p>Make sure the OpenAI Realtime Agents service is running on {realtimeUrl}</p>
              <div className="placeholder-instructions">
                <h5>To start the service:</h5>
                <ol>
                  <li>Open a terminal</li>
                  <li>Navigate to: <code>backend/</code></li>
                  <li>Run: <code>npm run dev</code></li>
                  <li>Wait for the service to start on port 3000</li>
                </ol>
              </div>
              <button onClick={checkRealtimeService} className="retry-button">
                Check Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bridge-info">
        <h4>How This Works</h4>
        <ul>
          <li><strong>Hybrid Architecture:</strong> This Tauri app communicates with the official OpenAI Realtime Agents service</li>
          <li><strong>Input-Based Emotions:</strong> The animated face reacts to YOUR emotions and tone, not the AI's responses</li>
          <li><strong>Speech-to-Speech:</strong> Full voice conversations powered by OpenAI's Realtime API</li>
          <li><strong>Official Implementation:</strong> Uses the proven OpenAI Agents SDK without modifications</li>
          <li><strong>Smart Emotion Detection:</strong> Analyzes your speech and text input to determine appropriate facial expressions</li>
          <li><strong>Multiple Agent Configurations:</strong> Switch between different AI personalities and capabilities</li>
        </ul>
        
        {iframeLoaded && (
          <div className="troubleshooting">
            <h5>Emotion Integration:</h5>
            <ul>
              <li>🎤 <strong>Listening:</strong> While the backend detects audio input from you</li>
              <li>💭 <strong>Thinking:</strong> Only when the AI is calling functions or APIs (web search, memory, etc.)</li>
              <li>🗣️ <strong>Speaking:</strong> During the entire duration of the AI's audio output/response</li>
              <li>😐 <strong>Neutral:</strong> Default state when idle or between interactions</li>
              <li>🕒 <strong>Time:</strong> Manual toggle to display the current time</li>
              <li>⏱ <strong>Metronome:</strong> Blinking blue screen at BPM (set via Metronome panel)</li>
            </ul>
            
            <h5>Musical Companion Features:</h5>
            <ul>
              <li><strong>Chord Recognition:</strong> "What's the fingering for C major?" or "Show me Am chord"</li>
              <li><strong>Songwriting:</strong> "I want to write a happy pop song" or "Help me with a sad folk song"</li>
              <li><strong>Music Theory:</strong> "Explain major scales" or "What are intervals?"</li>
              <li><strong>Chord Progressions:</strong> "What chords go well with G?" or "Give me a blues progression"</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeBridge;
