import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

/** Normalize transcript for comparison (lowercase, trim, collapse spaces). */
function normalizeTranscript(s: string): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** True if transcript is "microphone off" or "microphone on". */
function isMicCommandPhrase(transcript: string): boolean {
  const t = normalizeTranscript(transcript);
  return t.includes('microphone off') || t.includes('microphone on');
}

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
  /** When user input is detected as "microphone off" or "microphone on" (e.g. to play a short ack). */
  onMicCommandTranscription?: (transcript: string) => void;
  /** Called when any user speech is transcribed (e.g. for other features). */
  onUserInputTranscription?: () => void;
  /** Called when AI has finished outputting audio (resets idle timer for auto mic-off). */
  onAIOutputComplete?: () => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;
  const onMicCommandTranscriptionRef = useRef(callbacks.onMicCommandTranscription);
  onMicCommandTranscriptionRef.current = callbacks.onMicCommandTranscription;
  const onUserInputTranscriptionRef = useRef(callbacks.onUserInputTranscription);
  onUserInputTranscriptionRef.current = callbacks.onUserInputTranscription;
  const onAIOutputCompleteRef = useRef(callbacks.onAIOutputComplete);
  onAIOutputCompleteRef.current = callbacks.onAIOutputComplete;

  // Track if we've already sent a speaking signal for the current response
  // This prevents flooding the bridge with delta events
  const speakingSignalSentRef = useRef(false);
  const speakingEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioDeltaTimeRef = useRef<number>(0);

  // Helper to send speaking end to parent window (fallback for WebRTC)
  const sendSpeakingEndToParent = () => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      console.log('[Audio] Sending ai_speaking_end (response.done fallback)');
      window.parent.postMessage({ type: 'ai_speaking_end' }, '*');
    }
  };

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = (event.transcript ?? '').trim();
        onUserInputTranscriptionRef.current?.();
        if (isMicCommandPhrase(transcript)) {
          sessionRef.current?.interrupt();
          onMicCommandTranscriptionRef.current?.(transcript);
        }
        historyHandlers.handleTranscriptionCompleted(event);
        logServerEvent(event); // Forward to bridge for emotion sync
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        logServerEvent(event); // Forward to bridge for emotion sync
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        // Track the time of the last audio delta for smart delay calculation
        lastAudioDeltaTimeRef.current = Date.now();
        // Only log the FIRST delta event to trigger speaking face (avoid flooding)
        if (!speakingSignalSentRef.current) {
          speakingSignalSentRef.current = true;
          logServerEvent(event); // Triggers speaking face
        }
        // Cancel any pending speaking end timer (audio is still coming)
        if (speakingEndTimerRef.current) {
          clearTimeout(speakingEndTimerRef.current);
          speakingEndTimerRef.current = null;
        }
        break;
      }
      case "response.done": {
        // Reset the speaking signal flag when response completes
        speakingSignalSentRef.current = false;
        logServerEvent(event);
        
        // Calculate smart delay based on when last audio delta arrived
        // If deltas were still arriving recently, we need more buffer time
        const timeSinceLastDelta = Date.now() - lastAudioDeltaTimeRef.current;
        // Base delay of 1.5s, plus extra time if deltas were recent
        // Audio typically buffers 1-2 seconds ahead, so if last delta was <500ms ago,
        // we need more time for the buffer to play out
        const baseDelay = 1500;
        const extraDelay = timeSinceLastDelta < 500 ? 1500 : 
                          timeSinceLastDelta < 1000 ? 1000 : 500;
        const totalDelay = baseDelay + extraDelay;
        
        console.log(`[Audio] response.done - last delta ${timeSinceLastDelta}ms ago, using ${totalDelay}ms delay`);
        
        // Set a fallback timer to end speaking face
        // WebRTC streams may not fire audio element pause/ended events
        if (speakingEndTimerRef.current) {
          clearTimeout(speakingEndTimerRef.current);
        }
        speakingEndTimerRef.current = setTimeout(() => {
          sendSpeakingEndToParent();
          onAIOutputCompleteRef.current?.();
          speakingEndTimerRef.current = null;
        }, totalDelay);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      } 
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  };

  useEffect(() => {
    if (sessionRef.current) {
      // Log server errors
      sessionRef.current.on("error", (...args: any[]) => {
        logServerEvent({
          type: "error",
          message: args[0],
        });
      });

      // history events
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);
      sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);

      // additional transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
    }
  }, [sessionRef.current]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];

      // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
      //  simulate how the voice agent sounds over a PSTN/SIP phone call.
      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);

      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          // Set preferred codec before offer creation
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc);
            return pc;
          },
        }),
        model: 'gpt-4o-mini-realtime-preview',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });

      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
