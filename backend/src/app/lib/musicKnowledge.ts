/**
 * Music knowledge for the musical companion agent: diatonic chords,
 * chord formulas, and named progressions (basic to advanced).
 */

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const ROOTS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const ROOT_INDEX: Record<string, number> = {};
ROOTS.forEach((r, i) => { ROOT_INDEX[r] = i; ROOT_INDEX[r.toLowerCase()] = i; });
ROOTS_FLAT.forEach((r, i) => { ROOT_INDEX[r] = i; ROOT_INDEX[r.toLowerCase()] = i; });

/** Semitone offsets from root for each chord quality (intervals). */
export const CHORD_FORMULAS: Record<string, { intervals: number[]; name: string; theory: string }> = {
  major:     { intervals: [0, 4, 7], name: 'Major', theory: 'Root + major 3rd + perfect 5th' },
  minor:     { intervals: [0, 3, 7], name: 'Minor', theory: 'Root + minor 3rd + perfect 5th' },
  dim:       { intervals: [0, 3, 6], name: 'Diminished', theory: 'Root + minor 3rd + diminished 5th' },
  aug:       { intervals: [0, 4, 8], name: 'Augmented', theory: 'Root + major 3rd + augmented 5th' },
  '7':       { intervals: [0, 4, 7, 10], name: 'Dominant 7', theory: 'Major triad + minor 7th' },
  maj7:      { intervals: [0, 4, 7, 11], name: 'Major 7', theory: 'Major triad + major 7th' },
  m7:        { intervals: [0, 3, 7, 10], name: 'Minor 7', theory: 'Minor triad + minor 7th' },
  dim7:      { intervals: [0, 3, 6, 9], name: 'Diminished 7', theory: 'Dim triad + diminished 7th' },
  halfdim7:  { intervals: [0, 3, 6, 10], name: 'Half-diminished 7', theory: 'Dim triad + minor 7th' },
  m7b5:      { intervals: [0, 3, 6, 10], name: 'Half-diminished 7', theory: 'Same as ø7' },
  aug7:      { intervals: [0, 4, 8, 10], name: 'Augmented 7', theory: 'Aug triad + minor 7th' },
  sus2:      { intervals: [0, 2, 7], name: 'Sus2', theory: 'Root + 2nd + 5th' },
  sus4:      { intervals: [0, 5, 7], name: 'Sus4', theory: 'Root + 4th + 5th' },
  add9:      { intervals: [0, 4, 7, 14], name: 'Add9', theory: 'Major triad + 9th' },
  '9':       { intervals: [0, 4, 7, 10, 14], name: 'Dominant 9', theory: 'Dom 7 + 9th' },
  maj9:      { intervals: [0, 4, 7, 11, 14], name: 'Major 9', theory: 'Maj 7 + 9th' },
  m9:        { intervals: [0, 3, 7, 10, 14], name: 'Minor 9', theory: 'Min 7 + 9th' },
  '11':      { intervals: [0, 4, 7, 10, 14, 17], name: 'Dominant 11', theory: 'Dom 9 + 11th' },
  maj11:     { intervals: [0, 4, 7, 11, 14, 17], name: 'Major 11', theory: 'Maj 9 + 11th' },
  '13':      { intervals: [0, 4, 7, 10, 14, 17, 21], name: 'Dominant 13', theory: 'Dom 11 + 13th' },
  maj13:     { intervals: [0, 4, 7, 11, 14, 17, 21], name: 'Major 13', theory: 'Maj 11 + 13th' },
  m6:        { intervals: [0, 3, 7, 9], name: 'Minor 6', theory: 'Minor triad + major 6th' },
  '6':       { intervals: [0, 4, 7, 9], name: 'Major 6', theory: 'Major triad + major 6th' },
  '6/9':     { intervals: [0, 4, 7, 9, 14], name: '6/9', theory: 'Major 6 + 9th' },
};

