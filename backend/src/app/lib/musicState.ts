/**
 * Shadow copy of frontend MusicController state.
 * Frontend posts music_state_update; tools read from here.
 */
export interface MusicQueueItem {
  id: string;
  title: string;
  artist: string;
  uri: string;
  albumArtUrl?: string;
}

export interface MusicState {
  queue: MusicQueueItem[];
  currentIndex: number;
  nowPlaying: { title: string; artist: string } | null;
  status: 'playing' | 'paused' | 'stopped';
}

let state: MusicState = {
  queue: [],
  currentIndex: -1,
  nowPlaying: null,
  status: 'stopped',
};

export function getMusicState(): MusicState {
  return { ...state };
}

export function setMusicState(update: Partial<MusicState>): void {
  state = { ...state, ...update };
}
