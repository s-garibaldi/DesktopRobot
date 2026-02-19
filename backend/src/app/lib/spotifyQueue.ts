/**
 * In-memory Spotify queue (library of songs to play).
 * Each item: { name: string, artist: string }
 * Backend owns this; tools add/remove/reorder/clear. Queue controller plays next when track ends.
 */
import { postClientAction, postPlaySpotifyTrack } from './bridge';

/** Same search+parse logic as play_spotify_track tool - ensures identical fetch URL and response handling. */
export async function searchSpotifyTrack(
  query: string
): Promise<{ uri: string; trackName: string; artists: string } | null> {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const url = base ? `${base}/api/spotify/search` : '/api/spotify/search';
    const res = await fetch(
      `${url}?q=${encodeURIComponent(query)}&type=track&limit=5`,
      { mode: 'cors' }
    );
    const data = await res.json();
    if (!data?.success || !data?.tracks?.items?.length) return null;
    const track = data.tracks.items[0];
    const uri = `spotify:track:${track.id}`;
    const trackName = track.name ?? '';
    const artists = Array.isArray(track.artists)
      ? track.artists.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
      : '';
    return { uri, trackName, artists };
  } catch {
    return null;
  }
}

export interface QueueItem {
  name: string;
  artist: string;
  /** Stored when adding so we don't need to re-search on play (avoids search failures for mid-queue adds). */
  uri?: string;
}

const queue: QueueItem[] = [];
let isSpotifyPlaying = false;

export function getQueue(): QueueItem[] {
  return [...queue];
}

export function addToQueue(items: QueueItem | QueueItem[]): void {
  const arr = Array.isArray(items) ? items : [items];
  for (const item of arr) {
    if (item?.name && typeof item.name === 'string') {
      queue.push({
        name: item.name.trim(),
        artist: (item.artist ?? '').trim(),
        uri: typeof item.uri === 'string' && item.uri.startsWith('spotify:track:') ? item.uri : undefined,
      });
    }
  }
}

export function removeFromQueue(indexOrName: number | string, artist?: string): boolean {
  if (typeof indexOrName === 'number') {
    const i = indexOrName - 1; // 1-based
    if (i >= 0 && i < queue.length) {
      queue.splice(i, 1);
      return true;
    }
    return false;
  }
  const q = (indexOrName ?? '').trim().toLowerCase();
  if (!q) return false;
  const idx = queue.findIndex(
    (item) =>
      item.name.toLowerCase().includes(q) &&
      (!artist || !artist.trim() || item.artist.toLowerCase().includes(artist.trim().toLowerCase()))
  );
  if (idx >= 0) {
    queue.splice(idx, 1);
    return true;
  }
  return false;
}

export function reorderQueue(
  mode: 'move_to_front' | 'swap' | 'new_order',
  a: number,
  b?: number,
  newOrder?: number[]
): boolean {
  if (mode === 'move_to_front' && a >= 1 && a <= queue.length) {
    const idx = a - 1;
    const [item] = queue.splice(idx, 1);
    queue.unshift(item);
    return true;
  }
  if (mode === 'swap' && a >= 1 && b !== undefined && b >= 1 && a <= queue.length && b <= queue.length) {
    const i = a - 1;
    const j = b - 1;
    [queue[i], queue[j]] = [queue[j], queue[i]];
    return true;
  }
  if (mode === 'new_order' && Array.isArray(newOrder) && newOrder.length === queue.length) {
    const indices = newOrder.map((n) => Math.floor(Number(n)) - 1);
    if (indices.some((i) => i < 0 || i >= queue.length)) return false;
    const reordered = indices.map((i) => queue[i]);
    queue.length = 0;
    queue.push(...reordered);
    return true;
  }
  return false;
}

export function clearQueue(): void {
  queue.length = 0;
}

/**
 * Called when a track starts playing - remove the front queue item.
 * We always play in FIFO order (queue[0]), so the track that just started is the front item.
 * Removes by position to avoid fuzzy-matching bugs (e.g. "Song" incorrectly matching "Song 2",
 * which could remove a newly added song instead of the one that just finished).
 */
export function onTrackStarted(_trackName: string, _artists: string): void {
  if (queue.length > 0) {
    queue.shift();
  }
}

export function setIsSpotifyPlaying(playing: boolean): void {
  isSpotifyPlaying = playing;
}

export function getIsSpotifyPlaying(): boolean {
  return isSpotifyPlaying;
}

/**
 * Play the next song in the queue (use stored URI if available, else search).
 * Called when track ends and queue has items, or when items are added and nothing is playing.
 */
export async function playNextFromQueue(): Promise<boolean> {
  if (queue.length === 0) return false;
  const first = queue[0];
  let uri = first.uri;
  let trackName = first.name;
  let artists = first.artist ?? '';
  if (!uri || !uri.startsWith('spotify:track:')) {
    const query = first.artist ? `${first.name} ${first.artist}` : first.name;
    const result = await searchSpotifyTrack(query);
    if (!result) {
      queue.shift();
      return playNextFromQueue();
    }
    uri = result.uri;
    trackName = result.trackName;
    artists = result.artists;
  }
  isSpotifyPlaying = true;
  postPlaySpotifyTrack({ uri, trackName, artists });
  return true;
}

/**
 * Called when a track ends - play next or stop Spotify if queue is empty.
 */
export async function onTrackEnded(): Promise<void> {
  if (queue.length > 0) {
    await playNextFromQueue();
  } else {
    isSpotifyPlaying = false;
    postClientAction('spotify_stop');
  }
}
