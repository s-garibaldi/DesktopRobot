import type { EmotionDrawFunction } from './types';
import { getPupilFloat } from './neutral';

const MOUTH_BASE_Y = 35;
const MOUTH_HALF_WIDTH = 45;
const MOUTH_SPEED = 76;
// Bell curve: flat at edges, peak at center. Higher = flatter edges.
const BELL_SHARPNESS = 5;
// Voice-memo style: vertical bars. Count and max half-height (symmetric up/down from baseline).
const MOUTH_NUM_BARS = 25;
const MOUTH_MAX_BAR_HALF_HEIGHT = 10;
const MOUTH_BAR_WIDTH = 3;
// Cyclical wave for bar height variation (same animation feel).
const MOUTH_CYCLES = [3, 4, 5, 6, 7];
const MOUTH_CYCLE_WEIGHTS = [0.4, 0.3, 0.2, 0.07, 0.03];

/** Draws only the animated waveform mouth. Alpha 0–1 fades it in/out. Use after scaling by breathingScale.
 *  Voice-memo style: vertical bars on a baseline, bell envelope (flat edges, large center), cyclical variation animated over time. */
export function drawSpeakingMouth(
  ctx: CanvasRenderingContext2D,
  time: number,
  alpha: number
): void {
  const secondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1;

  ctx.save();
  ctx.translate(0, MOUTH_BASE_Y);
  ctx.shadowBlur = 32 + Math.sin(time * 2) * 10;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = MOUTH_BAR_WIDTH;
  ctx.globalAlpha = secondaryGlow * alpha;
  ctx.lineCap = 'round';

  const T = time * MOUTH_SPEED;
  for (let i = 0; i < MOUTH_NUM_BARS; i++) {
    const t = i / (MOUTH_NUM_BARS - 1);
    const x = (t * 2 - 1) * MOUTH_HALF_WIDTH;
    const n = x / MOUTH_HALF_WIDTH; // -1 .. 1
    // Bell envelope: flat at edges, peak at center.
    const envelope = Math.exp(-n * n * BELL_SHARPNESS);
    // Cyclical waves for bar height variation (animates with time).
    let wave = 0;
    for (let c = 0; c < MOUTH_CYCLES.length; c++) {
      wave +=
        MOUTH_CYCLE_WEIGHTS[c] *
        Math.sin(MOUTH_CYCLES[c] * Math.PI * n + T * (1 + c * 0.3));
    }
    // Bar half-height: envelope + cyclical variation (0.35–1.0 of max).
    const variation = 0.35 + 0.65 * (0.5 + 0.5 * wave);
    const halfH = envelope * MOUTH_MAX_BAR_HALF_HEIGHT * variation;
    ctx.beginPath();
    ctx.moveTo(x, -halfH);
    ctx.lineTo(x, halfH);
    ctx.stroke();
  }
  ctx.restore();
}

// SPEAKING emotion - neon face with full-circle eyes and animated waveform mouth (sound/speech)
export const drawSpeaking: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, fromEmotion) => {
  const breathingScale = 1 + Math.sin(breathingPhase) * 0.03;
  const primaryGlow = 0.85 + Math.sin(time * 1.2) * 0.15;
  const secondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1;
  const tertiaryGlow = 0.95 + Math.sin(time * 3.3) * 0.05;

  const faceWidth = 200;
  const faceHeight = 150;
  const cornerRadius = 20;
  const eyeSpacing = 50;
  const eyeRadius = 25;
  const pupilRadius = 15;
  const highlightOffset = { x: -3, y: -3 };
  const highlightSize = 4;
  // When from neutral: pupils drift quickly back to center (offset goes 1 -> 0).
  const fromNeutralPupilOffset = fromEmotion === 'neutral'
    ? { x: (1 - transitionProgress) * getPupilFloat(time).x, y: (1 - transitionProgress) * getPupilFloat(time).y }
    : { x: 0, y: 0 };

  ctx.save();
  ctx.scale(breathingScale, breathingScale);

  // Rounded rectangular head outline (neon cyan)
  ctx.shadowBlur = 30 + Math.sin(time * 1.5) * 10;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 6;
  ctx.globalAlpha = primaryGlow;
  ctx.beginPath();
  ctx.roundRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight, cornerRadius);
  ctx.stroke();

  // Left eye: cyan ring, black pupil, cyan highlight (same dimensions as neutral)
  ctx.save();
  ctx.translate(-eyeSpacing, -10);
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0 + fromNeutralPupilOffset.x, 0 + fromNeutralPupilOffset.y, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x + fromNeutralPupilOffset.x, highlightOffset.y + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right eye
  ctx.save();
  ctx.translate(eyeSpacing, -10);
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0 + fromNeutralPupilOffset.x, 0 + fromNeutralPupilOffset.y, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x + fromNeutralPupilOffset.x, highlightOffset.y + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSpeakingMouth(ctx, time, 1);

  ctx.restore();
};
