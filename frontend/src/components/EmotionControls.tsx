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
  const emotions: Emotion[] = ['neutral', 'happy', 'sad', 'surprised', 'thinking', 'excited', 'confused'];

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
            {emotion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmotionControls;
