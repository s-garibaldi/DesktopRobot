import type { EmotionDrawFunction } from '../face/emotions/types';

// Tuner view is rendered as a separate React component (TunerFace), not on the canvas.
// This stub exists only to satisfy the Emotion -> draw function map type.
export const drawTuner: EmotionDrawFunction = (_ctx) => {
  // No-op: tuner face is shown via TunerFace component in App
};
