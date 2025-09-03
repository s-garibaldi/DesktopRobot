import React, { useRef, useEffect, useCallback } from 'react';
import { Emotion } from '../App';

interface AnimatedFaceProps {
  emotion: Emotion;
}

const AnimatedFace: React.FC<AnimatedFaceProps> = ({ emotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  // Animation state
  const stateRef = useRef({
    eyeBlink: 0,
    eyeBlinkTimer: 0,
    breathingPhase: 0,
    microMovements: {
      headTilt: 0,
      eyeMovement: { x: 0, y: 0 },
      mouthMovement: 0
    },
    emotionTransition: {
      progress: 1,
      fromEmotion: emotion,
      toEmotion: emotion
    }
  });

  // Emotion configurations
  const emotionConfigs = {
    neutral: {
      eyeShape: { width: 1.0, height: 1.0, curve: 0 },
      eyebrowShape: { left: { x: -0.3, y: -0.3, angle: 0 }, right: { x: 0.3, y: -0.3, angle: 0 } },
      mouthShape: { width: 0, height: 0, curve: 0 }, // No mouth for neutral
      eyeColor: '#00FFFF',
      mouthColor: 'transparent',
      eyebrowColor: '#00FFFF',
      glowColor: '#00FFFF'
    },
    happy: {
      eyeShape: { width: 0.6, height: 0.2, curve: 0.3 },
      eyebrowShape: { left: { x: -0.3, y: -0.25, angle: 0.2 }, right: { x: 0.3, y: -0.25, angle: -0.2 } },
      mouthShape: { width: 0.5, height: 0.2, curve: 0.4 },
      eyeColor: '#32CD32',
      mouthColor: '#FF6B6B',
      eyebrowColor: '#8B4513'
    },
    sad: {
      eyeShape: { width: 0.7, height: 0.25, curve: -0.1 },
      eyebrowShape: { left: { x: -0.3, y: -0.15, angle: -0.3 }, right: { x: 0.3, y: -0.15, angle: 0.3 } },
      mouthShape: { width: 0.4, height: 0.15, curve: -0.3 },
      eyeColor: '#4169E1',
      mouthColor: '#8B4513',
      eyebrowColor: '#8B4513'
    },
    surprised: {
      eyeShape: { width: 0.9, height: 0.8, curve: 0.05 },
      eyebrowShape: { left: { x: -0.3, y: -0.3, angle: 0.1 }, right: { x: 0.3, y: -0.3, angle: -0.1 } },
      mouthShape: { width: 0.3, height: 0.4, curve: 0.1 },
      eyeColor: '#FFD700',
      mouthColor: '#FF6B6B',
      eyebrowColor: '#8B4513'
    },
    thinking: {
      eyeShape: { width: 0.7, height: 0.2, curve: 0.2 },
      eyebrowShape: { left: { x: -0.3, y: -0.2, angle: 0.1 }, right: { x: 0.3, y: -0.2, angle: -0.1 } },
      mouthShape: { width: 0.3, height: 0.1, curve: 0.1 },
      eyeColor: '#9370DB',
      mouthColor: '#8B4513',
      eyebrowColor: '#8B4513'
    },
    excited: {
      eyeShape: { width: 0.8, height: 0.3, curve: 0.4 },
      eyebrowShape: { left: { x: -0.3, y: -0.3, angle: 0.3 }, right: { x: 0.3, y: -0.3, angle: -0.3 } },
      mouthShape: { width: 0.6, height: 0.25, curve: 0.5 },
      eyeColor: '#FF4500',
      mouthColor: '#FF6B6B',
      eyebrowColor: '#8B4513'
    },
    confused: {
      eyeShape: { width: 0.6, height: 0.3, curve: 0.1 },
      eyebrowShape: { left: { x: -0.3, y: -0.2, angle: 0.2 }, right: { x: 0.3, y: -0.2, angle: 0.2 } },
      mouthShape: { width: 0.3, height: 0.1, curve: 0.1 },
      eyeColor: '#FFA500',
      mouthColor: '#8B4513',
      eyebrowColor: '#8B4513'
    }
  };

  // LIVING neon face with breathing and pulsing glow
  const drawLivingNeonFace = useCallback((ctx: CanvasRenderingContext2D, time: number, breathingPhase: number) => {
    // Enhanced breathing animation - more noticeable but still subtle
    const breathingScale = 1 + Math.sin(breathingPhase) * 0.03; // 3% size variation
    
    // Multi-layered glow pulsing - different frequencies for depth
    const primaryGlow = 0.85 + Math.sin(time * 1.2) * 0.15; // Main glow pulse
    const secondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1; // Secondary shimmer
    const tertiaryGlow = 0.95 + Math.sin(time * 3.3) * 0.05; // Fine shimmer
    
    ctx.save();
    
    // Apply breathing scale to the entire face
    ctx.scale(breathingScale, breathingScale);
    
    // Set up the exact proportions from the image
    const faceWidth = 200;
    const faceHeight = 150;
    const cornerRadius = 20; // Rounded corners as shown in image
    
    // Draw the rounded rectangular head outline with enhanced breathing glow
    ctx.shadowBlur = 30 + Math.sin(time * 1.5) * 10; // Pulsing shadow blur
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 6;
    ctx.globalAlpha = primaryGlow;
    
    ctx.beginPath();
    ctx.roundRect(-faceWidth/2, -faceHeight/2, faceWidth, faceHeight, cornerRadius);
    ctx.stroke();
    
    // Draw left eye with living glow effects
    ctx.save();
    ctx.translate(-50, -10);
    
    // Single outer ring with pulsing glow
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
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4; // Pulsing glisten
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow;
    ctx.beginPath();
    ctx.arc(-3, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Draw right eye with living glow effects
    ctx.save();
    ctx.translate(50, -10);
    
    // Single outer ring with pulsing glow
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
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4; // Pulsing glisten
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow;
    ctx.beginPath();
    ctx.arc(-3, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    ctx.restore();
  }, []);

  const drawEye = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, config: any, blink: number) => {
    const eyeWidth = config.width * 60 * (1 - blink * 0.8);
    const eyeHeight = config.height * 60 * (1 - blink * 0.9);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Eye socket
    ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth * 1.2, eyeHeight * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye white
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye color
    ctx.fillStyle = config.eyeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth * 0.8, eyeHeight * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth * 0.4, eyeHeight * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(eyeWidth * 0.2, -eyeHeight * 0.2, eyeWidth * 0.15, eyeHeight * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }, []);

  const drawEyebrow = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, config: any) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(config.angle);
    
    ctx.strokeStyle = config.eyebrowColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(0, -10, 30, 0);
    ctx.stroke();
    
    ctx.restore();
  }, []);

  const drawMouth = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, config: any) => {
    if (config.width === 0 || config.height === 0) return; // No mouth for neutral
    
    ctx.save();
    ctx.translate(x, y);
    
    const mouthWidth = config.width * 80;
    const mouthHeight = config.height * 40;
    
    ctx.fillStyle = config.mouthColor;
    ctx.beginPath();
    
    if (config.curve > 0) {
      // Happy mouth
      ctx.ellipse(0, 0, mouthWidth, mouthHeight, 0, 0, Math.PI);
    } else if (config.curve < 0) {
      // Sad mouth
      ctx.ellipse(0, mouthHeight * 0.5, mouthWidth, mouthHeight, 0, Math.PI, Math.PI * 2);
    } else {
      // Neutral mouth
      ctx.ellipse(0, 0, mouthWidth, mouthHeight * 0.3, 0, 0, Math.PI * 2);
    }
    
    ctx.fill();
    
    // Mouth outline
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const time = timeRef.current;
    
    // Update animation state with enhanced breathing
    state.eyeBlinkTimer += 0.016;
    if (state.eyeBlinkTimer > 3 + Math.random() * 2) {
      state.eyeBlink = Math.min(state.eyeBlink + 0.1, 1);
      if (state.eyeBlink >= 1) {
        state.eyeBlinkTimer = 0;
        state.eyeBlink = 0;
      }
    }
    
    // Enhanced breathing animation
    state.breathingPhase += 0.025; // Slightly faster breathing
    
    // Very subtle micro-movements for life
    state.microMovements.headTilt = Math.sin(time * 0.3) * 0.001; // Gentle sway
    state.microMovements.eyeMovement.x = Math.sin(time * 0.2) * 0.2; // Gentle eye drift
    state.microMovements.eyeMovement.y = Math.cos(time * 0.25) * 0.1;
    state.microMovements.mouthMovement = Math.sin(time * 0.15) * 0.3;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up coordinate system
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(state.microMovements.headTilt);
    
    // Get current emotion config
    const currentConfig = emotionConfigs[emotion];
    
    if (emotion === 'neutral') {
      // LIVING neon face with enhanced breathing and glow
      drawLivingNeonFace(ctx, time, state.breathingPhase);
      
    } else {
      // Original rendering for other emotions
      
      // Face background
      const faceGradient = ctx.createRadialGradient(0, -50, 0, 0, 0, 120);
      faceGradient.addColorStop(0, '#FFE4B5');
      faceGradient.addColorStop(1, '#F4A460');
      
      ctx.fillStyle = faceGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 120, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Face outline
      ctx.strokeStyle = '#D2B48C';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw eyebrows
      drawEyebrow(ctx, -60 + state.microMovements.eyeMovement.x, -80, {
        ...currentConfig.eyebrowShape.left,
        eyebrowColor: currentConfig.eyebrowColor
      });
      drawEyebrow(ctx, 60 + state.microMovements.eyeMovement.x, -80, {
        ...currentConfig.eyebrowShape.right,
        eyebrowColor: currentConfig.eyebrowColor
      });
      
      // Draw eyes
      drawEye(ctx, -60 + state.microMovements.eyeMovement.x, -40 + state.microMovements.eyeMovement.y, 
              currentConfig, state.eyeBlink);
      drawEye(ctx, 60 + state.microMovements.eyeMovement.x, -40 + state.microMovements.eyeMovement.y, 
              currentConfig, state.eyeBlink);
      
      // Draw nose
      ctx.fillStyle = '#D2B48C';
      ctx.beginPath();
      ctx.ellipse(0, -10, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw mouth
      drawMouth(ctx, 0, 40 + state.microMovements.mouthMovement, currentConfig);
      
      // Draw cheeks (for happy emotion)
      if (emotion === 'happy') {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-80, 20, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(80, 20, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
    
    timeRef.current = time + 0.016;
    animationRef.current = requestAnimationFrame(animate);
  }, [emotion, drawEye, drawEyebrow, drawMouth, drawLivingNeonFace]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 400;

    // Start animation
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div className="animated-face">
      <canvas
        ref={canvasRef}
        style={{ 
          border: emotion === 'neutral' ? '2px solid #00FFFF' : '2px solid rgba(255, 255, 255, 0.3)', 
          borderRadius: '15px',
          background: emotion === 'neutral' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: emotion === 'neutral' ? '0 0 40px rgba(0, 255, 255, 0.4)' : 'none'
        }}
      />
      <p style={{ 
        marginTop: '1rem', 
        fontSize: '1.2rem', 
        textTransform: 'capitalize',
        color: emotion === 'neutral' ? '#00FFFF' : '#fff',
        textShadow: emotion === 'neutral' ? '0 0 15px #00FFFF' : '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        Current Emotion: <strong>{emotion}</strong>
      </p>
    </div>
  );
};

export default AnimatedFace;
