import { useState } from 'react';
import AnimatedFace from './components/AnimatedFace';
import EmotionControls from './components/EmotionControls';
import ChatInterface from './components/ChatInterface';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'thinking' | 'excited' | 'confused';

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
          <ChatInterface 
            currentEmotion={currentEmotion}
            onEmotionChange={setCurrentEmotion}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
