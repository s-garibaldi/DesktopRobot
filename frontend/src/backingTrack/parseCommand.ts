/**
 * Parses a natural-language backing track command into a BackingTrackSpec.
 * Examples:
 *   "give me a backing track with these chords: G C D Em, 92 bpm, lofi, 15 seconds"
 *   "backing track G Am C D 120 bpm jazz 20 seconds"
 */

import type { BackingTrackSpec } from './types';

// Common chord-like tokens (letters + optional m/7/etc.)
const CHORD_PATTERN = /^[A-Ga-g](#|b)?(m|maj|min|dim|aug|sus|add|m7|7|M7|maj7|min7|dim7)?(\d+)?$/;

// Style keywords we recognize
const STYLE_KEYWORDS = new Set([
  'lofi', 'lo-fi', 'jazz', 'acoustic', 'rock', 'pop', 'blues', 'folk',
  'ambient', 'chill', 'electronic', 'piano', 'guitar', 'minimal', 'cinematic',
  'rumba',
]);

function isChordLike(token: string): boolean {
  const t = token.replace(/,/g, '').trim();
  if (!t || t.length > 6) return false;
  return CHORD_PATTERN.test(t) || /^[A-G][#b]?$/.test(t) || /^[A-G][#b]?m$/.test(t);
}

function extractNumberAfter(token: string, nextTokens: string[], patterns: RegExp[]): number | undefined {
  const lower = token.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      // Look for a number in this token or the next few
      const rest = [token, ...nextTokens].join(' ');
      const numMatch = rest.match(/\d+/);
      if (numMatch) return parseInt(numMatch[0], 10);
    }
  }
  return undefined;
}

/**
 * Parse a string command into BackingTrackSpec.
 * Tolerates varied phrasing (chords, bpm, style, duration in any order).
 */
export function parseBackingTrackCommand(text: string): BackingTrackSpec {
  const spec: BackingTrackSpec = {};
  if (!text || typeof text !== 'string') return spec;

  const normalized = text
    .toLowerCase()
    .replace(/backing track|give me a|with these chords|chords?:/gi, ' ')
    .replace(/,/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const chords: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const next = tokens.slice(i + 1, i + 4);

    // BPM: "92 bpm", "120 bpm", "bpm 92"
    const bpm = extractNumberAfter(token, next, [/bpm/]);
    if (bpm !== undefined && bpm >= 40 && bpm <= 240) {
      spec.bpm = bpm;
      i += 1;
      if (next[0] && /^\d+$/.test(next[0])) i += 1;
      continue;
    }

    // Duration: "15 seconds", "20 sec", "10 s", "seconds 15"
    const secMatch = token.match(/(\d+)/);
    if (
      (token.includes('second') || token === 'sec' || token === 's') &&
      secMatch
    ) {
      const sec = parseInt(secMatch[1], 10);
      if (sec >= 3 && sec <= 600) spec.durationSeconds = sec;
    }
    if (/^\d+$/.test(token)) {
      const nextLower = (next[0] || '').toLowerCase();
      if (
        nextLower.includes('second') ||
        nextLower === 'sec' ||
        nextLower === 's'
      ) {
        const sec = parseInt(token, 10);
        if (sec >= 3 && sec <= 600) spec.durationSeconds = sec;
        i += 2;
        continue;
      }
    }

    // Style: known keyword
    if (STYLE_KEYWORDS.has(token)) {
      spec.style = token;
      i += 1;
      continue;
    }

    // Chord-like token (e.g. G, C, D, Em, Am7)
    const chordCandidate = token.replace(/,/g, '');
    if (isChordLike(chordCandidate)) {
      const chord =
        chordCandidate.charAt(0).toUpperCase() +
        chordCandidate.slice(1).toLowerCase();
      if (chord.length >= 1 && chord.length <= 6) chords.push(chord);
    }

    i += 1;
  }

  if (chords.length > 0) spec.chords = chords;

  // Defaults if nothing parsed
  if (spec.durationSeconds == null) spec.durationSeconds = 15;
  if (spec.bpm == null) spec.bpm = 90;
  if (!spec.style) spec.style = 'lofi';

  return spec;
}
