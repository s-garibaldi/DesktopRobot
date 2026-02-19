/**
 * Spotify search - used by AI tools to find tracks.
 * Returns track info for the frontend MusicController.
 */
export async function searchSpotifyTrack(
  query: string
): Promise<{ uri: string; trackName: string; artists: string; albumArtUrl?: string } | null> {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const url = base ? `${base}/api/spotify/search` : '/api/spotify/search';
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
    };
    const uri = `spotify:track:${track.id}`;
    const trackName = track.name ?? '';
    const artists = Array.isArray(track.artists)
      ? track.artists.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
      : '';
    const albumArtUrl = track.album?.images?.[0]?.url;
    return { uri, trackName, artists, albumArtUrl };
  } catch {
    return null;
  }
}
