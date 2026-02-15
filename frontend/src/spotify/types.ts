/** Track shape returned by backend /api/spotify/search and /api/spotify/track/[id] */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export interface SpotifySearchResult {
  success: boolean;
  tracks?: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
}

export interface SpotifyTrackResult {
  success: boolean;
  track?: SpotifyTrack;
  error?: string;
}

export interface SpotifyTokenResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}
