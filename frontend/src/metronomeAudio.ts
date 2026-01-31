/**
 * Metronome tick sound using Web Audio API.
 * Plays a short click synced to each beat.
 */

let audioContext: AudioContext | null = null;
let lastBeatIndex = -1;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a short metronome tick sound.
 */
function playTick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browsers require user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Oscillator for a crisp "tick" - short sine burst
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.02);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.39, now); // 0.3 + 30%
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.025);
}

/**
 * Call each frame when metronome is active. Plays a tick when entering a new beat
 * and the light is on (phase < 0.25) so tick aligns with the flash.
 */
export function playTickIfNewBeat(realTimeSeconds: number, period: number, phase: number): void {
  const beatIndex = Math.floor(realTimeSeconds / period);
  if (beatIndex !== lastBeatIndex && phase < 0.25) {
    lastBeatIndex = beatIndex;
    playTick();
  }
}

