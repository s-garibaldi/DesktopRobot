/**
 * Reads the legacy scales.json (scaleKeys + positionStep + shapes) and outputs
 * scales.json in the same schema as chords: aliases, displayNames, scales (key → voicings).
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

const data = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
const { scaleKeys, positionStep, shapes } = data;

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
  const { rootFret, type, keys } = meta;
  const templateList = shapes[type];
  const templates = Array.isArray(templateList) ? templateList : [templateList];

  const voicings = [];
  const baseFrets = [
    rootFret,
    rootFret + positionStep,
    rootFret + 2 * positionStep,
    rootFret + 3 * positionStep,
    rootFret + 4 * positionStep,
  ].filter((f) => f >= 0 && f <= 24);

  for (const baseFret of baseFrets) {
    for (const template of templates) {
      const flat = template.positions.flat();
      const rootInTemplate = Math.min(...flat);
      const positions = template.positions.map((row) =>
        row.map((f) => baseFret + (f - rootInTemplate))
      );
      const minFret = Math.min(...positions.flat());
      if (minFret < 0) continue;
      voicings.push({ fretOffset: minFret, positions });
    }
  }

  voicings.sort((a, b) => a.fretOffset - b.fretOffset);
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
