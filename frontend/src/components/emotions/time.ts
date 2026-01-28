import type { EmotionDrawFunction } from './types';
import { drawNeutral } from './neutral';
import { lerp, easeInOut } from './types';

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
    // Draw neutral at full opacity, we control scale and fade via transforms
    drawNeutral(ctx, time, breathingPhase, 1, 'neutral');
    ctx.restore();
  }

  // Draw time text fading in
  if (timeAlpha > 0.01) {
    const now = new Date();
    const hours24 = now.getHours();
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours24 < 12 ? 'AM' : 'PM';

    const mainTime = `${hours12}:${minutes}`;

    ctx.save();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = timeAlpha;

    // Main time display – no glow; stroke for crisp definition
    ctx.font = '600 80px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    const timeMetrics = ctx.measureText(mainTime);
    const timeWidth = timeMetrics.width;

    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(mainTime, 0, 0);
    ctx.fillStyle = '#00FFFF';
    ctx.fillText(mainTime, 0, 0);

    // Small AM/PM indicator – no glow, subtle stroke for definition
    ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const timeBottom = (timeMetrics.actualBoundingBoxDescent || 40);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeText(ampm, timeWidth / 2 + 8, timeBottom);
    ctx.fillStyle = '#00FFFF';
    ctx.fillText(ampm, timeWidth / 2 + 8, timeBottom);

    ctx.restore();
  }
};

