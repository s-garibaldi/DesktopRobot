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
  spotify: {
    authState: 'connected' | 'not_connected' | 'expired' | 'restoring';
    deviceState: 'ready' | 'not_ready';
    canPlayback: boolean;
    reconnectRequired: boolean;
    message: string | null;
  };
}

let state: MusicState = {
  queue: [],
  currentIndex: -1,
  nowPlaying: null,
  status: 'stopped',
  spotify: {
    authState: 'not_connected',
    deviceState: 'not_ready',
    canPlayback: false,
    reconnectRequired: false,
    message: null,
  },
};

export function getMusicState(): MusicState {
  return { ...state };
}

export function setMusicState(update: Partial<MusicState>): void {
  state = { ...state, ...update };
}
