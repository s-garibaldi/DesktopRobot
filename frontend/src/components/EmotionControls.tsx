import React from 'react';
import { Emotion } from '../App';
import './EmotionControls.css';

interface EmotionControlsProps {
  currentEmotion: Emotion;
  onEmotionChange: (emotion: Emotion) => void;
}

const EmotionControls: React.FC<EmotionControlsProps> = ({ 
  currentEmotion, 
  onEmotionChange 
}) => {
  const emotions: Emotion[] = ['neutral', 'happy', 'listening', 'time', 'thinking', 'speaking', 'metronome', 'guitarTabs'];

  const labelForEmotion = (emotion: Emotion) => {
    if (emotion === 'time') return 'Time';
    if (emotion === 'metronome') return 'Metronome';
    if (emotion === 'guitarTabs') return 'Guitar tabs';
    return emotion;
  };

  return (
    <div className="emotion-controls">
      <h3>Manual Emotion Control</h3>
      <div className="emotion-buttons">
        {emotions.map((emotion) => (
          <button
            key={emotion}
            onClick={() => onEmotionChange(emotion)}
            className={`emotion-button ${currentEmotion === emotion ? 'active' : ''}`}
          >
            {labelForEmotion(emotion)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmotionControls;
