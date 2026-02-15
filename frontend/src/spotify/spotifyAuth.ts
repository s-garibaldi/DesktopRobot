/**
 * PKCE helpers for Spotify Authorization Code flow.
 * Used to get an access token for the Web Playback SDK (requires user login + Premium).
 */

const SPOTIFY_AUTH = 'https://accounts.spotify.com/authorize';

function generateRandom(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate code_verifier and code_challenge for PKCE. */
export async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandom(32);
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64UrlEncode(hash);
  return { codeVerifier, codeChallenge };
}

/** Build the Spotify authorization URL. Redirect the user here to log in. */
export function buildAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes?: string[];
}): string {
  const { clientId, redirectUri, codeChallenge, state = generateRandom(16), scopes } = options;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
  });
  if (scopes?.length) {
    params.set('scope', scopes.join(' '));
  }
  return `${SPOTIFY_AUTH}?${params.toString()}`;
}

/** Scopes needed for Web Playback SDK (streaming + user identity). */
export const SPOTIFY_PLAYBACK_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
];
