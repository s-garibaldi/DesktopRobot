import { EmotionDrawFunction } from './types';

// HAPPY emotion - neon face with crescent eyes, sparkles, and smiling mouth
export const drawHappy: EmotionDrawFunction = (ctx, time, breathingPhase) => {
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
  
  // Draw left eye - upward-curving crescent (smiling eye)
  ctx.save();
  ctx.translate(-50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * 1) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 7;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Crescent eye shape (upward curve, like a smile)
  ctx.beginPath();
  ctx.arc(0, 5, 30, Math.PI * 1.2, Math.PI * 1.8, false);
  ctx.stroke();
  
  // Sparkle dots around the eye (happy sparkles) - clustered above and to the sides
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
  
  sparklePositions.forEach((pos, index) => {
    const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
    const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
    ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.globalAlpha = sparkleGlow * secondaryGlow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
  
  // Draw right eye - upward-curving crescent (smiling eye)
  ctx.save();
  ctx.translate(50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 7;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Crescent eye shape (upward curve, like a smile)
  ctx.beginPath();
  ctx.arc(0, 5, 30, Math.PI * 1.2, Math.PI * 1.8, false);
  ctx.stroke();
  
  // Sparkle dots around the eye (happy sparkles) - clustered above and to the sides
  sparklePositions.forEach((pos, index) => {
    const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
    const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
    ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.globalAlpha = sparkleGlow * secondaryGlow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
  
  // Draw smiling mouth
  ctx.save();
  ctx.translate(0, -15); // Position mouth below eyes
  
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 7;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Wide upward-curving smile (wider arc for more prominent smile)
  ctx.beginPath();
  ctx.arc(0, 0, 50, Math.PI * 0.15, Math.PI * 0.85, false);
  ctx.stroke();
  
  ctx.restore();
  
  ctx.restore();
};
