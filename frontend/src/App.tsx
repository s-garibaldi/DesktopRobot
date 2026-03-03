import { useState, useEffect, useCallback } from 'react';
import AnimatedFace from './components/face/AnimatedFace';
import EmotionControls from './components/face/EmotionControls';
import GuitarTabsFace from './components/guitarTabs/GuitarTabsFace';
import SpotifyFace from './components/spotify/SpotifyFace';
import TunerFace from './components/tuner/TunerFace';
import { getChordVoicings, getScaleVoicings, normalizeChordInput, resolveChordOrScaleInputForDisplay, getConfusableRootChords, getChordDisplayName } from './components/guitarTabs/chordData';
import RealtimeBridge from './components/RealtimeBridge';
import type { PlaybackState } from './spotify';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'listening' | 'time' | 'thinking' | 'speaking' | 'metronome' | 'guitarTabs' | 'spotify' | 'tuner';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isEmotionFullscreen, setIsEmotionFullscreen] = useState(false);
  const [spotifyPlaybackState, setSpotifyPlaybackState] = useState<PlaybackState | null>(null);
  const [spotifyUserStopped, setSpotifyUserStopped] = useState(false);
  const [guitarTabsInput, setGuitarTabsInput] = useState('');
  const [guitarTabsVoicingIndex, setGuitarTabsVoicingIndex] = useState(0);

  const chordVoicings = getChordVoicings(guitarTabsInput);
  const scaleVoicings = getScaleVoicings(guitarTabsInput);
  const isScale = /scale/.test(normalizeChordInput(guitarTabsInput));
  const voicingCount = isScale ? scaleVoicings.length : chordVoicings.length;
  const hasMultipleVoicings = voicingCount > 1;
  const currentBaseFret = isScale && scaleVoicings.length ? scaleVoicings[Math.min(guitarTabsVoicingIndex, scaleVoicings.length - 1)]?.fretOffset : null;
  const confusableChords = !isScale && chordVoicings.length > 0 ? getConfusableRootChords(guitarTabsInput) : [];

  useEffect(() => {
    setGuitarTabsVoicingIndex(0);
  }, [guitarTabsInput]);

  // Destroy tuner when switching away to prevent it from updating detached DOM (crashes)
  const handleEmotionChange = useCallback((emotion: Emotion) => {
    const leavingTuner = currentEmotion === 'tuner' && emotion !== 'tuner';
    if (leavingTuner) {
      try {
        (window as { Tuner?: { destroy: () => void } }).Tuner?.destroy();
      } catch {
        // Ignore destroy errors
      }
    }
    // When user manually selects a non-spotify face while a track is playing, prevent
    // the Spotify effect from immediately switching back
    const hasActiveTrack = spotifyPlaybackState &&
      (spotifyPlaybackState.trackName || spotifyPlaybackState.duration > 0);
    if (emotion !== 'spotify' && hasActiveTrack) {
      setSpotifyUserStopped(true);
    }
    setCurrentEmotion(emotion);
  }, [currentEmotion, spotifyPlaybackState]);

  // Auto-show Spotify face when a track is loaded (playing or paused); only go back to neutral when track is stopped.
  // If user pressed Stop, don't switch back to Spotify until they play again (no active track).
  useEffect(() => {
    const hasActiveTrack =
      spotifyPlaybackState &&
      (spotifyPlaybackState.trackName || spotifyPlaybackState.duration > 0);
    if (hasActiveTrack && !spotifyUserStopped) {
      handleEmotionChange('spotify');
    } else if (!hasActiveTrack) {
      setSpotifyUserStopped(false);
      if (currentEmotion === 'spotify') handleEmotionChange('neutral');
    }
  }, [spotifyPlaybackState?.trackName ?? null, spotifyPlaybackState?.duration ?? 0, currentEmotion, spotifyUserStopped, handleEmotionChange]);

  const handleGuitarTabDisplayCommand = (action: 'show' | 'close', description?: string) => {
    if (action === 'show') {
      // Resolve to display form; for scales include " scale" so the UI shows scale voicings (backend can send "G major scale" or "G major")
      setGuitarTabsInput(resolveChordOrScaleInputForDisplay(description ?? ''));
      handleEmotionChange('guitarTabs');
    } else {
      handleEmotionChange('neutral');
    }
  };

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
        <div className={`robot-container${currentEmotion === 'guitarTabs' ? ' guitar-tabs-active' : ''}${currentEmotion === 'spotify' ? ' spotify-active' : ''}${currentEmotion === 'tuner' ? ' tuner-active' : ''}`}>
          <div className="left-panel">
            <div className="animated-face-wrapper">
              {currentEmotion === 'guitarTabs' ? (
                <GuitarTabsFace
                  input={guitarTabsInput}
                  voicingIndex={guitarTabsVoicingIndex}
                />
              ) : currentEmotion === 'spotify' ? (
                <SpotifyFace playbackState={spotifyPlaybackState} />
              ) : currentEmotion === 'tuner' ? (
                <TunerFace />
              ) : (
                <AnimatedFace emotion={currentEmotion} fillContainer={isEmotionFullscreen} />
              )}
              {!isEmotionFullscreen && currentEmotion !== 'guitarTabs' && currentEmotion !== 'spotify' && currentEmotion !== 'tuner' && (
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
              {currentEmotion === 'spotify' && (
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                  color: '#00FFFF',
                  textShadow: '0 0 10px #00FFFF'
                }}>
                  Spotify
                </p>
              )}
              {currentEmotion === 'tuner' && (
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                  color: '#00FFFF',
                  textShadow: '0 0 10px #00FFFF'
                }}>
                  Tuner
                </p>
              )}
            </div>
            <div className="controls-section">
              <EmotionControls
                currentEmotion={currentEmotion}
                onEmotionChange={handleEmotionChange}
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
                  {confusableChords.length > 0 && (
                    <p className="guitar-tabs-confusable-hint">
                      Mic mixed up B/C/D/E?{' '}
                      {confusableChords.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className="guitar-tabs-confusable-btn"
                          onClick={() => setGuitarTabsInput(getChordDisplayName(key))}
                        >
                          {getChordDisplayName(key)}
                        </button>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="right-panel">
            <RealtimeBridge
              currentEmotion={currentEmotion}
              onEmotionChange={handleEmotionChange}
              onGuitarTabDisplayCommand={handleGuitarTabDisplayCommand}
              onSpotifyPlaybackStateChange={setSpotifyPlaybackState}
              onSpotifyStop={() => {
                handleEmotionChange('neutral');
                setSpotifyUserStopped(true);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
