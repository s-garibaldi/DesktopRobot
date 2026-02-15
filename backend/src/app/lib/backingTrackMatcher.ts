/**
 * Backing track matcher: Search and score backing tracks based on user criteria (BPM, genre, key, scales).
 * Loads track list via the backend API (no fs usage) so it works with Next.js bundling.
 */

export interface BackingTrackMetadata {
  key?: string;
  genre?: string;
  bpm?: number;
  scales?: string[];
}

export interface BackingTrack {
  filename: string;
  metadata: BackingTrackMetadata;
}

export interface SearchCriteria {
  key?: string;
  genre?: string;
  bpm?: number;
  scale?: string;
  bpmTolerance?: number; // Default 20
}

export interface ScoredTrack {
  filename: string;
  metadata: BackingTrackMetadata;
  score: number;
  matchReasons: string[];
}

/** API response item from GET /api/backing-tracks */
interface ApiTrack {
  id: string;
  name: string;
  source: string;
  key: string | null;
  genre: string | null;
  bpm: number | null;
  scales: string[] | null;
}

function getBackendBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  if (typeof process !== 'undefined' && process.env?.BACKEND_PUBLIC_URL) {
    return process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/** Load all backing tracks with metadata via the backend API (no fs) */
export async function loadBackingTracks(baseUrl?: string): Promise<BackingTrack[]> {
  const url = (baseUrl || getBackendBaseUrl()) + '/api/backing-tracks';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const list = (await res.json()) as ApiTrack[];
    return list.map((t) => ({
      filename: t.id,
      metadata: {
        key: t.key ?? undefined,
        genre: t.genre ?? undefined,
        bpm: t.bpm ?? undefined,
        scales: t.scales ?? undefined,
      },
    }));
  } catch (error) {
    console.error('[backingTrackMatcher] Failed to load tracks from API:', error);
    return [];
  }
}

/** Normalize key to standard format (e.g. "A minor" → "Am", "C major" → "C") */
export function normalizeKey(key: string): string {
  let s = key.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Handle flats and sharps
  s = s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\bflat\b/g, 'b').replace(/\bsharp\b/g, '#');
  
  // Handle "A minor" → "Am", "C major" → "C"
  s = s.replace(/\bmajor\b/g, '').replace(/\bminor\b/g, 'm');
  
  // Remove spaces
  s = s.replace(/\s+/g, '');
  
  // Capitalize first letter
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  
  return s;
}

