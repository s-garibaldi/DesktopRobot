import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSuppressTrackEnded,
  isTrackEndedSuppressed,
  setSuppressTrackEnded,
} from './skipSuppress';

describe('skipSuppress', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearSuppressTrackEnded();
  });

  it('suppresses track-ended during a manual transition for the same track', () => {
    setSuppressTrackEnded('spotify:track:old');

    expect(isTrackEndedSuppressed('spotify:track:old')).toBe(true);
    expect(isTrackEndedSuppressed(null)).toBe(true);
  });

  it('clears suppression as soon as a different track becomes current', () => {
    setSuppressTrackEnded('spotify:track:old');

    expect(isTrackEndedSuppressed('spotify:track:new')).toBe(false);
    expect(isTrackEndedSuppressed('spotify:track:new')).toBe(false);
  });

  it('expires suppression after the timeout window', () => {
    vi.useFakeTimers();
    setSuppressTrackEnded('spotify:track:old');

    vi.advanceTimersByTime(5001);

    expect(isTrackEndedSuppressed('spotify:track:old')).toBe(false);
  });
});
