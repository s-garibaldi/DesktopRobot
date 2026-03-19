import './BackingTrackFace.css';

export interface BackingTrackFaceState {
  active: boolean;
  paused: boolean;
}

interface BackingTrackFaceProps {
  state: BackingTrackFaceState;
}

export default function BackingTrackFace({ state }: BackingTrackFaceProps) {
  const isPaused = state.paused;

  return (
    <div className="backing-track-face">
      <div
        className="backing-track-face-inner"
        data-paused={isPaused ? 'true' : 'false'}
      >
        <div className="backing-track-face-visual" aria-hidden="true">
          {isPaused ? (
            <div className="backing-track-face-pause-icon">
              <span />
              <span />
            </div>
          ) : (
            <div className="backing-track-face-bars">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <div className="backing-track-face-copy">
          <p className="backing-track-face-title">Backing Track</p>
          <p className="backing-track-face-status">
            {isPaused ? 'Paused' : 'Playing'}
          </p>
        </div>
      </div>
    </div>
  );
}
