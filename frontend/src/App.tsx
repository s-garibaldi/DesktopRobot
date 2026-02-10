import { useState, useEffect } from 'react';
import AnimatedFace from './components/AnimatedFace';
import EmotionControls from './components/EmotionControls';
import GuitarTabsFace from './components/guitarTabs/GuitarTabsFace';
import { getChordVoicings, getScaleVoicings, normalizeChordInput } from './components/guitarTabs/chordData';
import RealtimeBridge from './components/RealtimeBridge';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'listening' | 'time' | 'thinking' | 'speaking' | 'metronome' | 'guitarTabs';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isEmotionFullscreen, setIsEmotionFullscreen] = useState(false);
  const [guitarTabsInput, setGuitarTabsInput] = useState('');
  const [guitarTabsVoicingIndex, setGuitarTabsVoicingIndex] = useState(0);

  const chordVoicings = getChordVoicings(guitarTabsInput);
  const scaleVoicings = getScaleVoicings(guitarTabsInput);
  const isScale = /scale/.test(normalizeChordInput(guitarTabsInput));
  const voicingCount = isScale ? scaleVoicings.length : chordVoicings.length;
  const hasMultipleVoicings = voicingCount > 1;
  const currentBaseFret = isScale && scaleVoicings.length ? scaleVoicings[Math.min(guitarTabsVoicingIndex, scaleVoicings.length - 1)]?.fretOffset : null;

  useEffect(() => {
    setGuitarTabsVoicingIndex(0);
  }, [guitarTabsInput]);

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
              {currentEmotion === 'guitarTabs' ? (
                <GuitarTabsFace
                  input={guitarTabsInput}
                  voicingIndex={guitarTabsVoicingIndex}
                />
              ) : (
                <AnimatedFace emotion={currentEmotion} fillContainer={isEmotionFullscreen} />
              )}
              {!isEmotionFullscreen && currentEmotion !== 'guitarTabs' && (
                <button
                  type="button"
                  className="emotion-fullscreen-enter"
                  onClick={() => setIsEmotionFullscreen(true)}
                  aria-label="View fullscreen"
                >
                  Fullscreen
                </button>
              )}
              {currentEmotion === 'guitarTabs' && (
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                  color: '#00FFFF',
                  textShadow: '0 0 10px #00FFFF'
                }}>
                  Guitar tabs
                </p>
              )}
            </div>
            <div className="controls-section">
              <EmotionControls
                currentEmotion={currentEmotion}
                onEmotionChange={setCurrentEmotion}
              />
              {currentEmotion === 'guitarTabs' && (
                <div className="guitar-tabs-input-section">
                  <label htmlFor="chord-scale-input">Chord or scale</label>
                  <input
                    id="chord-scale-input"
                    type="text"
                    value={guitarTabsInput}
                    onChange={(e) => setGuitarTabsInput(e.target.value)}
                    placeholder="e.g. Gmajor, Am, C major scale"
                    className="guitar-tabs-input"
                  />
                  {hasMultipleVoicings && (
                    <div className="guitar-tabs-voicing-nav">
                      <button
                        type="button"
                        className="guitar-tabs-voicing-btn"
                        onClick={() => setGuitarTabsVoicingIndex((i) => Math.max(0, i - 1))}
                        aria-label={isScale ? 'Previous position (down the neck)' : 'Previous voicing (down the neck)'}
                        title={isScale ? 'Previous position' : 'Previous voicing'}
                      >
                        ←
                      </button>
                      <span className="guitar-tabs-voicing-label">
                        {isScale ? (
                          <>Position {guitarTabsVoicingIndex + 1} of {scaleVoicings.length}{currentBaseFret != null && <> · Fret {currentBaseFret}</>}</>
                        ) : (
                          <>Voicing {guitarTabsVoicingIndex + 1} of {chordVoicings.length}</>
                        )}
                      </span>
                      <button
                        type="button"
                        className="guitar-tabs-voicing-btn"
                        onClick={() =>
                          setGuitarTabsVoicingIndex((i) =>
                            Math.min(voicingCount - 1, i + 1)
                          )
                        }
                        aria-label={isScale ? 'Next position (up the neck)' : 'Next voicing (up the neck)'}
                        title={isScale ? 'Next position' : 'Next voicing'}
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              )}
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
