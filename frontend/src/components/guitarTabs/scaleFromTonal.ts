/**
 * Scale data from tonal.js: computes fret positions for any scale/mode
 * (major, minor, dorian, phrygian, lydian, mixolydian, aeolian, locrian, pentatonics, etc.).
 * Voicings start at frets 1, 5, 10, 12, 15, 20.
 */

import { Scale, Note } from 'tonal';

/** Same shape as chordData.ScaleShape (name, positions, fretOffset). */
export interface ScaleShape {
  name: string;
  positions: number[][];
  fretOffset?: number;
}

const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'] as const;
const VOICING_START_FRETS = [1, 5, 10, 12, 15, 20] as const;
const MAX_FRET = 24;
const FRET_SPAN = 5;

/** Scale type names from tonal (subset we support for display + modes). Sorted by length desc for parsing. */
const SCALE_TYPES = [
  'major pentatonic',
  'minor pentatonic',
  'major blues',
  'minor blues',
  'melodic minor',
  'harmonic minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
  'ionian',
  'major',
  'minor',
].slice().sort((a, b) => b.length - a.length);

/** Normalize scale type for matching: no spaces, lowercase. */
function scaleTypeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

const SCALE_TYPE_KEYS = new Map(SCALE_TYPES.map((t) => [scaleTypeKey(t), t]));

/** Chroma string (12 bits) to set of pitch class indices 0–11. */
function chromaToSet(chroma: string): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < 12; i++) if (chroma[i] === '1') set.add(i);
  return set;
}

/** Root letter + accidental to tonal note name (e.g. "g" -> "G", "eb" -> "Eb", "fs" -> "F#"). */
function rootToTonalNote(root: string): string {
  if (root.length === 1) return root.toUpperCase();
  const letter = root[0].toUpperCase();
  const acc = root.slice(1).toLowerCase();
  if (acc === 'b') return letter + 'b';
  if (acc === 's') return letter + '#';
  return letter;
}

/**
 * Parse normalized scale input (e.g. "gmajor", "eminor", "adorian") to { root, type } for tonal.
 * Returns null if no known scale type matches.
 */
export function parseScaleInput(normalized: string): { root: string; type: string } | null {
  const s = normalized.replace(/scale/g, '').trim().toLowerCase();
  if (!s) return null;
  for (const [, type] of SCALE_TYPE_KEYS) {
    const key = scaleTypeKey(type);
    if (s.endsWith(key)) {
      const root = s.slice(0, s.length - key.length);
      if (root.length >= 1 && root.length <= 2 && /^[a-g][bs]?$/.test(root))
        return { root, type };
    }
  }
  return null;
}

/**
 * Build tonal scale name for Scale.get (e.g. "G major", "A dorian").
 */
export function toTonalScaleName(root: string, type: string): string {
  return rootToTonalNote(root) + ' ' + type;
}

/**
 * Get scale chroma set from tonal (12 pitch classes). Returns null if scale not found.
 */
function getScaleChroma(tonalName: string): Set<number> | null {
  const scale = Scale.get(tonalName);
  if (scale.empty || !scale.chroma) return null;
  return chromaToSet(scale.chroma);
}

/**
 * For one string (open note), return all fret numbers 0..MAX_FRET that are in the scale.
 */
function fretsInScaleOnString(openNote: string, chroma: Set<number>): number[] {
  const openChroma = Note.chroma(openNote);
  if (openChroma === undefined) return [];
  const frets: number[] = [];
  for (let f = 0; f <= MAX_FRET; f++) {
    const pc = (openChroma + f) % 12;
    if (chroma.has(pc)) frets.push(f);
  }
  return frets;
}

/**
 * For a 5-fret window [start, start+4], return positions per string (array of fret numbers in that window).
 */
function voicingForWindow(
  startFret: number,
  perStringFrets: number[][]
): { fretOffset: number; positions: number[][] } {
  const endFret = startFret + FRET_SPAN - 1;
  const positions = perStringFrets.map((frets) =>
    frets.filter((f) => f >= startFret && f <= endFret).sort((a, b) => a - b)
  );
  return { fretOffset: startFret, positions };
}

/**
 * Build all scale shapes from tonal for the given scale name (e.g. "G major").
 * Returns 6 voicings at frets 1, 5, 10, 12, 15, 20.
 */
export function getScaleShapesFromTonal(tonalScaleName: string): ScaleShape[] | null {
  const chroma = getScaleChroma(tonalScaleName);
  if (!chroma) return null;

  const scale = Scale.get(tonalScaleName);
  const displayName = scale.name || tonalScaleName;

  const perStringFrets = STANDARD_TUNING.map((open) =>
    fretsInScaleOnString(open, chroma)
  );

  const shapes: ScaleShape[] = [];
  for (const start of VOICING_START_FRETS) {
    const { fretOffset, positions } = voicingForWindow(start, perStringFrets);
    shapes.push({ name: displayName, fretOffset, positions });
  }
  return shapes;
}

/**
 * Resolve user input to a tonal scale name if it's a scale request; otherwise null.
 */
export function resolveTonalScaleName(normalizedInput: string): string | null {
  const parsed = parseScaleInput(normalizedInput);
  if (!parsed) return null;
  return toTonalScaleName(parsed.root, parsed.type);
}

/** List of scale type names (for UI or suggestions). */
export function getScaleTypeNames(): string[] {
  return [...SCALE_TYPES];
}
