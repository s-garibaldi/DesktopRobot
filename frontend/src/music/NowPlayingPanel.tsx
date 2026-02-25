/**
 * Now Playing panel - track info, progress bar, play/pause/next/prev, volume, stop, restart, skip.
 */
import type { NowPlaying, PlaybackStatus } from './types';

export interface NowPlayingPanelProps {
  nowPlaying: NowPlaying | null;
  status: PlaybackStatus;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (positionMs: number) => void;
  /** Volume 0–1; when provided, shows volume slider */
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onStop?: () => void;
  onRestart?: () => void;
  /** Seconds for skip forward/back; when provided, shows skip controls */
  skipSeconds?: number;
  onSkipSecondsChange?: (seconds: number) => void;
  onRewind?: () => void;
  onForward?: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export function NowPlayingPanel({
  nowPlaying,
  status,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  volume,
  onVolumeChange,
  onStop,
  onRestart,
  skipSeconds = 15,
  onSkipSecondsChange,
  onRewind,
  onForward,
}: NowPlayingPanelProps) {
  const hasVolume = onVolumeChange != null;
  const hasStopRestart = onStop != null || onRestart != null;
  const hasSkip = onRewind != null && onForward != null;

  if (!nowPlaying && !hasVolume) {
    return (
      <div className="now-playing-panel now-playing-empty">
        <p>Nothing playing</p>
      </div>
    );
  }

  return (
    <div className="now-playing-panel">
      {nowPlaying ? (
        <>
          <div className="now-playing-art">
            {nowPlaying.item.albumArtUrl ? (
              <img src={nowPlaying.item.albumArtUrl} alt="" />
            ) : (
              <div className="now-playing-art-placeholder" />
            )}
          </div>
          <div className="now-playing-info">
            <div className="now-playing-title">{nowPlaying.item.title}</div>
            <div className="now-playing-artist">{nowPlaying.item.artist}</div>
          </div>
          <div className="now-playing-progress">
            <input
              type="range"
              min={0}
              max={nowPlaying.durationMs || 100}
              value={nowPlaying.progressMs}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="now-playing-seek"
            />
            <div className="now-playing-time">
              <span>{formatMs(nowPlaying.progressMs)}</span>
              <span>{formatMs(nowPlaying.durationMs)}</span>
            </div>
          </div>
          <div className="now-playing-controls">
            <button type="button" onClick={onPrevious} aria-label="Previous" className="now-playing-btn">
              ⏮
            </button>
            <button type="button" onClick={onPlayPause} aria-label={status === 'playing' ? 'Pause' : 'Play'} className="now-playing-btn now-playing-btn-main">
              {status === 'playing' ? '⏸' : '▶'}
            </button>
            <button type="button" onClick={onNext} aria-label="Next" className="now-playing-btn">
              ⏭
            </button>
          </div>
          {(hasStopRestart || hasSkip) && (
            <div className="now-playing-extra">
              {hasStopRestart && (
                <>
                  {onStop && (
                    <button type="button" onClick={onStop} className="now-playing-extra-btn" title="Stop">
                      ⏹ Stop
                    </button>
                  )}
                  {onRestart && (
                    <button type="button" onClick={onRestart} className="now-playing-extra-btn" title="Restart song">
                      ↺ Restart
                    </button>
                  )}
                </>
              )}
              {hasSkip && (
                <div className="now-playing-skip-row">
                  <label className="now-playing-skip-label">
                    Skip
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={skipSeconds}
                      onChange={(e) => onSkipSecondsChange?.(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
                      className="now-playing-skip-input"
                      title="Seconds to skip"
                    />
                    s
                  </label>
                  <button type="button" onClick={onRewind} className="now-playing-extra-btn" title={`Rewind ${skipSeconds} s`}>
                    ⏪ −{skipSeconds}s
                  </button>
                  <button type="button" onClick={onForward} className="now-playing-extra-btn" title={`Forward ${skipSeconds} s`}>
                    +{skipSeconds}s ⏩
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="now-playing-empty-text">Nothing playing</p>
      )}
      {hasVolume && (
        <div className="now-playing-volume">
          <label className="now-playing-volume-label">
            Vol
            <input
              type="range"
              min={0}
              max={100}
              value={volume != null ? volume * 100 : 50}
              onChange={(e) => onVolumeChange?.(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
