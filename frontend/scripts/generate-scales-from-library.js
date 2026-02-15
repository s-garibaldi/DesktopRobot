/**
 * Reads the legacy scales-legacy.json (scaleKeys + shapes) and outputs
 * scales.json in the same schema as chords: aliases, displayNames, scales (key → voicings).
 * Every scale gets 6 voicings with the diagram starting at frets: 1, 5, 10, 12, 15, 20.
 * Uses the first (canonical) shape per scale type from legacy; positions are absolute frets.
 * Run from project root: node frontend/scripts/generate-scales-from-library.js
 *
 * Output is written to frontend/src/components/guitarTabs/scales.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = join(__dirname, '../src/components/guitarTabs/scales-legacy.json');
const OUTPUT_PATH = join(__dirname, '../src/components/guitarTabs/scales.json');

/** Voicing start frets for every scale (first fret of the 5-fret window). */
const VOICING_START_FRETS = [1, 5, 10, 12, 15, 20];

const data = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
const { scaleKeys, shapes } = data;

function toCanonicalKey(key, type) {
  const root = key.replace(/major|minor|minorAlt/g, '').trim() || key;
  if (type === 'major') return root;
  return root.endsWith('m') && root.length <= 3 ? root : root.replace(/m$/, '') + 'm';
}

const keyToMeta = {};
for (const [key, meta] of Object.entries(scaleKeys)) {
  const canonical = toCanonicalKey(key, meta.type);
  if (!keyToMeta[canonical]) keyToMeta[canonical] = meta;
  keyToMeta[canonical].keys = keyToMeta[canonical].keys || [];
  keyToMeta[canonical].keys.push(key);
}

function displayNameFromKeyAndType(canonicalKey, type) {
  const root = canonicalKey.replace(/major|minor|minorAlt/g, '').trim() || canonicalKey;
  const rootDisplay =
    root.charAt(0).toUpperCase() + (root.length > 1 && root.endsWith('m') ? '' : root.slice(1));
  if (type === 'major') return `${rootDisplay} major`;
  if (type === 'minor' || type === 'minorAlt') return `${rootDisplay} minor`;
  return rootDisplay;
}

const aliases = {};
const displayNames = {};
const scales = {};

for (const [canonicalKey, meta] of Object.entries(keyToMeta)) {
  const { type, keys } = meta;
  const templateList = shapes[type];
  const templates = Array.isArray(templateList) ? templateList : [templateList];
  const template = templates[0];

  const flat = template.positions.flat();
  const rootInTemplate = Math.min(...flat);
  const voicings = [];

  for (const baseFret of VOICING_START_FRETS) {
    const positions = template.positions.map((row) =>
      row.map((f) => baseFret + (f - rootInTemplate))
    );
    const minFret = Math.min(...positions.flat());
    if (minFret < 0) continue;
    voicings.push({ fretOffset: minFret, positions });
  }

  scales[canonicalKey] = voicings;
  displayNames[canonicalKey] = displayNameFromKeyAndType(canonicalKey, type);
  for (const k of keys) {
    if (k !== canonicalKey) aliases[k] = canonicalKey;
  }
}

const out = {
  source: 'Scale data in TuxGuitar-style library format (aliases, displayNames, scales). Generated from legacy scaleKeys + shapes. See TUXGUITAR_CHORD_SOURCE.md.',
  aliases,
  displayNames,
  scales,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', OUTPUT_PATH, '—', Object.keys(scales).length, 'scale keys,', Object.values(scales).reduce((s, v) => s + v.length, 0), 'voicings.');
console.log('Aliases:', Object.keys(aliases).length);
console.log('Display names:', Object.keys(displayNames).length);
