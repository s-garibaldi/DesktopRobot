import { NextResponse } from 'next/server';
import { writeFile, readdir, mkdir, readFile } from 'fs/promises';
import path from 'path';

/** Directory for backing track files, relative to project root (where backend runs from backend/). */
const BACKING_TRACKS_DIR = process.env.BACKING_TRACKS_DIR ?? path.join(process.cwd(), '..', 'frontend', 'public', 'backing-tracks');
const METADATA_FILE = path.join(BACKING_TRACKS_DIR, 'metadata.json');

const ALLOWED_EXT = ['.mp3', '.wav', '.m4a', '.aac'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface BackingTrackMetadata {
  key?: string;
  genre?: string;
  bpm?: number;
  scales?: string[];
}

type MetadataMap = Record<string, BackingTrackMetadata>;

async function loadMetadata(): Promise<MetadataMap> {
  try {
    const raw = await readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(raw) as MetadataMap;
  } catch {
    return {};
  }
}

async function saveMetadata(map: MetadataMap): Promise<void> {
  await mkdir(BACKING_TRACKS_DIR, { recursive: true });
  await writeFile(METADATA_FILE, JSON.stringify(map, null, 2), 'utf-8');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/** GET: List all backing tracks in the project folder with metadata. */
export async function GET() {
  try {
    const [files, metadata] = await Promise.all([
      readdir(BACKING_TRACKS_DIR, { withFileTypes: true }),
      loadMetadata(),
    ]);
    const tracks = files
      .filter((f) => f.isFile() && ALLOWED_EXT.includes(path.extname(f.name).toLowerCase()))
      .map((f) => {
        const meta = metadata[f.name] ?? {};
        return {
          id: f.name,
          name: path.basename(f.name, path.extname(f.name)),
          source: 'project' as const,
          key: meta.key ?? null,
          genre: meta.genre ?? null,
          bpm: meta.bpm ?? null,
          scales: meta.scales ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(tracks);
  } catch {
    return NextResponse.json([]);
  }
}

/** POST: Upload a backing track file. Saves to project folder and optional metadata. */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format. Use: ${ALLOWED_EXT.join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
    }

    const base = sanitizeFilename(path.basename(file.name, ext));
    const filename = `${base}${ext}`;
    const filepath = path.join(BACKING_TRACKS_DIR, filename);

    const key = (formData.get('key') as string)?.trim() || undefined;
    const genre = (formData.get('genre') as string)?.trim() || undefined;
    const bpmRaw = (formData.get('bpm') as string)?.trim();
    const bpm = bpmRaw ? parseInt(bpmRaw, 10) : undefined;
    const meta: BackingTrackMetadata = {};
    if (key) meta.key = key;
    if (genre) meta.genre = genre;
    if (bpm != null && !isNaN(bpm) && bpm > 0) meta.bpm = bpm;

    await mkdir(BACKING_TRACKS_DIR, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filepath, buffer);

    if (Object.keys(meta).length > 0) {
      const metadata = await loadMetadata();
      metadata[filename] = { ...metadata[filename], ...meta };
      await saveMetadata(metadata);
    }

    return NextResponse.json({
      id: filename,
      name: base,
      source: 'project',
      key: meta.key ?? null,
      genre: meta.genre ?? null,
      bpm: meta.bpm ?? null,
      scales: meta.scales ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