/** Diatonic chords per key: I, ii, iii, IV, V, vi, vii° (major scale). Index 0 = C. */
const MAJOR_DIATONIC_QUALITIES = ['major', 'm7', 'm7', 'major', 'major', 'm7', 'halfdim7'] as const;
const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;

export function getRootIndex(root: string): number {
  const r = root.trim().replace(/\s+/g, '');
  return ROOT_INDEX[r] ?? -1;
}

export function getChordNotes(root: string, quality: string, useFlats = false): string[] | null {
  const base = useFlats ? ROOTS_FLAT : ROOTS;
  const idx = getRootIndex(root);
  if (idx < 0) return null;
  const formula = CHORD_FORMULAS[quality] ?? CHORD_FORMULAS.major;
  return formula.intervals.map(semi => base[(idx + semi) % 12]);
}

export function getDiatonicChords(keyRoot: string): Array<{ roman: string; root: string; chord: string; quality: string }> | null {
  const idx = getRootIndex(keyRoot);
  if (idx < 0) return null;
  const base = ROOTS_FLAT;
  return MAJOR_ROMAN.map((roman, i) => {
    const quality = MAJOR_DIATONIC_QUALITIES[i];
    const root = base[(idx + [0, 2, 4, 5, 7, 9, 11][i]) % 12];
    const chord = quality === 'major' ? root : quality === 'm7' ? `${root}m` : quality === 'halfdim7' ? `${root}m7b5` : root;
    return { roman, root, chord, quality };
  });
}

