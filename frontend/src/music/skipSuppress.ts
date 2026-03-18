/**
 * Shared suppress state for track-ended detection.
 * When next()/playIndex()/playUri() replace the current track, Spotify may briefly
 * report the old track as ended during the transition. Suppress auto-advance until
 * we either see a different track URI or the suppression window expires.
 */
const SUPPRESS_MS = 5000;

let suppressUntil = 0;
let suppressedTrackUri: string | null = null;

export function setSuppressTrackEnded(trackUri?: string | null): void {
  suppressUntil = Date.now() + SUPPRESS_MS;
  suppressedTrackUri = trackUri ?? null;
}

export function clearSuppressTrackEnded(): void {
  suppressUntil = 0;
  suppressedTrackUri = null;
}

export function isTrackEndedSuppressed(currentTrackUri?: string | null): boolean {
  if (Date.now() >= suppressUntil) {
    clearSuppressTrackEnded();
    return false;
  }

  if (!suppressedTrackUri) {
    return true;
  }

  if (currentTrackUri && currentTrackUri !== suppressedTrackUri) {
    clearSuppressTrackEnded();
    return false;
  }

  return true;
}
