import { useState } from 'react';
import AnimatedFace from './components/AnimatedFace';
import EmotionControls from './components/EmotionControls';
import RealtimeBridge from './components/RealtimeBridge';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'listening' | 'time' | 'thinking' | 'speaking' | 'metronome';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isEmotionFullscreen, setIsEmotionFullscreen] = useState(false);

  return (
    <div className="app">
      <div className={isEmotionFullscreen ? 'app-fullscreen' : undefined}>
        {isEmotionFullscreen && (
          <button
            type="button"
            className="emotion-fullscreen-exit"
            onClick={() => setIsEmotionFullscreen(false)}
            aria-label="Exit fullscreen"
          >
            Exit fullscreen
          </button>
        )}
        <h1>Desktop Robot</h1>
        <div className="robot-container">
          <div className="left-panel">
            <div className="animated-face-wrapper">
              <AnimatedFace emotion={currentEmotion} fillContainer={isEmotionFullscreen} />
              {!isEmotionFullscreen && (
                <button
                  type="button"
                  className="emotion-fullscreen-enter"
                  onClick={() => setIsEmotionFullscreen(true)}
                  aria-label="View fullscreen"
                >
                  Fullscreen
                </button>
              )}
            </div>
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
    </div>
  );
}

export default App;
