import { NextRequest, NextResponse } from 'next/server';
import { spotifyFetch, type SpotifyTrack } from '@/app/lib/spotify';

/**
 * GET /api/spotify/track/:id
 * Returns a single track's metadata by Spotify ID.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Track ID is required' },
      { status: 400 }
    );
  }

  const data = await spotifyFetch<SpotifyTrack>(`/tracks/${encodeURIComponent(id.trim())}`);

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: 'Spotify not configured or track not found.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, track: data });
}
