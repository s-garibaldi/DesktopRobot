/**
 * Metronome panel: text input to set BPM and optionally switch to metronome emotion.
 */

import { useState, useCallback } from 'react';
import { Emotion } from '../App';
import { parseMetronomeBpm } from '../parseMetronomeCommand';
import { getMetronomeBpm, setMetronomeBpm } from '../metronomeStore';
import './MetronomePanel.css';

interface MetronomePanelProps {
  currentEmotion: Emotion;
  onEmotionChange: (emotion: Emotion) => void;
  /** When starting the metronome (Set or Show), parent can show thinking then metronome. If not provided, goes straight to metronome. */
  onStartMetronome?: () => void;
  /** When stopping the metronome (Stop button), parent can exit metronome mode and restore mic. */
  onStopMetronome?: () => void;
}

export default function MetronomePanel({
  currentEmotion,
  onEmotionChange,
  onStartMetronome,
  onStopMetronome,
}: MetronomePanelProps) {
  const [textInput, setTextInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentBpm, setCurrentBpm] = useState(getMetronomeBpm());

  const applyBpm = useCallback(
    (text: string, switchToMetronome: boolean = false) => {
      const bpm = parseMetronomeBpm(text);
      if (bpm === null) {
        setStatusMessage('Could not parse BPM. Try "120 bpm" or "90" (40–240).');
        return;
      }
      setMetronomeBpm(bpm);
      setCurrentBpm(bpm);
      setStatusMessage(`Metronome set to ${bpm} BPM.`);
      if (switchToMetronome) {
        onStartMetronome ? onStartMetronome() : onEmotionChange('metronome');
      }
    },
    [onEmotionChange, onStartMetronome]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = textInput.trim();
      if (!text) return;
      applyBpm(text, true);
    },
    [textInput, applyBpm]
  );

  return (
    <div className="metronome-panel">
      <div className="metronome-panel-header">
        <span className="icon">⏱</span>
        <span>Metronome</span>
      </div>
      <div className="metronome-panel-body">
        <p className="metronome-hint">
          Face blinks blue at the set BPM. Type a BPM and press Enter or click Set.
        </p>

        <form onSubmit={handleSubmit} className="metronome-input-row">
          <label htmlFor="metronome-request" className="metronome-label">
            BPM (40–240)
          </label>
          <input
            id="metronome-request"
            type="text"
            className="metronome-text-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="e.g. 120 bpm"
          />
          <button type="submit" className="metronome-set-button">
            Set
          </button>
        </form>

        <div className="metronome-actions">
          <button
            type="button"
            className={`metronome-show-button ${currentEmotion === 'metronome' ? 'active' : ''}`}
            onClick={() => (onStartMetronome ? onStartMetronome() : onEmotionChange('metronome'))}
          >
            Show Metronome
          </button>
          {currentEmotion === 'metronome' && (
            <button
              type="button"
              className="metronome-stop-button"
              onClick={() => {
                onStopMetronome?.();
                onEmotionChange('neutral');
              }}
            >
              Stop
            </button>
          )}
        </div>

        <p className="metronome-status" role="status">
          {statusMessage || `Current: ${currentBpm} BPM`}
        </p>
      </div>
    </div>
  );
}
