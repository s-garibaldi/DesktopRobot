import type { EmotionDrawFunction } from '../face/emotions/types';

// Spotify face is rendered as a separate React component (SpotifyFace), not on the canvas.
// This stub exists only to satisfy the Emotion -> draw function map type.
export const drawSpotify: EmotionDrawFunction = (_ctx) => {
  // No-op: Spotify face is shown via SpotifyFace component in App
};
