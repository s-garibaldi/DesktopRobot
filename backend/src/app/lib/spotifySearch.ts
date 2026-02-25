/**
 * Spotify search - used by AI tools to find tracks.
 * Returns track info for the frontend MusicController.
 */
/** Base URL for API calls when window is undefined (e.g. server/SSR context). */
const SERVER_API_BASE =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) ||
  (typeof process !== 'undefined' && process.env?.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  'http://localhost:3000';

export async function searchSpotifyTrack(
  query: string
): Promise<{ uri: string; trackName: string; artists: string; albumArtUrl?: string; durationMs?: number } | null> {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : SERVER_API_BASE;
    const url = `${base}/api/spotify/search`;
    const res = await fetch(
      `${url}?q=${encodeURIComponent(query)}&type=track&limit=5`,
      { mode: 'cors' }
    );
    const data = await res.json();
    if (!data?.success || !data?.tracks?.items?.length) return null;
    const track = data.tracks.items[0] as {
      id: string;
      name?: string;
      artists?: { name?: string }[];
      album?: { images?: { url: string }[] };
      duration_ms?: number;
    };
    const uri = `spotify:track:${track.id}`;
    const trackName = track.name ?? '';
    const artists = Array.isArray(track.artists)
      ? track.artists.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
      : '';
    const albumArtUrl = track.album?.images?.[0]?.url;
    const durationMs = typeof track.duration_ms === 'number' ? track.duration_ms : undefined;
    return { uri, trackName, artists, albumArtUrl, durationMs };
  } catch (e) {
    console.error('[spotifySearch] Search failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
