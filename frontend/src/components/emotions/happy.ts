import { EmotionDrawFunction, lerp } from './types';

// HAPPY emotion - neon face with crescent eyes, sparkles, and smiling mouth
export const drawHappy: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1) => {
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
  
  // Interpolate between neutral (0) and happy (1) based on transition progress
  // transitionProgress: 0 = neutral, 1 = happy
  
  // Draw left eye - interpolate between full circle (neutral) and crescent (happy)
  ctx.save();
  ctx.translate(-50, -10);
  
  // Interpolate eye properties
  const eyeLineWidth = lerp(5, 7, transitionProgress);
  const eyeVerticalOffset = lerp(0, 5, transitionProgress); // Neutral at 0, happy at 5
  const eyeRadius = lerp(25, 30, transitionProgress);
  
  ctx.shadowBlur = 30 + Math.sin(time * lerp(1.8, 1, transitionProgress)) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Eye outline animation: disappear from bottom to top, mirrored on both sides
  // Canvas angles: 0 = right (3 o'clock), Math.PI/2 = bottom (6 o'clock), 
  //                Math.PI = left (9 o'clock), Math.PI*1.5 = top (12 o'clock)
  // Bottom of circle: Math.PI / 2 (90 degrees / 6 o'clock)
  // Happy crescent: from Math.PI * 1.2 (216 degrees) to Math.PI * 1.8 (324 degrees)
  
  // Interpolate start angle: from bottom (Math.PI/2) to crescent start (Math.PI*1.2)
  // Interpolate end angle: from bottom (Math.PI/2 + 2*PI) to crescent end (Math.PI*1.8)
  const bottomAngle = Math.PI / 2; // Bottom of circle
  const crescentStart = Math.PI * 1.2; // Start of happy crescent
  const crescentEnd = Math.PI * 1.8; // End of happy crescent
  
  // Start angle moves from bottom upward as transition progresses
  const startAngle = lerp(bottomAngle, crescentStart, transitionProgress);
  // End angle: when at bottom, we go full circle (bottomAngle + Math.PI * 2)
  // When at crescent, we end at crescentEnd
  const endAngle = lerp(bottomAngle + Math.PI * 2, crescentEnd, transitionProgress);
  
  ctx.beginPath();
  // Draw arc counterclockwise from startAngle to endAngle
  // This creates the effect of the bottom disappearing upward
  ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
  ctx.stroke();
  
  // Draw pupil and highlight - only visible during transition from neutral, completely hidden when happy
  // Pupils should fade out early in the transition (by 50% progress)
  const pupilAlpha = Math.max(0, 1 - (transitionProgress * 2)); // Fade out completely by 50% progress
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
  
  // Sparkle dots - fade in as we transition to happy
  const sparkleAlpha = Math.max(0, (transitionProgress - 0.3) / 0.7); // Start appearing at 30% progress
  const sparklePositions = [
    // Left side cluster
    { x: -25, y: -18, size: 2.5 },
    { x: -22, y: -22, size: 3 },
    { x: -18, y: -20, size: 2 },
    { x: -20, y: -15, size: 2.5 },
    // Right side cluster  
    { x: 25, y: -18, size: 2.5 },
    { x: 22, y: -22, size: 3 },
    { x: 18, y: -20, size: 2 },
    { x: 20, y: -15, size: 2.5 }
  ];
  
  if (sparkleAlpha > 0) {
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
  }
  
  ctx.restore();
  
  // Draw right eye - same interpolation
  ctx.save();
  ctx.translate(50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * lerp(1.8, 1.8, transitionProgress)) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Right eye - same animation, mirrored (identical to left)
  const rightStartAngle = lerp(bottomAngle, crescentStart, transitionProgress);
  const rightEndAngle = lerp(bottomAngle + Math.PI * 2, crescentEnd, transitionProgress);
  
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
  ctx.stroke();
  
  // Right eye pupils - same fade out logic
  const rightPupilAlpha = Math.max(0, 1 - (transitionProgress * 2));
  if (rightPupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = rightPupilAlpha;
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * rightPupilAlpha;
    ctx.beginPath();
    ctx.arc(-3, -3 + eyeVerticalOffset, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (sparkleAlpha > 0) {
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
  }
  
  ctx.restore();
  
  // Draw smiling mouth - fade in as we transition to happy
  const mouthAlpha = Math.max(0, (transitionProgress - 0.2) / 0.8); // Start appearing at 20% progress
  if (mouthAlpha > 0) {
    ctx.save();
    ctx.translate(0, -15); // Position mouth below eyes
    
    ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = lerp(0, 7, mouthAlpha);
    ctx.globalAlpha = secondaryGlow * mouthAlpha;
    ctx.lineCap = 'round';
    
    // Wide upward-curving smile
    ctx.beginPath();
    ctx.arc(0, 0, lerp(0, 50, mouthAlpha), Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.stroke();
    
    ctx.restore();
  }
  
  ctx.restore();
};
