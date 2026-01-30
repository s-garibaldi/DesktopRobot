/**
 * Structured spec for a backing track, parsed from a voice or text command.
 * Used to call the ElevenLabs music API (frontend-only, no AI backend).
 */
export interface BackingTrackSpec {
  /** Chord symbols, e.g. ['G', 'C', 'D', 'Em'] */
  chords?: string[];
  /** Beats per minute (e.g. 92) */
  bpm?: number;
  /** Style/genre keyword (e.g. 'lofi', 'jazz', 'acoustic') */
  style?: string;
  /** Duration in seconds (e.g. 15). API accepts 3–600 seconds. */
  durationSeconds?: number;
}
