import type { EmotionDrawFunction } from '../face/emotions/types';
import { getMetronomeBpm } from './metronomeStore';
import { playTickIfNewBeat } from './metronomeAudio';

// METRONOME emotion - blinking blue screen synced to BPM
// Uses performance.now() for accurate wall-clock timing (frame-based time drifts)
export const drawMetronome: EmotionDrawFunction = (ctx, _time, _breathingPhase, transitionProgress = 1, fromEmotion) => {
  const bpm = getMetronomeBpm();
  const beatsPerSecond = bpm / 60;
  const period = 1 / beatsPerSecond; // seconds per beat

  const realTimeSeconds = performance.now() / 1000;
  const phase = (realTimeSeconds % period) / period;
  const isOn = phase < 0.2;

  // When coming from thinking: no overlap — blink only after thinking has fully faded
  const fullyTransitioned = transitionProgress >= 1 || fromEmotion !== 'thinking';

  // Play tick sound when light flashes (only when fully visible to avoid extra ticks during transitions)
  if (fullyTransitioned) {
    playTickIfNewBeat(realTimeSeconds, period, phase);
  }

  // Interpolate alpha for smooth transition in/out
  let alpha = isOn ? 1 : 0;
  const fadeDuration = 0.03;
  if (phase < fadeDuration) {
    alpha = phase / fadeDuration;
  } else if (phase < 0.2 - fadeDuration) {
    alpha = 1;
  } else if (phase < 0.2) {
    alpha = (0.2 - phase) / fadeDuration;
  }

  // Apply transition from previous emotion (fade in metronome). From thinking: no blink until transition done.
  const effectiveAlpha = fullyTransitioned
    ? alpha * Math.min(1, transitionProgress * 1.5)
    : 0;

  ctx.save();

  // Fill entire canvas with blue (canvas is centered, so cover from -max to +max)
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = '#00FFFF';
  ctx.globalAlpha = effectiveAlpha;
  ctx.fillRect(-w, -h, w * 2, h * 2);

  ctx.restore();
};
