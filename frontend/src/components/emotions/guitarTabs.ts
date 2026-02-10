import type { EmotionDrawFunction } from './types';

// Guitar tabs view is rendered as a separate React component (GuitarTabsFace), not on the canvas.
// This stub exists only to satisfy the Emotion -> draw function map type.
export const drawGuitarTabs: EmotionDrawFunction = (_ctx) => {
  // No-op: guitar tabs face is shown via GuitarTabsFace component in App
};