/** Normalize genre (lowercase, remove extra spaces) */
export function normalizeGenre(genre: string): string {
  return genre.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Get relative minor/major key (e.g. "C" → "Am", "Am" → "C") */
export function getRelativeKey(key: string): string | null {
  const normalized = normalizeKey(key);
  const isMinor = normalized.endsWith('m');
  const root = isMinor ? normalized.slice(0, -1) : normalized;
  
  // Chromatic scale
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notesFlat = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  
  // Find root in chromatic scale
  let idx = notes.indexOf(root);
  if (idx === -1) idx = notesFlat.indexOf(root);
  if (idx === -1) return null;
  
  if (isMinor) {
    // Minor → relative major (up 3 semitones)
    const majorIdx = (idx + 3) % 12;
    return notes[majorIdx];
  } else {
    // Major → relative minor (down 3 semitones)
    const minorIdx = (idx + 9) % 12;
    return notes[minorIdx] + 'm';
  }
}

/** Check if two keys share the same root (e.g. "C" and "Cm") */
export function sameRoot(key1: string, key2: string): boolean {
  const k1 = normalizeKey(key1).replace(/m$/, '');
  const k2 = normalizeKey(key2).replace(/m$/, '');
  return k1 === k2;
}

/** Score key match: 1.0 = exact, 0.8 = relative, 0.5 = same root, 0 = different */
export function scoreKeyMatch(userKey: string, trackKey: string): number {
  const user = normalizeKey(userKey);
  const track = normalizeKey(trackKey);
  
  if (user === track) return 1.0;
  
  const relativeKey = getRelativeKey(user);
  if (relativeKey && normalizeKey(relativeKey) === track) return 0.8;
  
  if (sameRoot(user, track)) return 0.5;
  
  return 0;
}

/** Genre synonyms and similar genres */
const GENRE_GROUPS: Record<string, string[]> = {
  'blues': ['blues', 'blue', 'rhythm and blues', 'r&b'],
  'rock': ['rock', 'rock and roll', 'hard rock', 'classic rock'],
  'jazz': ['jazz', 'bebop', 'swing', 'fusion'],
  'bossa nova': ['bossa nova', 'bossa', 'brazilian', 'latin jazz'],
  'pop': ['pop', 'popular', 'top 40'],
  'funk': ['funk', 'funky', 'soul'],
  'reggae': ['reggae', 'ska', 'dub'],
  'country': ['country', 'folk', 'bluegrass', 'americana'],
  'latin': ['latin', 'salsa', 'mambo', 'rumba'],
  'soul': ['soul', 'r&b', 'motown'],
};

/** Score genre match: 1.0 = exact, 0.7 = similar, 0 = different */
export function scoreGenreMatch(userGenre: string, trackGenre: string): number {
  const user = normalizeGenre(userGenre);
  const track = normalizeGenre(trackGenre);
  
  if (user === track) return 1.0;
  
  // Check if they're in the same genre group
  for (const [group, genres] of Object.entries(GENRE_GROUPS)) {
    const userInGroup = genres.includes(user);
    const trackInGroup = genres.includes(track);
    if (userInGroup && trackInGroup) return 0.7;
  }
  
  // Partial match (e.g. "rock" in "hard rock")
  if (track.includes(user) || user.includes(track)) return 0.6;
  
  return 0;
}

/** Score BPM match: 1.0 = exact, linear decay with tolerance */
export function scoreBpmMatch(userBpm: number, trackBpm: number, tolerance: number = 20): number {
  const diff = Math.abs(userBpm - trackBpm);
  if (diff === 0) return 1.0;
  if (diff > tolerance * 2) return 0;
  
  // Linear decay: 1.0 at 0 diff, 0.5 at tolerance, 0 at 2*tolerance
  return Math.max(0, 1.0 - (diff / (tolerance * 2)));
}

/** Score scale match: 1.0 if requested scale in track scales */
export function scoreScaleMatch(userScale: string, trackScales: string[] = []): number {
  if (!userScale || trackScales.length === 0) return 0;
  
  const user = userScale.trim().toLowerCase();
  
  for (const trackScale of trackScales) {
    const track = trackScale.trim().toLowerCase();
    if (track.includes(user) || user.includes(track)) return 1.0;
  }
  
  return 0;
}

/** Search and score all backing tracks based on criteria */
export async function searchBackingTracks(criteria: SearchCriteria): Promise<ScoredTrack[]> {
  const tracks = await loadBackingTracks();
  if (tracks.length === 0) return [];
  
  const tolerance = criteria.bpmTolerance ?? 20;
  
  const scored = tracks.map((track): ScoredTrack => {
    let score = 0;
    const matchReasons: string[] = [];
    
    // Key match (weight: 40%)
    if (criteria.key && track.metadata.key) {
      const keyScore = scoreKeyMatch(criteria.key, track.metadata.key);
      score += keyScore * 40;
      if (keyScore === 1.0) {
        matchReasons.push(`exact key match (${track.metadata.key})`);
      } else if (keyScore === 0.8) {
        matchReasons.push(`relative key (${track.metadata.key})`);
      } else if (keyScore === 0.5) {
        matchReasons.push(`same root note (${track.metadata.key})`);
      }
    }
    
    // Genre match (weight: 30%)
    if (criteria.genre && track.metadata.genre) {
      const genreScore = scoreGenreMatch(criteria.genre, track.metadata.genre);
      score += genreScore * 30;
      if (genreScore >= 0.7) {
        matchReasons.push(`${track.metadata.genre}`);
      }
    }
    
    // BPM match (weight: 20%)
    if (criteria.bpm != null && track.metadata.bpm != null) {
      const bpmScore = scoreBpmMatch(criteria.bpm, track.metadata.bpm, tolerance);
      score += bpmScore * 20;
      if (bpmScore > 0.7) {
        matchReasons.push(`${track.metadata.bpm} BPM`);
      }
    }
    
    // Scale match (weight: 10%)
    if (criteria.scale && track.metadata.scales) {
      const scaleScore = scoreScaleMatch(criteria.scale, track.metadata.scales);
      score += scaleScore * 10;
      if (scaleScore > 0) {
        matchReasons.push(`compatible scales`);
      }
    }
    
    return {
      filename: track.filename,
      metadata: track.metadata,
      score,
      matchReasons,
    };
  });
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  return scored;
}

/** Parse natural language command to search criteria */
export function parseBackingTrackCommand(command: string): SearchCriteria {
  const s = command.toLowerCase();
  const criteria: SearchCriteria = {};
  
  // Extract BPM (look for numbers, common patterns)
  const bpmMatch = s.match(/\b(\d{2,3})\s*bpm\b|\bat\s+(\d{2,3})\b|\b(\d{2,3})\s+beats\b/);
  if (bpmMatch) {
    const bpm = parseInt(bpmMatch[1] || bpmMatch[2] || bpmMatch[3], 10);
    if (bpm >= 40 && bpm <= 240) {
      criteria.bpm = bpm;
    }
  }
  
  // Extract key: "in A minor", "in E", "A minor", "key of G", etc.
  const keyMatch =
    s.match(/\bin\s+([a-g][#b♯♭]?\s*(?:major|minor|m)?)\b/i) ||
    s.match(/\b([a-g][#b♯♭]?\s*(?:major|minor|m))\b/i) ||
    s.match(/\b(?:key\s+of\s+)?([a-g][#b♯♭]?\s*(?:major|minor|m)?)\b/i);
  if (keyMatch) {
    criteria.key = keyMatch[1].trim();
  }

  // Extract genre (look for common genres; check before key so "blues in A" works)
  const genres = ['bossa nova', 'blues', 'rock', 'jazz', 'pop', 'funk', 'reggae', 'country', 'latin', 'soul'];
  for (const genre of genres) {
    if (s.includes(genre)) {
      criteria.genre = genre;
      break;
    }
  }
  
  // Extract scale (look for scale names)
  const scaleMatch = s.match(/\b(pentatonic|dorian|mixolydian|aeolian|ionian|lydian|phrygian|locrian|blues scale|harmonic minor|melodic minor)\b/i);
  if (scaleMatch) {
    criteria.scale = scaleMatch[1];
  }
  
  return criteria;
}

/** Get best match with explanation */
export async function findBestBackingTrack(command: string): Promise<{
  filename: string | null;
  metadata: BackingTrackMetadata | null;
  explanation: string;
  criteria: SearchCriteria;
}> {
  const criteria = parseBackingTrackCommand(command);
  const tracks = await searchBackingTracks(criteria);
  
  if (tracks.length === 0) {
    return {
      filename: null,
      metadata: null,
      explanation: 'No backing tracks available in the library.',
      criteria,
    };
  }
  
  // When all scores are 0, pick randomly so we don't always play the same (first) track
  const topScore = tracks[0].score;
  const best =
    topScore === 0 && tracks.length > 1
      ? tracks[Math.floor(Math.random() * tracks.length)]
      : tracks[0];

  if (best.score === 0) {
    return {
      filename: best.filename,
      metadata: best.metadata,
      explanation: `No exact match found. Playing: ${[best.metadata.key, best.metadata.genre, best.metadata.bpm ? best.metadata.bpm + ' BPM' : ''].filter(Boolean).join(' ') || best.filename}`.trim(),
      criteria,
    };
  }
  
  // Build explanation
  const parts: string[] = [];
  if (best.matchReasons.length > 0) {
    parts.push(`Found ${best.matchReasons.join(', ')}`);
  }
  
  if (best.metadata.scales && best.metadata.scales.length > 0) {
    parts.push(`Recommended scales: ${best.metadata.scales.slice(0, 2).join(', ')}`);
  }
  
  const explanation = parts.length > 0 ? parts.join('. ') + '.' : 'Playing backing track.';
  
  return {
    filename: best.filename,
    metadata: best.metadata,
    explanation,
    criteria,
  };
}
