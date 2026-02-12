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

// ----- Voice-to-chord normalization (single pipeline so speech reliably maps to library keys) -----

/** Root + accidental: one letter a-g plus flat (b) or sharp (s). Preserved so "ab"/"as" etc. always work. */
const TWO_LETTER_ROOT_ACCIDENTAL = /^[a-g][bs]$/;

/** Normalize raw voice or typed input to the chord library key format (e.g. "E minor" → "em", "A over C" → "a-c"). */
export function normalizeChordInput(input: string): string {
  let s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';

  // 1) Display symbols → key format (library uses b/s, display uses ♭/♯)
  s = s.replace(/♭/g, 'b').replace(/♯/g, 's').replace(/#/g, 's');

  // 2) Slash chords: "A over C", "A slash C", "A/C" → key "a-c"
  s = s.replace(/\s+over\s+/g, '-').replace(/\s+slash\s+/g, '-').replace(/\//g, '-');

  // 2a) Mic often hears "B" as "the", "be", "bee", "we" — fix only when followed by chord-quality words
  const bMishearings = /\b(the|be|bee|we)\s+(?=minor|major|flat|sharp|seven|nine|eleven|thirteen|six|diminished|suspended|augmented|four|two)\b/g;
  s = s.replace(bMishearings, 'b ');

  // 2b) Preserve two-letter root+accidental (ab, as, eb, cs, etc.) so they are never altered by word replacements
  if (s.length === 2 && TWO_LETTER_ROOT_ACCIDENTAL.test(s)) return s;

  // 3) Filler words (strip so "C chord" → "C")
  s = s.replace(/\bchord\b/g, '').replace(/\s+/g, ' ').trim();

  // 3b) Root + accidental as a unit so "E flat minor seven", "C sharp major 7" etc. always work (preserve space after)
  s = s.replace(/\b([a-g])\s+flat\s+/g, '$1b ');
  s = s.replace(/\b([a-g])\s+sharp\s+/g, '$1s ');

  // 4) Number words — replace only the word (\b) so we keep spaces; "minor seven" must stay "minor 7" for step 5
  s = s.replace(/\bseven\b/g, '7').replace(/\bnine\b/g, '9').replace(/\beleven\b/g, '11');
  s = s.replace(/\bthirteen\b/g, '13').replace(/\bsix\b/g, '6').replace(/\bfive\b/g, '5');

  // 5) Quality phrases (longest first; keep "maj" for maj7 etc.)
  // Minor major (mmaj7, mmaj7b5): "minor major seven" → "mmaj7"
  s = s.replace(/\bminor\s+major\s+seven\b/g, 'mmaj7').replace(/\bminor\s+major\s+7\b/g, 'mmaj7');
  // Major/minor + number (word or digit)
  s = s.replace(/\bmajor\s+seven\b/g, 'maj7').replace(/\bmajor\s+nine\b/g, 'maj9').replace(/\bmajor\s+7\b/g, 'maj7').replace(/\bmajor\s+9\b/g, 'maj9');
  s = s.replace(/\bmajor\s+eleven\b/g, 'maj11').replace(/\bmajor\s+thirteen\b/g, 'maj13').replace(/\bmajor\s+six\b/g, 'maj6');
  s = s.replace(/\bminor\s+seven\b/g, 'm7').replace(/\bminor\s+nine\b/g, 'm9').replace(/\bminor\s+7\b/g, 'm7').replace(/\bminor\s+9\b/g, 'm9');
  s = s.replace(/\bminor\s+eleven\b/g, 'm11').replace(/\bminor\s+thirteen\b/g, 'm13').replace(/\bminor\s+six\b/g, 'm6');
  // Diminished: "diminished seven" / "diminished 7" → dim7, "diminished" → dim
  s = s.replace(/\bdiminished\s+seven\b/g, 'dim7').replace(/\bdiminished\s+7\b/g, 'dim7').replace(/\bdiminished\b/g, 'dim');
  // Suspended: "suspended four/two" or "suspended 4/2", and "sus four/two/4/2"
  s = s.replace(/\bsuspended\s+four\b/g, 'sus4').replace(/\bsuspended\s+two\b/g, 'sus2').replace(/\bsuspended\s+4\b/g, 'sus4').replace(/\bsuspended\s+2\b/g, 'sus2').replace(/\bsuspended\b/g, 'sus');
  s = s.replace(/\bsus\s+four\b/g, 'sus4').replace(/\bsus\s+two\b/g, 'sus2').replace(/\bsus\s+4\b/g, 'sus4').replace(/\bsus\s+2\b/g, 'sus2');
  // Augmented: "augmented seven/nine" or "augmented 7/9" → aug7, aug9; "augmented" → aug
  s = s.replace(/\baugmented\s+seven\b/g, 'aug7').replace(/\baugmented\s+nine\b/g, 'aug9').replace(/\baugmented\s+7\b/g, 'aug7').replace(/\baugmented\s+9\b/g, 'aug9').replace(/\baugmented\b/g, 'aug');
  // "flat 5" / "flat five" → b5 so dmmaj7b5, cm7b5 etc. work
  s = s.replace(/\bflat\s+five\b/g, 'b5').replace(/\bflat\s+5\b/g, 'b5');
  s = s.replace(/\bminor\b/g, 'm').replace(/\bmajor\b/g, '');
  // Flat/sharp and common mic mishearings of "sharp" (shop, shaw, shark, sherry) so "F nine shop eleven" → f9s11
  s = s.replace(/\bflat\b/g, 'b').replace(/\b(sharp|shop|shaw|shark|sherry)\b/g, 's');

  // 6) Collapse and remove spaces
  s = s.replace(/\s+/g, '');

  // 7) Leftover "min" (e.g. "e min") → "m"; do not replace "maj" so "maj7" stays
  s = s.replace(/min/g, 'm');

  return s;
}

/** Roots that mics often confuse (B/C/D/E). Used for fallback and "did you mean?" suggestions. */
const CONFUSABLE_ROOTS = ['b', 'c', 'd', 'e'] as const;

/** Known root pattern: single letter a-g optional flat(b) or sharp(s). */
const ROOT_PATTERN = /^([a-g](?:b|s)?)/;

/** Alternative input variants to try when primary normalization doesn't resolve. */
function getNormalizationCandidates(raw: string): string[] {
  const t = raw.trim();
  const candidates: string[] = [t];
  const withoutChord = t.replace(/\bchord\b/gi, '').trim();
  if (withoutChord && withoutChord !== t) candidates.push(withoutChord);
  // Try fixing B mishearings as fallback (e.g. "the minor" → "b minor")
  const bFix = t.replace(/\b(the|be|bee|we)\s+/gi, 'b ');
  if (bFix !== t) candidates.push(bFix);
  // If mic dropped "sharp" before 11 (e.g. "F 9 11" or "F nine eleven"), try "9s11" so it normalizes to f9s11
  const withSharp11 = t.replace(/\s*(nine|9)\s*(eleven|11)\s*/gi, ' 9s11 ').replace(/\s*9\s+11\s*/g, ' 9s11 ');
  if (withSharp11.trim() !== t) candidates.push(withSharp11.trim());
  return candidates;
}

/** When nothing resolved: try B/C/D/E + rest of phrase (mic often confuses these roots). */
function getRootConfusionCandidates(raw: string): string[] {
  const t = raw.trim().toLowerCase();
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const first = parts[0];
  const rest = parts.slice(1).join(' ');
  const knownRoot = first.match(/^[a-g](?:b|s)?$/) != null;
  if (knownRoot) return [];
  return CONFUSABLE_ROOTS.map((r) => r + ' ' + rest);
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

/** Enharmonic: library may not have "as" (A♯); map to "bb" (B♭) so typing "as" displays. */
const ENHARMONIC_ALIASES: Record<string, string> = { as: 'bb', ds: 'eb', gs: 'ab', cs: 'db', fs: 'gb', bs: 'c' };

/**
 * How sharp and flat chords are stored and accessed:
 *
 * - Library keys use ASCII: sharp = "s", flat = "b" (e.g. "cs" = C♯, "eb" = E♭).
 * - chords.json has:
 *   - chords: { "cs": [...voicings], "eb": [...], "fs": [...], "ab": [...], "bb": [...], ... }
 *   - displayNames: { "cs": "C♯", "eb": "E♭", ... }  (display uses Unicode ♯/♭)
 *   - aliases: { "csmajor": "cs", "ebminor": "ebm", ... } for spoken forms
 * - Lookup: input → normalizeChordInput() → key; resolveKey() checks ALIASES[key] then chords[key].
 * - To access by key: getChordShape(key) or getChordVoicings(key); getChordDisplayName(key) for "E♭"/"C♯".
 */
const CHORD_KEYS = Object.keys(CHORD_VOICING_INDICES);

function resolveKey(input: string): string | null {
  const n = normalizeChordInput(input);
  if (/scale/.test(n)) return null;
  const fromAlias = ALIASES[n];
  if (fromAlias != null) return fromAlias;
  if (CHORD_VOICING_INDICES[n]) return n;
  const enharmonic = ENHARMONIC_ALIASES[n];
  if (enharmonic != null && CHORD_VOICING_INDICES[enharmonic]) return enharmonic;
  return null;
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

/** Returns the display name for voice input (e.g. "E minor" → "Em"). Tries primary normalization and fallbacks so voice commands resolve reliably. */
export function resolveChordOrScaleDisplayName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  for (const candidate of getNormalizationCandidates(trimmed)) {
    const result = getChordOrScale(candidate);
    if (result) return result.shape.name;
  }
  // Mic often confuses B/C/D/E; try each root with the rest of the phrase (e.g. "sea minor" → try "b minor", "c minor", …)
  for (const candidate of getRootConfusionCandidates(trimmed)) {
    const result = getChordOrScale(candidate);
    if (result) return result.shape.name;
  }
  return trimmed;
}

/** All chord keys in the library (e.g. "c", "em", "cs", "eb", "a-c"). */
export function getChordLibraryKeys(): string[] {
  return CHORD_KEYS;
}

/** Display name for a known key (e.g. "eb" → "E♭", "cs" → "C♯"). Uses canonical key from aliases. */
export function getChordDisplayName(key: string): string {
  const k = normalizeChordInput(key);
  if (/scale/.test(k)) return key;
  const canonical = ALIASES[k] ?? (CHORD_VOICING_INDICES[k] ? k : null);
  return canonical != null ? (DISPLAY_NAMES[canonical] ?? canonical) : key;
}

/** True if the library has this chord key (including sharp/flat: cs, eb, fs, ab, bb, etc.). */
export function hasChordKey(key: string): boolean {
  return resolveKey(key) != null;
}

/**
 * Same-quality chords with roots B, C, D, E — for "Did you mean?" when the mic confuses these roots.
 * Returns other keys that exist in the library (e.g. for "cm" returns ["bm", "dm", "em"] if they exist).
 */
export function getConfusableRootChords(chordKey: string): string[] {
  const k = normalizeChordInput(chordKey);
  if (/scale/.test(k)) return [];
  const canonical = resolveKey(chordKey);
  if (!canonical) return [];
  const rootMatch = canonical.match(ROOT_PATTERN);
  if (!rootMatch) return [];
  const root = rootMatch[1];
  const quality = canonical.slice(root.length);
  if (!CONFUSABLE_ROOTS.includes(root as (typeof CONFUSABLE_ROOTS)[number])) return [];
  return CONFUSABLE_ROOTS.filter((r) => r !== root)
    .map((r) => r + quality)
    .filter((key) => resolveKey(key) != null);
}

export { STRING_NAMES };
