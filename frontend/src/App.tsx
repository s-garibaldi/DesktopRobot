import { useState, useEffect, useCallback, useRef } from 'react';
import AnimatedFace from './components/face/AnimatedFace';
import EmotionControls from './components/face/EmotionControls';
import GuitarTabsFace from './components/guitarTabs/GuitarTabsFace';
import SpotifyFace from './components/spotify/SpotifyFace';
import TunerFace from './components/tuner/TunerFace';
import BackingTrackFace, { type BackingTrackFaceState } from './components/backingTrack/BackingTrackFace';
import { getChordVoicings, getScaleVoicings, normalizeChordInput, resolveChordOrScaleInputForDisplay, getConfusableRootChords, getChordDisplayName } from './components/guitarTabs/chordData';
import RealtimeBridge from './components/RealtimeBridge';
import type { PlaybackState } from './spotify';
import './App.css';

export type Emotion = 'neutral' | 'happy' | 'listening' | 'time' | 'thinking' | 'speaking' | 'metronome' | 'guitarTabs' | 'spotify' | 'tuner' | 'backingTrack';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isEmotionFullscreen, setIsEmotionFullscreen] = useState(false);
  const [spotifyPlaybackState, setSpotifyPlaybackState] = useState<PlaybackState | null>(null);
  const [backingTrackState, setBackingTrackState] = useState<BackingTrackFaceState>({ active: false, paused: false });
  const [spotifyUserStopped, setSpotifyUserStopped] = useState(false);
  const [showSpotifyStartPlaybackButton, setShowSpotifyStartPlaybackButton] = useState(false);
  const [showSpotifyConnectButton, setShowSpotifyConnectButton] = useState(false);
  const [spotifyStartPlaybackPressed, setSpotifyStartPlaybackPressed] = useState(false);
  const [spotifyExitTransition, setSpotifyExitTransition] = useState<{
    active: boolean;
    fromEmotion: Emotion | null;
    toEmotion: Emotion | null;
    playbackState: PlaybackState | null;
    showStartPlaybackButton: boolean;
  }>({
    active: false,
    fromEmotion: null,
    toEmotion: null,
    playbackState: null,
    showStartPlaybackButton: false,
  });
  const [chordDisplayTransition, setChordDisplayTransition] = useState<{
    active: boolean;
    fromEmotion: Emotion | null;
    toEmotion: Emotion | null;
  }>({
    active: false,
    fromEmotion: null,
    toEmotion: null,
  });
  const [guitarTabsInput, setGuitarTabsInput] = useState('');
  const [guitarTabsVoicingIndex, setGuitarTabsVoicingIndex] = useState(0);
  const previousEmotionRef = useRef<Emotion>(currentEmotion);
  const previousBackingTrackActiveRef = useRef(backingTrackState.active);
  const spotifyExitTimerRef = useRef<number | null>(null);
  const chordDisplayTransitionTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    const previousEmotion = previousEmotionRef.current;
    const isSpotifyManagedTransition =
      (previousEmotion === 'spotify' && currentEmotion === 'neutral') ||
      (previousEmotion === 'thinking' && currentEmotion === 'spotify');
    const isChordDisplayManagedTransition =
      (previousEmotion === 'neutral' && currentEmotion === 'guitarTabs') ||
      (previousEmotion === 'thinking' && currentEmotion === 'guitarTabs') ||
      (previousEmotion === 'guitarTabs' && currentEmotion === 'neutral');

    if (isSpotifyManagedTransition) {
      setSpotifyExitTransition({
        active: true,
        fromEmotion: previousEmotion,
        toEmotion: currentEmotion,
        playbackState: spotifyPlaybackState,
        showStartPlaybackButton: showSpotifyStartPlaybackButton,
      });
      if (spotifyExitTimerRef.current) {
        window.clearTimeout(spotifyExitTimerRef.current);
      }
      spotifyExitTimerRef.current = window.setTimeout(() => {
        setSpotifyExitTransition({
          active: false,
          fromEmotion: null,
          toEmotion: null,
          playbackState: null,
          showStartPlaybackButton: false,
        });
        spotifyExitTimerRef.current = null;
      }, 520);
    } else if (isChordDisplayManagedTransition) {
      setChordDisplayTransition({
        active: true,
        fromEmotion: previousEmotion,
        toEmotion: currentEmotion,
      });
      if (chordDisplayTransitionTimerRef.current) {
        window.clearTimeout(chordDisplayTransitionTimerRef.current);
      }
      chordDisplayTransitionTimerRef.current = window.setTimeout(() => {
        setChordDisplayTransition({
          active: false,
          fromEmotion: null,
          toEmotion: null,
        });
        chordDisplayTransitionTimerRef.current = null;
      }, 900);
    } else if (
      spotifyExitTransition.active &&
      (currentEmotion !== spotifyExitTransition.toEmotion || previousEmotion !== spotifyExitTransition.fromEmotion)
    ) {
      setSpotifyExitTransition({
        active: false,
        fromEmotion: null,
        toEmotion: null,
        playbackState: null,
        showStartPlaybackButton: false,
      });
      if (spotifyExitTimerRef.current) {
        window.clearTimeout(spotifyExitTimerRef.current);
        spotifyExitTimerRef.current = null;
      }
    } else if (
      chordDisplayTransition.active &&
      (currentEmotion !== chordDisplayTransition.toEmotion || previousEmotion !== chordDisplayTransition.fromEmotion)
    ) {
      setChordDisplayTransition({
        active: false,
        fromEmotion: null,
        toEmotion: null,
      });
      if (chordDisplayTransitionTimerRef.current) {
        window.clearTimeout(chordDisplayTransitionTimerRef.current);
        chordDisplayTransitionTimerRef.current = null;
      }
    }
    previousEmotionRef.current = currentEmotion;
  }, [
    currentEmotion,
    spotifyPlaybackState,
    showSpotifyStartPlaybackButton,
    spotifyExitTransition.active,
    spotifyExitTransition.fromEmotion,
    spotifyExitTransition.toEmotion,
    chordDisplayTransition.active,
    chordDisplayTransition.fromEmotion,
    chordDisplayTransition.toEmotion,
  ]);

  useEffect(() => {
    return () => {
      if (spotifyExitTimerRef.current) {
        window.clearTimeout(spotifyExitTimerRef.current);
      }
      if (chordDisplayTransitionTimerRef.current) {
        window.clearTimeout(chordDisplayTransitionTimerRef.current);
      }
    };
  }, []);

  // Destroy tuner when switching away to prevent it from updating detached DOM (crashes)
  const handleEmotionChange = useCallback((emotion: Emotion) => {
    if (currentEmotion === 'tuner' && emotion !== 'tuner') {
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
    // Set chord display transition (neutral↔chord display, thinking↔chord)
    const isChordDisplayTransition =
      (currentEmotion === 'guitarTabs' && emotion === 'neutral') ||
      (currentEmotion === 'neutral' && emotion === 'guitarTabs') ||
      (currentEmotion === 'thinking' && emotion === 'guitarTabs');
    if (isChordDisplayTransition) {
      setChordDisplayTransition({
        active: true,
        fromEmotion: currentEmotion,
        toEmotion: emotion,
      });
    }
    setCurrentEmotion(emotion);
  }, [currentEmotion, spotifyPlaybackState]);

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

  useEffect(() => {
    const wasActive = previousBackingTrackActiveRef.current;
    if (backingTrackState.active && !wasActive) {
      handleEmotionChange('backingTrack');
    } else if (!backingTrackState.active && currentEmotion === 'backingTrack') {
      handleEmotionChange('neutral');
    }
    previousBackingTrackActiveRef.current = backingTrackState.active;
  }, [backingTrackState.active, currentEmotion, handleEmotionChange]);

  const handleGuitarTabDisplayCommand = (action: 'show' | 'close', description?: string) => {
    if (action === 'show') {
      // Resolve to display form; for scales include " scale" so the UI shows scale voicings (backend can send "G major scale" or "G major")
      setGuitarTabsInput(resolveChordOrScaleInputForDisplay(description ?? ''));
      handleEmotionChange('guitarTabs');
    } else {
      handleEmotionChange('neutral');
    }
  };

  const handleTunerCommand = (action: 'show' | 'close') => {
    if (action === 'show') {
      handleEmotionChange('tuner');
    } else {
      handleEmotionChange('neutral');
    }
  };

  useEffect(() => {
    const handleRequest = () => {
      if (!spotifyStartPlaybackPressed) {
        setShowSpotifyStartPlaybackButton(true);
      }
    };
    window.addEventListener('spotify-agent-requested-playback', handleRequest);
    return () => window.removeEventListener('spotify-agent-requested-playback', handleRequest);
  }, [spotifyStartPlaybackPressed]);

  useEffect(() => {
    const handlePlaybackFailed = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      if (reason !== 'not_connected') return;
      setShowSpotifyConnectButton(true);
      setShowSpotifyStartPlaybackButton(false);
      handleEmotionChange('spotify');
    };

    const handleConnected = () => {
      setShowSpotifyConnectButton(false);
    };

    window.addEventListener('spotify-playback-failed', handlePlaybackFailed);
    window.addEventListener('spotify-connected', handleConnected);
    return () => {
      window.removeEventListener('spotify-playback-failed', handlePlaybackFailed);
      window.removeEventListener('spotify-connected', handleConnected);
    };
  }, [handleEmotionChange]);

  const handleSpotifyFaceStartPlayback = useCallback(() => {
    setSpotifyStartPlaybackPressed(true);
    setShowSpotifyStartPlaybackButton(false);
    window.dispatchEvent(new CustomEvent('spotify-start-playback-request'));
  }, []);

  const handleSpotifyFaceConnect = useCallback(() => {
    window.dispatchEvent(new CustomEvent('spotify-connect-request'));
  }, []);

  const renderPrimaryFace = () => {
    if (currentEmotion === 'guitarTabs') {
      return (
        <GuitarTabsFace
          input={guitarTabsInput}
          voicingIndex={guitarTabsVoicingIndex}
        />
      );
    }
    if (currentEmotion === 'spotify') {
      return (
        <SpotifyFace
          playbackState={spotifyPlaybackState}
          showConnectButton={showSpotifyConnectButton}
          onConnectSpotify={handleSpotifyFaceConnect}
          showStartPlaybackButton={showSpotifyStartPlaybackButton}
          onStartPlayback={handleSpotifyFaceStartPlayback}
        />
      );
    }
    if (currentEmotion === 'backingTrack') {
      return <BackingTrackFace state={backingTrackState} />;
    }
    if (currentEmotion === 'tuner') {
      return <TunerFace />;
    }
    return <AnimatedFace emotion={currentEmotion} fillContainer={isEmotionFullscreen} />;
  };

  const renderTransitionFace = () => {
    if (spotifyExitTransition.active) {
      const { fromEmotion, toEmotion, playbackState, showStartPlaybackButton } = spotifyExitTransition;

      if (fromEmotion === 'spotify' && toEmotion === 'neutral') {
        return (
          <div className="face-transition-shell">
            <div className="face-layer face-layer-neutral-enter">
              <AnimatedFace emotion="neutral" showFrame={false} />
            </div>
            <div className="face-layer face-layer-spotify-exit">
              <SpotifyFace
                playbackState={playbackState}
                showStartPlaybackButton={showStartPlaybackButton}
                onStartPlayback={handleSpotifyFaceStartPlayback}
                showShell={false}
              />
            </div>
          </div>
        );
      }

      if (fromEmotion === 'thinking' && toEmotion === 'spotify') {
        return (
          <div className="face-transition-shell">
            <div className="face-layer face-layer-thinking-exit">
              <AnimatedFace emotion="thinking" showFrame={false} />
            </div>
            <div className="face-layer face-layer-spotify-enter">
              <SpotifyFace
                playbackState={playbackState}
                showStartPlaybackButton={showStartPlaybackButton}
                onStartPlayback={handleSpotifyFaceStartPlayback}
                showShell={false}
              />
            </div>
          </div>
        );
      }
    }

    if (chordDisplayTransition.active) {
      const { fromEmotion, toEmotion } = chordDisplayTransition;

      if (fromEmotion === 'thinking' && toEmotion === 'guitarTabs') {
        return (
          <div key="thinking-to-chord" className="face-transition-shell face-transition-shell--chord-enter">
            <div className="face-layer face-layer-chord-display-enter face-layer-chord-display-enter--from-thinking">
              <GuitarTabsFace
                input={guitarTabsInput}
                voicingIndex={guitarTabsVoicingIndex}
                showShell={false}
              />
            </div>
            <div className="face-layer face-layer-thinking-exit">
              <AnimatedFace emotion="thinking" showFrame={false} />
            </div>
          </div>
        );
      }

      if (fromEmotion === 'neutral' && toEmotion === 'guitarTabs') {
        return (
          <div key="neutral-to-chord" className="face-transition-shell face-transition-shell--chord-enter">
            <div className="face-layer face-layer-chord-display-enter">
              <GuitarTabsFace
                input={guitarTabsInput}
                voicingIndex={guitarTabsVoicingIndex}
                showShell={false}
              />
            </div>
            <div className="face-layer face-layer-neutral-exit face-layer-neutral-exit--to-chord">
              <AnimatedFace emotion="neutral" showFrame={false} />
            </div>
          </div>
        );
      }

      if (fromEmotion === 'guitarTabs' && toEmotion === 'neutral') {
        return (
          <div key="chord-to-neutral" className="face-transition-shell">
            <div className="face-layer face-layer-neutral-enter face-layer-neutral-enter-from-chord">
              <AnimatedFace emotion="neutral" showFrame={false} />
            </div>
            <div className="face-layer face-layer-chord-display-exit">
              <GuitarTabsFace
                input={guitarTabsInput}
                voicingIndex={guitarTabsVoicingIndex}
                showShell={false}
              />
            </div>
          </div>
        );
      }
    }

    return null;
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
        <div className={`robot-container${currentEmotion === 'guitarTabs' ? ' guitar-tabs-active' : ''}${currentEmotion === 'spotify' ? ' spotify-active' : ''}${currentEmotion === 'tuner' ? ' tuner-active' : ''}${currentEmotion === 'backingTrack' ? ' backing-track-active' : ''}`}>
          <div className="left-panel">
            <div className="animated-face-wrapper">
              <div className={`face-stage${(spotifyExitTransition.active || chordDisplayTransition.active) ? ' face-stage-transition' : ''}`}>
                {(spotifyExitTransition.active || chordDisplayTransition.active) ? (
                  renderTransitionFace()
                ) : (
                  <div className="face-layer face-layer-current">
                    {renderPrimaryFace()}
                  </div>
                )}
              </div>
              {!isEmotionFullscreen && currentEmotion !== 'guitarTabs' && currentEmotion !== 'spotify' && currentEmotion !== 'tuner' && currentEmotion !== 'backingTrack' && (
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
              {currentEmotion === 'backingTrack' && (
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                  color: '#00FFFF',
                  textShadow: '0 0 10px #00FFFF'
                }}>
                  Backing track
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
              onTunerCommand={handleTunerCommand}
              onSpotifyPlaybackStateChange={setSpotifyPlaybackState}
              onBackingTrackStateChange={setBackingTrackState}
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
