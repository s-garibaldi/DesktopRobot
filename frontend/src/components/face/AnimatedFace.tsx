import React, { useRef, useEffect, useCallback } from 'react';
import { Emotion } from '../../App';
import { emotionDrawFunctions, easeInOut } from './emotions';
import { lerp } from './emotions/types';
import { drawSpeakingMouth } from './emotions/speaking';

interface AnimatedFaceProps {
  emotion: Emotion;
  /** When true, canvas fills its container (e.g. for fullscreen); otherwise fixed 400×400 */
  fillContainer?: boolean;
}

const AnimatedFace: React.FC<AnimatedFaceProps> = ({ emotion, fillContainer = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
      duration: 0.4, // Transition duration in seconds (faster by 50%)
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
      // Use longer duration for neutral->time transition (0.6s for zoom + fade, 50% faster)
      if (prevEmotionRef.current === 'neutral' && emotion === 'time') {
        state.emotionTransition.duration = 0.6;
      } else if (prevEmotionRef.current === 'neutral' && emotion === 'metronome') {
        state.emotionTransition.duration = 0.6; // Same as neutral→time: zoom out to point, then metronome blinks in
      } else if (prevEmotionRef.current === 'metronome' && emotion === 'neutral') {
        state.emotionTransition.duration = 0.5; // Two-phase: metronome cut off, then neutral zoom in
      } else if (prevEmotionRef.current === 'metronome' && emotion === 'thinking') {
        state.emotionTransition.duration = 0.5; // Two-phase: metronome stops blinking, then thinking zooms in from dot
      } else if (prevEmotionRef.current === 'thinking' && emotion === 'metronome') {
        state.emotionTransition.duration = 0.6; // Two-phase: thinking zoom out to point, then metronome blinks in
      } else if (prevEmotionRef.current === 'speaking' && emotion === 'metronome') {
        state.emotionTransition.duration = 0.6; // Two-phase: speaking zoom out to point, then metronome blinks in
      } else if (prevEmotionRef.current === 'time' && emotion === 'listening') {
        // Time→listening: fast time fade, neutral zoom in, then neutral→listening (~0.9s, 50% faster)
        state.emotionTransition.duration = 0.9;
      } else {
        state.emotionTransition.duration = 0.4; // Default duration (50% faster)
      }
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
      } else if (state.emotionTransition.fromEmotion === 'happy' && state.emotionTransition.toEmotion === 'speaking') {
        // Transition from happy to speaking: same as happy→neutral (crescent→circle, smile out) + waveform mouth fades in
        const neutralDraw = emotionDrawFunctions['neutral'];
        if (neutralDraw) {
          neutralDraw(ctx, time, state.breathingPhase, easedProgress, 'happy');
        }
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, easedProgress);
        ctx.restore();
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
      } else if (state.emotionTransition.fromEmotion === 'thinking' && state.emotionTransition.toEmotion === 'speaking') {
        // Transition from thinking to speaking: dots/drips fade out (like thinking→neutral) + mouth fades in
        const fromDraw = emotionDrawFunctions['thinking'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1 - easedProgress, 'thinking');
        }
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, easedProgress);
        ctx.restore();
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
      } else if (state.emotionTransition.fromEmotion === 'speaking' && state.emotionTransition.toEmotion === 'listening') {
        // Transition from speaking to listening: same as neutral→listening (eyes grow, move closer) + mouth fades out
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, 1 - easedProgress);
        ctx.restore();
      } else if (state.emotionTransition.fromEmotion === 'speaking' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from speaking to neutral: face and eyes stay (same), only mouth fades out
        const fromDraw = emotionDrawFunctions['neutral'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1, 'neutral');
        }
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, 1 - easedProgress);
        ctx.restore();
      } else if (state.emotionTransition.fromEmotion === 'speaking' && state.emotionTransition.toEmotion === 'happy') {
        // Transition from speaking to happy: same as neutral→happy (eyes→crescent, smile in) + waveform mouth fades out
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, 1 - easedProgress);
        ctx.restore();
      } else if (state.emotionTransition.fromEmotion === 'listening' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from listening to neutral - eyes get smaller and further apart, pulsing decreases
        // neutral expects: 0 = happy (for happy->neutral), but we need to handle listening->neutral
        // Call listening emotion with reverse progress (1 -> 0) so it interpolates back to neutral
        const fromDraw = emotionDrawFunctions['listening'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1 - easedProgress, 'neutral');
        }
      } else if (state.emotionTransition.fromEmotion === 'listening' && state.emotionTransition.toEmotion === 'speaking') {
        // Transition from listening to speaking: same as listening→neutral (eyes shrink, move apart) + mouth fades in
        const fromDraw = emotionDrawFunctions['listening'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, 1 - easedProgress, 'neutral');
        }
        const breathingScale = 1 + Math.sin(state.breathingPhase) * 0.03;
        ctx.save();
        ctx.scale(breathingScale, breathingScale);
        drawSpeakingMouth(ctx, time, easedProgress);
        ctx.restore();
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
      } else if (state.emotionTransition.fromEmotion === 'neutral' && state.emotionTransition.toEmotion === 'time') {
        // Transition from neutral to time - face zooms to dot, then time fades in
        // Duration is already set to 1.2s in the transition setup
        toDraw(ctx, time, state.breathingPhase, easedProgress, 'neutral');
      } else if (state.emotionTransition.fromEmotion === 'neutral' && state.emotionTransition.toEmotion === 'metronome') {
        // Two-phase: (1) neutral face zooms out to point (like neutral→time), (2) metronome blinks in
        const p = easedProgress;
        const ZOOM_OUT_PHASE_END = 0.15; // Same as neutral→time — neutral fully zoomed out before metronome
        if (p < ZOOM_OUT_PHASE_END) {
          // Phase 1: neutral face zooms out to tiny dot; pupils drift quickly back to center
          const zoomOutProgress = p / ZOOM_OUT_PHASE_END;
          const easedZoomOut = easeInOut(zoomOutProgress);
          const faceScale = lerp(1, 0.02, easedZoomOut);
          const pupilDriftToCenter = Math.min(1, zoomOutProgress / 0.3);
          const neutralDraw = emotionDrawFunctions['neutral'];
          if (neutralDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.scale(faceScale, faceScale);
            neutralDraw(ctx, time, state.breathingPhase, 1, 'neutral', pupilDriftToCenter);
            ctx.restore();
          }
        } else {
          // Phase 2: metronome blinks in (no neutral visible)
          const metronomeFadeIn = (p - ZOOM_OUT_PHASE_END) / (1 - ZOOM_OUT_PHASE_END);
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            metronomeDraw(ctx, time, state.breathingPhase, metronomeFadeIn, 'neutral');
            ctx.restore();
          }
        }
      } else if (state.emotionTransition.fromEmotion === 'time' && state.emotionTransition.toEmotion === 'neutral') {
        // Transition from time to neutral - time fades out, neutral zooms in from dot
        const fromDraw = emotionDrawFunctions['time'];
        if (fromDraw) {
          fromDraw(ctx, time, state.breathingPhase, easedProgress, 'time');
        }
      } else if (state.emotionTransition.fromEmotion === 'time' && state.emotionTransition.toEmotion === 'listening') {
        // Three-phase: (1) fast time fade out, (2) neutral zoom in from dot, (3) neutral→listening
        const p = easedProgress;
        const TIME_FADEOUT_END = 0.12;   // ~0.22s: time fades out
        const NEUTRAL_ZOOM_END = 0.42;   // ~0.36s: neutral zoom in, then neutral→listening
        const timeDraw = emotionDrawFunctions['time'];
        const listenDraw = emotionDrawFunctions['listening'];
        if (p < TIME_FADEOUT_END) {
          // Phase 1: time fades out (map 0..TIME_FADEOUT_END → 0..0.15 for time.ts)
          const timeProgress = (p / TIME_FADEOUT_END) * 0.15;
          if (timeDraw) timeDraw(ctx, time, state.breathingPhase, timeProgress, 'time');
        } else if (p < NEUTRAL_ZOOM_END) {
          // Phase 2: neutral zooms in from dot (map TIME_FADEOUT_END..NEUTRAL_ZOOM_END → 0.15..1)
          const timeProgress = 0.15 + ((p - TIME_FADEOUT_END) / (NEUTRAL_ZOOM_END - TIME_FADEOUT_END)) * 0.85;
          if (timeDraw) timeDraw(ctx, time, state.breathingPhase, timeProgress, 'time');
        } else {
          // Phase 3: same as neutral→listening
          const listenProgress = (p - NEUTRAL_ZOOM_END) / (1 - NEUTRAL_ZOOM_END);
          if (listenDraw) listenDraw(ctx, time, state.breathingPhase, listenProgress, 'neutral');
        }
      } else if (state.emotionTransition.fromEmotion === 'metronome' && state.emotionTransition.toEmotion === 'neutral') {
        // Two-phase: (1) metronome cuts off completely, (2) neutral zooms in from dot (like time→neutral)
        const p = easedProgress;
        const METRONOME_CUTOFF = 0.15; // Same as time fade-out phase — metronome fully off before neutral
        if (p < METRONOME_CUTOFF) {
          // Phase 1: only metronome, fade out to zero — no neutral, no blink overlap
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = 1 - p / METRONOME_CUTOFF;
            metronomeDraw(ctx, time, state.breathingPhase, 1, 'metronome');
            ctx.restore();
          }
        } else {
          // Phase 2: only neutral, zoom in from dot (same as time→neutral)
          const zoomInProgress = (p - METRONOME_CUTOFF) / (1 - METRONOME_CUTOFF);
          const easedZoomIn = easeInOut(zoomInProgress);
          const faceScale = lerp(0.02, 1, easedZoomIn);
          const neutralDraw = emotionDrawFunctions['neutral'];
          if (neutralDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.scale(faceScale, faceScale);
            neutralDraw(ctx, time, state.breathingPhase, 1, 'neutral');
            ctx.restore();
          }
        }
      } else if (state.emotionTransition.fromEmotion === 'metronome' && state.emotionTransition.toEmotion === 'thinking') {
        // Two-phase: (1) metronome stops blinking (fade out), (2) thinking face zooms in from dot (like time→neutral)
        const p = easedProgress;
        const METRONOME_CUTOFF = 0.15; // Metronome fully off before thinking appears
        if (p < METRONOME_CUTOFF) {
          // Phase 1: only metronome, fade out to zero — stop blinking
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = 1 - p / METRONOME_CUTOFF;
            metronomeDraw(ctx, time, state.breathingPhase, 1, 'metronome');
            ctx.restore();
          }
        } else {
          // Phase 2: only thinking, zoom in from dot (same as time→neutral for neutral)
          const zoomInProgress = (p - METRONOME_CUTOFF) / (1 - METRONOME_CUTOFF);
          const easedZoomIn = easeInOut(zoomInProgress);
          const faceScale = lerp(0.02, 1, easedZoomIn);
          const thinkingDraw = emotionDrawFunctions['thinking'];
          if (thinkingDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.scale(faceScale, faceScale);
            thinkingDraw(ctx, time, state.breathingPhase, 1, 'thinking');
            ctx.restore();
          }
        }
      } else if (state.emotionTransition.fromEmotion === 'metronome') {
        // Transition from metronome to other (non-neutral, non-thinking): cut off metronome first, then show target
        const p = easedProgress;
        const METRONOME_CUTOFF = 0.15;
        if (p < METRONOME_CUTOFF) {
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = 1 - p / METRONOME_CUTOFF;
            metronomeDraw(ctx, time, state.breathingPhase, 1, 'metronome');
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.globalAlpha = 1;
          toDraw(ctx, time, state.breathingPhase, 1, 'metronome');
          ctx.restore();
        }
      } else if (state.emotionTransition.fromEmotion === 'thinking' && state.emotionTransition.toEmotion === 'metronome') {
        // Two-phase: (1) thinking face zooms out to point (like neutral→time), (2) metronome blinks in
        const p = easedProgress;
        const ZOOM_OUT_PHASE_END = 0.15; // Same as neutral→time — thinking fully zoomed out before metronome
        if (p < ZOOM_OUT_PHASE_END) {
          // Phase 1: thinking face zooms out to tiny dot
          const zoomOutProgress = p / ZOOM_OUT_PHASE_END;
          const easedZoomOut = easeInOut(zoomOutProgress);
          const faceScale = lerp(1, 0.02, easedZoomOut);
          const thinkingDraw = emotionDrawFunctions['thinking'];
          if (thinkingDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.scale(faceScale, faceScale);
            thinkingDraw(ctx, time, state.breathingPhase, 1, 'thinking');
            ctx.restore();
          }
        } else {
          // Phase 2: metronome blinks in (no thinking visible)
          const metronomeFadeIn = (p - ZOOM_OUT_PHASE_END) / (1 - ZOOM_OUT_PHASE_END);
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = metronomeFadeIn;
            metronomeDraw(ctx, time, state.breathingPhase, 1, 'thinking');
            ctx.restore();
          }
        }
      } else if (state.emotionTransition.fromEmotion === 'speaking' && state.emotionTransition.toEmotion === 'metronome') {
        // Two-phase: (1) speaking face zooms out to point (like neutral→time), (2) metronome blinks in
        const p = easedProgress;
        const ZOOM_OUT_PHASE_END = 0.15; // Same as neutral→time — speaking fully zoomed out before metronome
        if (p < ZOOM_OUT_PHASE_END) {
          // Phase 1: speaking face (neutral + mouth) zooms out to tiny dot
          const zoomOutProgress = p / ZOOM_OUT_PHASE_END;
          const easedZoomOut = easeInOut(zoomOutProgress);
          const faceScale = lerp(1, 0.02, easedZoomOut);
          const neutralDraw = emotionDrawFunctions['neutral'];
          if (neutralDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.scale(faceScale, faceScale);
            neutralDraw(ctx, time, state.breathingPhase, 1, 'neutral');
            ctx.restore();
          }
          ctx.save();
          ctx.scale(faceScale, faceScale);
          drawSpeakingMouth(ctx, time, 1);
          ctx.restore();
        } else {
          // Phase 2: metronome blinks in (no speaking face visible)
          const metronomeFadeIn = (p - ZOOM_OUT_PHASE_END) / (1 - ZOOM_OUT_PHASE_END);
          const metronomeDraw = emotionDrawFunctions['metronome'];
          if (metronomeDraw) {
            ctx.save();
            ctx.globalAlpha = 1;
            metronomeDraw(ctx, time, state.breathingPhase, metronomeFadeIn, 'speaking');
            ctx.restore();
          }
        }
      } else if (state.emotionTransition.toEmotion === 'metronome') {
        // Transition to metronome (non-thinking): crossfade from-emotion out, metronome in
        const fromDraw = emotionDrawFunctions[state.emotionTransition.fromEmotion];
        if (fromDraw) {
          ctx.save();
          ctx.globalAlpha = 1 - easedProgress;
          fromDraw(ctx, time, state.breathingPhase, 1, state.emotionTransition.fromEmotion);
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = easedProgress;
        toDraw(ctx, time, state.breathingPhase, easedProgress, state.emotionTransition.fromEmotion);
        ctx.restore();
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

  const setCanvasSize = useCallback((w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    animate();
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (fillContainer && containerRef.current) {
      const container = containerRef.current;
      const updateSize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) setCanvasSize(w, h);
      };
      updateSize();
      const ro = new ResizeObserver(updateSize);
      ro.observe(container);
      return () => {
        ro.disconnect();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    // Fixed size
    setCanvasSize(400, 400);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, fillContainer, setCanvasSize]);

  const canvasStyle: React.CSSProperties = {
    border: fillContainer ? 'none' : '2px solid #00FFFF',
    borderRadius: fillContainer ? 0 : '15px',
    background: 'rgba(0, 0, 0, 1)',
    width: fillContainer ? '100%' : undefined,
    height: fillContainer ? '100%' : undefined,
    ...(fillContainer ? {} : {
      backdropFilter: 'blur(10px)',
      boxShadow: '0 0 40px rgba(0, 255, 255, 0.4)'
    })
  };

  return (
    <div
      ref={fillContainer ? containerRef : undefined}
      className={`animated-face ${fillContainer ? 'animated-face--fill' : ''}`}
      style={fillContainer ? { width: '100%', height: '100%' } : undefined}
    >
      <canvas ref={canvasRef} style={canvasStyle} />
      {!fillContainer && (
        <p style={{
          marginTop: '1rem',
          fontSize: '1.2rem',
          textTransform: 'capitalize',
          color: '#00FFFF',
          textShadow: '0 0 15px #00FFFF'
        }}>
          Current Emotion: <strong>{emotion}</strong>
        </p>
      )}
    </div>
  );
};

export default AnimatedFace;
