import { NextResponse } from 'next/server';
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

const BACKING_TRACKS_DIR = process.env.BACKING_TRACKS_DIR ?? path.join(process.cwd(), '..', 'frontend', 'public', 'backing-tracks');
const METADATA_FILE = path.join(BACKING_TRACKS_DIR, 'metadata.json');

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

/** GET: Serve a backing track file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename) {
    return NextResponse.json({ error: 'Filename required' }, { status: 400 });
  }

  // Prevent path traversal
  if (filename.includes('..') || path.isAbsolute(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const filepath = path.join(BACKING_TRACKS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';

    const buffer = await readFile(filepath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

type MetadataMap = Record<string, { key?: string; genre?: string; bpm?: number; scales?: string[] }>;

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

/** PATCH: Update metadata for an existing backing track. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename || filename.includes('..') || path.isAbsolute(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { key?: string; genre?: string; bpm?: number; scales?: string[] };
    const metadata = await loadMetadata();
    const existing = metadata[filename] ?? {};
    if (body.key !== undefined) existing.key = body.key?.trim() || undefined;
    if (body.genre !== undefined) existing.genre = body.genre?.trim() || undefined;
    if (body.bpm !== undefined) {
      const n = typeof body.bpm === 'number' ? body.bpm : parseInt(String(body.bpm), 10);
      existing.bpm = n > 0 ? n : undefined;
    }
    if (body.scales !== undefined) existing.scales = body.scales;
    metadata[filename] = existing;
    await saveMetadata(metadata);
    return NextResponse.json({
      id: filename,
      name: path.basename(filename, path.extname(filename)),
      key: existing.key ?? null,
      genre: existing.genre ?? null,
      bpm: existing.bpm ?? null,
      scales: existing.scales ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${msg}` }, { status: 500 });
  }
}
