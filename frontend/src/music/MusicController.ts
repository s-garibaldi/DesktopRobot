/**
 * MusicController - owns queue state (source of truth).
 * Spotify is treated as a playback device only.
 * All queue operations are local, deterministic, and unit-testable.
 */
import type { QueueItem, MusicQueue, NowPlaying, PlaybackStatus } from './types';

function generateId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type PlaybackAdapter = {
  playUri: (uri: string, positionMs?: number) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
};

export type MusicControllerListener = (event: MusicControllerEvent) => void;

export type MusicControllerEvent =
  | { type: 'QUEUE_UPDATED'; queue: MusicQueue }
  | { type: 'NOW_PLAYING'; nowPlaying: NowPlaying | null; status: PlaybackStatus }
  | { type: 'PLAYBACK_STATUS'; status: PlaybackStatus };

class MusicControllerImpl {
  private items: QueueItem[] = [];
  private currentIndex = -1;
  private playbackStatus: PlaybackStatus = 'stopped';
  private adapter: PlaybackAdapter | null = null;
  private listeners: Set<MusicControllerListener> = new Set();

  setPlaybackAdapter(adapter: PlaybackAdapter | null): void {
    this.adapter = adapter;
  }

  subscribe(listener: MusicControllerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: MusicControllerEvent): void {
    this.listeners.forEach((l) => l(event));
  }

  private notifyQueue(): void {
    this.emit({
      type: 'QUEUE_UPDATED',
      queue: this.getQueue(),
    });
  }

  private notifyNowPlaying(): void {
    const np = this.getNowPlaying();
    this.emit({
      type: 'NOW_PLAYING',
      nowPlaying: np,
      status: this.playbackStatus,
    });
    this.emit({ type: 'PLAYBACK_STATUS', status: this.playbackStatus });
  }

  getQueue(): MusicQueue {
    return {
      items: [...this.items],
      currentIndex: this.currentIndex,
    };
  }

