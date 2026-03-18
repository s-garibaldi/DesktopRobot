import { useEffect, useRef, type MutableRefObject } from 'react';
import { parseMetronomeBpm } from '../components/metronome/parseMetronomeCommand';

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

export type MetronomeVoiceAction = 'start' | 'stop' | 'setBpm' | 'pause' | 'play';

export type BackingTrackVoiceAction = 'describe' | 'pause' | 'play' | 'save' | 'stop';

export type GuitarTabDisplayVoiceAction = 'show' | 'close';

export type SpotifyVoiceAction = 'pause' | 'play' | 'stop' | 'restart' | 'rewind' | 'forward' | 'skip';

export type TunerVoiceAction = 'close';

const COOLDOWN_MS = 2500;
/** Extra cooldown for skip to prevent double-skip (interim+final or rapid duplicates). */
const SPOTIFY_SKIP_COOLDOWN_MS = 2500;
/** Min ms between acting on interim results to avoid double-fire from rapid interims. */
const INTERIM_DEBOUNCE_MS = 400;
/** Min ms between backing-track chimes so conversation about "carrot" doesn't trigger repeated chimes. */
const BACKING_CHIME_COOLDOWN_MS = 8000;
const BACKING_DESCRIPTION_TIMEOUT_MS = 5000;
const DISPLAY_DESCRIPTION_TIMEOUT_MS = 5000;
const METRONOME_BPM_TIMEOUT_MS = 5000;
/** Ignore "stop" / "pause" for metronome for this long after metronome start (avoids agent saying "say stop to control it" triggering stop). */
const METRONOME_START_COOLDOWN_MS = 6000;
/** Ignore "close display" for this long after chord was shown from backend (avoids agent saying "say close display to go back" triggering close). */
const GUITAR_TAB_CLOSE_COOLDOWN_MS = 6000;
const PHRASE_OFF = 'microphone off';
const PHRASE_ON = 'microphone on';
const PHRASE_BACKING_TRACK = 'carrot';
const PHRASE_DISPLAY = 'eggplant';
const PHRASE_CLOSE_DISPLAY = 'close display';
const PHRASE_METRONOME = 'apple';

/** Play a short ascending chime (C5 → E5) to acknowledge e.g. "carrot", "apple", "microphone on". */
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

/** Play a short descending chime (E5 → C5) to acknowledge "microphone off". Exported for use by backend auto mic-off. */
export function playChimeDown(): void {
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

/** Stricter check for "microphone off" to reduce false positives (e.g. AI echo). */
function isMicOffCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === PHRASE_OFF || t.endsWith(PHRASE_OFF);
}

/** Same structure as isMicOffCommand for consistent behavior. */
function isMicOnCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === PHRASE_ON || t.endsWith(PHRASE_ON);
}

function isStopCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'stop' || t.startsWith('stop ');
}

/** Same as stop for metronome/backing: "stop" or "close" (and "close ...") close the metronome. */
function isStopOrCloseCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'stop' || t.startsWith('stop ') || t === 'close' || t.startsWith('close ');
}

function isCloseCommand(transcript: string): boolean {
  return normalize(transcript) === 'close';
}

function isPauseCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'pause' || t.startsWith('pause ');
}

function isPlayCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'play' || t.startsWith('play ');
}

function isResumeCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'resume' || t.startsWith('resume ');
}

/** Stricter play/resume for Spotify: avoids false positives when mic is on during pause.
 * Rejects conversational phrases like "I want to play" or "play guitar".
 * Prefer "play music" or "resume" over bare "play" for robustness. */
function isSpotifyPlayOrResumeCommand(transcript: string): boolean {
  const t = normalize(transcript);
  const allowed = [
    'play', 'play music', 'play song', 'play the music', 'play the song', 'play it',
    'resume', 'resume music', 'resume song', 'resume playback',
    'resume the music', 'resume the song', 'resume it',
  ];
  return allowed.includes(t);
}

function isPlayOrResumeCommand(transcript: string): boolean {
  return isPlayCommand(transcript) || isResumeCommand(transcript);
}

function isSaveCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'save' || t.startsWith('save ');
}

function isRestartCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'restart' || t.startsWith('restart ') || t === 'start over' || t.startsWith('start over ');
}

function isSkipCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'skip' || t === 'skip song' || t === 'next song' || t === 'next track' || t === 'next'
    || t.startsWith('skip ') || t.startsWith('next ') || t.includes('skip song') || t.includes('next song');
}

/** Parse "rewind 30 seconds", "fast forward 1 minute", "go back 15", "skip forward 45". Returns seconds or null. */
function parseSpotifySeekSeconds(transcript: string): { direction: 'rewind' | 'forward'; seconds: number } | null {
  const t = normalize(transcript);
  const rewindMatch = t.match(/(?:rewind|go back|back)\s+(\d+)\s*(?:second|sec|minute|min)s?/i)
    || t.match(/(?:rewind|go back|back)\s+(\d+)/i);
  if (rewindMatch) {
    const n = parseInt(rewindMatch[1], 10);
    const seconds = /minute|min/i.test(t) ? n * 60 : n;
    return { direction: 'rewind', seconds: Math.min(seconds, 3600) };
  }
  const forwardMatch = t.match(/(?:fast forward|skip forward|forward)\s+(\d+)\s*(?:second|sec|minute|min)s?/i)
    || t.match(/(?:fast forward|skip forward|forward)\s+(\d+)/i);
  if (forwardMatch) {
    const n = parseInt(forwardMatch[1], 10);
    const seconds = /minute|min/i.test(t) ? n * 60 : n;
    return { direction: 'forward', seconds: Math.min(seconds, 3600) };
  }
  return null;
}

function isSpotifyRewindPhrase(transcript: string): boolean {
  const t = normalize(transcript);
  return /^(rewind|go back|back)(\s|$)/.test(t) || /(rewind|go back|back)\s+\d+/.test(t);
}

function isSpotifyForwardPhrase(transcript: string): boolean {
  const t = normalize(transcript);
  return /^(fast forward|skip forward|forward)(\s|$)/.test(t) || /(fast forward|skip forward|forward)\s+\d+/.test(t);
}

/** Extract description after "carrot" for ElevenLabs. */
function extractBackingTrackDescription(transcript: string): string | null {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const idx = lower.indexOf(PHRASE_BACKING_TRACK);
  if (idx === -1) return null;
  const after = t.slice(idx + PHRASE_BACKING_TRACK.length).trim();
  return after || ''; // allow "carrot" alone (use defaults)
}

/** True if transcript looks like a backing-track command (starts with "carrot"), not conversational mention. */
function isBackingTrackCommandPhrase(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  return lower.startsWith(PHRASE_BACKING_TRACK) || lower.startsWith(PHRASE_BACKING_TRACK + ' ');
}

/** Extract chord/scale description after "eggplant" for guitar tab. */
function extractDisplayDescription(transcript: string): string | null {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const idx = lower.indexOf(PHRASE_DISPLAY);
  if (idx === -1) return null;
  const after = t.slice(idx + PHRASE_DISPLAY.length).trim();
  return after || ''; // allow "eggplant" alone (wait for follow-up)
}

/** Exported for unit tests. Matches "close display". */
export function isCloseDisplayCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === PHRASE_CLOSE_DISPLAY || t.endsWith(PHRASE_CLOSE_DISPLAY) || t.includes(PHRASE_CLOSE_DISPLAY);
}

/** Exported for unit tests. Matches "stop", "close", "close display", "close tuner", "stop tuner", "turn off tuner" etc. */
export function isCloseTunerCommand(transcript: string): boolean {
  const t = normalize(transcript);
  if (t === 'stop' || t === 'close') return true;
  if (t.includes('close display') || t.includes('close tuner') || t.includes('stop tuner')) return true;
  if (t.includes('turn off tuner') || t.includes('turn off the tuner')) return true;
  if (t === 'exit' || t === 'hide' || t === 'done') return true;
  return false;
}

/**
 * Listens for vocal commands via Web Speech API:
 * - "microphone off" / "microphone on" → onCommand
 * - "apple" + number or a number (40–240) → onMetronomeCommand('start' | 'setBpm', bpm)
 * - "stop" → onMetronomeCommand('stop') and onBackingTrackCommand('stop')
 * - "carrot" + description → onBackingTrackCommand('describe', description)
 * - "pause" / "play" / "save" / "stop" → onBackingTrackCommand
 * - "eggplant" (chime), then say chord — or "eggplant" + chord in one phrase; "close display" → back to neutral
 * - When Spotify is active: "pause", "play", "stop", "restart", "rewind X seconds", "fast forward X seconds"
 * - When tuner is active: "stop", "close", "close display", "close tuner" → close tuner and return to neutral
 */
