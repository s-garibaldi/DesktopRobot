// Central export point for all emotion drawing functions
import { drawNeutral } from './neutral';
import { drawHappy } from './happy';
import { drawThinking } from './thinking';
import { drawSad } from './sad';
import { drawSurprised } from './surprised';
import { drawExcited } from './excited';
import { drawConfused } from './confused';
import { Emotion } from '../../App';

// Map emotions to their drawing functions
export const emotionDrawFunctions: Record<Emotion, (ctx: CanvasRenderingContext2D, time: number, breathingPhase: number) => void> = {
  neutral: drawNeutral,
  happy: drawHappy,
  thinking: drawThinking,
  sad: drawSad,
  surprised: drawSurprised,
  excited: drawExcited,
  confused: drawConfused,
};

// Export individual functions for direct use if needed
export { drawNeutral, drawHappy, drawThinking, drawSad, drawSurprised, drawExcited, drawConfused };
