/**
 * Music controller data types.
 * App owns queue state; Spotify is playback device only.
 */

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  uri: string;
  albumArtUrl?: string;
  /** Duration in ms, from search/add – used when Spotify doesn't return it yet */
  durationMs?: number;
}

export interface MusicQueue {
  items: QueueItem[];
  currentIndex: number;
}

export interface NowPlaying {
  item: QueueItem;
  progressMs: number;
  durationMs: number;
}

export type PlaybackStatus = 'playing' | 'paused' | 'stopped';

export interface SpotifyPlaybackState {
  trackUri: string | null;
  progressMs: number;
  durationMs: number;
  paused: boolean;
}
