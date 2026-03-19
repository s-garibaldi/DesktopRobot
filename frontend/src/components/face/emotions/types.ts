// Shared types for emotion drawing functions

export type EmotionDrawFunction = (
  ctx: CanvasRenderingContext2D,
  time: number,
  breathingPhase: number,
  transitionProgress?: number,
  fromEmotion?: string,
  pupilDriftToCenter?: number // 0 = full float, 1 = centered (only used by neutral when leaving)
) => void;

// Helper function for smooth interpolation
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Easing function for smooth transitions (ease-in-out)
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Smootherstep: zero 1st, 2nd, 3rd derivative at 0 and 1 — eliminates jerk at turn-around
export function smoothEase(phase: number): number {
  const n = Math.sin(phase) * 0.5 + 0.5; // 0 to 1 over half cycle
  const n2 = n * n;
  const n3 = n2 * n;
  return n3 * (n * (n * 6 - 15) + 10);
}
