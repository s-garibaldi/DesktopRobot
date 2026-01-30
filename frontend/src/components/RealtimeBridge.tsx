import { useState, useRef, useEffect } from 'react';
import { Emotion } from '../App';
import './RealtimeBridge.css';

interface RealtimeBridgeProps {
  onEmotionChange: (emotion: Emotion) => void;
  currentEmotion: Emotion;
}

const RealtimeBridge: React.FC<RealtimeBridgeProps> = ({ 
  onEmotionChange, 
  currentEmotion 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallingTool, setIsCallingTool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeUrl, setRealtimeUrl] = useState('http://localhost:3000');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [lastEmotionChange, setLastEmotionChange] = useState<number>(0);
  const [agentConfig] = useState('musicalCompanion'); // Musical Companion as the only agent
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  
  // Use refs to track state inside the message handler to avoid infinite loops
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isCallingToolRef = useRef(false);
  
  // Track PTT state from backend - used to determine when to show listening face
  const isPTTActiveRef = useRef(false);
  const isPTTUserSpeakingRef = useRef(false);

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

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message:', event.origin, event.data);
      
      // Accept messages from our realtime service
      if (event.origin === 'http://localhost:3000') {
        try {
          const data = event.data;
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
              // After tool call ends, go to neutral unless AI starts speaking
              if (!isSpeakingRef.current && !isListeningRef.current) {
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
              // Audio playback finished → neutral (go-to idle emotion)
              if (!isListeningRef.current && !isCallingToolRef.current) {
                handleEmotionChange('neutral', 'ai_speaking_end', true);
              }
              break;
              
            case 'error':
              setError(data.message);
              handleEmotionChange('confused', 'error');
              break;
              
            case 'ptt_state':
              // Update PTT state refs from backend
              isPTTActiveRef.current = data.isPTTActive;
              isPTTUserSpeakingRef.current = data.isPTTUserSpeaking;
              console.log(`PTT state updated: active=${data.isPTTActive}, speaking=${data.isPTTUserSpeaking}`);
              break;
          }
        } catch (error) {
          console.error('Error handling message from realtime service:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onEmotionChange, currentEmotion, lastEmotionChange]);
  // Note: We use refs (isListeningRef, isSpeakingRef, isCallingToolRef) instead of state
  // variables in the dependency array to avoid infinite re-render loops

  // Check service availability on mount and periodically
  useEffect(() => {
    checkRealtimeService();
    const interval = setInterval(checkRealtimeService, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [realtimeUrl]);

  // Idle timeout: switch to "time" after 10 seconds of no input/output activity
  useEffect(() => {
    if (!isConnected) return;

    const checkIdleTimeout = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;
      const IDLE_TIMEOUT_MS = 10000; // 10 seconds

      // Only trigger if:
      // 1. 10 seconds have passed since last activity
      // 2. We're not already showing time
      // 3. We're not currently transitioning (check by ensuring enough time has passed since last emotion change)
      const timeSinceLastEmotionChange = now - lastEmotionChange;
      const isTransitioning = timeSinceLastEmotionChange < 500; // Transition duration is ~400ms, add buffer

      // Idle → time trigger commented out for now
      // if (timeSinceLastActivity >= IDLE_TIMEOUT_MS && currentEmotion !== 'time' && !isTransitioning) {
      //   console.log('Idle timeout reached, switching to time display');
      //   setLastEmotionChange(now);
      //   onEmotionChange('time');
      // }
    };

    // Check every second
    const interval = setInterval(checkIdleTimeout, 1000);
    
    return () => clearInterval(interval);
  }, [isConnected, currentEmotion, onEmotionChange, lastEmotionChange]);

  // Send message to iframe
  const sendMessageToIframe = (message: any) => {
    if (iframeRef.current?.contentWindow) {
      console.log('Sending message to iframe:', message);
      iframeRef.current.contentWindow.postMessage(message, 'http://localhost:3000');
    }
  };

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
    }, 1000);
  };

  // Request microphone permission proactively
  useEffect(() => {
    // Request microphone permission as soon as component mounts
    const requestMicrophonePermission = async () => {
      try {
        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('getUserMedia is not supported in this browser');
          return;
        }

        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        setError(null); // Clear any previous errors
      } catch (error: any) {
        console.error('Microphone permission error:', error);
        const errorMessage = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Please allow microphone access in your system settings and refresh the app.'
          : 'Failed to access microphone. Please check your system settings.';
        setError(errorMessage);
      }
    };

    requestMicrophonePermission();
  }, []); // Run once on mount

  // Build the iframe URL with the selected agent configuration
  const iframeSrc = `${realtimeUrl}/?agentConfig=${agentConfig}`;

  return (
    <div className="realtime-bridge">
      <div className="bridge-header">
        <h3>OpenAI Realtime Voice Chat</h3>
        <div className="current-emotion-display">
          Current: <strong>{currentEmotion}</strong>
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