/** Normalize chord input for lookup (e.g. "Cmaj7" -> root "C", quality "maj7"). */
export function parseChordName(input: string): { root: string; quality: string } | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s.length) return null;
  const match = s.match(/^([A-Ga-g][#b]?)(.*)$/);
  if (!match) return null;
  const root = match[1];
  const rest = (match[2] || 'major').toLowerCase()
    .replace(/major/g, 'major').replace(/min|minor/g, 'm').replace(/maj/g, 'maj');
  if (rest === '' || rest === 'maj') return { root: root.charAt(0).toUpperCase() + root.slice(1), quality: 'major' };
  if (rest === 'm') return { root: root.charAt(0).toUpperCase() + root.slice(1), quality: 'minor' };
  const qualityMap: Record<string, string> = {
    '7': '7', 'm7': 'm7', 'maj7': 'maj7', 'dim': 'dim', 'dim7': 'dim7',
    'aug': 'aug', 'sus2': 'sus2', 'sus4': 'sus4', 'add9': 'add9',
    '9': '9', 'maj9': 'maj9', 'm9': 'm9', '11': '11', '13': '13',
    'm7b5': 'halfdim7', 'ø7': 'halfdim7', '6': '6', 'm6': 'm6', '69': '6/9', '6/9': '6/9',
  };
  for (const [k, v] of Object.entries(qualityMap)) {
    if (rest === k || rest.replace(/[#b]/g, '') === k) {
      return { root: root.charAt(0).toUpperCase() + root.slice(1), quality: v };
    }
  }
  if (CHORD_FORMULAS[rest]) return { root: root.charAt(0).toUpperCase() + root.slice(1), quality: rest };
  return { root: root.charAt(0).toUpperCase() + root.slice(1), quality: 'major' };
}

export function getChordTheory(root: string, quality: string): { name: string; theory: string; notes: string[] } | null {
  const parsed = parseChordName(root + (quality || ''));
  const r = parsed?.root ?? root;
  const q = (parsed?.quality ?? quality) || 'major';
  const formula = CHORD_FORMULAS[q];
  if (!formula) return null;
  const notes = getChordNotes(r, q);
  if (!notes) return null;
  const name = q === 'major' ? r : q === 'minor' ? `${r}m` : `${r}${q}`;
  return { name, theory: formula.theory, notes };
}

// --- Named progressions (Roman numerals in major key; we resolve to chord names by key) ---
export interface NamedProgression {
  name: string;
  romans: string[];
  description: string;
  style: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

const ROMAN_TO_DIATONIC_INDEX: Record<string, number> = {
  'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii°': 6, 'vii': 6,
  'i': 0, 'iv': 5, 'v': 7, // minor key (Aeolian) degrees for root positions
};

export const NAMED_PROGRESSIONS: NamedProgression[] = [
  { name: 'I–V–vi–IV', romans: ['I', 'V', 'vi', 'IV'], description: 'Classic pop; works in any key.', style: 'pop', complexity: 'basic' },
  { name: 'I–IV–V', romans: ['I', 'IV', 'V'], description: 'Classic rock and blues.', style: 'rock', complexity: 'basic' },
  { name: 'vi–IV–I–V', romans: ['vi', 'IV', 'I', 'V'], description: 'Sad pop / ballad.', style: 'pop', complexity: 'basic' },
  { name: 'I–IV–vi–V', romans: ['I', 'IV', 'vi', 'V'], description: 'Versatile pop/rock.', style: 'pop', complexity: 'basic' },
  { name: 'ii–V–I', romans: ['ii', 'V', 'I'], description: 'Jazz cadence; often with 7ths (e.g. Dm7–G7–Cmaj7).', style: 'jazz', complexity: 'intermediate' },
  { name: 'I–vi–ii–V', romans: ['I', 'vi', 'ii', 'V'], description: 'Jazz turnaround; cycle back to I.', style: 'jazz', complexity: 'intermediate' },
  { name: 'iii–vi–ii–V–I', romans: ['iii', 'vi', 'ii', 'V', 'I'], description: 'Extended jazz turnaround.', style: 'jazz', complexity: 'advanced' },
  { name: 'I–V–ii–V–I', romans: ['I', 'V', 'ii', 'V', 'I'], description: 'Jazz turnaround with dominant motion.', style: 'jazz', complexity: 'advanced' },
  { name: 'I–bVII–IV–I', romans: ['I', 'bVII', 'IV', 'I'], description: 'Borrowed bVII (mixolydian feel).', style: 'rock', complexity: 'intermediate' },
  { name: 'i–bVII–bVI–V', romans: ['i', 'bVII', 'bVI', 'V'], description: 'Andalusian cadence (minor).', style: 'folk', complexity: 'intermediate' },
  { name: 'I–IV–I–V', romans: ['I', 'IV', 'I', 'V'], description: 'Simple country/folk.', style: 'country', complexity: 'basic' },
  { name: 'I–IV–V–IV', romans: ['I', 'IV', 'V', 'IV'], description: 'Classic rock loop.', style: 'rock', complexity: 'basic' },
  { name: 'Im7–IVmaj7–iii–VI', romans: ['I', 'IV', 'iii', 'VI'], description: 'Smooth R&B / neo-soul (7ths).', style: 'r&b', complexity: 'intermediate' },
  { name: 'I–bIII–IV–iv–I', romans: ['I', 'bIII', 'IV', 'iv', 'I'], description: 'Borrowed minor iv; emotional.', style: 'pop', complexity: 'advanced' },
  { name: 'I–ii–iii–IV', romans: ['I', 'ii', 'iii', 'IV'], description: 'Stepwise ascending.', style: 'pop', complexity: 'basic' },
  { name: 'I–V–vi–IV–IV–I–V', romans: ['I', 'V', 'vi', 'IV', 'IV', 'I', 'V'], description: 'Extended pop with repeat.', style: 'pop', complexity: 'intermediate' },
  { name: 'i–iv–v–i', romans: ['i', 'iv', 'v', 'i'], description: 'Natural minor (Aeolian).', style: 'folk', complexity: 'basic' },
  { name: 'I–IV–ii–V', romans: ['I', 'IV', 'ii', 'V'], description: 'Jazz/pop hybrid.', style: 'jazz', complexity: 'intermediate' },
];

/** Resolve Roman numerals to chord symbols in the given key (major). Handles I, ii, iii, IV, V, vi, vii° and bVII, bVI, iv. */
export function resolveProgressionInKey(keyRoot: string, romans: string[], useSevenths = false): string[] {
  const diatonic = getDiatonicChords(keyRoot);
  if (!diatonic) return romans as string[];

  const suffix: Record<string, string> = {
    major: useSevenths ? 'maj7' : '',
    m7: useSevenths ? 'm7' : 'm',
    halfdim7: 'm7b5',
  };

  const keyIdx = getRootIndex(keyRoot);
  const chords: string[] = [];
  for (const r of romans) {
    const isFlat = r.startsWith('b');
    const roman = r.replace(/^b/, '');
    if (roman === 'i') {
      chords.push(ROOTS_FLAT[keyIdx] + (useSevenths ? 'm7' : 'm'));
      continue;
    }
    if (roman === 'iv') {
      chords.push(ROOTS_FLAT[(keyIdx + 5) % 12] + (useSevenths ? 'm7' : 'm'));
      continue;
    }
    if (roman === 'v') {
      chords.push(ROOTS_FLAT[(keyIdx + 7) % 12] + (useSevenths ? '7' : ''));
      continue;
    }
    const idx = ROMAN_TO_DIATONIC_INDEX[roman] ?? ROMAN_TO_DIATONIC_INDEX[roman.toUpperCase()];
    if (idx !== undefined && !isFlat) {
      const d = diatonic[idx];
      const suf = suffix[d.quality] ?? '';
      chords.push(d.root + suf);
      continue;
    }
    if (roman === 'VII' && isFlat) {
      const idxB7 = (getRootIndex(keyRoot) + 10) % 12;
      chords.push(ROOTS_FLAT[idxB7] + (useSevenths ? '7' : ''));
      continue;
    }
    if (roman === 'VI' && isFlat) {
      const idxB6 = (getRootIndex(keyRoot) + 8) % 12;
      chords.push(ROOTS_FLAT[idxB6] + (useSevenths ? '7' : ''));
      continue;
    }
    if (roman === 'IV' && r === 'iv') {
      const idx4 = (getRootIndex(keyRoot) + 5) % 12;
      chords.push(ROOTS_FLAT[idx4] + 'm' + (useSevenths ? '7' : ''));
      continue;
    }
    if (roman === 'VI' && r === 'VI') {
      const idx6 = (getRootIndex(keyRoot) + 9) % 12;
      chords.push(ROOTS_FLAT[idx6] + (useSevenths ? 'maj7' : ''));
      continue;
    }
    if (roman === 'III' && isFlat) {
      const idxB3 = (getRootIndex(keyRoot) + 3) % 12;
      chords.push(ROOTS_FLAT[idxB3] + (useSevenths ? 'maj7' : ''));
      continue;
    }
    chords.push(r);
  }
  return chords;
}

export function getProgressionsForStyle(
  style: string,
  complexity: 'basic' | 'intermediate' | 'advanced',
  keyRoot: string,
  useSevenths = false
): Array<{ name: string; chords: string[]; description: string }> {
  const filtered = NAMED_PROGRESSIONS.filter(
    p => p.style === style && p.complexity === complexity
  );
  if (filtered.length === 0) {
    const anyComplexity = NAMED_PROGRESSIONS.filter(p => p.style === style);
    const byComplexity = anyComplexity.filter(p => {
      if (complexity === 'basic') return p.complexity === 'basic';
      if (complexity === 'intermediate') return p.complexity !== 'advanced';
      return true;
    });
    (byComplexity.length ? byComplexity : anyComplexity).forEach(p => filtered.push(p));
  }
  return filtered.map(p => ({
    name: p.name,
    chords: resolveProgressionInKey(keyRoot, p.romans, useSevenths),
    description: p.description,
  }));
}

export function getAllStyles(): string[] {
  const set = new Set(NAMED_PROGRESSIONS.map(p => p.style));
  return Array.from(set).sort();
}
