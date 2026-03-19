import type { EmotionDrawFunction } from './types';
import { drawNeutral } from './neutral';
import { lerp, easeInOut, smoothEase } from './types';

// Smooth oscillation (match neutral face)
const smoothPulse = (t: number, freq: number, min: number, max: number) => {
  const s = Math.sin(t * freq);
  return min + (max - min) * (s * 0.5 + 0.5);
};

// TIME emotion - shows the current local time (no face/background elements)
export const drawTime: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, fromEmotion) => {
  // Two-phase transition from neutral:
  // Phase 1 (0-0.15): Face zooms out to tiny dot quickly
  // Phase 2 (0.15-1.0): Time fades in over ~1 second
  // Reverse (fromEmotion === 'time'): Phase 1 = time fades out fast, Phase 2 = neutral zooms in from dot
  const ZOOM_OUT_PHASE_END = 0.15; // 15% of transition for zoom out / time fade out
  
  let faceScale = 1;
  let faceAlpha = 1;
  let timeAlpha = 0;
  let fadeProgress = 0; // For glow animation
  
  if (fromEmotion === 'time') {
    // When transitionProgress >= 1 we're just displaying time (no transition) — show only time, no face
    if (transitionProgress >= 1) {
      timeAlpha = 1;
      faceAlpha = 0;
      faceScale = 0.02;
      fadeProgress = 1;
    } else if (transitionProgress < ZOOM_OUT_PHASE_END) {
      // Time → neutral transition Phase 1: fast time fade out
      const fadeOutProgress = transitionProgress / ZOOM_OUT_PHASE_END;
      const easedFadeOut = easeInOut(fadeOutProgress);
      timeAlpha = 1 - easedFadeOut; // Time fades out
      faceAlpha = 0;
      faceScale = 0.02;
      fadeProgress = 1 - easedFadeOut;
    } else {
      // Time → neutral transition Phase 2: neutral zoom in from dot
      const zoomInProgress = (transitionProgress - ZOOM_OUT_PHASE_END) / (1 - ZOOM_OUT_PHASE_END);
      const easedZoomIn = easeInOut(zoomInProgress);
      timeAlpha = 0;
      faceAlpha = 1;
      faceScale = lerp(0.02, 1, easedZoomIn); // Neutral zooms in from dot
    }
  } else if (transitionProgress < ZOOM_OUT_PHASE_END) {
    // Phase 1: Zoom out face to tiny dot
    const zoomProgress = transitionProgress / ZOOM_OUT_PHASE_END;
    const easedZoom = easeInOut(zoomProgress);
    faceScale = lerp(1, 0.02, easedZoom); // Shrink to 2% size (tiny dot)
    faceAlpha = 1; // Keep face visible during zoom
    timeAlpha = 0; // Time not visible yet
    fadeProgress = 0; // No fade yet
  } else {
    // Phase 2: Face is gone, fade in time
    fadeProgress = (transitionProgress - ZOOM_OUT_PHASE_END) / (1 - ZOOM_OUT_PHASE_END);
    const easedFade = easeInOut(fadeProgress);
    faceScale = 0.02; // Face stays as tiny dot (or invisible)
    faceAlpha = 0; // Face fully gone
    timeAlpha = easedFade; // Time fades in
  }

  // Draw neutral face (zooming out when from neutral, zooming in when from time)
  if ((fromEmotion === 'neutral' || fromEmotion === 'time') && faceAlpha > 0.01 && faceScale > 0.01) {
    ctx.save();
    ctx.globalAlpha = faceAlpha;
    ctx.scale(faceScale, faceScale);
    // When zooming out from neutral, pupils drift quickly back to center (first 30% of zoom)
    const pupilDriftToCenter =
      fromEmotion === 'neutral' && transitionProgress < ZOOM_OUT_PHASE_END
        ? Math.min(1, (transitionProgress / ZOOM_OUT_PHASE_END) / 0.3)
        : undefined;
    drawNeutral(ctx, time, breathingPhase, 1, 'neutral', pupilDriftToCenter);
    ctx.restore();
  }

  // Draw time with same box as neutral face, time scaled to fit inside
  if (timeAlpha > 0.01) {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const mainTime = `${hours}:${minutes}`;
    const hoursStr = hours;

    // Box: same size and style as neutral face (225×150, corner 20)
    const faceWidth = 225;
    const faceHeight = 150;
    const cornerRadius = 20;

    // Breathing sync: all light pulsations use same phase for smooth, coherent motion (no flicker)
    const breathEase = smoothEase(breathingPhase);
    const breathingScale = 1 + (breathEase - 0.5) * 0.04;
    const boxGlow = breathEase; // Single phase for all layers
    const primaryGlow = 0.9 + (breathEase - 0.5) * 0.2; // In phase with breathing (0.8–1.0)

    const boxPath = () => {
      ctx.beginPath();
      ctx.roundRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight, cornerRadius);
    };

    ctx.save();
    ctx.globalAlpha = timeAlpha;
    ctx.scale(breathingScale, breathingScale);

    // 1. Outer ambient glow (synced to breathing)
    ctx.save();
    ctx.shadowBlur = 48 + boxGlow * 14;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.25)';
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = 8;
    ctx.globalAlpha = timeAlpha * (0.58 + boxGlow * 0.12);
    boxPath();
    ctx.stroke();
    ctx.restore();

    // 2. Inner glow (subtle fill)
    ctx.save();
    ctx.globalAlpha = timeAlpha * (0.025 + boxGlow * 0.025);
    ctx.fillStyle = '#00FFFF';
    boxPath();
    ctx.fill();
    ctx.restore();

    // 3. Main outline with gradient stroke (brighter at top, match neutral)
    const gradient = ctx.createLinearGradient(0, -faceHeight / 2, 0, faceHeight / 2);
    gradient.addColorStop(0, 'rgba(150, 255, 255, 1)');
    gradient.addColorStop(0.5, '#00FFFF');
    gradient.addColorStop(1, 'rgba(0, 200, 255, 0.95)');
    ctx.shadowBlur = 28 + boxGlow * 14;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 6;
    ctx.globalAlpha = timeAlpha * (0.9 + boxGlow * 0.1) * primaryGlow;
    boxPath();
    ctx.stroke();
    ctx.restore();

    // Measure time display at base font size to compute scale to fit inside box
    const padding = 28;
    const innerWidth = faceWidth - padding * 2;
    const innerHeight = faceHeight - padding * 2;

    const baseFontMain = 80;
    const fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.save();
    ctx.font = `600 ${baseFontMain}px ${fontFamily}`;
    const timeMetrics = ctx.measureText(mainTime);
    const mainWidth = timeMetrics.width;
    const mainHeight = (timeMetrics.actualBoundingBoxAscent || 0) + (timeMetrics.actualBoundingBoxDescent || baseFontMain * 0.4);
    const hoursWidth = ctx.measureText(hoursStr).width;
    const colonWidth = ctx.measureText(':').width;
    const minutesWidth = ctx.measureText(minutes).width;
    ctx.restore();

    const totalContentWidth = mainWidth;
    const totalContentHeight = mainHeight;
    const scale = Math.min(innerWidth / totalContentWidth, innerHeight / totalContentHeight, 1);

    // Colon blink: smooth pulse every second (smoothPulse for phase continuity, no snap)
    const colonAlpha = smoothPulse(time, Math.PI * 2, 0.25, 1);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = timeAlpha;
    ctx.scale(scale, scale);

    ctx.font = `600 ${baseFontMain}px ${fontFamily}`;

    // Center the full time string
    const totalTimeWidth = hoursWidth + colonWidth + minutesWidth;
    const startX = -totalTimeWidth / 2;

    // Light text glow for depth (reduced for crisper look)
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';

    // Subtle outline for legibility
    ctx.strokeStyle = 'rgba(0, 120, 180, 0.5)';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    // Draw hours
    ctx.strokeText(hoursStr, startX, 0);
    ctx.fillStyle = '#00FFFF';
    ctx.fillText(hoursStr, startX, 0);

    // Draw colon with blink
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * colonAlpha;
    ctx.strokeText(':', startX + hoursWidth, 0);
    ctx.fillText(':', startX + hoursWidth, 0);
    ctx.restore();

    // Draw minutes
    ctx.strokeText(minutes, startX + hoursWidth + colonWidth, 0);
    ctx.fillText(minutes, startX + hoursWidth + colonWidth, 0);

    ctx.shadowBlur = 0;

    ctx.restore();
  }
};

