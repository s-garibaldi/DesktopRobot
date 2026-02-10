#!/usr/bin/env node
/**
 * Generate chords.json from chords-db (TuxGuitar-style open chord library).
 * Run from project root: node frontend/scripts/generate-chords-from-library.js
 * Requires Node 18+ (fetch). Writes to frontend/src/components/guitarTabs/chords.json
 *
 * chords-db stores frets relative to the diagram when baseFret > 1 (1 = first fret shown).
 * We convert to absolute fret numbers so our diagram (which uses fretOffset + relFret) is correct.
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUITAR_JSON_URL = 'https://raw.githubusercontent.com/tombatossals/chords-db/master/lib/guitar.json';
const OUT_PATH = join(__dirname, '../src/components/guitarTabs/chords.json');

function keyToCanonical(key) {
  return key.replace(/#/g, 's').replace(/b/g, 'b').toLowerCase();
}

function suffixToQuality(suffix) {
  if (suffix === 'major') return 'major';
  if (suffix === 'minor') return 'minor';
  if (suffix === 'm7') return 'm7';
  if (suffix === '7') return '7';
  if (suffix === 'maj7') return 'maj7';
  if (suffix === 'dim') return 'dim';
  if (suffix === 'dim7') return 'dim7';
  if (suffix === 'aug') return 'aug';
  if (suffix === 'sus' || suffix === 'sus4') return 'sus4';
  if (suffix === 'sus2') return 'sus2';
  if (suffix === '5') return '5';
  if (suffix === '6') return '6';
  if (suffix === '9') return '9';
  if (suffix === 'm6') return 'm6';
  if (suffix === 'add9') return 'add9';
  return suffix;
}

function toDisplayName(key, suffix) {
  const k = key.replace(/b/g, '♭').replace(/#/g, '♯');
  if (suffix === 'major') return k;
  if (suffix === 'minor') return k + 'm';
  if (suffix === '7') return k + '7';
  if (suffix === 'm7') return k + 'm7';
  if (suffix === 'maj7') return k + 'maj7';
  if (suffix === 'dim') return k + 'dim';
  if (suffix === 'dim7') return k + 'dim7';
  if (suffix === 'aug') return k + 'aug';
  if (suffix === 'sus2') return k + 'sus2';
  if (suffix === 'sus4' || suffix === 'sus') return k + 'sus4';
  if (suffix === '9') return k + '9';
  if (suffix === 'm9') return k + 'm9';
  if (suffix === '6') return k + '6';
  if (suffix === 'm6') return k + 'm6';
  if (suffix === 'add9') return k + 'add9';
  if (suffix === '5') return k + '5';
  return k + (suffix || '');
}

function buildCanonicalKey(key, suffix) {
  const k = keyToCanonical(key);
  if (suffix === 'major') return k;
  if (suffix === 'minor') return k + 'm';
  if (suffix === '7') return k + '7';
  if (suffix === 'm7') return k + 'm7';
  if (suffix === 'maj7') return k + 'maj7';
  if (suffix === 'dim') return k + 'dim';
  if (suffix === 'dim7') return k + 'dim7';
  if (suffix === 'aug') return k + 'aug';
  if (suffix === 'sus2') return k + 'sus2';
  if (suffix === 'sus4' || suffix === 'sus') return k + 'sus4';
  if (suffix === '9') return k + '9';
  if (suffix === 'm9') return k + 'm9';
  if (suffix === '6') return k + '6';
  if (suffix === 'm6') return k + 'm6';
  if (suffix === 'add9') return k + 'add9';
  if (suffix === '5') return k + '5';
  return k + (suffix || '').replace(/#/g, 's').replace(/\//g, '-').toLowerCase();
}

async function main() {
  console.log('Fetching chords-db guitar.json...');
  const res = await fetch(GUITAR_JSON_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();

  const chordsByKey = data.chords || {};
  const chords = {};
  const displayNames = {};
  const aliases = {};

  for (const noteName of Object.keys(chordsByKey)) {
    const entries = chordsByKey[noteName];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const { key, suffix, positions } = entry;
    if (!positions || positions.length === 0) continue;
    const canonicalKey = buildCanonicalKey(key, suffix);
    const displayName = toDisplayName(key, suffix);

    const voicings = positions.map((pos) => {
      const baseFret = Math.max(1, pos.baseFret ?? 1);
      let frets = pos.frets != null ? [...pos.frets] : [];
      while (frets.length < 6) frets.push(-1);
      frets = frets.slice(0, 6);
      // chords-db stores relative frets when baseFret > 1 (1 = first fret of diagram). Convert to absolute.
      if (baseFret > 1) {
        frets = frets.map((f) => (f > 0 ? f + baseFret - 1 : f));
      }
      let fingers = pos.fingers != null ? [...pos.fingers] : [];
      while (fingers.length < 6) fingers.push(0);
      fingers = fingers.slice(0, 6);
      let barre = undefined;
      if (pos.barres && pos.barres.length > 0) {
        const b = pos.barres[0];
        barre = baseFret > 1 ? b + baseFret - 1 : b;
      }
      return {
        name: displayName,
        quality: suffixToQuality(suffix),
        baseFret,
        frets,
        fingers,
        ...(barre != null && { barre }),
      };
    });

    chords[canonicalKey] = voicings;
    displayNames[canonicalKey] = displayName;

      if (suffix === 'major') aliases[keyToCanonical(key) + 'major'] = canonicalKey;
      if (suffix === 'minor') aliases[keyToCanonical(key) + 'minor'] = canonicalKey;
    }
  }

  const standardAliases = {
    gmajor: 'g', cmajor: 'c', dmajor: 'd', emajor: 'e', amajor: 'a', bmajor: 'b', fmajor: 'f',
    eminor: 'em', aminor: 'am', bminor: 'bm', fminor: 'fm', dminor: 'dm',
  };
  const output = {
    source: "Chord data from chords-db (tombatossals/chords-db, MIT). TuxGuitar-style library; see TUXGUITAR_CHORD_SOURCE.md.",
    aliases: { ...standardAliases, ...aliases },
    displayNames,
    chords,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('Wrote', OUT_PATH);
  console.log('Chord keys:', Object.keys(chords).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