export function useVoiceCommandMicOnOff(
  enabled: boolean,
  onCommand: (payload: { type: 'set_backend_mic_enabled'; enabled: boolean }) => void,
  onMetronomeCommand?: (action: MetronomeVoiceAction, bpm?: number) => void,
  onBackingTrackCommand?: (action: BackingTrackVoiceAction, description?: string) => void,
  onGuitarTabDisplayCommand?: (action: GuitarTabDisplayVoiceAction, description?: string) => void,
  onSpotifyCommand?: (action: SpotifyVoiceAction, seconds?: number) => void,
  onTunerCommand?: (action: TunerVoiceAction) => void,
  voiceCooldownRefs?: {
    lastMetronomeStartTime: MutableRefObject<number>;
    lastGuitarTabDisplayFromBackendTime: MutableRefObject<number>;
  },
  isSpotifyActive?: boolean,
  isTunerActive?: boolean,
  isMetronomeActive?: boolean,
  isBackingTrackActive?: boolean,
  isGuitarTabActive?: boolean
) {
  const onCommandRef = useRef(onCommand);
  const onMetronomeCommandRef = useRef(onMetronomeCommand);
  const onBackingTrackCommandRef = useRef(onBackingTrackCommand);
  const onGuitarTabDisplayCommandRef = useRef(onGuitarTabDisplayCommand);
  const onSpotifyCommandRef = useRef(onSpotifyCommand);
  const onTunerCommandRef = useRef(onTunerCommand);
  const isSpotifyActiveRef = useRef(isSpotifyActive ?? false);
  const isTunerActiveRef = useRef(isTunerActive ?? false);
  const isMetronomeActiveRef = useRef(isMetronomeActive ?? false);
  const isBackingTrackActiveRef = useRef(isBackingTrackActive ?? false);
  const isGuitarTabActiveRef = useRef(isGuitarTabActive ?? false);
  const lastCommandTimeRef = useRef(0);
  const lastSpotifySkipTimeRef = useRef(0);
  onSpotifyCommandRef.current = onSpotifyCommand;
  onTunerCommandRef.current = onTunerCommand;
  isSpotifyActiveRef.current = isSpotifyActive ?? false;
  isTunerActiveRef.current = isTunerActive ?? false;
  isMetronomeActiveRef.current = isMetronomeActive ?? false;
  isBackingTrackActiveRef.current = isBackingTrackActive ?? false;
  isGuitarTabActiveRef.current = isGuitarTabActive ?? false;

  const lastMetronomeStartTimeRef = voiceCooldownRefs?.lastMetronomeStartTime;
  const lastGuitarTabDisplayFromBackendTimeRef = voiceCooldownRefs?.lastGuitarTabDisplayFromBackendTime;

  const isInMetronomeStopCooldown = (now: number): boolean => {
    if (!lastMetronomeStartTimeRef) return false;
    const elapsed = now - lastMetronomeStartTimeRef.current;
    return elapsed >= 0 && elapsed < METRONOME_START_COOLDOWN_MS;
  };
  const isInGuitarTabCloseCooldown = (now: number): boolean => {
    if (!lastGuitarTabDisplayFromBackendTimeRef) return false;
    const elapsed = now - lastGuitarTabDisplayFromBackendTimeRef.current;
    return elapsed >= 0 && elapsed < GUITAR_TAB_CLOSE_COOLDOWN_MS;
  };
  const enabledRef = useRef(enabled);
  const waitingForBackingDescriptionRef = useRef(false);
  const chimePlayedForBackingRef = useRef(false);
  const lastBackingChimeTimeRef = useRef(0);
  const backingDescriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForDisplayDescriptionRef = useRef(false);
  const chimePlayedForDisplayRef = useRef(false);
  const displayDescriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForMetronomeBpmRef = useRef(false);
  const chimePlayedForMetronomeRef = useRef(false);
  const metronomeBpmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onCommandRef.current = onCommand;
  onMetronomeCommandRef.current = onMetronomeCommand;
  onBackingTrackCommandRef.current = onBackingTrackCommand;
  onGuitarTabDisplayCommandRef.current = onGuitarTabDisplayCommand;
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

        // When backing track is active (playing or paused), only respond to: microphone on/off, stop, resume, pause. Ignore all other speech (no chime).
        if (isBackingTrackActiveRef.current) {
          const allowed =
            isMicOnCommand(transcript) ||
            isMicOffCommand(transcript) ||
            isStopOrCloseCommand(transcript) ||
            isPlayOrResumeCommand(transcript) ||
            isPauseCommand(transcript);
          if (!allowed) continue;
        }

        // Play chime only when "carrot" looks like a command (not conversational), and not in backing_track mode; cooldown avoids repeated chimes when discussing backing tracks.
        const backingDesc = extractBackingTrackDescription(transcript);
        const backingChimeOk =
          backingDesc !== null &&
          !isBackingTrackActiveRef.current &&
          isBackingTrackCommandPhrase(transcript) &&
          !chimePlayedForBackingRef.current &&
          now - lastBackingChimeTimeRef.current >= BACKING_CHIME_COOLDOWN_MS;
        if (backingChimeOk) {
          playChime();
          chimePlayedForBackingRef.current = true;
          lastBackingChimeTimeRef.current = now;
        }
        if (extractDisplayDescription(transcript) !== null && !chimePlayedForDisplayRef.current) {
          playChime();
          chimePlayedForDisplayRef.current = true;
        }
        if (transcriptContainsPhrase(transcript, PHRASE_METRONOME) && !chimePlayedForMetronomeRef.current) {
          playChime();
          chimePlayedForMetronomeRef.current = true;
        }

        // Act on interim results for short commands to reduce latency (same pattern as backing track chime)
        if (!result.isFinal) {
          if (now - lastCommandTimeRef.current < INTERIM_DEBOUNCE_MS) {
            continue;
          }
          if (isMicOnCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command (interim): microphone on');
            continue;
          }
          if (isMicOffCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command (interim): microphone off');
            continue;
          }
          if (isSpotifyActiveRef.current && onSpotifyCommandRef.current) {
            const spotify = onSpotifyCommandRef.current;
            if (isPauseCommand(transcript)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              spotify('pause');
              console.log('Voice command (interim): Spotify pause');
              continue;
            }
            // No interim handling for play/resume - only final results; reduces false positives when mic is on during pause
            if (isStopCommand(transcript)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              spotify('stop');
              console.log('Voice command (interim): Spotify stop');
              continue;
            }
            // No interim handling for skip - only final results; prevents double-skip when interim + final both fire
          }
          if (isTunerActiveRef.current && onTunerCommandRef.current && isCloseTunerCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onTunerCommandRef.current('close');
            console.log('Voice command (interim): tuner close');
            continue;
          }
          if (
            isGuitarTabActiveRef.current &&
            onGuitarTabDisplayCommandRef.current &&
            (isCloseDisplayCommand(transcript) || isCloseCommand(transcript))
          ) {
            if (isInGuitarTabCloseCooldown(now)) {
              console.log('Voice command (interim): ignoring close display (backend cooldown)');
              continue;
            }
            lastCommandTimeRef.current = now;
            playChimeDown();
            onGuitarTabDisplayCommandRef.current('close');
            console.log('Voice command (interim): close display');
            continue;
          }
          if (isMetronomeActiveRef.current && onMetronomeCommandRef.current) {
            const metronome = onMetronomeCommandRef.current;
            if (isPlayOrResumeCommand(transcript)) {
              lastCommandTimeRef.current = now;
              playChime();
              metronome('play');
              console.log('Voice command (interim): metronome play/resume');
              continue;
            }
            if (isPauseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              metronome('pause');
              console.log('Voice command (interim): metronome pause');
              continue;
            }
            if (isStopOrCloseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              metronome('stop');
              console.log('Voice command (interim): metronome stop/close');
              continue;
            }
          }
          // Only handle backing track pause/resume/stop when backing track is actually active
          if (isBackingTrackActiveRef.current && onBackingTrackCommandRef.current) {
            if (isPauseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('pause');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('pause');
              console.log('Voice command (interim): backing track pause');
              continue;
            }
            if (isPlayOrResumeCommand(transcript) && !isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
              playChime();
              onBackingTrackCommandRef.current('play');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('play');
              console.log('Voice command (interim): backing track play/resume');
              continue;
            }
            if (isStopOrCloseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('stop');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
              console.log('Voice command (interim): backing track stop/close');
              continue;
            }
          }
          continue;
        }

        // If we're waiting for a guitar tab display description, next utterance is the chord (unless it's a command)
        if (waitingForDisplayDescriptionRef.current && onGuitarTabDisplayCommandRef.current) {
          waitingForDisplayDescriptionRef.current = false;
          if (displayDescriptionTimeoutRef.current) {
            clearTimeout(displayDescriptionTimeoutRef.current);
            displayDescriptionTimeoutRef.current = null;
          }
          if (isCloseDisplayCommand(transcript) || isCloseCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onGuitarTabDisplayCommandRef.current('close');
            console.log('Voice command: close display');
            return;
          }
          if (isMicOffCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command: microphone off');
            return;
          }
          if (isMicOnCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command: microphone on');
            return;
          }
          if (isStopOrCloseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            if (onBackingTrackCommandRef.current) onBackingTrackCommandRef.current('stop');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
            onGuitarTabDisplayCommandRef.current('close');
            console.log('Voice command: stop/close (close display + backing + metronome)');
            return;
          }
          lastCommandTimeRef.current = now;
          onGuitarTabDisplayCommandRef.current('show', transcript || '');
              console.log('Voice command: eggplant (follow-up)', transcript || '');
          return;
        }

        // If we're waiting for a backing track description, next utterance is the description (unless it's a command)
        if (waitingForBackingDescriptionRef.current && onBackingTrackCommandRef.current) {
          waitingForBackingDescriptionRef.current = false;
          if (backingDescriptionTimeoutRef.current) {
            clearTimeout(backingDescriptionTimeoutRef.current);
            backingDescriptionTimeoutRef.current = null;
          }
          if (isMicOffCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command: microphone off');
            return;
          }
          if (isMicOnCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command: microphone on');
            return;
          }
          if (isStopOrCloseCommand(transcript)) {
            if (!isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('stop');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
              console.log('Voice command: stop/close (backing + metronome)');
            }
            return;
          }
          if (isPauseCommand(transcript)) {
            if (!isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('pause');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('pause');
              console.log('Voice command: backing track pause');
            }
            return;
          }
          // Only treat "play"/"resume" as backing track resume when backing track is active
          if (isBackingTrackActiveRef.current && isPlayOrResumeCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            playChime();
            onBackingTrackCommandRef.current('play');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('play');
            console.log('Voice command: backing track play/resume');
            return;
          }
          if (isSaveCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onBackingTrackCommandRef.current('save');
            console.log('Voice command: backing track save');
            return;
          }
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null && onMetronomeCommandRef.current) {
            lastCommandTimeRef.current = now;
            playChime();
            const hasMetronomeWord = transcriptContainsPhrase(transcript, PHRASE_METRONOME);
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

        // If we're waiting for a metronome BPM — same idle pattern as backing track: any utterance clears timeout and stops waiting, then we branch
        if (waitingForMetronomeBpmRef.current && onMetronomeCommandRef.current) {
          waitingForMetronomeBpmRef.current = false;
          chimePlayedForMetronomeRef.current = false;
          if (metronomeBpmTimeoutRef.current) {
            clearTimeout(metronomeBpmTimeoutRef.current);
            metronomeBpmTimeoutRef.current = null;
          }
          if (isMicOffCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command: microphone off');
            return;
          }
          if (isMicOnCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command: microphone on');
            return;
          }
          if (isStopOrCloseCommand(transcript)) {
            if (!isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              if (onBackingTrackCommandRef.current) onBackingTrackCommandRef.current('stop');
              onMetronomeCommandRef.current('stop');
              console.log('Voice command: stop/close (backing + metronome)');
            }
            return;
          }
          if (onBackingTrackCommandRef.current) {
            const backingDesc = extractBackingTrackDescription(transcript);
            if (backingDesc !== null) {
              lastCommandTimeRef.current = now;
              playChime();
              if (backingDesc.trim() !== '') {
                onBackingTrackCommandRef.current('describe', backingDesc);
                console.log('Voice command: backing track', backingDesc);
              } else {
                waitingForBackingDescriptionRef.current = true;
                if (backingDescriptionTimeoutRef.current) clearTimeout(backingDescriptionTimeoutRef.current);
                backingDescriptionTimeoutRef.current = setTimeout(() => {
                  backingDescriptionTimeoutRef.current = null;
                  waitingForBackingDescriptionRef.current = false;
                  playChimeDown();
                  console.log('Voice command: backing track description timeout (5s)');
                }, BACKING_DESCRIPTION_TIMEOUT_MS);
                console.log('Voice command: backing track (say description after chime)');
              }
              chimePlayedForBackingRef.current = false;
              return;
            }
            if (isPauseCommand(transcript)) {
              if (!isInMetronomeStopCooldown(now)) {
                lastCommandTimeRef.current = now;
                playChimeDown();
                onBackingTrackCommandRef.current('pause');
                if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('pause');
                console.log('Voice command: backing track pause');
              }
              return;
            }
            // Only backing track "play"/"resume" when backing is active
            if (isBackingTrackActiveRef.current && isPlayOrResumeCommand(transcript)) {
              lastCommandTimeRef.current = now;
              onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
              playChime();
              onBackingTrackCommandRef.current('play');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('play');
              console.log('Voice command: backing track play/resume');
              return;
            }
            if (isSaveCommand(transcript)) {
              lastCommandTimeRef.current = now;
              playChime();
              onBackingTrackCommandRef.current('save');
              console.log('Voice command: backing track save');
              return;
            }
          }
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null) {
            lastCommandTimeRef.current = now;
            playChime();
            onMetronomeCommandRef.current('start', bpm);
            console.log('Voice command: metronome (follow-up)', bpm);
            return;
          }
          // Not a number and not a command: cancel wait (already cleared above), do nothing else
          return;
        }

        // When backing track is active, handle allowed commands (mic on/off, stop, resume, pause) before cooldown so they always work
        if (isBackingTrackActiveRef.current && result.isFinal) {
          lastCommandTimeRef.current = now;
          if (isMicOffCommand(transcript)) {
            playChimeDown();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            console.log('Voice command (backing track): microphone off');
            return;
          }
          if (isMicOnCommand(transcript)) {
            playChime();
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
            console.log('Voice command (backing track): microphone on');
            return;
          }
          if (isStopOrCloseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
            playChimeDown();
            if (onBackingTrackCommandRef.current) onBackingTrackCommandRef.current('stop');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
            console.log('Voice command (backing track): stop');
            return;
          }
          if (isPlayOrResumeCommand(transcript) && !isInMetronomeStopCooldown(now)) {
            lastCommandTimeRef.current = now;
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            playChime();
            if (onBackingTrackCommandRef.current) onBackingTrackCommandRef.current('play');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('play');
            console.log('Voice command (backing track): play/resume');
            return;
          }
          if (isPauseCommand(transcript) && !isInMetronomeStopCooldown(now)) {
            playChimeDown();
            if (onBackingTrackCommandRef.current) onBackingTrackCommandRef.current('pause');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('pause');
            console.log('Voice command (backing track): pause');
            return;
          }
        }

        if (now - lastCommandTimeRef.current < COOLDOWN_MS) return;

        // When Spotify face is active, handle Spotify transport commands first (frontend only)
        // Check pause/play before restart - "pause" can be misheard as "restart" or "start over"
        if (isSpotifyActiveRef.current && onSpotifyCommandRef.current) {
          const spotify = onSpotifyCommandRef.current;
          if (isPauseCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            spotify('pause');
            console.log('Voice command: Spotify pause');
            return;
          }
          if (isSpotifyPlayOrResumeCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            spotify('play');
            console.log('Voice command: Spotify play');
            return;
          }
          if (isRestartCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            spotify('restart');
            console.log('Voice command: Spotify restart');
            return;
          }
          const seek = parseSpotifySeekSeconds(transcript);
          if (seek !== null) {
            lastCommandTimeRef.current = now;
            playChime();
            spotify(seek.direction === 'rewind' ? 'rewind' : 'forward', seek.seconds);
            console.log('Voice command: Spotify', seek.direction, seek.seconds, 'seconds');
            return;
          }
          if (isSpotifyRewindPhrase(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            spotify('rewind', 15);
            console.log('Voice command: Spotify rewind (default 15s)');
            return;
          }
          if (isSpotifyForwardPhrase(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            spotify('forward', 15);
            console.log('Voice command: Spotify forward (default 15s)');
            return;
          }
          if (isStopCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChimeDown();
            spotify('stop');
            console.log('Voice command: Spotify stop');
            return;
          }
          if (isSkipCommand(transcript)) {
            if (now - lastSpotifySkipTimeRef.current < SPOTIFY_SKIP_COOLDOWN_MS) return;
            lastSpotifySkipTimeRef.current = now;
            lastCommandTimeRef.current = now;
            playChime();
            spotify('skip');
            console.log('Voice command: Spotify skip');
            return;
          }
        }

        // When tuner face is active, "stop", "close", "close tuner" etc. close it and return to neutral
        if (isTunerActiveRef.current && onTunerCommandRef.current && isCloseTunerCommand(transcript)) {
          lastCommandTimeRef.current = now;
          playChimeDown();
          onTunerCommandRef.current('close');
          console.log('Voice command: tuner close');
          return;
        }

        if (isMicOffCommand(transcript)) {
          lastCommandTimeRef.current = now;
          playChimeDown();
          onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
          console.log('Voice command: microphone off');
          return;
        }
        if (isMicOnCommand(transcript)) {
          lastCommandTimeRef.current = now;
          playChime();
          onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: true });
          console.log('Voice command: microphone on');
          return;
        }
        if (
          isGuitarTabActiveRef.current &&
          onGuitarTabDisplayCommandRef.current &&
          (isCloseDisplayCommand(transcript) || isCloseCommand(transcript))
        ) {
          if (isInGuitarTabCloseCooldown(now)) {
            console.log('Voice command: ignoring close display (backend cooldown)');
            return;
          }
          lastCommandTimeRef.current = now;
          playChimeDown();
          onGuitarTabDisplayCommandRef.current('close');
          console.log('Voice command: close display');
          return;
        }
        if (onGuitarTabDisplayCommandRef.current) {
          const displayDesc = extractDisplayDescription(transcript);
          if (displayDesc !== null) {
            lastCommandTimeRef.current = now;
            if (displayDesc.trim() !== '') {
              onGuitarTabDisplayCommandRef.current('show', displayDesc);
              console.log('Voice command: display', displayDesc);
            } else {
              waitingForDisplayDescriptionRef.current = true;
              if (displayDescriptionTimeoutRef.current) clearTimeout(displayDescriptionTimeoutRef.current);
              displayDescriptionTimeoutRef.current = setTimeout(() => {
                displayDescriptionTimeoutRef.current = null;
                waitingForDisplayDescriptionRef.current = false;
                playChimeDown();
                console.log('Voice command: display description timeout (5s)');
              }, DISPLAY_DESCRIPTION_TIMEOUT_MS);
              console.log('Voice command: eggplant (say chord after chime)');
            }
            chimePlayedForDisplayRef.current = false;
            return;
          }
        }
        if (onBackingTrackCommandRef.current) {
          const backingDesc = extractBackingTrackDescription(transcript);
          if (backingDesc !== null) {
            lastCommandTimeRef.current = now;
            if (backingDesc.trim() === '') {
              if (backingDescriptionTimeoutRef.current) clearTimeout(backingDescriptionTimeoutRef.current);
              waitingForBackingDescriptionRef.current = true;
              backingDescriptionTimeoutRef.current = setTimeout(() => {
                backingDescriptionTimeoutRef.current = null;
                waitingForBackingDescriptionRef.current = false;
                playChimeDown();
                console.log('Voice command: backing track description timeout (5s)');
              }, BACKING_DESCRIPTION_TIMEOUT_MS);
              console.log('Voice command: backing track (say description after chime)');
            } else {
              onBackingTrackCommandRef.current('describe', backingDesc);
              console.log('Voice command: backing track', backingDesc);
            }
            chimePlayedForBackingRef.current = false; // so next "backing track" plays chime again
            return;
          }
          if (isStopOrCloseCommand(transcript)) {
            if (!isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('stop');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('stop');
              console.log('Voice command: stop/close (backing + metronome)');
            }
            return;
          }
          if (isPauseCommand(transcript)) {
            if (!isInMetronomeStopCooldown(now)) {
              lastCommandTimeRef.current = now;
              playChimeDown();
              onBackingTrackCommandRef.current('pause');
              if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('pause');
              console.log('Voice command: backing track pause');
            }
            return;
          }
          // Only handle "play"/"resume" as backing/metronome resume when backing track is active
          if (isBackingTrackActiveRef.current && isPlayOrResumeCommand(transcript)) {
            lastCommandTimeRef.current = now;
            onCommandRef.current({ type: 'set_backend_mic_enabled', enabled: false });
            playChime();
            onBackingTrackCommandRef.current('play');
            if (onMetronomeCommandRef.current) onMetronomeCommandRef.current('play');
            console.log('Voice command: backing track play/resume');
            return;
          }
          if (isSaveCommand(transcript)) {
            lastCommandTimeRef.current = now;
            playChime();
            onBackingTrackCommandRef.current('save');
            console.log('Voice command: backing track save');
            return;
          }
        }
        if (onMetronomeCommandRef.current && isStopOrCloseCommand(transcript)) {
          if (isInMetronomeStopCooldown(now)) {
            console.log('Voice command: ignoring metronome stop/close (start cooldown)');
          } else {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onMetronomeCommandRef.current('stop');
            console.log('Voice command: metronome stop/close');
          }
          return;
        }
        if (onMetronomeCommandRef.current && isPauseCommand(transcript)) {
          if (isInMetronomeStopCooldown(now)) {
            console.log('Voice command: ignoring metronome pause (start cooldown)');
          } else {
            lastCommandTimeRef.current = now;
            playChimeDown();
            onMetronomeCommandRef.current('pause');
            console.log('Voice command: metronome pause');
          }
          return;
        }
        if (isMetronomeActiveRef.current && onMetronomeCommandRef.current && isPlayOrResumeCommand(transcript)) {
          lastCommandTimeRef.current = now;
          playChime();
          onMetronomeCommandRef.current('play');
          console.log('Voice command: metronome play/resume');
          return;
        }
        // While metronome is playing: a number (e.g. "90", "120 bpm") changes BPM without stopping
        if (isMetronomeActiveRef.current && onMetronomeCommandRef.current) {
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null) {
            lastCommandTimeRef.current = now;
            playChime();
            onMetronomeCommandRef.current('setBpm', bpm);
            console.log('Voice command: metronome setBpm (while playing)', bpm);
            return;
          }
        }
        if (onMetronomeCommandRef.current && transcriptContainsPhrase(transcript, PHRASE_METRONOME)) {
          const bpm = parseMetronomeBpm(transcript);
          lastCommandTimeRef.current = now;
          if (bpm !== null) {
            playChime();
            onMetronomeCommandRef.current('start', bpm);
            console.log('Voice command: metronome', bpm);
          } else {
            if (metronomeBpmTimeoutRef.current) clearTimeout(metronomeBpmTimeoutRef.current);
            waitingForMetronomeBpmRef.current = true;
            metronomeBpmTimeoutRef.current = setTimeout(() => {
              metronomeBpmTimeoutRef.current = null;
              waitingForMetronomeBpmRef.current = false;
              chimePlayedForMetronomeRef.current = false;
              playChimeDown();
              console.log('Voice command: metronome BPM timeout (5s)');
            }, METRONOME_BPM_TIMEOUT_MS);
            console.log('Voice command: metronome (say BPM after chime)');
          }
          chimePlayedForMetronomeRef.current = false;
          return;
        }
        if (onMetronomeCommandRef.current) {
          const bpm = parseMetronomeBpm(transcript);
          if (bpm !== null) {
            lastCommandTimeRef.current = now;
            playChime();
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
      if (backingDescriptionTimeoutRef.current) {
        clearTimeout(backingDescriptionTimeoutRef.current);
        backingDescriptionTimeoutRef.current = null;
      }
      waitingForDisplayDescriptionRef.current = false;
      chimePlayedForDisplayRef.current = false;
      if (displayDescriptionTimeoutRef.current) {
        clearTimeout(displayDescriptionTimeoutRef.current);
        displayDescriptionTimeoutRef.current = null;
      }
      waitingForMetronomeBpmRef.current = false;
      chimePlayedForMetronomeRef.current = false;
      if (metronomeBpmTimeoutRef.current) {
        clearTimeout(metronomeBpmTimeoutRef.current);
        metronomeBpmTimeoutRef.current = null;
      }
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [enabled]);
}
