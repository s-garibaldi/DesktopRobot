import React, { useRef, useEffect, useCallback } from 'react';
import { Emotion } from '../App';
import { emotionDrawFunctions, easeInOut } from './emotions';

interface AnimatedFaceProps {
  emotion: Emotion;
}

const AnimatedFace: React.FC<AnimatedFaceProps> = ({ emotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  // Track previous emotion for transitions
  const prevEmotionRef = useRef<Emotion>(emotion);
  
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
      progress: 1, // 0 = fromEmotion, 1 = toEmotion
      fromEmotion: emotion,
      toEmotion: emotion,
      duration: 0.8, // Transition duration in seconds
      elapsed: 0
    }
  });

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const time = timeRef.current;
    
    // Check if emotion changed and start transition
    if (emotion !== prevEmotionRef.current) {
      state.emotionTransition.fromEmotion = prevEmotionRef.current;
      state.emotionTransition.toEmotion = emotion;
      state.emotionTransition.progress = 0;
      state.emotionTransition.elapsed = 0;
      prevEmotionRef.current = emotion;
    }
    
    // Update transition progress
    if (state.emotionTransition.progress < 1) {
      state.emotionTransition.elapsed += 0.016; // ~60fps
      state.emotionTransition.progress = Math.min(
        state.emotionTransition.elapsed / state.emotionTransition.duration,
        1
      );
    }
    
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
    
    // Draw with transition if in progress
    if (state.emotionTransition.progress < 1) {
      // Draw transition between emotions
      const toDraw = emotionDrawFunctions[state.emotionTransition.toEmotion];
      
      // Use eased progress for smoother animation
      const easedProgress = easeInOut(state.emotionTransition.progress);
      
      // Special handling for specific emotion transitions
      if (state.emotionTransition.fromEmotion === 'neutral' && state.emotionTransition.toEmotion === 'happy') {
        // Transition from neutral to happy
        // happy expects: 0 = neutral, 1 = happy
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
      } else if (state.emotionTransition.fromEmotion === 'happy' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from happy to neutral (reverse)
        // neutral expects: 0 = happy, 1 = neutral
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'happy');
      } else if (state.emotionTransition.fromEmotion === 'neutral' && state.emotionTransition.toEmotion === 'thinking') {
        // Transition from neutral to thinking - dots and drips fade in
        // thinking expects: 0 = neutral, 1 = thinking
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
      } else if (state.emotionTransition.fromEmotion === 'thinking' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from thinking to neutral - dots and drips fade out
        // Call thinking emotion with decreasing progress (1 -> 0) so dots fade out
        const fromDraw = emotionDrawFunctions['thinking'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1 - easedProgress, 'thinking');
        }
      } else if (state.emotionTransition.fromEmotion === 'thinking' && state.emotionTransition.toEmotion === 'happy') {
        // Transition from thinking to happy - same eye morphing as neutral->happy, but dots fade out
        // happy expects: 0 = neutral, 1 = happy
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'thinking');
      } else if (state.emotionTransition.fromEmotion === 'happy' && state.emotionTransition.toEmotion === 'thinking') {
        // Transition from happy to thinking - same eye morphing as happy->neutral, but dots fade in
        // thinking expects: 0 = neutral, 1 = thinking
        // But we're coming from happy, so we need to handle the eye morphing
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'happy');
      } else if (state.emotionTransition.fromEmotion === 'neutral' && state.emotionTransition.toEmotion === 'listening') {
        // Transition from neutral to listening - eyes get bigger and closer, pulsing increases
        // listening expects: 0 = neutral, 1 = listening
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
      } else if (state.emotionTransition.fromEmotion === 'listening' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from listening to neutral - eyes get smaller and further apart, pulsing decreases
        // neutral expects: 0 = happy (for happy->neutral), but we need to handle listening->neutral
        // Call listening emotion with reverse progress (1 -> 0) so it interpolates back to neutral
        const fromDraw = emotionDrawFunctions['listening'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1 - easedProgress, 'neutral');
        }
      } else if (state.emotionTransition.fromEmotion === 'happy' && state.emotionTransition.toEmotion === 'listening') {
        // Transition from happy to listening - first happy->neutral, then neutral->listening
        // listening expects: 0 = neutral, 1 = listening, but we're coming from happy
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'happy');
      } else if (state.emotionTransition.fromEmotion === 'listening' && state.emotionTransition.toEmotion === 'happy') {
        // Transition from listening to happy - first listening->neutral, then neutral->happy
        // happy expects: 0 = neutral, 1 = happy, but we're coming from listening
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'listening');
      } else if (state.emotionTransition.fromEmotion === 'thinking' && state.emotionTransition.toEmotion === 'listening') {
        // Transition from thinking to listening - dots/drips fade out while eyes grow and move closer
        // listening expects: 0 = neutral, 1 = listening, but we're coming from thinking
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'thinking');
      } else if (state.emotionTransition.fromEmotion === 'listening' && state.emotionTransition.toEmotion === 'thinking') {
        // Transition from listening to thinking - eyes shrink and move apart while dots/drips fade in
        // thinking expects: 0 = neutral, 1 = thinking, but we're coming from listening
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'listening');
      } else {
        // For other transitions, draw target emotion
        toDraw(ctx, time, state.breathingPhase, easedProgress, state.emotionTransition.fromEmotion);
      }
    } else {
      // Draw current emotion normally
      const drawEmotion = emotionDrawFunctions[emotion];
      drawEmotion(ctx, time, state.breathingPhase, 1, emotion);
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
