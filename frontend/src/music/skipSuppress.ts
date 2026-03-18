/**
 * Shared suppress state for track-ended detection.
 * When next() is called (from voice, UI, or music_next), we suppress track-ended
 * for a short window to prevent double-skip from SDK reporting uri=null during transition.
 */
const SUPPRESS_MS = 2500;

let suppressUntil = 0;

export function setSuppressTrackEnded(): void {
  suppressUntil = Date.now() + SUPPRESS_MS;
}

export function isTrackEndedSuppressed(): boolean {
  return Date.now() < suppressUntil;
}
