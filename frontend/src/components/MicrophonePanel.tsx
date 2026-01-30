import type { MicrophoneStatus } from '../hooks/useMicrophone';
import './MicrophonePanel.css';

interface MicrophonePanelProps {
  status: MicrophoneStatus;
  error: string | null;
  isSupported: boolean;
  volumeLevel: number;
  volumeDb: number;
  onRequestAccess: () => void;
  onStop: () => void;
}

export default function MicrophonePanel({
  status,
  error,
  isSupported,
  volumeLevel,
  volumeDb,
  onRequestAccess,
  onStop,
}: MicrophonePanelProps) {
  if (!isSupported) {
    return (
      <div className="microphone-panel unsupported">
        <span className="microphone-panel-icon">🎤</span>
        <span>Microphone not supported in this environment.</span>
      </div>
    );
  }

  return (
    <div className={`microphone-panel status-${status}`}>
      <div className="microphone-panel-header">
        <span className="microphone-panel-icon">🎤</span>
        <span className="microphone-panel-title">Frontend Microphone</span>
      </div>
      <div className="microphone-panel-body">
        {status === 'idle' && (
          <p className="microphone-panel-hint">
            Enable the microphone so this app can receive your voice. Later it will be used to send commands to the backend.
          </p>
        )}
        {status === 'requesting' && (
          <p className="microphone-panel-hint">Requesting microphone access…</p>
        )}
        {status === 'granted' && (
          <>
            <p className="microphone-stream-confirmed" role="status">
              ✓ Microphone stream active — app can receive your audio.
            </p>
            <div className="microphone-panel-active">
              <div className="microphone-level-bar">
                <div className="microphone-level-track">
                  <div
                    className="microphone-level-fill"
                    style={{ width: `${Math.round(volumeLevel * 100)}%` }}
                  />
                </div>
                <span className="microphone-level-db" aria-label="Current level in decibels">
                  {volumeDb} dB
                </span>
              </div>
              <span className="microphone-panel-status-text">Microphone on</span>
            </div>
            <p className="microphone-receiving-hint" role="status" aria-live="polite">
              {volumeDb > -55 ? (
                <span className="microphone-receiving-yes">✓ Level meter detecting sound.</span>
              ) : (
                <span className="microphone-receiving-silent">Level meter may not update in this environment; stream is still active.</span>
              )}
            </p>
          </>
        )}
        {(status === 'denied' || status === 'error') && error && (
          <p className="microphone-panel-error">{error}</p>
        )}
      </div>
      <div className="microphone-panel-actions">
        {(status === 'idle' || status === 'denied' || status === 'error' || status === 'requesting') ? (
          <button
            type="button"
            className="microphone-panel-button enable"
            onClick={onRequestAccess}
            disabled={status === 'requesting'}
          >
            {status === 'requesting' ? 'Requesting…' : 'Enable Microphone'}
          </button>
        ) : status === 'granted' ? (
          <button
            type="button"
            className="microphone-panel-button disable"
            onClick={onStop}
          >
            Disable Microphone
          </button>
        ) : null}
      </div>
    </div>
  );
}
