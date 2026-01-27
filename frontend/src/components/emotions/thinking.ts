import { EmotionDrawFunction, lerp } from './types';

// THINKING emotion - neon face with full circle eyes, drips, and animated dots
export const drawThinking: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, fromEmotion) => {
  // Enhanced breathing animation
  const breathingScale = 1 + Math.sin(breathingPhase) * 0.03;
  
  // Multi-layered glow pulsing
  // For listening->thinking: interpolate from listening (dramatic) to neutral/thinking (normal)
  const isListeningTransition = fromEmotion === 'listening' && transitionProgress < 1;
  const isNeutralTransition = fromEmotion === 'neutral' && transitionProgress < 1;
  
  const listeningPrimaryGlow = 0.9 + Math.sin(time * 1.5) * 0.1;
  const neutralPrimaryGlow = 0.85 + Math.sin(time * 1.2) * 0.15;
  const thinkingPrimaryGlow = 0.85 + Math.sin(time * 1.2) * 0.15; // Thinking uses same as neutral
  const primaryGlow = isListeningTransition
    ? lerp(listeningPrimaryGlow, thinkingPrimaryGlow, transitionProgress)
    : thinkingPrimaryGlow;
  
  const listeningSecondaryGlow = 0.95 + Math.sin(time * 2.5) * 0.15;
  const neutralSecondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1;
  const thinkingSecondaryGlow = 0.9 + Math.sin(time * 2.1) * 0.1; // Thinking uses same as neutral
  const secondaryGlow = isListeningTransition
    ? lerp(listeningSecondaryGlow, thinkingSecondaryGlow, transitionProgress)
    : thinkingSecondaryGlow;
  
  const listeningTertiaryGlow = 0.98 + Math.sin(time * 4.0) * 0.12;
  const neutralTertiaryGlow = 0.95 + Math.sin(time * 3.3) * 0.05;
  const thinkingTertiaryGlow = 0.95 + Math.sin(time * 3.3) * 0.05; // Thinking uses same as neutral
  const tertiaryGlow = isListeningTransition
    ? lerp(listeningTertiaryGlow, thinkingTertiaryGlow, transitionProgress)
    : thinkingTertiaryGlow;
  
  ctx.save();
  ctx.scale(breathingScale, breathingScale);
  
  // Set up proportions
  const faceWidth = 200;
  const faceHeight = 150;
  const cornerRadius = 20;
  
  // Draw the rounded rectangular head outline
  // Interpolate from listening (dramatic) to neutral/thinking (normal)
  const listeningHeadShadowBlur = 40 + Math.sin(time * 2.0) * 20;
  const neutralHeadShadowBlur = 30 + Math.sin(time * 1.5) * 10;
  const thinkingHeadShadowBlur = 30 + Math.sin(time * 1.5) * 10; // Thinking uses same as neutral
  const headShadowBlur = isListeningTransition
    ? lerp(listeningHeadShadowBlur, thinkingHeadShadowBlur, transitionProgress)
    : thinkingHeadShadowBlur;
  
  const listeningHeadLineWidth = 7;
  const neutralHeadLineWidth = 6;
  const thinkingHeadLineWidth = 6; // Thinking uses same as neutral
  const headLineWidth = isListeningTransition
    ? lerp(listeningHeadLineWidth, thinkingHeadLineWidth, transitionProgress)
    : thinkingHeadLineWidth;
  
  ctx.shadowBlur = headShadowBlur;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = headLineWidth;
  ctx.globalAlpha = primaryGlow;
  
  ctx.beginPath();
  ctx.roundRect(-faceWidth/2, -faceHeight/2, faceWidth, faceHeight, cornerRadius);
  ctx.stroke();
  
  // Eye spacing: listening (40) -> neutral/thinking (50)
  const listeningEyeSpacing = 40;
  const neutralEyeSpacing = 50;
  const thinkingEyeSpacing = 50; // Thinking uses same as neutral
  const eyeSpacing = isListeningTransition
    ? lerp(listeningEyeSpacing, thinkingEyeSpacing, transitionProgress)
    : thinkingEyeSpacing;
  
  // Draw left eye - handle transitions from happy or listening
  ctx.save();
  ctx.translate(-eyeSpacing, -10);
  
  // Eye radius: listening (30) -> neutral/thinking (25)
  const listeningEyeRadius = 30;
  const neutralEyeRadius = 25;
  const thinkingEyeRadius = 25; // Thinking uses same as neutral
  
  // Calculate eye properties once for both eyes (for listening transition)
  let eyeRadius: number;
  let eyeLineWidth: number;
  let eyeShadowBlur: number;
  let pupilRadius: number;
  let highlightSize: number;
  
  if (isListeningTransition) {
    eyeRadius = lerp(listeningEyeRadius, thinkingEyeRadius, transitionProgress);
    eyeLineWidth = lerp(6, 5, transitionProgress);
    const listeningEyeShadowBlur = 45 + Math.sin(time * 2.5) * 25;
    const neutralEyeShadowBlur = 30 + Math.sin(time * 1.8) * 8;
    eyeShadowBlur = lerp(listeningEyeShadowBlur, neutralEyeShadowBlur, transitionProgress);
    const listeningPupilRadius = 16.875;
    const neutralPupilRadius = 15;
    pupilRadius = lerp(listeningPupilRadius, neutralPupilRadius, transitionProgress);
    const listeningHighlightSize = 4.6875;
    const neutralHighlightSize = 4;
    highlightSize = lerp(listeningHighlightSize, neutralHighlightSize, transitionProgress);
  }
  
  // If transitioning from happy, morph eyes from crescent to full circle
  if (fromEmotion === 'happy') {
    // Interpolate eye properties (reverse of happy)
    const eyeLineWidth = lerp(7, 5, transitionProgress);
    const eyeVerticalOffset = lerp(5, 0, transitionProgress);
    const eyeRadius = lerp(30, 25, transitionProgress);
    
    const happyEyeShadowBlur = 30 + Math.sin(time * 1) * 8;
    const neutralEyeShadowBlur = 30 + Math.sin(time * 1.8) * 8;
    const eyeShadowBlur = 30 + Math.sin(time * lerp(1, 1.8, transitionProgress)) * 8;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = eyeLineWidth;
    ctx.globalAlpha = secondaryGlow;
    ctx.lineCap = 'round';
    
    // Reverse of happy animation: crescent arcs downward to form full circle
    const bottomAngle = Math.PI / 2;
    const crescentStart = Math.PI * 1.2;
    const crescentEnd = Math.PI * 1.8;
    
    const startAngle = lerp(crescentStart, bottomAngle, transitionProgress);
    const endAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
    
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
    ctx.stroke();
    
    // Pupils fade in as we transition from happy
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
  } else if (isListeningTransition) {
    // Transition from listening: eyes shrink and pulsing decreases
    // Use pre-calculated values for consistency
    ctx.shadowBlur = eyeShadowBlur;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = eyeLineWidth;
    ctx.globalAlpha = secondaryGlow;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    // Draw full circle with interpolated radius
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow;
    ctx.beginPath();
    ctx.arc(-3, -3, highlightSize, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal thinking eye - full circle outline
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
  }
  
  ctx.restore();
  
  // Drip particles below the eyes (sparkling cyan particles) - fade in during transition
  // If coming from listening, drips fade in as transition progresses (listening->neutral->thinking)
  // If coming from neutral, drips should also fade in
  const dripAlpha = transitionProgress; // Fade in as transition progresses
  const dripPositions = [
    { x: -8, y: 18, size: 1.5 },
    { x: -4, y: 22, size: 2 },
    { x: 0, y: 20, size: 1.5 },
    { x: 4, y: 24, size: 1.8 },
    { x: 8, y: 21, size: 1.5 }
  ];
  
  if (dripAlpha > 0) {
    // Use correct eye spacing for drip positions
    // Left eye drips
    ctx.save();
    ctx.translate(-eyeSpacing, -10);
    dripPositions.forEach((pos, index) => {
      const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
      const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
      ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.globalAlpha = dripGlow * secondaryGlow * 0.7 * dripAlpha; // Fade in with transition
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    
    // Right eye drips
    ctx.save();
    ctx.translate(eyeSpacing, -10);
    dripPositions.forEach((pos, index) => {
      const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
      const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
      ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.globalAlpha = dripGlow * secondaryGlow * 0.7 * dripAlpha; // Fade in with transition
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  
  // Draw right eye - handle transitions from happy or listening
  ctx.save();
  ctx.translate(eyeSpacing, -10);
  
  if (fromEmotion === 'happy') {
    // Same morphing as left eye
    const eyeLineWidth = lerp(7, 5, transitionProgress);
    const eyeVerticalOffset = lerp(5, 0, transitionProgress);
    const eyeRadius = lerp(30, 25, transitionProgress);
    
    ctx.shadowBlur = eyeShadowBlur;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = eyeLineWidth;
    ctx.globalAlpha = secondaryGlow;
    ctx.lineCap = 'round';
    
    const bottomAngle = Math.PI / 2;
    const crescentStart = Math.PI * 1.2;
    const crescentEnd = Math.PI * 1.8;
    
    const rightStartAngle = lerp(crescentStart, bottomAngle, transitionProgress);
    const rightEndAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, transitionProgress);
    
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
    ctx.stroke();
    
    const pupilAlpha = Math.max(0, (transitionProgress * 2) - 1);
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
  } else if (isListeningTransition) {
    // Transition from listening: eyes shrink and pulsing decreases (same as left eye)
    // Use pre-calculated values for consistency
    ctx.shadowBlur = eyeShadowBlur;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = eyeLineWidth;
    ctx.globalAlpha = secondaryGlow;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow;
    ctx.beginPath();
    ctx.arc(-3, -3, highlightSize, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal thinking eye - full circle outline
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
  }
  
  ctx.restore();
  
    // Draw three animated dots (iMessage-style bouncing animation) - fade in during transition
    // If coming from listening, dots fade in as transition progresses (listening->neutral->thinking)
    // If coming from neutral, dots should also fade in
    const dotsAlpha = transitionProgress; // Fade in as transition progresses
    if (dotsAlpha > 0) {
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
        ctx.globalAlpha = secondaryGlow * dotsAlpha; // Fade in with transition
        ctx.beginPath();
        ctx.arc(dot.x, -dot.offset, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.restore();
    }
  
  // If transitioning from happy, fade out the happy elements (smile and sparkles)
  if (fromEmotion === 'happy') {
    const happyElementsAlpha = 1 - transitionProgress; // Fade out as we transition to thinking
    
    // Fade out sparkles around the eyes
    if (happyElementsAlpha > 0) {
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
      
      // Left eye sparkles
      ctx.save();
      ctx.translate(-50, -10);
      sparklePositions.forEach((pos, index) => {
        const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
        const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
        ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = sparkleGlow * secondaryGlow * happyElementsAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      
      // Right eye sparkles
      ctx.save();
      ctx.translate(50, -10);
      sparklePositions.forEach((pos, index) => {
        const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
        const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
        ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = sparkleGlow * secondaryGlow * happyElementsAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    
    // Fade out smiling mouth
    const mouthAlpha = Math.max(0, 1 - (transitionProgress * 1.25));
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
  }
  
  ctx.restore();
};
