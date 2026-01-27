// Shared types for emotion drawing functions

export type EmotionDrawFunction = (
  ctx: CanvasRenderingContext2D,
  time: number,
  breathingPhase: number
) => void;
