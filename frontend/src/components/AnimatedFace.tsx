import React, { useRef, useEffect, useCallback } from 'react';
import { Emotion } from '../App';
import { emotionDrawFunctions } from './emotions';

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
    
    // Use the emotion-specific drawing function
    const drawEmotion = emotionDrawFunctions[emotion];
    if (drawEmotion) {
      drawEmotion(ctx, time, state.breathingPhase);
    }
    
    ctx.restore();
    
    timeRef.current = time + 0.016;
    animationRef.current = requestAnimationFrame(animate);
  }, [emotion]);

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
          border: '2px solid #00FFFF', 
          borderRadius: '15px',
          background: 'rgba(0, 0, 0, 1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 40px rgba(0, 255, 255, 0.4)'
        }}
      />
      <p style={{ 
        marginTop: '1rem', 
        fontSize: '1.2rem', 
        textTransform: 'capitalize',
        color: '#00FFFF',
        textShadow: '0 0 15px #00FFFF'
      }}>
        Current Emotion: <strong>{emotion}</strong>
      </p>
    </div>
  );
};

export default AnimatedFace;
