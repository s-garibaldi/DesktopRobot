import { EmotionDrawFunction } from './types';

// THINKING emotion - neon face with full circle eyes, drips, and animated dots
export const drawThinking: EmotionDrawFunction = (ctx, time, breathingPhase) => {
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
  
  // Draw left eye - full circle outline
  ctx.save();
  ctx.translate(-50, -10);
  
  // Full circle eye outline
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  // Draw full circle
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  
  // Black pupil (circular, centered)
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Bright cyan highlight dot in center
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(-3, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Drip particles below the eye (sparkling cyan particles)
  const dripPositions = [
    { x: -8, y: 18, size: 1.5 },
    { x: -4, y: 22, size: 2 },
    { x: 0, y: 20, size: 1.5 },
    { x: 4, y: 24, size: 1.8 },
    { x: 8, y: 21, size: 1.5 }
  ];
  
  dripPositions.forEach((pos, index) => {
    const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
    const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
    ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.globalAlpha = dripGlow * secondaryGlow * 0.7; // Fainter than main elements
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
  
  // Draw right eye - full circle outline (same as left)
  ctx.save();
  ctx.translate(50, -10);
  
  // Full circle eye outline
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  // Draw full circle
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  
  // Black pupil
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Bright cyan highlight dot
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(-3, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Drip particles below the eye
  dripPositions.forEach((pos, index) => {
    const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
    const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
    ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.globalAlpha = dripGlow * secondaryGlow * 0.7;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
  
  // Draw three animated dots (iMessage-style bouncing animation)
  ctx.save();
  ctx.translate(0, -50); // Position above the top of the eyes
  
  const dotSpacing = 20; // Space between dots
  const bounceHeight = 8; // How high dots bounce
  const animationSpeed = 0.8; // Speed of animation
  
  // Calculate bounce offset for each dot (sequential animation)
  const dot1Offset = Math.abs(Math.sin(time * animationSpeed * 2)) * bounceHeight;
  const dot2Offset = Math.abs(Math.sin(time * animationSpeed * 2 + Math.PI * 0.66)) * bounceHeight;
  const dot3Offset = Math.abs(Math.sin(time * animationSpeed * 2 + Math.PI * 1.33)) * bounceHeight;
  
  // Draw three main dots with sequential bounce animation
  const dots = [
    { x: -dotSpacing, offset: dot1Offset },
    { x: 0, offset: dot2Offset },
    { x: dotSpacing, offset: dot3Offset }
  ];
  
  dots.forEach((dot, index) => {
    ctx.shadowBlur = 15 + Math.sin(time * 2 + index) * 5;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.globalAlpha = secondaryGlow;
    ctx.beginPath();
    ctx.arc(dot.x, -dot.offset, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
  
  ctx.restore();
};
