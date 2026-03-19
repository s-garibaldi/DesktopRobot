/**
 * Unit tests for tuner and guitar tab display voice command detection.
 * Tuner and chord display should operate similarly: each has a close command
 * that returns to neutral when that face is active.
 */
import { describe, it, expect } from 'vitest';
import {
  isCloseBackingTrackCommand,
  isCloseDisplayCommand,
  isCloseTunerCommand,
  isSpotifyPlayOrResumeCommand,
} from './useVoiceCommandMicOnOff';

describe('isCloseTunerCommand', () => {
  it('matches "stop" and "close"', () => {
    expect(isCloseTunerCommand('stop')).toBe(true);
    expect(isCloseTunerCommand('Stop')).toBe(true);
    expect(isCloseTunerCommand('close')).toBe(true);
    expect(isCloseTunerCommand('Close')).toBe(true);
  });

  it('matches tuner-specific phrases', () => {
    expect(isCloseTunerCommand('close tuner')).toBe(true);
    expect(isCloseTunerCommand('stop tuner')).toBe(true);
    expect(isCloseTunerCommand('turn off tuner')).toBe(true);
    expect(isCloseTunerCommand('turn off the tuner')).toBe(true);
  });

  it('matches "close display" (parity with chord display)', () => {
    expect(isCloseTunerCommand('close display')).toBe(true);
  });

  it('matches exit/hide/done', () => {
    expect(isCloseTunerCommand('exit')).toBe(true);
    expect(isCloseTunerCommand('hide')).toBe(true);
    expect(isCloseTunerCommand('done')).toBe(true);
  });

  it('rejects unrelated phrases', () => {
    expect(isCloseTunerCommand('play')).toBe(false);
    expect(isCloseTunerCommand('open tuner')).toBe(false);
    expect(isCloseTunerCommand('show display')).toBe(false);
  });
});

describe('isCloseDisplayCommand', () => {
  it('matches "close display"', () => {
    expect(isCloseDisplayCommand('close display')).toBe(true);
    expect(isCloseDisplayCommand('Close Display')).toBe(true);
  });

  it('matches phrases containing "close display"', () => {
    expect(isCloseDisplayCommand('please close display')).toBe(true);
  });

  it('rejects "close tuner" (different command)', () => {
    expect(isCloseDisplayCommand('close tuner')).toBe(false);
  });

  it('rejects unrelated phrases', () => {
    expect(isCloseDisplayCommand('stop')).toBe(false);
    expect(isCloseDisplayCommand('eggplant')).toBe(false);
  });
});

describe('isCloseBackingTrackCommand', () => {
  it('matches explicit close phrases for backing track', () => {
    expect(isCloseBackingTrackCommand('close')).toBe(true);
    expect(isCloseBackingTrackCommand('close backing track')).toBe(true);
    expect(isCloseBackingTrackCommand('close the backing track')).toBe(true);
    expect(isCloseBackingTrackCommand('close track')).toBe(true);
    expect(isCloseBackingTrackCommand('close carrot')).toBe(true);
  });

  it('rejects stop so backing track does not compete with generic stop handlers', () => {
    expect(isCloseBackingTrackCommand('stop')).toBe(false);
    expect(isCloseBackingTrackCommand('stop backing track')).toBe(false);
  });
});

describe('tuner and chord display parity', () => {
  it('both accept "close display" for closing (tuner also accepts it)', () => {
    expect(isCloseDisplayCommand('close display')).toBe(true);
    expect(isCloseTunerCommand('close display')).toBe(true);
  });

  it('tuner accepts more close variants than chord display', () => {
    expect(isCloseTunerCommand('stop')).toBe(true);
    expect(isCloseDisplayCommand('stop')).toBe(false);

    expect(isCloseTunerCommand('close tuner')).toBe(true);
    expect(isCloseDisplayCommand('close tuner')).toBe(false);
  });
});

describe('isSpotifyPlayOrResumeCommand', () => {
  it('accepts explicit Spotify resume phrases', () => {
    expect(isSpotifyPlayOrResumeCommand('resume')).toBe(true);
    expect(isSpotifyPlayOrResumeCommand('resume playback')).toBe(true);
    expect(isSpotifyPlayOrResumeCommand('play music')).toBe(true);
    expect(isSpotifyPlayOrResumeCommand('play spotify')).toBe(true);
  });

  it('rejects loose conversational phrases that cause accidental resumes', () => {
    expect(isSpotifyPlayOrResumeCommand('play')).toBe(false);
    expect(isSpotifyPlayOrResumeCommand('play it')).toBe(false);
    expect(isSpotifyPlayOrResumeCommand('i want to play guitar')).toBe(false);
    expect(isSpotifyPlayOrResumeCommand('can you play something else')).toBe(false);
  });
});
