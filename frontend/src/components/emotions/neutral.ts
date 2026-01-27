import { EmotionDrawFunction } from './types';

// NEUTRAL emotion - standard neon face with full circle eyes
export const drawNeutral: EmotionDrawFunction = (ctx, time, breathingPhase) => {
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
  
  // Draw left eye - full circle
  ctx.save();
  ctx.translate(-50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  
  // Dark pupil center
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Bright center dot with enhanced glisten
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(-3, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  // Draw right eye - full circle
  ctx.save();
  ctx.translate(50, -10);
  
  ctx.shadowBlur = 30 + Math.sin(time * 1.8) * 8;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 5;
  ctx.globalAlpha = secondaryGlow;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  
  // Dark pupil center
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Bright center dot with enhanced glisten
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
  ctx.shadowColor = '#00FFFF';
  ctx.globalAlpha = tertiaryGlow;
  ctx.beginPath();
  ctx.arc(-3, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  ctx.restore();
};
