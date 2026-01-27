// Shared types for emotion drawing functions

export type EmotionDrawFunction = (
  ctx: CanvasRenderingContext2D,
  time: number,
  breathingPhase: number,
  transitionProgress?: number,
  fromEmotion?: string
) => void;

// Helper function for smooth interpolation
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Easing function for smooth transitions (ease-in-out)
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
