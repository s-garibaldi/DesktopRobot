# Batch Analysis for Existing Tracks

If you have existing MP3 files that were uploaded before the audio analysis feature was added, you can run a batch analysis to detect their BPM, key, genre, and recommended scales.

## Quick Start

```bash
cd backend
node scripts/batch_analyze.js
```

This will:
1. Scan `frontend/public/backing-tracks/` for all audio files
2. Skip tracks that already have scales in metadata.json
3. Analyze remaining tracks (10-30 seconds each)
4. Update metadata.json with detected values

## Options

### Re-analyze all tracks (including those with existing metadata)

```bash
node scripts/batch_analyze.js --force
```

This ignores existing metadata and re-analyzes everything.

## What it does

For each track without scales:
- ✅ Detects BPM, key, and genre
- ✅ Generates scale recommendations
- ✅ Preserves any existing metadata (unless using --force)
- ✅ Updates metadata.json atomically

## Example Output

```
🎵 Batch Backing Track Analysis
================================

Scanning: /path/to/backing-tracks
Mode: INCREMENTAL (skip existing)

Found 20 audio file(s)

🔍 Analyzing: blues_jam_120.mp3
   ✅ SUCCESS: BPM=120, Key=A, Genre=Blues
   🎼 Scales: A Minor Pentatonic, A Blues Scale, ...

⏭️  SKIP: rock_progression.mp3 (already has metadata)

🔍 Analyzing: funk_groove.mp3
   ✅ SUCCESS: BPM=108, Key=Em, Genre=Funk
   🎼 Scales: E Minor Pentatonic, E Dorian, ...

================================
Summary:
  ✅ Analyzed: 18
  ⏭️  Skipped:  2
  ❌ Failed:   0
  📁 Total:    20

✨ Metadata saved to: /path/to/metadata.json
```

## Time Estimate

- **Small tracks (2-3 min)**: ~5-10 seconds each
- **Larger tracks (5+ min)**: ~15-30 seconds each
- **20 tracks total**: ~5-10 minutes

The script analyzes one track at a time to avoid excessive memory usage.

## Troubleshooting

### "Python script exited with code 1"

Ensure Python dependencies are installed:
```bash
pip3 install -r requirements.txt
```

### "Failed to start Python process"

Make sure `python3` is in your PATH:
```bash
which python3
```

### Analysis is slow

The script analyzes the first 60 seconds of each track. For very large files, this can take longer. This is normal and expected.

### Some tracks fail

If specific tracks fail:
1. Check the error message in the output
2. Try analyzing that file manually:
   ```bash
   python3 scripts/analyze_audio.py /path/to/problem-track.mp3
   ```
3. The file might be corrupted or in an unsupported format

## After Running

1. Restart your frontend to pick up the new metadata
2. Select a track in the backing track panel
3. Click "Edit" to see the detected scales and metadata
4. Adjust any values if needed and save

The metadata is stored in `frontend/public/backing-tracks/metadata.json` and can be committed to git.
