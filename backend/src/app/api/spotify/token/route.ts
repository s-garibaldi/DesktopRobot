import { NextRequest, NextResponse } from 'next/server';
import { exchangeSpotifyCode } from '@/app/lib/spotify';

/**
 * POST /api/spotify/token
 * Body: { code: string, code_verifier: string, redirect_uri: string }
 * Exchanges authorization code (from PKCE login) for access + refresh tokens.
 * Use the access_token in the frontend with the Web Playback SDK.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body;

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json(
        { success: false, error: 'code, code_verifier, and redirect_uri are required' },
        { status: 400 }
      );
    }

    const result = await exchangeSpotifyCode(code, codeVerifier, redirectUri);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error.includes('Backend missing') ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (e) {
    console.error('[Spotify token]', e);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