  getNowPlaying(): NowPlaying | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      return null;
    }
    const item = this.items[this.currentIndex];
    return {
      item,
      progressMs: 0,
      durationMs: 0,
    };
  }

  getPlaybackStatus(): PlaybackStatus {
    return this.playbackStatus;
  }

  /** Update progress/duration from Spotify poll (UI only; does not change queue) */
  updateProgress(progressMs: number, durationMs: number): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return;
    this.emit({
      type: 'NOW_PLAYING',
      nowPlaying: {
        item: this.items[this.currentIndex],
        progressMs,
        durationMs,
      },
      status: this.playbackStatus,
    });
  }

  addToQueue(item: Omit<QueueItem, 'id'> | QueueItem): void {
    const full: QueueItem = 'id' in item ? item : { ...item, id: generateId() };
    if (!full.uri?.startsWith('spotify:track:')) return;
    this.items.push(full);
    this.notifyQueue();
  }

  addNext(item: Omit<QueueItem, 'id'> | QueueItem): void {
    const full: QueueItem = 'id' in item ? item : { ...item, id: generateId() };
    if (!full.uri?.startsWith('spotify:track:')) return;
    const insertAt = this.currentIndex < 0 ? 0 : this.currentIndex + 1;
    this.items.splice(insertAt, 0, full);
    this.notifyQueue();
  }

  removeAt(index: number): boolean {
    if (index < 0 || index >= this.items.length) return false;
    this.items.splice(index, 1);
    if (this.currentIndex >= this.items.length) {
      this.currentIndex = Math.max(-1, this.items.length - 1);
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    }
    this.notifyQueue();
    this.notifyNowPlaying();
    return true;
  }

  move(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.items.length ||
      toIndex < 0 ||
      toIndex >= this.items.length ||
      fromIndex === toIndex
    ) {
      return false;
    }
    const [item] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, item);
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }
    this.notifyQueue();
    return true;
  }

  clear(): void {
    this.items = [];
    this.currentIndex = -1;
    this.playbackStatus = 'stopped';
    this.notifyQueue();
    this.notifyNowPlaying();
  }

  async next(): Promise<boolean> {
    if (this.items.length === 0) {
      this.playbackStatus = 'stopped';
      this.currentIndex = -1;
      this.notifyNowPlaying();
      return false;
    }
    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.items.length) {
      // No next song; stop playback and pause Spotify
      this.playbackStatus = 'stopped';
      if (this.adapter) await this.adapter.pause();
      this.notifyNowPlaying();
      return false;
    }
    this.currentIndex = nextIndex;
    const item = this.items[this.currentIndex];
    this.playbackStatus = 'playing';
    this.notifyNowPlaying();
    if (this.adapter) {
      const ok = await this.adapter.playUri(item.uri, 0);
      if (!ok) {
        this.playbackStatus = 'stopped';
        this.notifyNowPlaying();
        return false;
      }
    }
    return true;
  }

  async previous(): Promise<boolean> {
    if (this.items.length === 0) return false;
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    const item = this.items[this.currentIndex];
    this.playbackStatus = 'playing';
    this.notifyNowPlaying();
    if (this.adapter) {
      await this.adapter.playUri(item.uri, 0);
    }
    return true;
  }

  async playIndex(index: number): Promise<boolean> {
    if (index < 0 || index >= this.items.length) return false;
    if (!this.adapter) {
      return false;
    }
    this.currentIndex = index;
    const item = this.items[index];
    this.playbackStatus = 'playing';
    this.notifyNowPlaying();
    const ok = await this.adapter.playUri(item.uri, 0);
    if (!ok) {
      this.playbackStatus = 'stopped';
      this.notifyNowPlaying();
      return false;
    }
    return true;
  }

  async playUri(uri: string, item?: Partial<QueueItem>): Promise<boolean> {
    if (!this.adapter) {
      this.playbackStatus = 'stopped';
      return false;
    }
    const queueItem: QueueItem = item
      ? {
          id: item.id ?? generateId(),
          title: item.title ?? 'Unknown',
          artist: item.artist ?? '',
          uri,
          albumArtUrl: item.albumArtUrl,
        }
      : {
          id: generateId(),
          title: 'Unknown',
          artist: '',
          uri,
        };
    this.items = [queueItem];
    this.currentIndex = 0;
    this.playbackStatus = 'playing';
    this.notifyQueue();
    this.notifyNowPlaying();
    const ok = await this.adapter.playUri(uri, 0);
    if (!ok) {
      this.playbackStatus = 'stopped';
      this.notifyNowPlaying();
      return false;
    }
    return true;
  }

  async addAndPlay(items: QueueItem[]): Promise<boolean> {
    if (items.length === 0) return false;
    if (!this.adapter) return false;
    this.items = items;
    this.currentIndex = 0;
    this.playbackStatus = 'playing';
    this.notifyQueue();
    this.notifyNowPlaying();
    const ok = await this.adapter.playUri(items[0].uri, 0);
    if (!ok) {
      this.playbackStatus = 'stopped';
      this.notifyNowPlaying();
      return false;
    }
    return true;
  }

  async addToQueueAndStartIfIdle(items: QueueItem[]): Promise<boolean> {
    for (const it of items) {
      this.addToQueue(it);
    }
    if (this.playbackStatus === 'stopped' && this.items.length > 0) {
      return this.playIndex(0);
    }
    return true;
  }

  async pause(): Promise<void> {
    if (this.adapter) await this.adapter.pause();
    this.playbackStatus = 'paused';
    this.notifyNowPlaying();
  }

  async resume(): Promise<void> {
    if (this.adapter) await this.adapter.resume();
    this.playbackStatus = 'playing';
    this.notifyNowPlaying();
  }

  async seek(positionMs: number): Promise<void> {
    if (this.adapter) await this.adapter.seek(positionMs);
  }

  setPlaybackStatus(status: PlaybackStatus): void {
    this.playbackStatus = status;
    this.notifyNowPlaying();
  }

  /** Called when Spotify reports track ended - advance to next */
  async onTrackEnded(): Promise<void> {
    await this.next();
  }
}

export const musicController = new MusicControllerImpl();
