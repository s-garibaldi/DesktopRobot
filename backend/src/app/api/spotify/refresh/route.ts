import { NextRequest, NextResponse } from 'next/server';
import { refreshSpotifyToken } from '@/app/lib/spotify';

/**
 * POST /api/spotify/refresh
 * Body: { refresh_token: string }
 * Returns a new access_token so the user can stay logged in without re-authorizing.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refresh_token: refreshToken } = body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'refresh_token is required' },
        { status: 400 }
      );
    }

    const result = await refreshSpotifyToken(refreshToken);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Spotify refresh failed. Reconnect with Spotify.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      access_token: result.access_token,
      expires_in: result.expires_in,
      refresh_token: result.refresh_token,
    });
  } catch (e) {
    console.error('[Spotify refresh]', e);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
