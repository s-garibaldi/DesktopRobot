/**
 * Spotify Web API helpers.
 * - Client Credentials flow: for server-side metadata (search, track, album) — no user login.
 * - PKCE exchange: for frontend playback token (user must log in with Spotify Premium).
 */

const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

let cachedClientToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an access token using Client Credentials (server-only, for metadata).
 * Cached until expiry. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in env.
 */
export async function getSpotifyClientToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedClientToken && cachedClientToken.expiresAt > Date.now() + 60_000) {
    return cachedClientToken.token;
  }

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Spotify] Client token error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedClientToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedClientToken.token;
}

export type ExchangeResult =
  | { ok: true; access_token: string; refresh_token?: string; expires_in: number }
  | { ok: false; error: string };

/**
 * Exchange authorization code + code_verifier for access/refresh tokens (PKCE).
 * Call this from your backend when the frontend sends code + code_verifier after user login.
 */
export async function exchangeSpotifyCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<ExchangeResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Backend missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.' };
  }

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  const body = await res.text();
  if (!res.ok) {
    let message = `Spotify returned ${res.status}.`;
    try {
      const j = JSON.parse(body) as { error?: string; error_description?: string };
      if (j.error_description) message = j.error_description;
      else if (j.error) message = j.error;
    } catch {
      if (body) message = body.slice(0, 200);
    }
    console.error('[Spotify] Code exchange error:', res.status, body);
    return { ok: false, error: message };
  }

  const data = JSON.parse(body) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh an access token using a refresh token (user stays logged in).
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string } | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Spotify] Refresh token error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
  };
}

/**
 * Call Spotify Web API with Client Credentials token (for metadata).
 */
export async function spotifyFetch<T>(
  path: string,
  query?: Record<string, string>
): Promise<T | null> {
  const token = await getSpotifyClientToken();
  if (!token) return null;

  const url = new URL(`${SPOTIFY_API}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error('[Spotify] API error:', res.status, path, await res.text());
    return null;
  }

  return res.json() as Promise<T>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string; height: number; width: number }[] };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export interface SpotifySearchTracksResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}
