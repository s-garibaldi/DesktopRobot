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
      eyeShape: { width: 0.8, height: 0.3, curve: 0.1 },
      eyebrowShape: { left: { x: -0.3, y: -0.2, angle: 0 }, right: { x: 0.3, y: -0.2, angle: 0 } },
      mouthShape: { width: 0.4, height: 0.1, curve: 0.05 },
      eyeColor: '#4A90E2',
      mouthColor: '#8B4513',
      eyebrowColor: '#8B4513'
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

  // Helper functions
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
    
    // Update animation state
    state.eyeBlinkTimer += 0.016;
    if (state.eyeBlinkTimer > 3 + Math.random() * 2) {
      state.eyeBlink = Math.min(state.eyeBlink + 0.1, 1);
      if (state.eyeBlink >= 1) {
        state.eyeBlinkTimer = 0;
        state.eyeBlink = 0;
      }
    }
    
    state.breathingPhase += 0.02;
    state.microMovements.headTilt = Math.sin(time * 0.5) * 0.02;
    state.microMovements.eyeMovement.x = Math.sin(time * 0.3) * 2;
    state.microMovements.eyeMovement.y = Math.cos(time * 0.4) * 1;
    state.microMovements.mouthMovement = Math.sin(time * 0.2) * 0.5;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up coordinate system
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 1 + Math.sin(state.breathingPhase) * 0.02;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.rotate(state.microMovements.headTilt);
    
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
    
    // Get current emotion config (with transition)
    const currentConfig = emotionConfigs[emotion];
    
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
    
    ctx.restore();
    
    timeRef.current = time + 0.016;
    animationRef.current = requestAnimationFrame(animate);
  }, [emotion, drawEye, drawEyebrow, drawMouth]);

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
          border: '2px solid rgba(255, 255, 255, 0.3)', 
          borderRadius: '15px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}
      />
      <p style={{ 
        marginTop: '1rem', 
        fontSize: '1.2rem', 
        textTransform: 'capitalize',
        color: '#fff',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        Current Emotion: <strong>{emotion}</strong>
      </p>
    </div>
  );
};

export default AnimatedFace;
