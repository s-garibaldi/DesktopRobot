import { EmotionDrawFunction, lerp, smoothEase } from './types';

/** Same pupil float as drawNeutral; used by other emotions when transitioning from neutral so pupils drift to center. */
export function getPupilFloat(time: number): { x: number; y: number } {
  const pupilFreq = 0.55;
  return {
    x: Math.sin(time * pupilFreq) * 2.5 + Math.sin(time * pupilFreq * 1.08) * 1.2,
    y: Math.cos(time * pupilFreq * 0.92) * 1.8 + Math.cos(time * pupilFreq * 1.15) * 1
  };
}

// Smooth oscillation: slower frequencies, gentler feel
const smoothPulse = (t: number, freq: number, min: number, max: number) => {
  const s = Math.sin(t * freq);
  return min + (max - min) * (s * 0.5 + 0.5);
};

// NEUTRAL emotion - standard neon face with full circle eyes
export const drawNeutral: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, _fromEmotion, pupilDriftToCenter) => {
  // Extra-smooth breathing for outer box (smoothstep = zero velocity at inhale/exhale peaks)
  const breathEase = smoothEase(breathingPhase);
  const breathingScale = 1 + (breathEase - 0.5) * 0.04; // ±2% with smooth easing
  
  // Multi-layered glow - slow, harmonious frequencies (avoid harsh beats)
  const secondaryGlow = smoothPulse(time, 0.6, 0.9, 1);
  const tertiaryGlow = smoothPulse(time, 0.7, 0.93, 1);
  
  ctx.save();
  ctx.scale(breathingScale, breathingScale);
  
  // Set up proportions
  const faceWidth = 225;
  const faceHeight = 150;
  const cornerRadius = 20;
  
  // Box path (reused for outline and inner glow)
  const boxPath = () => {
    ctx.beginPath();
    ctx.roundRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight, cornerRadius);
  };
  
  // Box glow uses same smooth phase as breathing for cohesive, fluid motion
  const boxGlow = smoothEase(breathingPhase);

  // 1. Outer ambient glow (soft layer behind everything) - synced to breathing
  ctx.save();
  ctx.shadowBlur = 48 + boxGlow * 14;
  ctx.shadowColor = 'rgba(0, 255, 255, 0.25)';
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.58 + boxGlow * 0.12;
  boxPath();
  ctx.stroke();
  ctx.restore();
  
  // 2. Inner glow (subtle fill inside the box) - synced to breathing
  ctx.save();
  ctx.globalAlpha = 0.025 + boxGlow * 0.025;
  ctx.fillStyle = '#00FFFF';
  boxPath();
  ctx.fill();
  ctx.restore();
  
  // 3. Main head outline with gradient stroke (brighter at top) - synced to breathing
  const gradient = ctx.createLinearGradient(0, -faceHeight / 2, 0, faceHeight / 2);
  gradient.addColorStop(0, 'rgba(150, 255, 255, 1)');
  gradient.addColorStop(0.5, '#00FFFF');
  gradient.addColorStop(1, 'rgba(0, 200, 255, 0.95)');
  
  ctx.shadowBlur = 28 + boxGlow * 14;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.9 + boxGlow * 0.1;
  boxPath();
  ctx.stroke();
  
  // Reverse animation: transition FROM happy TO neutral
  // transitionProgress: 0 = happy (crescent), 1 = neutral (full circle)
  // This is the exact reverse of the happy animation - crescent arcs downward to form full circle
  
  // Draw left eye - exact reverse of happy animation
  ctx.save();
  ctx.translate(-50, -10);
  
  // Interpolate eye properties (reverse of happy)
  const eyeLineWidth = lerp(7, 5, transitionProgress);
  const eyeVerticalOffset = lerp(5, 0, transitionProgress);
  const eyeRadius = lerp(30, 25, transitionProgress);
  
  // Canvas angles: 0 = right, Math.PI/2 = bottom, Math.PI = left, Math.PI*1.5 = top
  const bottomAngle = Math.PI / 2;
  const crescentStart = Math.PI * 1.2;
  const crescentEnd = Math.PI * 1.8;
  
  // Soft outer glow pass for eye depth (same arc as main eye)
  const leftStartAngle = lerp(crescentStart, bottomAngle, transitionProgress);
  const leftEndAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
  ctx.shadowBlur = smoothPulse(time, 0.5, 36, 46);
  ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = eyeLineWidth + 2;
  ctx.globalAlpha = secondaryGlow * 0.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, leftStartAngle, leftEndAngle, false);
  ctx.stroke();
  
  ctx.shadowBlur = smoothPulse(time, 0.55, 26, 34);
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  
  ctx.beginPath();
  // Draw arc - crescent arcs downward to form full circle (exact reverse)
  ctx.arc(0, eyeVerticalOffset, eyeRadius, leftStartAngle, leftEndAngle, false);
  ctx.stroke();
  
  // Pupil float: smooth Lissajous-like motion (2 slow sine waves, similar freq = fluid drift).
  // When leaving neutral (pupilDriftToCenter 0→1), drift quickly back to center.
  // When entering neutral (transitionProgress < 1), float starts at center and ramps to full so no jump.
  const pupilFreq = 0.55;
  const rawPupilFloatX = Math.sin(time * pupilFreq) * 2.5 + Math.sin(time * pupilFreq * 1.08) * 1.2;
  const rawPupilFloatY = Math.cos(time * pupilFreq * 0.92) * 1.8 + Math.cos(time * pupilFreq * 1.15) * 1;
  const drift = pupilDriftToCenter != null ? Math.min(1, pupilDriftToCenter) : 0;
  const enterScale = transitionProgress; // 0 = just entered neutral (center), 1 = full float
  const pupilFloatX = (1 - drift) * rawPupilFloatX * enterScale;
  const pupilFloatY = (1 - drift) * rawPupilFloatY * enterScale;
  const highlightBaseX = -3;
  const highlightBaseY = -3;
  const highlightPulse = smoothPulse(time, 0.65, 0.88, 1);

  // Draw pupil and highlight - fade in as we transition to neutral (highlight fixed relative to pupil, no float).
  const pupilAlpha = Math.max(0, (transitionProgress * 2) - 1); // Fade in from 50% progress
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(pupilFloatX, eyeVerticalOffset + pupilFloatY, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil highlight - slightly larger, pulsing shimmer
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = smoothPulse(time, 0.6, 10, 14);
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha * highlightPulse;
    ctx.beginPath();
    ctx.arc(pupilFloatX + highlightBaseX, eyeVerticalOffset + pupilFloatY + highlightBaseY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Tiny secondary highlight for wetness
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.globalAlpha = pupilAlpha * highlightPulse * 0.5;
    ctx.beginPath();
    ctx.arc(pupilFloatX + highlightBaseX + 1, eyeVerticalOffset + pupilFloatY + highlightBaseY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Draw right eye - same reverse animation, mirrored (same pupil float so both move in sequence)
  ctx.save();
  ctx.translate(50, -10);
  
  const rightStartAngle = lerp(crescentStart, bottomAngle, transitionProgress);
  const rightEndAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
  
  ctx.shadowBlur = smoothPulse(time, 0.5, 36, 46);
  ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = eyeLineWidth + 2;
  ctx.globalAlpha = secondaryGlow * 0.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
  ctx.stroke();
  
  ctx.shadowBlur = smoothPulse(time, 0.55, 26, 34);
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
  ctx.stroke();
  
  // Right eye pupils (same pupilFloat so both eyes move in sequence; highlight fixed relative to pupil)
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(pupilFloatX, eyeVerticalOffset + pupilFloatY, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = smoothPulse(time, 0.6, 10, 14);
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha * highlightPulse;
    ctx.beginPath();
    ctx.arc(pupilFloatX + highlightBaseX, eyeVerticalOffset + pupilFloatY + highlightBaseY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.globalAlpha = pupilAlpha * highlightPulse * 0.5;
    ctx.beginPath();
    ctx.arc(pupilFloatX + highlightBaseX + 1, eyeVerticalOffset + pupilFloatY + highlightBaseY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Draw smiling mouth - fade out as we transition to neutral (reverse of happy)
  const mouthAlpha = Math.max(0, 1 - (transitionProgress * 1.25)); // Fade out as transition progresses
  if (mouthAlpha > 0) {
    ctx.save();
    ctx.translate(0, lerp(-15, 0, transitionProgress)); // Mouth position moves up as it fades
    
    ctx.shadowBlur = smoothPulse(time, 0.5, 26, 34);
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = lerp(7, 0, transitionProgress);
    ctx.globalAlpha = secondaryGlow * mouthAlpha;
    ctx.lineCap = 'round';
    
    // Smile fades away
    ctx.beginPath();
    ctx.arc(0, 0, lerp(50, 0, transitionProgress), Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.stroke();
    
    ctx.restore();
  }
  
  // Sparkles - fade out as we transition to neutral (reverse of happy)
  const sparkleAlpha = Math.max(0, 1 - (transitionProgress * 1.43)); // Fade out faster
  if (sparkleAlpha > 0) {
    const sparklePositions = [
      { x: -25, y: -18, size: 2.5 },
      { x: -22, y: -22, size: 3 },
      { x: -18, y: -20, size: 2 },
      { x: -20, y: -15, size: 2.5 },
      { x: 25, y: -18, size: 2.5 },
      { x: 22, y: -22, size: 3 },
      { x: 18, y: -20, size: 2 },
      { x: 20, y: -15, size: 2.5 }
    ];
    
    // Draw sparkles around both eyes (they fade out)
    ctx.save();
    ctx.translate(-50, lerp(-10, -10, transitionProgress));
    sparklePositions.forEach((pos, index) => {
      const sparkleGlow = smoothPulse(time + index * 0.5, 0.7, 0.55, 0.85);
      const sparkleSize = pos.size + Math.sin(time * 0.8 + index * 0.3) * 0.5;
      ctx.shadowBlur = smoothPulse(time + index * 0.2, 0.6, 10, 16);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.globalAlpha = sparkleGlow * secondaryGlow * sparkleAlpha;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    
    ctx.save();
    ctx.translate(50, lerp(-10, -10, transitionProgress));
    sparklePositions.forEach((pos, index) => {
      const sparkleGlow = smoothPulse(time + index * 0.5, 0.7, 0.55, 0.85);
      const sparkleSize = pos.size + Math.sin(time * 0.8 + index * 0.3) * 0.5;
      ctx.shadowBlur = smoothPulse(time + index * 0.2, 0.6, 10, 16);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.globalAlpha = sparkleGlow * secondaryGlow * sparkleAlpha;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  
  ctx.restore();
};
