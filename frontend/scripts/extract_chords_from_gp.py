#!/usr/bin/env python3
"""
Extract chord diagrams from a Guitar Pro (.gp3, .gp4, .gp5) file and output
JSON voicings in our chords.json schema (TuxGuitar-style).

Usage:
  pip install pyguitarpro
  python extract_chords_from_gp.py path/to/file.gp5

Output is printed to stdout as a JSON object: { "chords": { "key": [ voicing, ... ] } }
You can merge this into frontend/src/components/guitarTabs/chords.json
or use it to extend the library. Canonical key (e.g. "g", "am") must be
inferred from chord name; this script uses a simple normalization.
"""

import json
import re
import sys
from pathlib import Path

try:
    import guitarpro
except ImportError:
    print("Install PyGuitarPro: pip install pyguitarpro", file=sys.stderr)
    sys.exit(1)


def normalize_name_to_key(name: str) -> str:
    """Map chord name to canonical key (e.g. 'G' -> 'g', 'Am7' -> 'am7')."""
    if not name or not name.strip():
        return "unknown"
    s = name.strip().replace(" ", "").replace("#", "s").replace("b", "b")
    s = s.lower()
    # Keep quality suffix: m, 7, m7, etc.
    return s


def chord_voicing_from_gp(chord) -> dict | None:
    """Convert PyGuitarPro Chord to our voicing schema."""
    if chord is None or chord.strings is None:
        return None
    # GP strings: typically 6 elements, high e (index 0) to low E (index 5).
    # Our schema: low E (index 0) to high e (index 5).
    frets = list(chord.strings)
    if len(frets) == 6:
        frets = frets[::-1]
    elif len(frets) != 6:
        return None
    first_fret = chord.firstFret if chord.firstFret is not None else 1
    # Barre: GP has chord.barres (list of Barre). Barre has fret, startString, endString (1-based in GP).
    barre = None
    if chord.barres and len(chord.barres) > 0:
        b = chord.barres[0]
        start = getattr(b, "startString", 1) or 1
        end = getattr(b, "endString", 6) or 6
        fret = getattr(b, "fret", first_fret) or first_fret
        # Convert to our 0-based string indices (low E = 0). GP often 1-based, high e = 1.
        start_0 = 6 - start if start <= 6 else 0
        end_0 = 6 - end if end <= 6 else 5
        if start_0 > end_0:
            start_0, end_0 = end_0, start_0
        if end_0 - start_0 >= 2:
            barre = [start_0, end_0, fret]
        else:
            barre = fret
    name = chord.name or "?"
    # Simple quality from name
    quality = "major"
    if "m" in name and "maj" not in name.lower() and "m7" in name:
        quality = "m7"
    elif "m" in name and "maj" not in name.lower():
        quality = "minor"
    elif "7" in name:
        quality = "7"
    return {
        "name": name,
        "quality": quality,
        "baseFret": first_fret,
        "frets": frets,
        "barre": barre,
    }


def extract_chords(gp_path: str) -> dict:
    """Parse GP file and return { chords: { key: [ voicing, ... ] } }."""
    song = guitarpro.parse(gp_path)
    by_key: dict[str, list[dict]] = {}
    seen = set()

    for track in song.tracks or []:
        for measure in track.measures or []:
            for voice in measure.voices or []:
                for beat in voice.beats or []:
                    effect = getattr(beat, "effect", None)
                    if effect is None:
                        continue
                    chord = getattr(effect, "chord", None)
                    if chord is None:
                        continue
                    voicing = chord_voicing_from_gp(chord)
                    if voicing is None:
                        continue
                    key = normalize_name_to_key(voicing["name"])
                    sig = (key, json.dumps(voicing["frets"]), voicing["baseFret"])
                    if sig in seen:
                        continue
                    seen.add(sig)
                    if key not in by_key:
                        by_key[key] = []
                    by_key[key].append(voicing)

    return {"chords": by_key}


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_chords_from_gp.py <file.gp5>", file=sys.stderr)
        sys.exit(1)
    gp_path = Path(sys.argv[1])
    if not gp_path.exists():
        print(f"File not found: {gp_path}", file=sys.stderr)
        sys.exit(1)
    result = extract_chords(str(gp_path))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
