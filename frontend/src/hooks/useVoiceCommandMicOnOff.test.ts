/**
 * Unit tests for tuner and guitar tab display voice command detection.
 * Tuner and chord display should operate similarly: each has a close command
 * that returns to neutral when that face is active.
 */
import { describe, it, expect } from 'vitest';
import {
  isCloseDisplayCommand,
  isCloseTunerCommand,
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
