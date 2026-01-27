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
  const [error, setError] = useState<string | null>(null);
  const [realtimeUrl, setRealtimeUrl] = useState('http://localhost:3000');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [lastEmotionChange, setLastEmotionChange] = useState<number>(0);
  const [agentConfig, setAgentConfig] = useState('simpleHandoff'); // Keep simpleHandoff as default
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // Enhanced emotion change handler with debouncing
  const handleEmotionChange = (emotion: Emotion, source: string = 'unknown') => {
    const now = Date.now();
    const timeSinceLastChange = now - lastEmotionChange;
    
    // Debounce emotion changes to prevent rapid switching
    if (timeSinceLastChange > 800) { // 800ms debounce for more responsive input emotions
      console.log(`Emotion change: ${currentEmotion} -> ${emotion} (from ${source})`);
      onEmotionChange(emotion);
      setLastEmotionChange(now);
    } else {
      console.log(`Emotion change debounced: ${emotion} (from ${source})`);
    }
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

          // Handle different types of events from the realtime service
          switch (data.type) {
            case 'session_status':
              setIsConnected(data.connected);
              break;
              
            case 'speech_started':
              setIsListening(true);
              // Don't change emotion immediately when speech starts - wait for input analysis
              break;
              
            case 'speech_stopped':
              setIsListening(false);
              // Return to neutral when user stops speaking
              handleEmotionChange('neutral', 'speech_stopped');
              break;
              
            case 'ai_speaking_start':
              setIsSpeaking(true);
              // Keep current emotion when AI starts speaking
              break;
              
            case 'ai_speaking_end':
              setIsSpeaking(false);
              // Return to neutral when AI stops speaking
              handleEmotionChange('neutral', 'ai_speaking_end');
              break;
              
            case 'emotion_suggestion':
              // Handle emotion suggestions from user input
              if (data.emotion && ['happy', 'sad', 'excited', 'thinking', 'confused', 'neutral', 'surprised'].includes(data.emotion)) {
                console.log('Received emotion suggestion from user input:', data.emotion);
                handleEmotionChange(data.emotion as Emotion, data.source || 'user_input');
              }
              break;
              
            case 'error':
              setError(data.message);
              handleEmotionChange('confused', 'error');
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

  // Check service availability on mount and periodically
  useEffect(() => {
    checkRealtimeService();
    const interval = setInterval(checkRealtimeService, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [realtimeUrl]);

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
          <label>
            Agent Configuration:
            <select 
              value={agentConfig} 
              onChange={(e) => setAgentConfig(e.target.value)}
            >
              <option value="generalAssistant">🤖 General Assistant</option>
              <option value="simpleHandoff">🎯 General Chat & Haikus</option>
              <option value="musicalCompanion">🎵 Musical Companion</option>
              <option value="customerServiceRetail">🏔️ Snowy Peak Boards</option>
            </select>
          </label>
          <div className="agent-description">
            {agentConfig === 'generalAssistant' && (
              <span>🤖 General-purpose assistant for a wide variety of tasks and conversations</span>
            )}
            {agentConfig === 'simpleHandoff' && (
              <span>🎯 General-purpose AI that can chat about anything and write haikus</span>
            )}
            {agentConfig === 'musicalCompanion' && (
              <span>🎵 Musical AI companion for guitar chords, songwriting, and music theory!</span>
            )}
            {agentConfig === 'customerServiceRetail' && (
              <span>🏔️ Snowy Peak Boards snowboard shop assistant</span>
            )}
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
            <h5>Emotion Integration (Based on YOUR Input):</h5>
            <ul>
              <li>🤔 <strong>Thinking:</strong> When you say "let me think", "hmm", "maybe"</li>
              <li>😊 <strong>Happy:</strong> When you say "great", "awesome", "thank you", "love it"</li>
              <li>😢 <strong>Sad:</strong> When you say "help", "trouble", "problem", "worried"</li>
              <li>🤯 <strong>Excited:</strong> When you say "excited", "amazing", "incredible", "wow"</li>
              <li>😕 <strong>Confused:</strong> When you say "confused", "don't understand", "what", "how"</li>
              <li>😮 <strong>Surprised:</strong> When you say "surprised", "no way", "really", "unbelievable"</li>
              <li>😐 <strong>Neutral:</strong> Default state and when you stop speaking</li>
            </ul>
            
            <h5>Available Agent Configurations:</h5>
            <ul>
              <li><strong>🤖 General Assistant:</strong> Versatile assistant for a wide variety of tasks, questions, and conversations</li>
              <li><strong>🎯 General Chat & Haikus:</strong> Can discuss any topic and write haikus - perfect for general conversation and creativity!</li>
              <li><strong>🎵 Musical Companion:</strong> Guitar chord recognition, songwriting suggestions, and music theory help!</li>
              <li><strong>🏔️ Snowy Peak Boards:</strong> Specialized for snowboard shop assistance (limited scope)</li>
            </ul>
            
            <h5>Musical Companion Examples:</h5>
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
