import type { EmotionDrawFunction } from './types';
import { smoothEase } from './types';
import { getPupilFloat } from './neutral';

// Smooth oscillation (match neutral/time/listening)
const smoothPulse = (t: number, freq: number, min: number, max: number) => {
  const s = Math.sin(t * freq);
  return min + (max - min) * (s * 0.5 + 0.5);
};

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
  const secondaryGlow = smoothPulse(time, 2.1, 0.9, 1);

  ctx.save();
  ctx.translate(0, MOUTH_BASE_Y);
  ctx.shadowBlur = 32 + (smoothPulse(time, 2, 0, 1) - 0.5) * 20;
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
  const breathEase = smoothEase(breathingPhase);
  const breathingScale = 1 + (breathEase - 0.5) * 0.04;
  const boxGlow = smoothEase(breathingPhase);
  const primaryGlow = smoothPulse(time, 0.6, 0.9, 1);
  const secondaryGlow = smoothPulse(time, 0.65, 0.9, 1);
  const tertiaryGlow = smoothPulse(time, 0.7, 0.93, 1);

  const faceWidth = 225;
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

  const boxPath = () => {
    ctx.beginPath();
    ctx.roundRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight, cornerRadius);
  };

  // 1. Outer ambient glow (synced to breathing)
  ctx.save();
  ctx.shadowBlur = 48 + boxGlow * 14;
  ctx.shadowColor = 'rgba(0, 255, 255, 0.25)';
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.58 + boxGlow * 0.12;
  boxPath();
  ctx.stroke();
  ctx.restore();

  // 2. Inner glow (subtle fill)
  ctx.save();
  ctx.globalAlpha = 0.025 + boxGlow * 0.025;
  ctx.fillStyle = '#00FFFF';
  boxPath();
  ctx.fill();
  ctx.restore();

  // 3. Main head outline with gradient stroke (brighter at top)
  const gradient = ctx.createLinearGradient(0, -faceHeight / 2, 0, faceHeight / 2);
  gradient.addColorStop(0, 'rgba(150, 255, 255, 1)');
  gradient.addColorStop(0.5, '#00FFFF');
  gradient.addColorStop(1, 'rgba(0, 200, 255, 0.95)');
  ctx.shadowBlur = 28 + boxGlow * 14;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 6;
  ctx.globalAlpha = (0.9 + boxGlow * 0.1) * primaryGlow;
  boxPath();
  ctx.stroke();

  // Left eye: cyan ring, black pupil, cyan highlight (same dimensions as neutral)
  ctx.save();
  ctx.translate(-eyeSpacing, -10);
  ctx.shadowBlur = 30 + (smoothPulse(time, 1.8, 0, 1) - 0.5) * 16;
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
  ctx.shadowBlur = 8 + (smoothPulse(time, 2.5, 0, 1) - 0.5) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x + fromNeutralPupilOffset.x, highlightOffset.y + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right eye
  ctx.save();
  ctx.translate(eyeSpacing, -10);
  ctx.shadowBlur = 30 + (smoothPulse(time, 1.8, 0, 1) - 0.5) * 16;
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
  ctx.shadowBlur = 8 + (smoothPulse(time, 2.5, 0, 1) - 0.5) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x + fromNeutralPupilOffset.x, highlightOffset.y + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSpeakingMouth(ctx, time, 1);

  ctx.restore();
};
