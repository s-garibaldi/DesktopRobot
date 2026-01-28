import { useState } from 'react';
import AnimatedFace from './components/AnimatedFace';
import EmotionControls from './components/EmotionControls';
import RealtimeBridge from './components/RealtimeBridge';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'listening' | 'time' | 'thinking' | 'excited' | 'confused';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');

  return (
    <div className="app">
      <h1>Desktop Robot</h1>
      <div className="robot-container">
        <div className="left-panel">
          <AnimatedFace emotion={currentEmotion} />
          <div className="controls-section">
            <EmotionControls 
              currentEmotion={currentEmotion} 
              onEmotionChange={setCurrentEmotion} 
            />
          </div>
        </div>
        <div className="right-panel">
          <RealtimeBridge 
            currentEmotion={currentEmotion}
            onEmotionChange={setCurrentEmotion}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
