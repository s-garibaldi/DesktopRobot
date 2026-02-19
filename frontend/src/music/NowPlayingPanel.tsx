/**
 * Now Playing panel - track info, progress bar, play/pause/next/prev.
 */
import type { NowPlaying, PlaybackStatus } from './types';

export interface NowPlayingPanelProps {
  nowPlaying: NowPlaying | null;
  status: PlaybackStatus;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (positionMs: number) => void;
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
}: NowPlayingPanelProps) {
  if (!nowPlaying) {
    return (
      <div className="now-playing-panel now-playing-empty">
        <p>Nothing playing</p>
      </div>
    );
  }

  const { item, progressMs, durationMs } = nowPlaying;

  return (
    <div className="now-playing-panel">
      <div className="now-playing-art">
        {item.albumArtUrl ? (
          <img src={item.albumArtUrl} alt="" />
        ) : (
          <div className="now-playing-art-placeholder" />
        )}
      </div>
      <div className="now-playing-info">
        <div className="now-playing-title">{item.title}</div>
        <div className="now-playing-artist">{item.artist}</div>
      </div>
      <div className="now-playing-progress">
        <input
          type="range"
          min={0}
          max={durationMs || 100}
          value={progressMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="now-playing-seek"
        />
        <div className="now-playing-time">
          <span>{formatMs(progressMs)}</span>
          <span>{formatMs(durationMs)}</span>
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
    </div>
  );
}
