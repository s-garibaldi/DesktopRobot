import type { PlaybackState } from '../../spotify';
import './SpotifyFace.css';

interface SpotifyFaceProps {
  playbackState: PlaybackState | null;
  onSeek?: (positionMs: number) => void;
  onTogglePlay?: () => void;
}

/** PlaybackState uses seconds; convert to m:ss for display. Tolerates ms input if value is unreasonably large (>2h). */
function formatDurationSec(value: number): string {
  const sec = value > 7200 ? value / 1000 : value; // >2h in sec = likely ms
  const s = Math.floor(Math.max(0, sec));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function SpotifyFace({ playbackState, onSeek, onTogglePlay }: SpotifyFaceProps) {
  const hasTrack = playbackState && (playbackState.trackName || playbackState.duration > 0);
  const seekPercent =
    playbackState && playbackState.duration > 0
      ? Math.min(100, (playbackState.position / playbackState.duration) * 100)
      : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playbackState || playbackState.duration <= 0 || !onSeek) return;
    const pct = Number(e.target.value);
    const positionSec = (pct / 100) * playbackState.duration;
    onSeek(positionSec * 1000);
  };

  return (
    <div className="spotify-face">
      <div className="spotify-face-inner">
        {hasTrack ? (
          <>
            <div className="spotify-face-cover-wrap">
              {playbackState.albumImageUrl ? (
                <img
                  src={playbackState.albumImageUrl}
                  alt=""
                  className="spotify-face-cover"
                />
              ) : (
                <div className="spotify-face-cover-placeholder">
                  <span className="spotify-face-cover-icon">♪</span>
                </div>
              )}
            </div>
            <div className="spotify-face-info">
              <p className="spotify-face-title" title={playbackState.trackName ?? undefined}>
                {playbackState.trackName ?? '—'}
              </p>
              {playbackState.artistNames && (
                <p className="spotify-face-artist" title={playbackState.artistNames}>
                  {playbackState.artistNames}
                </p>
              )}
            </div>
            <div className="spotify-face-bar-wrap">
              <div className="spotify-face-time">
                {formatDurationSec(playbackState.position)}
              </div>
              <input
                type="range"
                className="spotify-face-seek"
                min={0}
                max={100}
                value={seekPercent}
                onChange={handleSeek}
                disabled={!onSeek}
                title="Seek"
                aria-label="Seek"
              />
              <div className="spotify-face-time">
                {formatDurationSec(playbackState.duration)}
              </div>
            </div>
            {onTogglePlay && (
              <button
                type="button"
                className="spotify-face-play-pause"
                onClick={onTogglePlay}
                title={playbackState.paused ? 'Play' : 'Pause'}
                aria-label={playbackState.paused ? 'Play' : 'Pause'}
              >
                {playbackState.paused ? '▶' : '⏸'}
              </button>
            )}
          </>
        ) : (
          <div className="spotify-face-empty">
            <span className="spotify-face-empty-icon">♪</span>
            <p className="spotify-face-empty-text">No track playing</p>
            <p className="spotify-face-empty-hint">Play something from the Spotify panel</p>
          </div>
        )}
      </div>
    </div>
  );
}
