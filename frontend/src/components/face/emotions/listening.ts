import { EmotionDrawFunction, lerp, smoothEase } from './types';
import { getPupilFloat } from './neutral';

// Smooth oscillation (match neutral/time face)
const smoothPulse = (t: number, freq: number, min: number, max: number) => {
  const s = Math.sin(t * freq);
  return min + (max - min) * (s * 0.5 + 0.5);
};

// LISTENING emotion - neutral face with bigger, closer eyes and more dramatic pulsing
export const drawListening: EmotionDrawFunction = (ctx, time, breathingPhase, transitionProgress = 1, fromEmotion) => {
  // Breathing sync: smooth easing (match neutral face)
  const breathEase = smoothEase(breathingPhase);
  const breathingScale = 1 + (breathEase - 0.5) * 0.04;

  // Box glow synced to breathing (match neutral/time)
  const boxGlow = smoothEase(breathingPhase);

  // More dramatic multi-layered glow pulsing (brighter and more intense)
  // Interpolate from neutral to listening values during transition
  // For happy->listening, we go through neutral first
  // For thinking->listening, we combine thinking->neutral (dots fade out) with neutral->listening (eyes grow)
  const isHappyTransition = fromEmotion === 'happy' && transitionProgress < 1;
  const isNeutralTransition = fromEmotion === 'neutral' && transitionProgress < 1;
  const isThinkingTransition = fromEmotion === 'thinking' && transitionProgress < 1;
  
  // For happy->listening: first half (0-0.5) is happy->neutral, second half (0.5-1) is neutral->listening
  const happyToNeutralPhase = isHappyTransition ? Math.min(transitionProgress * 2, 1) : 0;
  const neutralToListeningPhase = isHappyTransition ? Math.max(0, (transitionProgress - 0.5) * 2) : (isNeutralTransition ? transitionProgress : 1);
  
  // When from neutral: pupils drift quickly back to center (offset goes 1 -> 0).
  const fromNeutralPupilOffset = isNeutralTransition
    ? { x: (1 - transitionProgress) * getPupilFloat(time).x, y: (1 - transitionProgress) * getPupilFloat(time).y }
    : { x: 0, y: 0 };
  
  const neutralPrimaryGlow = smoothPulse(time, 0.6, 0.9, 1);
  const happyPrimaryGlow = smoothPulse(time, 0.6, 0.9, 1); // Happy uses same as neutral for glow
  const listeningPrimaryGlow = smoothPulse(time, 0.7, 0.92, 1);
  const thinkingPrimaryGlow = smoothPulse(time, 0.6, 0.9, 1); // Thinking uses same as neutral
  const primaryGlow = isHappyTransition
    ? lerp(happyPrimaryGlow, lerp(neutralPrimaryGlow, listeningPrimaryGlow, neutralToListeningPhase), happyToNeutralPhase)
    : (isThinkingTransition ? lerp(thinkingPrimaryGlow, listeningPrimaryGlow, transitionProgress) : (isNeutralTransition ? lerp(neutralPrimaryGlow, listeningPrimaryGlow, transitionProgress) : listeningPrimaryGlow));
  
  const neutralSecondaryGlow = smoothPulse(time, 0.65, 0.9, 1);
  const happySecondaryGlow = smoothPulse(time, 0.65, 0.9, 1); // Happy uses same as neutral
  const thinkingSecondaryGlow = smoothPulse(time, 0.65, 0.9, 1); // Thinking uses same as neutral
  const listeningSecondaryGlow = smoothPulse(time, 0.8, 0.92, 1);
  const secondaryGlow = isHappyTransition
    ? lerp(happySecondaryGlow, lerp(neutralSecondaryGlow, listeningSecondaryGlow, neutralToListeningPhase), happyToNeutralPhase)
    : (isThinkingTransition ? lerp(thinkingSecondaryGlow, listeningSecondaryGlow, transitionProgress) : (isNeutralTransition ? lerp(neutralSecondaryGlow, listeningSecondaryGlow, transitionProgress) : listeningSecondaryGlow));
  
  const neutralTertiaryGlow = smoothPulse(time, 0.7, 0.93, 1);
  const happyTertiaryGlow = smoothPulse(time, 0.7, 0.93, 1); // Happy uses same as neutral
  const thinkingTertiaryGlow = smoothPulse(time, 0.7, 0.93, 1); // Thinking uses same as neutral
  const listeningTertiaryGlow = smoothPulse(time, 0.9, 0.95, 1);
  const tertiaryGlow = isHappyTransition
    ? lerp(happyTertiaryGlow, lerp(neutralTertiaryGlow, listeningTertiaryGlow, neutralToListeningPhase), happyToNeutralPhase)
    : (isThinkingTransition ? lerp(thinkingTertiaryGlow, listeningTertiaryGlow, transitionProgress) : (isNeutralTransition ? lerp(neutralTertiaryGlow, listeningTertiaryGlow, transitionProgress) : listeningTertiaryGlow));
  
  ctx.save();
  ctx.scale(breathingScale, breathingScale);
  
  // Set up proportions
  const faceWidth = 225;
  const faceHeight = 150;
  const cornerRadius = 20;

  const boxPath = () => {
    ctx.beginPath();
    ctx.roundRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight, cornerRadius);
  };

  // Head intensity: 0 = neutral, 1 = listening (for interpolating box layers during transitions)
  const headIntensity = isHappyTransition
    ? (happyToNeutralPhase < 1 ? 0 : neutralToListeningPhase)
    : (isThinkingTransition ? transitionProgress : (isNeutralTransition ? transitionProgress : 1));

  // 1. Outer ambient glow (synced to breathing) - interpolate neutral <-> listening
  const neutralLayer1Blur = 48 + boxGlow * 14;
  const listeningLayer1Blur = 55 + boxGlow * 18;
  const neutralLayer1Alpha = 0.58 + boxGlow * 0.12;
  const listeningLayer1Alpha = 0.62 + boxGlow * 0.14;
  ctx.save();
  ctx.shadowBlur = lerp(neutralLayer1Blur, listeningLayer1Blur, headIntensity);
  ctx.shadowColor = 'rgba(0, 255, 255, 0.25)';
  ctx.strokeStyle = `rgba(0, 255, 255, ${lerp(0.15, 0.2, headIntensity)})`;
  ctx.lineWidth = lerp(8, 9, headIntensity);
  ctx.globalAlpha = lerp(neutralLayer1Alpha, listeningLayer1Alpha, headIntensity);
  boxPath();
  ctx.stroke();
  ctx.restore();

  // 2. Inner glow (subtle fill) - synced to breathing
  const neutralLayer2Alpha = 0.025 + boxGlow * 0.025;
  const listeningLayer2Alpha = 0.03 + boxGlow * 0.03;
  ctx.save();
  ctx.globalAlpha = lerp(neutralLayer2Alpha, listeningLayer2Alpha, headIntensity);
  ctx.fillStyle = '#00FFFF';
  boxPath();
  ctx.fill();
  ctx.restore();

  // 3. Main head outline with gradient stroke (brighter at top) - synced to breathing
  const gradient = ctx.createLinearGradient(0, -faceHeight / 2, 0, faceHeight / 2);
  gradient.addColorStop(0, 'rgba(150, 255, 255, 1)');
  gradient.addColorStop(0.5, '#00FFFF');
  gradient.addColorStop(1, 'rgba(0, 200, 255, 0.95)');
  const neutralLayer3Blur = 28 + boxGlow * 14;
  const listeningLayer3Blur = 36 + boxGlow * 20;
  const neutralLayer3Alpha = (0.9 + boxGlow * 0.1) * primaryGlow;
  const listeningLayer3Alpha = (0.92 + boxGlow * 0.12) * primaryGlow;
  ctx.shadowBlur = lerp(neutralLayer3Blur, listeningLayer3Blur, headIntensity);
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = gradient;
  ctx.lineWidth = lerp(6, 7, headIntensity);
  ctx.globalAlpha = lerp(neutralLayer3Alpha, listeningLayer3Alpha, headIntensity);
  boxPath();
  ctx.stroke();
  
  // LISTENING: Eyes are bigger and closer together
  // Interpolate from neutral to listening during transition
  // For happy->listening: first morph crescent to full circle, then grow
  // For thinking->listening: combine thinking->neutral (same eye size) with neutral->listening (grow)
  const happyEyeRadius = 30; // Happy crescent eyes
  const neutralEyeRadius = 25; // Neutral full circle eyes
  const thinkingEyeRadius = 25; // Thinking full circle eyes (same as neutral)
  const listeningEyeRadius = 30; // Listening full circle eyes
  
  let eyeRadius;
  if (isHappyTransition) {
    if (happyToNeutralPhase < 1) {
      // First phase: happy->neutral (shrink from 30 to 25)
      eyeRadius = lerp(happyEyeRadius, neutralEyeRadius, happyToNeutralPhase);
    } else {
      // Second phase: neutral->listening (grow from 25 to 30)
      eyeRadius = lerp(neutralEyeRadius, listeningEyeRadius, neutralToListeningPhase);
    }
  } else if (isThinkingTransition) {
    // Thinking->listening: eyes grow from 25 to 30 (thinking and neutral have same size)
    eyeRadius = lerp(thinkingEyeRadius, listeningEyeRadius, transitionProgress);
  } else {
    eyeRadius = isNeutralTransition ? lerp(neutralEyeRadius, listeningEyeRadius, transitionProgress) : listeningEyeRadius;
  }
  
  const neutralEyeSpacing = 50;
  const thinkingEyeSpacing = 50; // Thinking uses neutral spacing
  const listeningEyeSpacing = 40;
  let eyeSpacing;
  if (isHappyTransition) {
    if (happyToNeutralPhase < 1) {
      // First phase: happy->neutral (no change, stays at 50)
      eyeSpacing = neutralEyeSpacing;
    } else {
      // Second phase: neutral->listening (move closer from 50 to 40)
      eyeSpacing = lerp(neutralEyeSpacing, listeningEyeSpacing, neutralToListeningPhase);
    }
  } else if (isThinkingTransition) {
    // Thinking->listening: eyes move closer from 50 to 40
    eyeSpacing = lerp(thinkingEyeSpacing, listeningEyeSpacing, transitionProgress);
  } else {
    eyeSpacing = isNeutralTransition ? lerp(neutralEyeSpacing, listeningEyeSpacing, transitionProgress) : listeningEyeSpacing;
  }
  
  // Draw left eye - bigger with more dramatic pulsing
  ctx.save();
  ctx.translate(-eyeSpacing, -10); // Closer to center
  
  // Interpolate eye outline properties
  const happyEyeShadowBlur = 30 + (smoothPulse(time, 1, 0, 1) - 0.5) * 16;
  const neutralEyeShadowBlur = 30 + (smoothPulse(time, 1.8, 0, 1) - 0.5) * 16;
  const thinkingEyeShadowBlur = 30 + (smoothPulse(time, 1.8, 0, 1) - 0.5) * 16;
  const listeningEyeShadowBlur = 45 + (smoothPulse(time, 2.5, 0, 1) - 0.5) * 50;
  const eyeShadowBlur = isHappyTransition
    ? lerp(
        lerp(happyEyeShadowBlur, neutralEyeShadowBlur, happyToNeutralPhase),
        lerp(neutralEyeShadowBlur, listeningEyeShadowBlur, neutralToListeningPhase),
        happyToNeutralPhase < 1 ? 0 : 1
      )
    : (isThinkingTransition ? lerp(thinkingEyeShadowBlur, listeningEyeShadowBlur, transitionProgress) : (isNeutralTransition ? lerp(neutralEyeShadowBlur, listeningEyeShadowBlur, transitionProgress) : listeningEyeShadowBlur));
  
  const happyEyeLineWidth = 7;
  const neutralEyeLineWidth = 5;
  const thinkingEyeLineWidth = 5; // Thinking uses same as neutral
  const listeningEyeLineWidth = 6;
  const eyeLineWidth = isHappyTransition
    ? lerp(
        lerp(happyEyeLineWidth, neutralEyeLineWidth, happyToNeutralPhase),
        lerp(neutralEyeLineWidth, listeningEyeLineWidth, neutralToListeningPhase),
        happyToNeutralPhase < 1 ? 0 : 1
      )
    : (isThinkingTransition ? lerp(thinkingEyeLineWidth, listeningEyeLineWidth, transitionProgress) : (isNeutralTransition ? lerp(neutralEyeLineWidth, listeningEyeLineWidth, transitionProgress) : listeningEyeLineWidth));
  
  // For happy->listening: need to morph from crescent to full circle
  const happyEyeVerticalOffset = 5;
  const neutralEyeVerticalOffset = 0;
  const eyeVerticalOffset = isHappyTransition
    ? lerp(happyEyeVerticalOffset, neutralEyeVerticalOffset, happyToNeutralPhase)
    : 0;
  
  ctx.shadowBlur = eyeShadowBlur;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Handle eye shape: crescent (happy) -> full circle (neutral/listening)
  if (isHappyTransition && happyToNeutralPhase < 1) {
    // First phase: morph from crescent to full circle
    const bottomAngle = Math.PI / 2;
    const crescentStart = Math.PI * 1.2;
    const crescentEnd = Math.PI * 1.8;
    
    const startAngle = lerp(crescentStart, bottomAngle, happyToNeutralPhase);
    const endAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, happyToNeutralPhase);
    
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
    ctx.stroke();
  } else {
    // Second phase or normal: full circle
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Black pupil (circular, centered) - scaled proportionally with eye size
  // For happy->listening: pupils fade in during first phase, then grow
  const neutralPupilRadius = 15;
  const listeningPupilRadius = 16.875;
  
  let pupilRadius;
  let pupilAlpha = 1;
  if (isHappyTransition) {
    // First phase: fade in pupils (happy->neutral)
    pupilAlpha = Math.max(0, (happyToNeutralPhase * 2) - 1); // Fade in from 50% of first phase
    pupilRadius = lerp(neutralPupilRadius, lerp(neutralPupilRadius, listeningPupilRadius, neutralToListeningPhase), happyToNeutralPhase < 1 ? 0 : 1);
  } else {
    pupilRadius = isNeutralTransition ? lerp(neutralPupilRadius, listeningPupilRadius, transitionProgress) : listeningPupilRadius;
  }
  
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0 + fromNeutralPupilOffset.x, eyeVerticalOffset + fromNeutralPupilOffset.y, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright cyan highlight dot in center - brighter
    const neutralHighlightSize = 4;
    const listeningHighlightSize = 4.6875;
    const highlightSize = isHappyTransition
      ? lerp(neutralHighlightSize, lerp(neutralHighlightSize, listeningHighlightSize, neutralToListeningPhase), happyToNeutralPhase < 1 ? 0 : 1)
      : (isNeutralTransition ? lerp(neutralHighlightSize, listeningHighlightSize, transitionProgress) : listeningHighlightSize);
    
    const neutralHighlightShadowBlur = 8 + (smoothPulse(time, 2.5, 0, 1) - 0.5) * 8;
    const listeningHighlightShadowBlur = 12 + (smoothPulse(time, 3.5, 0, 1) - 0.5) * 16;
    const highlightShadowBlur = isHappyTransition
      ? lerp(neutralHighlightShadowBlur, lerp(neutralHighlightShadowBlur, listeningHighlightShadowBlur, neutralToListeningPhase), happyToNeutralPhase < 1 ? 0 : 1)
      : (isNeutralTransition ? lerp(neutralHighlightShadowBlur, listeningHighlightShadowBlur, transitionProgress) : listeningHighlightShadowBlur);
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = highlightShadowBlur;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3 + fromNeutralPupilOffset.x, -3 + eyeVerticalOffset + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Draw right eye - same as left, mirrored
  ctx.save();
  ctx.translate(eyeSpacing, -10); // Closer to center
  
  // Use same interpolated values as left eye
  ctx.shadowBlur = eyeShadowBlur;
  ctx.shadowColor = '#00FFFF';
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = eyeLineWidth;
  ctx.globalAlpha = secondaryGlow;
  ctx.lineCap = 'round';
  
  // Handle eye shape: crescent (happy) -> full circle (neutral/listening)
  if (isHappyTransition && happyToNeutralPhase < 1) {
    // First phase: morph from crescent to full circle
    const bottomAngle = Math.PI / 2;
    const crescentStart = Math.PI * 1.2;
    const crescentEnd = Math.PI * 1.8;
    
    const startAngle = lerp(crescentStart, bottomAngle, happyToNeutralPhase);
    const endAngle = lerp(crescentEnd, bottomAngle + Math.PI * 2, happyToNeutralPhase);
    
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, startAngle, endAngle, false);
    ctx.stroke();
  } else {
    // Second phase or normal: full circle
    ctx.beginPath();
    ctx.arc(0, eyeVerticalOffset, eyeRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Black pupil
  if (pupilAlpha > 0.05) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = pupilAlpha;
    ctx.beginPath();
    ctx.arc(0 + fromNeutralPupilOffset.x, eyeVerticalOffset + fromNeutralPupilOffset.y, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright cyan highlight dot - brighter
    const neutralHighlightSize = 4;
    const listeningHighlightSize = 4.6875;
    const highlightSize = isHappyTransition
      ? lerp(neutralHighlightSize, lerp(neutralHighlightSize, listeningHighlightSize, neutralToListeningPhase), happyToNeutralPhase < 1 ? 0 : 1)
      : (isNeutralTransition ? lerp(neutralHighlightSize, listeningHighlightSize, transitionProgress) : listeningHighlightSize);
    
    const neutralHighlightShadowBlur = 8 + (smoothPulse(time, 2.5, 0, 1) - 0.5) * 8;
    const listeningHighlightShadowBlur = 12 + (smoothPulse(time, 3.5, 0, 1) - 0.5) * 16;
    const highlightShadowBlur = isHappyTransition
      ? lerp(neutralHighlightShadowBlur, lerp(neutralHighlightShadowBlur, listeningHighlightShadowBlur, neutralToListeningPhase), happyToNeutralPhase < 1 ? 0 : 1)
      : (isNeutralTransition ? lerp(neutralHighlightShadowBlur, listeningHighlightShadowBlur, transitionProgress) : listeningHighlightShadowBlur);
    
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = highlightShadowBlur;
    ctx.shadowColor = '#00FFFF';
    ctx.globalAlpha = tertiaryGlow * pupilAlpha;
    ctx.beginPath();
    ctx.arc(-3 + fromNeutralPupilOffset.x, -3 + eyeVerticalOffset + fromNeutralPupilOffset.y, highlightSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // If transitioning from happy, fade out the happy elements (smile and sparkles)
  if (isHappyTransition) {
    const happyElementsAlpha = 1 - happyToNeutralPhase; // Fade out during first phase
    
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
      ctx.translate(-eyeSpacing, -10);
      sparklePositions.forEach((pos, index) => {
        const sparkleGlow = 0.6 + (smoothPulse(time + index * 0.2, 3.5, 0, 1) - 0.5) * 0.8;
        const sparkleSize = pos.size + (smoothPulse(time + index * 0.15, 4.5, 0, 1) - 0.5) * 1.6;
        ctx.shadowBlur = 12 + (smoothPulse(time + index * 0.1, 4, 0, 1) - 0.5) * 16;
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
      ctx.translate(eyeSpacing, -10);
      sparklePositions.forEach((pos, index) => {
        const sparkleGlow = 0.6 + (smoothPulse(time + index * 0.2, 3.5, 0, 1) - 0.5) * 0.8;
        const sparkleSize = pos.size + (smoothPulse(time + index * 0.15, 4.5, 0, 1) - 0.5) * 1.6;
        ctx.shadowBlur = 12 + (smoothPulse(time + index * 0.1, 4, 0, 1) - 0.5) * 16;
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
    const mouthAlpha = Math.max(0, 1 - (happyToNeutralPhase * 1.25));
    if (mouthAlpha > 0) {
      ctx.save();
      ctx.translate(0, lerp(-15, 0, happyToNeutralPhase)); // Mouth position moves up as it fades
      
      ctx.shadowBlur = 30 + (smoothPulse(time, 1.8, 0, 1) - 0.5) * 16;
      ctx.shadowColor = '#00FFFF';
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = lerp(7, 0, happyToNeutralPhase);
      ctx.globalAlpha = secondaryGlow * mouthAlpha;
      ctx.lineCap = 'round';
      
      // Smile fades away
      ctx.beginPath();
      ctx.arc(0, 0, lerp(50, 0, happyToNeutralPhase), Math.PI * 0.15, Math.PI * 0.85, false);
      ctx.stroke();
      
      ctx.restore();
    }
  }
  
  // If transitioning from thinking, fade out the thinking elements (dots and drips)
  if (isThinkingTransition) {
    const thinkingElementsAlpha = 1 - transitionProgress; // Fade out as we transition to listening
    
    // Fade out drip particles
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
      ctx.translate(-eyeSpacing, -10);
      dripPositions.forEach((pos, index) => {
        const dripGlow = 0.5 + (smoothPulse(time + index * 0.1, 2, 0, 1) - 0.5) * 0.6;
        const dripSize = pos.size + (smoothPulse(time + index * 0.15, 3, 0, 1) - 0.5) * 1;
        ctx.shadowBlur = 8 + (smoothPulse(time + index * 0.12, 3, 0, 1) - 0.5) * 8;
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
      ctx.translate(eyeSpacing, -10);
      dripPositions.forEach((pos, index) => {
        const dripGlow = 0.5 + (smoothPulse(time + index * 0.1, 2, 0, 1) - 0.5) * 0.6;
        const dripSize = pos.size + (smoothPulse(time + index * 0.15, 3, 0, 1) - 0.5) * 1;
        ctx.shadowBlur = 8 + (smoothPulse(time + index * 0.12, 3, 0, 1) - 0.5) * 8;
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
        ctx.shadowBlur = 10 + (smoothPulse(time + index * 0.2, 2.5, 0, 1) - 0.5) * 10;
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
