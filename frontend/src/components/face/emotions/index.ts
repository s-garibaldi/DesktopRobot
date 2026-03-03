// Central export point for all emotion drawing functions
import { drawNeutral } from './neutral';
import { drawHappy } from './happy';
import { drawThinking } from './thinking';
import { drawListening } from './listening';
import { drawTime } from './time';
import { drawSpeaking } from './speaking';
import { drawMetronome } from '../../metronome/metronomeEmotion';
import { drawGuitarTabs } from '../../guitarTabs/guitarTabsEmotion';
import { drawSpotify } from '../../spotify/spotifyEmotion';
import { drawTuner } from '../../tuner/tunerEmotion';
import { Emotion } from '../../../App';
import { EmotionDrawFunction } from './types';

// Map emotions to their drawing functions
export const emotionDrawFunctions: Record<Emotion, EmotionDrawFunction> = {
  neutral: drawNeutral,
  happy: drawHappy,
  thinking: drawThinking,
  listening: drawListening,
  time: drawTime,
  speaking: drawSpeaking,
  metronome: drawMetronome,
  guitarTabs: drawGuitarTabs,
  spotify: drawSpotify,
  tuner: drawTuner,
};

// Export individual functions for direct use if needed
export { drawNeutral, drawHappy, drawThinking, drawListening, drawTime, drawSpeaking, drawMetronome, drawGuitarTabs, drawSpotify, drawTuner };
export { easeInOut } from './types';
