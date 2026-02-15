import { NextRequest, NextResponse } from 'next/server';
import { spotifyFetch, type SpotifySearchTracksResponse } from '@/app/lib/spotify';

/**
 * GET /api/spotify/search?q=...&type=track&limit=20
 * Proxies Spotify search using server-side Client Credentials (metadata only).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const type = req.nextUrl.searchParams.get('type') ?? 'track';
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 20, 1), 50);

  if (!q || !q.trim()) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  const data = await spotifyFetch<SpotifySearchTracksResponse>('/search', {
    q: q.trim(),
    type,
    limit: String(limit),
  });

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: 'Spotify not configured or request failed. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, ...data });
}
