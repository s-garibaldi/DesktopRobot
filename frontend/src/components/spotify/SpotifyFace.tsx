import type { PlaybackState } from '../../spotify';
import './SpotifyFace.css';

interface SpotifyFaceProps {
  playbackState: PlaybackState | null;
  onTogglePlay?: () => void;
  showStartPlaybackButton?: boolean;
  onStartPlayback?: () => void;
  showConnectButton?: boolean;
  onConnectSpotify?: () => void;
  showShell?: boolean;
}

export default function SpotifyFace({
  playbackState,
  onTogglePlay,
  showStartPlaybackButton = false,
  onStartPlayback,
  showConnectButton = false,
  onConnectSpotify,
  showShell = true,
}: SpotifyFaceProps) {
  const hasTrack = playbackState && (playbackState.trackName || playbackState.duration > 0);

  const isPlaying = hasTrack && playbackState && !playbackState.paused;

  const inner = (
    <div
      className="spotify-face-inner"
      data-playing={isPlaying ? 'true' : undefined}
    >
      {showConnectButton ? (
        <div className="spotify-face-empty spotify-face-empty--connect">
          <span className="spotify-face-empty-icon">♪</span>
          <p className="spotify-face-empty-text">Spotify needs to reconnect</p>
          {onConnectSpotify && (
            <button
              type="button"
              className="spotify-face-connect-btn"
              onClick={onConnectSpotify}
              title="Connect Spotify"
              aria-label="Connect Spotify"
            >
              Connect Spotify
            </button>
          )}
        </div>
      ) : hasTrack ? (
        <div className="spotify-face-track">
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
          <div className="spotify-face-actions">
            {showStartPlaybackButton && onStartPlayback && (
              <button
                type="button"
                className="spotify-face-start-btn"
                onClick={onStartPlayback}
                title="Start playback"
                aria-label="Start playback"
              >
                ▶ Start playback
              </button>
            )}
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
          </div>
        </div>
      ) : (
        <div className="spotify-face-empty">
          <span className="spotify-face-empty-icon">♪</span>
          <p className="spotify-face-empty-text">No track playing</p>
          {showStartPlaybackButton && onStartPlayback && (
            <button
              type="button"
              className="spotify-face-start-btn"
              onClick={onStartPlayback}
              title="Start playback"
              aria-label="Start playback"
            >
              ▶ Start playback
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!showShell) {
    return <div className="spotify-face spotify-face--shell-less">{inner}</div>;
  }

  return (
    <div className="spotify-face">
      {inner}
    </div>
  );
}
