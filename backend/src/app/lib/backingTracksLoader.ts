/**
 * Server-only loader for backing tracks. Reads metadata and file list from disk
 * so the backend can list and search tracks without depending on HTTP.
 */
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const ALLOWED_EXT = ['.mp3', '.wav', '.m4a', '.aac'];

/** Same path logic as api/backing-tracks/route.ts; supports cwd = backend or project root. */
export function getBackingTracksDir(): string {
  if (process.env.BACKING_TRACKS_DIR) {
    return process.env.BACKING_TRACKS_DIR;
  }
  // When running "npm run dev" from backend/, cwd is backend/
  const fromBackend = path.join(process.cwd(), '..', 'frontend', 'public', 'backing-tracks');
  return fromBackend;
}

export interface BackingTrackRecord {
  filename: string;
  metadata: {
    key?: string;
    genre?: string;
    bpm?: number;
    scales?: string[];
  };
}

/** Load all backing tracks from disk (metadata.json + audio files in dir). */
export async function loadBackingTracksFromDisk(): Promise<BackingTrackRecord[]> {
  let dir = getBackingTracksDir();
  if (process.env.BACKING_TRACKS_DIR) {
    // use as-is
  } else {
    const fromRoot = path.join(process.cwd(), 'frontend', 'public', 'backing-tracks');
    try {
      await readdir(dir, { withFileTypes: true });
    } catch {
      try {
        await readdir(fromRoot, { withFileTypes: true });
        dir = fromRoot;
      } catch {
        return [];
      }
    }
  }
  const metadataPath = path.join(dir, 'metadata.json');

  let metadataMap: Record<string, BackingTrackRecord['metadata']> = {};
  try {
    const raw = await readFile(metadataPath, 'utf-8');
    metadataMap = JSON.parse(raw) as Record<string, BackingTrackRecord['metadata']>;
  } catch {
    // no metadata or invalid json
  }

  let entries: { name: string }[] = [];
  try {
    const withTypes = await readdir(dir, { withFileTypes: true });
    entries = withTypes.filter(
      (e) => e.isFile() && ALLOWED_EXT.includes(path.extname(e.name).toLowerCase())
    );
  } catch {
    return [];
  }
  return entries
    .map((e) => {
      const meta = metadataMap[e.name] ?? {};
      return {
        filename: e.name,
        metadata: {
          key: meta.key,
          genre: meta.genre,
          bpm: meta.bpm,
          scales: meta.scales,
        },
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}
