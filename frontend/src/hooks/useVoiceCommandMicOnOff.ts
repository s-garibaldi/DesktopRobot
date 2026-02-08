import { useEffect, useRef } from 'react';
import { parseMetronomeBpm } from '../parseMetronomeCommand';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export type MetronomeVoiceAction = 'start' | 'stop' | 'setBpm';

export type BackingTrackVoiceAction = 'describe' | 'pause' | 'play' | 'save' | 'stop';

const COOLDOWN_MS = 2500;
const PHRASE_OFF = 'microphone off';
const PHRASE_ON = 'microphone on';
const PHRASE_BACKING_TRACK = 'backing track';

/** Play a short ascending chime (C5 → E5) to acknowledge e.g. "backing track", "metronome", "microphone on". */
function playChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const freq = [523.25, 659.25]; // C5, E5 — low then high
    freq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.225, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.26);
    });
  } catch {
    // ignore
  }
}

/** Play a short descending chime (E5 → C5) to acknowledge "microphone off". */
function playChimeDown(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const freq = [659.25, 523.25]; // E5, C5 — high then low
    freq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.225, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.26);
    });
  } catch {
    // ignore
  }
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function transcriptContainsPhrase(transcript: string, phrase: string): boolean {
  const t = normalize(transcript);
  return t.includes(phrase) || t === phrase;
}

function isStopCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'stop' || t.startsWith('stop ');
}

function isPauseCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'pause' || t.startsWith('pause ');
}

function isPlayCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'play' || t.startsWith('play ');
}

function isSaveCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'save' || t.startsWith('save ');
}

/** Extract description after "backing track" for ElevenLabs. */
function extractBackingTrackDescription(transcript: string): string | null {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const idx = lower.indexOf(PHRASE_BACKING_TRACK);
  if (idx === -1) return null;
  const after = t.slice(idx + PHRASE_BACKING_TRACK.length).trim();
  return after || ''; // allow "backing track" alone (use defaults)
}

/**
 * Listens for vocal commands via Web Speech API:
 * - "microphone off" / "microphone on" → onCommand
 * - "metronome" + number or a number (40–240) → onMetronomeCommand('start' | 'setBpm', bpm)
 * - "stop" → onMetronomeCommand('stop') and onBackingTrackCommand('stop')
 * - "backing track" + description → onBackingTrackCommand('describe', description)
 * - "pause" / "play" / "save" / "stop" → onBackingTrackCommand
 */
