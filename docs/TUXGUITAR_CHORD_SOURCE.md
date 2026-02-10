# Using TuxGuitar as a Chord Dictionary Data Source

## 1. What TuxGuitar Is and Why It’s Relevant

**TuxGuitar** is an open-source, Guitar Pro–style tablature editor (Java, cross-platform). It includes a Chord Editor and a chord library: users can look up chords by name/quality, draw fingerings, and save them. That makes it a useful **source of chord shapes and voicings** without relying on proprietary chord sites or runtime dependencies.

## 2. Use TuxGuitar Only as a Data Source

TuxGuitar is used **only to obtain chord data**, not as a runtime dependency:

- **No** bundling of TuxGuitar code or binaries.
- **No** calling TuxGuitar at runtime (no CLI, no API).
- **One-time extraction**: parse TuxGuitar’s chord dictionary (or chord-bearing files) into our own JSON; commit only that JSON and use it in the app.

Everything at runtime is **deterministic and offline**: we read from our own `chords.json`.

## 3. High-Level Steps

1. **Install TuxGuitar locally**  
   Download and install from [TuxGuitar](https://tuxguitar.org/) or [GitHub releases](https://github.com/helge17/tuxguitar/releases). No need to run it in the product; it’s only for accessing the chord data.

2. **Locate chord dictionary resource files**  
   - The Chord Editor can “get a chord from a library” and “save to the library”; that library may be stored in config (e.g. XML) or inside the app resources.  
   - Inspect the installation (e.g. `share/`, `resources/`, or OS config dirs) or the [TuxGuitar source](https://github.com/helge17/tuxguitar) (e.g. `TuxGuitar-lib`, chord-related I/O) to find where chord definitions live (e.g. `.tg` templates, XML, or embedded in Guitar Pro–compatible format).  
   - **Alternative**: Create a “chord library” tab in TuxGuitar (one chord per beat/measure), export it as Guitar Pro (`.gp5`/`.gpx`) or `.tg`, and use that file as the input to the extractor.

3. **Write a one-time extraction script**  
   Use Python, Node, or Rust to:
   - Parse the chord dictionary resource (if it’s a known format) **or** parse Guitar Pro / `.tg` files (e.g. via [PyGuitarPro](https://pyguitarpro.readthedocs.io/), [alphaTab](https://alphatab.net/), or TuxGuitar’s own format docs).
   - Map each chord to our schema (name, quality, baseFret, frets, optional fingers).
   - Output a single `chords.json` (or per-quality files). Optionally filter to a **curated subset** (e.g. common open and barre shapes).

4. **Commit only the resulting JSON**  
   Commit `chords.json` (or the chosen subset) into the repo. Do **not** commit TuxGuitar binaries, full chord-library dumps, or extractor input files unless you intend to document them as build-time assets.

5. **Use `chords.json` at runtime**  
   The frontend (or backend) loads `chords.json` and uses it to render SVG chord diagrams (e.g. in the Guitar Tabs face). Lookup by name/quality and optional voicing index; no network calls, no TuxGuitar dependency.

## 4. Deterministic and Offline

This pipeline is **deterministic and offline**:

- Chord data is fixed at extract time and versioned in the repo.
- No scraping of proprietary sites, no runtime fetches for chord content.
- Reproducible: re-run the extractor on the same TuxGuitar version/same input file to regenerate `chords.json` if needed.

## 5. Licensing and Attribution

- **Do not bundle** TuxGuitar code or binaries in the product. Only use **extracted/converted data** (e.g. fret numbers, names) in our own schema.
- **Cite the source** in the thesis (and in the repo if desired): chord shapes/voicings derived from TuxGuitar’s chord library or from files created/exported with TuxGuitar; TuxGuitar is LGPL-licensed, [https://github.com/helge17/tuxguitar](https://github.com/helge17/tuxguitar).

## 6. Example JSON Shape for a Chord Voicing

Our runtime schema can look like this (one entry per voicing):

```json
{
  "name": "G",
  "quality": "major",
  "baseFret": 1,
  "frets": [3, 2, 0, 0, 0, 3],
  "fingers": [2, 1, 0, 0, 0, 3]
}
```

- **`name`**: Root/letter name (e.g. `"G"`, `"Am"`).
- **`quality`**: e.g. `"major"`, `"minor"`, `"7"`, `"m7"`.
- **`baseFret`**: First fret shown on the diagram (1 = open position).
- **`frets`**: Per string from low E to high e; `-1` = mute (X), `0` = open (O), `1+` = fret number.
- **`fingers`**: Optional; `0` = open, `1–4` = finger index; omit if not extracted from source.

The extractor script maps TuxGuitar/GP fields (e.g. `firstFret`, `strings[]`) into this shape; fingering can be inferred or left out if the source doesn’t provide it.
