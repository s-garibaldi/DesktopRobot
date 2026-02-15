import { useCallback, useState } from 'react';
import type { SpotifySearchResult, SpotifyTrack, SpotifyTrackResult } from './types';

/**
 * Hook to fetch Spotify metadata via your backend (no user login required).
 * Backend uses Client Credentials; set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
 */
export function useSpotifyMetadata(backendUrl: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTracks = useCallback(
    async (query: string, limit = 20): Promise<SpotifyTrack[]> => {
      if (!backendUrl || !query.trim()) return [];
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${backendUrl}/api/spotify/search?q=${encodeURIComponent(query.trim())}&type=track&limit=${limit}`,
          { mode: 'cors' }
        );
        const data: SpotifySearchResult = await res.json();
        if (!data.success || !data.tracks) {
          setError(data.error ?? 'Search failed');
          return [];
        }
        return data.tracks.items;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [backendUrl]
  );

  const getTrack = useCallback(
    async (trackId: string): Promise<SpotifyTrack | null> => {
      if (!backendUrl || !trackId.trim()) return null;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${backendUrl}/api/spotify/track/${encodeURIComponent(trackId.trim())}`,
          { mode: 'cors' }
        );
        const data: SpotifyTrackResult = await res.json();
        if (!data.success || !data.track) {
          setError(data.error ?? 'Track not found');
          return null;
        }
        return data.track;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [backendUrl]
  );

  return { searchTracks, getTrack, loading, error };
}
