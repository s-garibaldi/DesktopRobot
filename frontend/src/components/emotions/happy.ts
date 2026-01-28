import { EmotionDrawFunction, lerp } from './types';

// HAPPY emotion - neon face with crescent eyes, sparkles, and smiling mouth
export const drawHappy: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, fromEmotion) => {
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
  // For listening->happy: first phase (0-0.5) is listening->neutral, second phase (0.5-1) is neutral->happy
  const isListeningTransition = fromEmotion === 'listening' && transitionProgress < 1;
  const listeningToNeutralPhase = isListeningTransition ? Math.min(transitionProgress * 2, 1) : 0;
  const neutralToHappyPhase = isListeningTransition ? Math.max(0, (transitionProgress - 0.5) * 2) : transitionProgress;
  
  // Eye spacing: listening (40) -> neutral (50) -> happy (50, no change)
  const listeningEyeSpacing = 40;
  const neutralEyeSpacing = 50;
  const happyEyeSpacing = 50;
  let eyeSpacing;
  if (isListeningTransition) {
    if (listeningToNeutralPhase < 1) {
      // First phase: listening->neutral (move further apart)
      eyeSpacing = lerp(listeningEyeSpacing, neutralEyeSpacing, listeningToNeutralPhase);
    } else {
      // Second phase: neutral->happy (no change in spacing)
      eyeSpacing = happyEyeSpacing;
    }
  } else {
    eyeSpacing = happyEyeSpacing;
  }
  
  // Draw left eye - interpolate between full circle (neutral) and crescent (happy)
  ctx.save();
  ctx.translate(-eyeSpacing, -10);
  
  // Eye radius: listening (30) -> neutral (25) -> happy (30)
  const listeningEyeRadius = 30;
  const neutralEyeRadius = 25;
  const happyEyeRadius = 30;
  let eyeRadius;
  if (isListeningTransition) {
    if (listeningToNeutralPhase < 1) {
      // First phase: listening->neutral (shrink from 30 to 25)
      eyeRadius = lerp(listeningEyeRadius, neutralEyeRadius, listeningToNeutralPhase);
    } else {
      // Second phase: neutral->happy (grow from 25 to 30)
      eyeRadius = lerp(neutralEyeRadius, happyEyeRadius, neutralToHappyPhase);
    }
  } else {
    eyeRadius = lerp(neutralEyeRadius, happyEyeRadius, transitionProgress);
  }
  
  // Eye line width: listening (6) -> neutral (5) -> happy (7)
  const listeningEyeLineWidth = 6;
  const neutralEyeLineWidth = 5;
  const happyEyeLineWidth = 7;
  let eyeLineWidth;
  if (isListeningTransition) {
    if (listeningToNeutralPhase < 1) {
      eyeLineWidth = lerp(listeningEyeLineWidth, neutralEyeLineWidth, listeningToNeutralPhase);
    } else {
      eyeLineWidth = lerp(neutralEyeLineWidth, happyEyeLineWidth, neutralToHappyPhase);
    }
  } else {
    eyeLineWidth = lerp(neutralEyeLineWidth, happyEyeLineWidth, transitionProgress);
  }
  
  // Eye vertical offset: neutral (0) -> happy (5)
  const eyeVerticalOffset = isListeningTransition && listeningToNeutralPhase < 1
    ? 0 // First phase: stay at neutral (0)
    : lerp(0, 5, neutralToHappyPhase); // Second phase: neutral->happy
  
  // Shadow blur: listening (dramatic) -> neutral (normal) -> happy (normal)
  const listeningEyeShadowBlur = 45 + Math.sin(time * 2.5) * 25;
  const neutralEyeShadowBlur = 30 + Math.sin(time * 1.8) * 8;
  const happyEyeShadowBlur = 30 + Math.sin(time * 1) * 8;
  let eyeShadowBlur;
  if (isListeningTransition) {
    if (listeningToNeutralPhase < 1) {
      eyeShadowBlur = lerp(listeningEyeShadowBlur, neutralEyeShadowBlur, listeningToNeutralPhase);
    } else {
      eyeShadowBlur = lerp(neutralEyeShadowBlur, happyEyeShadowBlur, neutralToHappyPhase);
    }
  } else {
    eyeShadowBlur = 30 + Math.sin(time * lerp(1.8, 1, transitionProgress)) * 8;
  }
  
  ctx.shadowBlur = eyeShadowBlur;
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
  
  const bottomAngle = Math.PI / 2; // Bottom of circle
  const crescentStart = Math.PI * 1.2; // Start of happy crescent
  const crescentEnd = Math.PI * 1.8; // End of happy crescent
  
  let startAngle, endAngle;
  if (isListeningTransition && listeningToNeutralPhase < 1) {
    // First phase: full circle (listening->neutral)
    startAngle = bottomAngle;
    endAngle = bottomAngle + Math.PI * 2;
  } else {
    // Second phase: morph from full circle to crescent (neutral->happy)
    startAngle = lerp(bottomAngle, crescentStart, neutralToHappyPhase);
    endAngle = lerp(bottomAngle + Math.PI * 2, crescentEnd, neutralToHappyPhase);
  }
  
  ctx.beginPath();
  // Draw arc counterclockwise from startAngle to endAngle
  ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
  ctx.stroke();
  
  // Draw pupil and highlight - fade out during neutral->happy phase
  // Pupils should fade out early in the neutral->happy transition (by 50% of that phase)
  const pupilAlpha = isListeningTransition && listeningToNeutralPhase < 1
    ? 1 // First phase: pupils visible (listening->neutral)
    : Math.max(0, 1 - (neutralToHappyPhase * 2)); // Second phase: fade out during neutral->happy
  
  if (pupilAlpha > 0.05) {
    // Pupil size: listening (16.875) -> neutral (15) -> happy (15, then fade out)
    const listeningPupilRadius = 16.875;
    const neutralPupilRadius = 15;
    let pupilRadius;
    if (isListeningTransition) {
      if (listeningToNeutralPhase < 1) {
        pupilRadius = lerp(listeningPupilRadius, neutralPupilRadius, listeningToNeutralPhase);
      } else {
        pupilRadius = neutralPupilRadius; // Stay at neutral size during fade out
      }
    } else {
      pupilRadius = neutralPupilRadius;
    }
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight size: listening (4.6875) -> neutral (4) -> happy (4, then fade out)
    const listeningHighlightSize = 4.6875;
    const neutralHighlightSize = 4;
    let highlightSize;
    if (isListeningTransition) {
      if (listeningToNeutralPhase < 1) {
        highlightSize = lerp(listeningHighlightSize, neutralHighlightSize, listeningToNeutralPhase);
      } else {
        highlightSize = neutralHighlightSize;
      }
    } else {
      highlightSize = neutralHighlightSize;
    }
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3, -3 + eyeVerticalOffset, highlightSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Sparkle dots - fade in as we transition to happy (only in second phase for listening->happy)
  const sparkleAlpha = isListeningTransition && listeningToNeutralPhase < 1
    ? 0 // First phase: no sparkles
    : Math.max(0, (neutralToHappyPhase - 0.3) / 0.7); // Second phase: start appearing at 30% of neutral->happy phase
  // Sparkle positions - positioned at the edge of the eyes, but accounting for shadow blur
  // Eye radius is 30, but we position sparkles at x: -20 to -22 to ensure they stay inside
  // even with shadow blur (max 20px) extending outward
  const sparklePositions = [
    // Left side cluster (at right edge of left eye, but inward enough to account for blur)
    { x: -20, y: -18, size: 2.5 },
    { x: -21, y: -22, size: 3 },
    { x: -19, y: -20, size: 2 },
    { x: -20, y: -15, size: 2.5 },
    // Right side cluster (at left edge of right eye, but inward enough to account for blur)
    { x: 20, y: -18, size: 2.5 },
    { x: 21, y: -22, size: 3 },
    { x: 19, y: -20, size: 2 },
    { x: 20, y: -15, size: 2.5 }
  ];
  
  if (sparkleAlpha > 0) {
    // Draw sparkles around left eye - only if inside face box
    ctx.save();
    ctx.translate(-eyeSpacing, -10);
    sparklePositions.forEach((pos, index) => {
      // Calculate absolute position relative to face center
      const absoluteX = -eyeSpacing + pos.x;
      const faceBoxLeft = -faceWidth / 2; // -100
      const faceBoxRight = faceWidth / 2; // +100
      const maxShadowBlur = 20; // Maximum shadow blur extent
      const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
      const maxExtent = maxShadowBlur + sparkleSize; // Total extent including size
      
      // Only draw if sparkle (including shadow blur and size) is completely inside the face box
      // Use stricter boundary: leave 30px margin on each side to account for blur and size
      if (absoluteX - maxExtent > faceBoxLeft + 30 && absoluteX + maxExtent < faceBoxRight - 30) {
        const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
        ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = sparkleGlow * secondaryGlow * sparkleAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }
  
  ctx.restore();
  
  // Draw right eye - same interpolation as left
  ctx.save();
  ctx.translate(eyeSpacing, -10);
  
  ctx.shadowBlur = eyeShadowBlur;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Right eye - same animation logic as left
  let rightStartAngle, rightEndAngle;
  if (isListeningTransition && listeningToNeutralPhase < 1) {
    // First phase: full circle (listening->neutral)
    rightStartAngle = bottomAngle;
    rightEndAngle = bottomAngle + Math.PI * 2;
  } else {
    // Second phase: morph from full circle to crescent (neutral->happy)
    rightStartAngle = lerp(bottomAngle, crescentStart, neutralToHappyPhase);
    rightEndAngle = lerp(bottomAngle + Math.PI * 2, crescentEnd, neutralToHappyPhase);
  }
  
  ctx.beginPath();
  ctx.arc(0, eyeVerticalOffset, eyeRadius, rightStartAngle, rightEndAngle, false);
  ctx.stroke();
  
  // Right eye pupils - same fade out logic as left
  if (pupilAlpha > 0.05) {
    // Use same pupil radius and highlight size as left eye
    const listeningPupilRadius = 16.875;
    const neutralPupilRadius = 15;
    let rightPupilRadius;
    if (isListeningTransition) {
      if (listeningToNeutralPhase < 1) {
        rightPupilRadius = lerp(listeningPupilRadius, neutralPupilRadius, listeningToNeutralPhase);
      } else {
        rightPupilRadius = neutralPupilRadius;
      }
    } else {
      rightPupilRadius = neutralPupilRadius;
    }
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, rightPupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    const listeningHighlightSize = 4.6875;
    const neutralHighlightSize = 4;
    let rightHighlightSize;
    if (isListeningTransition) {
      if (listeningToNeutralPhase < 1) {
        rightHighlightSize = lerp(listeningHighlightSize, neutralHighlightSize, listeningToNeutralPhase);
      } else {
        rightHighlightSize = neutralHighlightSize;
      }
    } else {
      rightHighlightSize = neutralHighlightSize;
    }
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8 + Math.sin(time * 2.5) * 4;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3, -3 + eyeVerticalOffset, rightHighlightSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (sparkleAlpha > 0) {
    // Draw sparkles around right eye - only if inside face box
    ctx.save();
    ctx.translate(eyeSpacing, -10);
    sparklePositions.forEach((pos, index) => {
      // Calculate absolute position relative to face center
      const absoluteX = eyeSpacing + pos.x;
      const faceBoxLeft = -faceWidth / 2; // -100
      const faceBoxRight = faceWidth / 2; // +100
      const maxShadowBlur = 20; // Maximum shadow blur extent
      const sparkleSize = pos.size + Math.sin(time * 4.5 + index) * 0.8;
      const maxExtent = maxShadowBlur + sparkleSize; // Total extent including size
      
      // Only draw if sparkle (including shadow blur and size) is completely inside the face box
      // Use stricter boundary: leave 30px margin on each side to account for blur and size
      if (absoluteX - maxExtent > faceBoxLeft + 30 && absoluteX + maxExtent < faceBoxRight - 30) {
        const sparkleGlow = 0.6 + Math.sin(time * 3.5 + index * 0.8) * 0.4;
        ctx.shadowBlur = 12 + Math.sin(time * 4 + index * 0.7) * 8;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = sparkleGlow * secondaryGlow * sparkleAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }
  
  ctx.restore();
  
  // Draw smiling mouth - fade in as we transition to happy (only in second phase for listening->happy)
  const mouthAlpha = isListeningTransition && listeningToNeutralPhase < 1
    ? 0 // First phase: no smile
    : Math.max(0, (neutralToHappyPhase - 0.2) / 0.8); // Second phase: start appearing at 20% of neutral->happy phase
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
  
  // If transitioning from thinking, fade out the thinking elements (dots and drips)
  if (fromEmotion === 'thinking') {
    const thinkingElementsAlpha = 1 - transitionProgress; // Fade out as we transition to happy
    
    // Fade out drip particles (if they exist from thinking)
    if (thinkingElementsAlpha > 0) {
      const dripPositions = [
        { x: -8, y: 18, size: 1.5 },
        { x: -4, y: 22, size: 2 },
        { x: 0, y: 20, size: 1.5 },
        { x: 4, y: 24, size: 1.8 },
        { x: 8, y: 21, size: 1.5 }
      ];
      
      // Left eye drips
      ctx.save();
      ctx.translate(-50, -10);
      dripPositions.forEach((pos, index) => {
        const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
        const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
        ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = dripGlow * secondaryGlow * 0.7 * thinkingElementsAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      
      // Right eye drips
      ctx.save();
      ctx.translate(50, -10);
      dripPositions.forEach((pos, index) => {
        const dripGlow = 0.5 + Math.sin(time * 2 + index * 0.5) * 0.3;
        const dripSize = pos.size + Math.sin(time * 3 + index) * 0.5;
        ctx.shadowBlur = 8 + Math.sin(time * 3 + index * 0.6) * 4;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = dripGlow * secondaryGlow * 0.7 * thinkingElementsAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dripSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    
    // Fade out moving dots
    if (thinkingElementsAlpha > 0) {
      ctx.save();
      ctx.translate(0, -50); // Position above the top of the eyes
      
      const dotSpacing = 20;
      const bounceHeight = 8;
      const animationSpeed = 0.8;
      
      const dot1Offset = Math.abs(Math.sin(time * animationSpeed * 2)) * bounceHeight;
      const dot2Offset = Math.abs(Math.sin(time * animationSpeed * 2 + Math.PI * 0.66)) * bounceHeight;
      const dot3Offset = Math.abs(Math.sin(time * animationSpeed * 2 + Math.PI * 1.33)) * bounceHeight;
      
      const dots = [
        { x: -dotSpacing, offset: dot1Offset },
        { x: 0, offset: dot2Offset },
        { x: dotSpacing, offset: dot3Offset }
      ];
      
      const baseAlpha = secondaryGlow * thinkingElementsAlpha;
      dots.forEach((dot, index) => {
        ctx.save();
        ctx.translate(dot.x, -dot.offset);
        ctx.shadowBlur = 15 + Math.sin(time * 2 + index) * 5;
        ctx.shadowColor = '#00FFFF';
        ctx.fillStyle = '#00FFFF';
        ctx.globalAlpha = baseAlpha;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.restore();
      });
      
      ctx.restore();
    }
  }
  
  ctx.restore();
};
