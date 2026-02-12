#!/usr/bin/env node
/**
 * Batch analysis script for existing backing tracks.
 * Analyzes all MP3 files in the backing-tracks folder and updates metadata.json
 * with detected BPM, key, genre, and scales.
 * 
 * Usage: node scripts/batch_analyze.js [--force]
 * 
 * Options:
 *   --force    Re-analyze tracks even if they already have metadata
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const BACKING_TRACKS_DIR = process.env.BACKING_TRACKS_DIR ?? path.join(__dirname, '..', '..', 'frontend', 'public', 'backing-tracks');
const METADATA_FILE = path.join(BACKING_TRACKS_DIR, 'metadata.json');
const PYTHON_SCRIPT = path.join(__dirname, 'analyze_audio.py');
const ALLOWED_EXT = ['.mp3', '.wav', '.m4a', '.aac'];

const force = process.argv.includes('--force');

async function loadMetadata() {
  try {
    const raw = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveMetadata(metadata) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
}

function runPythonAnalysis(audioPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [PYTHON_SCRIPT, audioPath]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse analysis result: ${err}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

async function main() {
  console.log('🎵 Batch Backing Track Analysis');
  console.log('================================\n');
  
  console.log(`Scanning: ${BACKING_TRACKS_DIR}`);
  console.log(`Mode: ${force ? 'FORCE (re-analyze all)' : 'INCREMENTAL (skip existing)'}\n`);

  // Load existing metadata
  const metadata = await loadMetadata();
  
  // Get all audio files
  const files = await fs.readdir(BACKING_TRACKS_DIR, { withFileTypes: true });
  const audioFiles = files
    .filter((f) => f.isFile() && ALLOWED_EXT.includes(path.extname(f.name).toLowerCase()))
    .filter((f) => f.name !== 'metadata.json')
    .map((f) => f.name);

  console.log(`Found ${audioFiles.length} audio file(s)\n`);

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of audioFiles) {
    const filepath = path.join(BACKING_TRACKS_DIR, filename);
    const existing = metadata[filename] || {};
    
    // Skip if already has scales (unless --force)
    if (!force && existing.scales && existing.scales.length > 0) {
      console.log(`⏭️  SKIP: ${filename} (already has metadata)`);
      skipped++;
      continue;
    }

    console.log(`🔍 Analyzing: ${filename}`);
    
    try {
      const result = await runPythonAnalysis(filepath);
      
      if (!result.success) {
        console.log(`   ❌ FAILED: ${result.error}\n`);
        failed++;
        continue;
      }

      // Update metadata (preserve existing values if present)
      metadata[filename] = {
        key: existing.key || result.key,
        genre: existing.genre || result.genre,
        bpm: existing.bpm || result.bpm,
        scales: result.scales || existing.scales,
      };

      console.log(`   ✅ SUCCESS: BPM=${result.bpm}, Key=${result.key}, Genre=${result.genre}`);
      console.log(`   🎼 Scales: ${result.scales?.slice(0, 2).join(', ')}${result.scales?.length > 2 ? ', ...' : ''}\n`);
      analyzed++;
      
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}\n`);
      failed++;
    }
  }

  // Save updated metadata
  await saveMetadata(metadata);

  console.log('\n================================');
  console.log('Summary:');
  console.log(`  ✅ Analyzed: ${analyzed}`);
  console.log(`  ⏭️  Skipped:  ${skipped}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  📁 Total:    ${audioFiles.length}`);
  console.log('\n✨ Metadata saved to:', METADATA_FILE);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
