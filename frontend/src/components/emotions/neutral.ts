import { EmotionDrawFunction, lerp } from './types';

// NEUTRAL emotion - standard neon face with full circle eyes
export const drawNeutral: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1) => {
  // Enhanced breathing animation
  const breathingScale = 1 + Math.sin(breathingPhase) * 0.03;
  
  // Multi-layered glow pulsing
  const primaryGlow = 0.85 + Math.sin(time * 1.2) * 0.15;
  const secondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1;
  const tertiaryGlow = 0.95 + Math.sin(time * 3.3) * 0.05;
  
  ctx.save();
  ctx.scale(breathingScale, breathingScale);
  
  // Set up proportions
  const faceWidth = 200;
  const faceHeight = 150;
  const cornerRadius = 20;
  
  // Draw the rounded rectangular head outline
  ctx.shadowBlur = 30 + Math.sin(time * 1.5) * 10;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 6;
  ctx.globalAlpha = primaryGlow;
  
  ctx.beginPath();
  ctx.roundRect(-faceWidth/2, -faceHeight/2, faceWidth, faceHeight, cornerRadius);
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
  
  ctx.shadowBlur = 30 + Math.sin(time * lerp(1, 1.8, transitionProgress)) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Exact reverse of happy animation: crescent arcs downward to form full circle
  // Canvas angles: 0 = right, Math.PI/2 = bottom, Math.PI = left, Math.PI*1.5 = top
  const bottomAngle = Math.PI / 2; // Bottom of circle
  const crescentStart = Math.PI * 1.2; // Start of happy crescent
  const crescentEnd = Math.PI * 1.8; // End of happy crescent
  
  // Reverse interpolation: start from crescent angles, end at full circle
  // Start angle: from crescentStart back to bottomAngle (arcs downward)
  const startAngle = lerp(crescentStart, bottomAngle, transitionProgress);
  // End angle: from crescentEnd to full circle (bottomAngle + 2*PI)
  const endAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
  
  ctx.beginPath();
  // Draw arc - crescent arcs downward to form full circle (exact reverse)
  ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
  ctx.stroke();
  
  // Draw pupil and highlight - fade in as we transition to neutral
  // Pupils should appear early in the transition (by 50% progress)
  const pupilAlpha = Math.max(0, (transitionProgress * 2) - 1); // Fade in from 50% progress
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3, -3 + eyeVerticalOffset, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Draw right eye - same reverse animation, mirrored
  ctx.save();
  ctx.translate(50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * lerp(1.8, 1.8, transitionProgress)) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Right eye - exact reverse animation
  const rightStartAngle = lerp(crescentStart, bottomAngle, transitionProgress);
  const rightEndAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
  
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
  ctx.stroke();
  
  // Right eye pupils
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3, -3 + eyeVerticalOffset, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Draw smiling mouth - fade out as we transition to neutral (reverse of happy)
  const mouthAlpha = Math.max(0, 1 - (transitionProgress * 1.25)); // Fade out as transition progresses
  if (mouthAlpha > 0) {
    ctx.save();
    ctx.translate(0, lerp(-15, 0, transitionProgress)); // Mouth position moves up as it fades
    
    ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
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
      const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
      const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
      ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
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
      const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
      const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
      ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
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