export function useVoiceCommandMicOnOff(
  enabled: boolean,
  onCommand: (payload: { type: 'set_backend_mic_enabled'; enabled: boolean }) => void,
  onMetronomeCommand?: (action: MetronomeVoiceAction, bpm?: number) => void,
  onBackingTrackCommand?: (action: BackingTrackVoiceAction, description?: string) => void
) {
  const onCommandRef = useRef(onCommand);
  const onMetronomeCommandRef = useRef(onMetronomeCommand);
  const onBackingTrackCommandRef = useRef(onBackingTrackCommand);
  const lastCommandTimeRef = useRef(0);
  const enabledRef = useRef(enabled);
  const waitingForBackingDescriptionRef = useRef(false);
  const chimePlayedForBackingRef = useRef(false);
  const waitingForMetronomeBpmRef = useRef(false);
  const chimePlayedForMetronomeRef = useRef(false);
  onCommandRef.current = onCommand;
  onMetronomeCommandRef.current = onMetronomeCommand;
  onBackingTrackCommandRef.current = onBackingTrackCommand;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const SpeechRecognitionCtor =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition);

    if (!SpeechRecognitionCtor) {
      console.warn('Voice command mic on/off: SpeechRecognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionInstance;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now();
      const results = event.results;

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        const transcript = (result[0]?.transcript ?? '').trim();

        // Play chime as soon as "backing track" or "metronome" is detected (including interim) so it feels immediate
        if (extractBackingTrackDescription(transcript) !== null && !chimePlayedForBackingRef.current) {
          playChime();
          chimePlayedForBackingRef.current = true;
        }
        if (transcriptContainsPhrase(transcript, 'metronome') && !chimePlayedForMetronomeRef.current) {
          playChime();
          chimePlayedForMetronomeRef.current = true;
        }

        if (!result.isFinal) continue;

        // If we're waiting for a backing track description, next utterance is the description (unless it's a command)
        if (waitingForBackingDescriptionRef.current && onBackingTrackCommandRef.current) {
          waitingForBackingDescriptionRef.current = false;
          if (transcriptContainsPhrase(transcript, PHRASE_OFF)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command: microphone off');
            return;
          }
          if (transcriptContainsPhrase(transcript, PHRASE_ON)) {
            lastCommandTimeRef.current = now;
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command: microphone on');
            return;
          }
          if (isStopCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('stop');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
            console.log('Voice command: stop (backing + metronome)');
            return;
          }
          if (isPauseCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('pause');
            console.log('Voice command: backing track pause');
            return;
          }
          if (isPlayCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('play');
            console.log('Voice command: backing track play');
            return;
          }
          if (isSaveCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('save');
            console.log('Voice command: backing track save');
            return;
          }
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null && onMetronomeCommandRef.current) {
            lastCommandTimeRef.current = now;
            const hasMetronomeWord = transcriptContainsPhrase(transcript, 'metronome');
            onMetronomeCommandRef.current(hasMetronomeWord ? 'start' : 'setBpm', bpm);
            console.log('Voice command: metronome', hasMetronomeWord ? 'start' : 'setBpm', bpm);
            return;
          }
          // Use this utterance as the backing track description
          lastCommandTimeRef.current = now;
          onBackingTrackCommandRef.current('describe', transcript || '');
          console.log('Voice command: backing track (follow-up)', transcript || '(defaults)');
          return;
        }

        // If we're waiting for a metronome BPM, next utterance is the number (or we clear and fall through)
        if (waitingForMetronomeBpmRef.current && onMetronomeCommandRef.current) {
          waitingForMetronomeBpmRef.current = false;
          chimePlayedForMetronomeRef.current = false;
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null) {
            lastCommandTimeRef.current = now;
            onMetronomeCommandRef.current('start', bpm);
            console.log('Voice command: metronome (follow-up)', bpm);
            return;
          }
          // Not a number; clear waiting and fall through (other commands or cooldown)
        }

        if (now - lastCommandTimeRef.current < COOLDOWN_MS) return;

        if (transcriptContainsPhrase(transcript, PHRASE_OFF)) {
          lastCommandTimeRef.current = now;
          playChimeDown();
          onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
          console.log('Voice command: microphone off');
          return;
        }
        if (transcriptContainsPhrase(transcript, PHRASE_ON)) {
          lastCommandTimeRef.current = now;
          playChime();
          onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
          console.log('Voice command: microphone on');
          return;
        }
        if (onBackingTrackCommandRef.current) {
          const backingDesc = extractBackingTrackDescription(transcript);
          if (backingDesc !== null) {
            lastCommandTimeRef.current = now;
            if (backingDesc.trim() === '') {
              waitingForBackingDescriptionRef.current = true;
              console.log('Voice command: backing track (say description after chime)');
            } else {
              onBackingTrackCommandRef.current('describe', backingDesc);
              console.log('Voice command: backing track', backingDesc);
            }
            chimePlayedForBackingRef.current = false; // so next "backing track" plays chime again
            return;
          }
          if (isStopCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('stop');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
            console.log('Voice command: stop (backing + metronome)');
            return;
          }
          if (isPauseCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('pause');
            console.log('Voice command: backing track pause');
            return;
          }
          if (isPlayCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('play');
            console.log('Voice command: backing track play');
            return;
          }
          if (isSaveCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onBackingTrackCommandRef.current('save');
            console.log('Voice command: backing track save');
            return;
          }
        } else if (onMetronomeCommandRef.current && isStopCommand(transcript)) {
          lastCommandTimeRef.current = now;
          onMetronomeCommandRef.current('stop');
          console.log('Voice command: metronome stop');
          return;
        }
        if (onMetronomeCommandRef.current && transcriptContainsPhrase(transcript, 'metronome')) {
          const bpm = parseMetronomeBpm(transcript);
          lastCommandTimeRef.current = now;
          if (bpm !== null) {
            onMetronomeCommandRef.current('start', bpm);
            console.log('Voice command: metronome', bpm);
          } else {
            waitingForMetronomeBpmRef.current = true;
            console.log('Voice command: metronome (say BPM after chime)');
          }
          chimePlayedForMetronomeRef.current = false;
          return;
        }
        if (onMetronomeCommandRef.current) {
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null) {
            lastCommandTimeRef.current = now;
            onMetronomeCommandRef.current('setBpm', bpm);
            console.log('Voice command: metronome setBpm', bpm);
            return;
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Voice command recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      if (enabledRef.current) {
        try {
          recognition.start();
        } catch {
          // may throw if already started or in bad state
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Voice command: failed to start recognition', err);
    }

    return () => {
      waitingForBackingDescriptionRef.current = false;
      chimePlayedForBackingRef.current = false;
      waitingForMetronomeBpmRef.current = false;
      chimePlayedForMetronomeRef.current = false;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [enabled]);
}
