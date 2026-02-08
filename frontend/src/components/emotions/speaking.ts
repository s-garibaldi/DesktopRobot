import type { EmotionDrawFunction } from './types';

const MOUTH_BASE_Y = 35;
const MOUTH_HALF_WIDTH = 45;
const MOUTH_SEGMENTS = 80;
const MOUTH_AMPLITUDE = 10;
const MOUTH_SPEED = 3.2;
const MOUTH_F1 = 4.2;
const MOUTH_F2 = 2.7;
const MOUTH_F3 = 6.1;
const MOUTH_K1 = 0.25;
const MOUTH_K2 = 0.15;
const MOUTH_K3 = 0.35;

/** Draws only the animated waveform mouth. Alpha 0–1 fades it in/out. Use after scaling by breathingScale. */
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
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow * alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const T = time * MOUTH_SPEED;
  for (let i = 0; i <= MOUTH_SEGMENTS; i++) {
    const t = i / MOUTH_SEGMENTS;
    const x = (t * 2 - 1) * MOUTH_HALF_WIDTH;
    const n = x / MOUTH_HALF_WIDTH;
    const envelope = Math.exp(-n * n * 2.5);
    const y =
      envelope *
      MOUTH_AMPLITUDE *
      (Math.sin(MOUTH_F1 * T + MOUTH_K1 * x) * 0.5 +
        Math.sin(MOUTH_F2 * T + MOUTH_K2 * x) * 0.35 +
        Math.sin(MOUTH_F3 * T + MOUTH_K3 * x) * 0.25);
    if (i === 0) ctx.moveTo(x, -y);
    else ctx.lineTo(x, -y);
  }
  ctx.stroke();
  ctx.restore();
}

// SPEAKING emotion - neon face with full-circle eyes and animated waveform mouth (sound/speech)
export const drawSpeaking: EmotionDrawFunction = (ctx, time, breathingPhase, _transitionProgress = 1) => {
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
  ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x, highlightOffset.y, highlightSize, 0, Math.PI * 2);
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
  ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(highlightOffset.x, highlightOffset.y, highlightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSpeakingMouth(ctx, time, 1);

  ctx.restore();
};
