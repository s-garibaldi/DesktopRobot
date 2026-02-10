/**
 * Guitar chord and scale data for tab display.
 * Data is loaded from TuxGuitar-style JSON library (chords.json, scales.json).
 * Strings order: low E (index 0) to high e (index 5).
 * Fret values: 0 = open, -1 = mute (X), 1+ = fret number.
 */

import chordsJson from './chords.json';
import scalesJson from './scales.json';

export interface ChordShape {
  name: string;
  /** Frets per string [low E, A, D, G, B, high e]. 0 = open, -1 = don't play */
  frets: number[];
  /** First fret shown (e.g. 1 for open chords, 3 for 3rd fret barre) */
  fretOffset?: number;
  /** Optional barre: e.g. { fromString: 0, toString: 5, fret: 1 } */
  barre?: { fromString: number; toString: number; fret: number };
}

export interface ScaleShape {
  name: string;
  /** Fret positions to show per string [low E, A, D, G, B, high e]. Each is array of fret numbers (1-12). */
  positions: number[][];
  fretOffset?: number;
}

// ----- JSON schema types -----
interface ChordVoicingJson {
  name: string;
  quality: string;
  baseFret: number;
  frets: number[];
  fingers?: number[];
  barre?: number | [number, number, number];
}

interface ChordsLibraryJson {
  aliases: Record<string, string>;
  displayNames: Record<string, string>;
  chords: Record<string, ChordVoicingJson[]>;
}

/** One scale voicing from the library (same idea as chord voicing). */
interface ScaleVoicingJson {
  fretOffset: number;
  positions: number[][];
}

/** Scales library: same schema as chords (aliases, displayNames, scales key → voicings). */
interface ScalesLibraryJson {
  aliases: Record<string, string>;
  displayNames: Record<string, string>;
  scales: Record<string, ScaleVoicingJson[]>;
}

// ----- Normalize input for lookup -----
export function normalizeChordInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/maj/g, '')
    .replace(/min/g, 'm')
    .replace(/minor/g, 'm')
    .replace(/major/g, '');
}

// ----- Build chord shape pool from JSON (dedupe) -----
function chordShapeFromVoicing(v: ChordVoicingJson): ChordShape {
  const barre =
    v.barre === undefined
      ? undefined
      : typeof v.barre === 'number'
        ? { fromString: 0, toString: 5, fret: v.barre }
        : { fromString: v.barre[0], toString: v.barre[1], fret: v.barre[2] };
  return {
    name: v.name,
    frets: v.frets,
    fretOffset: v.baseFret,
    ...(barre && { barre }),
  };
}

function buildShapePoolFromJson(
  lib: ChordsLibraryJson
): { shapes: ChordShape[]; voicings: Record<string, number[]> } {
  const byKey = new Map<string, number>();
  const shapes: ChordShape[] = [];

  function key(v: ChordVoicingJson): string {
    return JSON.stringify([v.frets, v.baseFret, v.barre]);
  }

  function indexOf(v: ChordVoicingJson, displayName: string): number {
    const k = key(v);
    let i = byKey.get(k);
    if (i === undefined) {
      i = shapes.length;
      byKey.set(k, i);
      shapes.push({ ...chordShapeFromVoicing(v), name: displayName });
    }
    return i;
  }

  const voicings: Record<string, number[]> = {};
  for (const [canonicalKey, list] of Object.entries(lib.chords)) {
    const displayName = lib.displayNames[canonicalKey] ?? canonicalKey;
    voicings[canonicalKey] = list.map((v) => indexOf(v, displayName));
  }

  return { shapes, voicings };
}

const { shapes: SHAPES, voicings: CHORD_VOICING_INDICES } = buildShapePoolFromJson(
  chordsJson as ChordsLibraryJson
);

const ALIASES = (chordsJson as ChordsLibraryJson).aliases;
const DISPLAY_NAMES = (chordsJson as ChordsLibraryJson).displayNames;

function resolveKey(input: string): string | null {
  const n = normalizeChordInput(input);
  if (/scale/.test(n)) return null;
  return ALIASES[n] ?? (CHORD_VOICING_INDICES[n] ? n : null);
}

function shapeAt(idx: number, displayName: string): ChordShape {
  const s = SHAPES[idx];
  return { ...s, name: displayName };
}

// ----- Scales: from scales.json (same pattern as chords: aliases, displayNames, scales) -----
const SCALE_ALIASES = (scalesJson as ScalesLibraryJson).aliases;
const SCALE_DISPLAY_NAMES = (scalesJson as ScalesLibraryJson).displayNames;
const SCALE_VOICINGS = (scalesJson as ScalesLibraryJson).scales;

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

// ----- Public API -----
export function getChordShape(input: string): ChordShape | null {
  const key = resolveKey(input);
  if (!key) return null;
  const indices = CHORD_VOICING_INDICES[key];
  if (!indices?.length) return null;
  const name = DISPLAY_NAMES[key] ?? key;
  return shapeAt(indices[0], name);
}

/** Returns chord voicings sorted by position up the neck (lowest fret first) so voicing index matches "next position". */
export function getChordVoicings(input: string): ChordShape[] {
  const key = resolveKey(input);
  if (!key) return [];
  const indices = CHORD_VOICING_INDICES[key];
  if (!indices?.length) return [];
  const name = DISPLAY_NAMES[key] ?? key;
  const shapes = indices.map((i) => shapeAt(i, name));
  shapes.sort((a, b) => (a.fretOffset ?? 1) - (b.fretOffset ?? 1));
  return shapes;
}

function resolveScaleKey(input: string): string | null {
  const n = normalizeChordInput(input).replace(/scale/g, '').trim();
  if (!n) return null;
  const key = SCALE_ALIASES[n] ?? (SCALE_VOICINGS[n] ? n : null);
  return key;
}

function scaleShapeFromVoicing(v: ScaleVoicingJson, displayName: string): ScaleShape {
  return { name: displayName, fretOffset: v.fretOffset, positions: v.positions };
}

export function getScaleShape(input: string): ScaleShape | null {
  const key = resolveScaleKey(input);
  if (!key) return null;
  const list = SCALE_VOICINGS[key];
  if (!list?.length) return null;
  const name = SCALE_DISPLAY_NAMES[key] ?? key;
  return scaleShapeFromVoicing(list[0], name);
}

/** Returns scale voicings from the library (same as chords: sorted by fretOffset, display name from library). */
export function getScaleVoicings(input: string): ScaleShape[] {
  const key = resolveScaleKey(input);
  if (!key) return [];
  const list = SCALE_VOICINGS[key];
  if (!list?.length) return [];
  const name = SCALE_DISPLAY_NAMES[key] ?? key;
  const shapes = list.map((v) => scaleShapeFromVoicing(v, name));
  shapes.sort((a, b) => (a.fretOffset ?? 1) - (b.fretOffset ?? 1));
  return shapes;
}

export function getChordOrScale(
  input: string
): { type: 'chord'; shape: ChordShape } | { type: 'scale'; shape: ScaleShape } | null {
  const n = normalizeChordInput(input);
  if (/scale/.test(n)) {
    const shape = getScaleShape(input);
    return shape ? { type: 'scale', shape } : null;
  }
  const chord = getChordShape(input);
  return chord ? { type: 'chord', shape: chord } : null;
}

export { STRING_NAMES };
