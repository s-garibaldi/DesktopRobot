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
  playUri: (uri: string, positionMs?: number, queueUris?: string[]) => Promise<boolean>;
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
  /** Queue = upcoming songs only. Currently playing is in nowPlayingItem. */
  private items: QueueItem[] = [];
  private nowPlayingItem: QueueItem | null = null;
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
      currentIndex: -1,
    };
  }

  getNowPlaying(): NowPlaying | null {
    if (!this.nowPlayingItem) return null;
    return {
      item: this.nowPlayingItem,
      progressMs: 0,
      durationMs: this.nowPlayingItem.durationMs ?? 0,
    };
  }

  getPlaybackStatus(): PlaybackStatus {
    return this.playbackStatus;
  }

  /** Update progress/duration from Spotify poll (UI only; does not change queue) */
  updateProgress(progressMs: number, durationMs: number): void {
    if (!this.nowPlayingItem) return;
    this.emit({
      type: 'NOW_PLAYING',
      nowPlaying: {
        item: this.nowPlayingItem,
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
    this.items.splice(0, 0, full);
    this.notifyQueue();
  }

  removeAt(index: number): boolean {
    if (index < 0 || index >= this.items.length) return false;
    this.items.splice(index, 1);
    this.notifyQueue();
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
    this.notifyQueue();
    return true;
  }

  clear(): void {
    this.items = [];
    this.nowPlayingItem = null;
    this.playbackStatus = 'stopped';
    this.notifyQueue();
    this.notifyNowPlaying();
  }

  async next(): Promise<boolean> {
    if (this.items.length === 0) {
      this.nowPlayingItem = null;
      this.playbackStatus = 'stopped';
      if (this.adapter) await this.adapter.pause();
      this.notifyQueue();
      this.notifyNowPlaying();
      return false;
    }
    const item = this.items[0];
    this.items.splice(0, 1);
    this.nowPlayingItem = item;
    this.playbackStatus = 'playing';
    this.notifyQueue();
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
    if (!this.nowPlayingItem || !this.adapter) return false;
    this.playbackStatus = 'playing';
    this.notifyNowPlaying();
    await this.adapter.playUri(this.nowPlayingItem.uri, 0);
    return true;
  }

  async playIndex(index: number): Promise<boolean> {
    if (index < 0) return false;
    if (!this.adapter) {
      console.warn('[MusicController] playIndex failed: no playback adapter (Spotify not connected?)');
      return false;
    }
    if (index >= this.items.length) {
      if (index === 0 && this.nowPlayingItem && this.playbackStatus === 'paused') {
        this.playbackStatus = 'playing';
        this.notifyNowPlaying();
        await this.adapter.resume();
        return true;
      }
      return false;
    }
    const item = this.items[index];
    this.items.splice(index, 1);
    const queueUris = this.items.map((i) => i.uri);
    this.nowPlayingItem = item;
    this.playbackStatus = 'playing';
    this.notifyQueue();
    this.notifyNowPlaying();
    const ok = await this.adapter.playUri(item.uri, 0, queueUris);
    if (!ok) {
      this.items.splice(index, 0, item);
      this.nowPlayingItem = null;
      this.playbackStatus = 'stopped';
      this.notifyQueue();
      this.notifyNowPlaying();
      return false;
    }
    return true;
  }

  /** Skip to a specific queue item by reference. More robust than playIndex when the queue
   * may have changed (e.g. after adding songs or track-auto-advance) since we find by id. */
  async playItem(item: QueueItem): Promise<boolean> {
    const index = this.items.findIndex((i) => i.id === item.id || i.uri === item.uri);
    if (index < 0) return false;
    return this.playIndex(index);
  }

  async playUri(uri: string, item?: Partial<QueueItem>): Promise<boolean> {
    if (!this.adapter) {
      console.warn('[MusicController] playUri failed: no playback adapter (Spotify not connected?)');
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
    this.items = [];
    this.nowPlayingItem = queueItem;
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
    if (!this.adapter) {
      console.warn('[MusicController] addAndPlay failed: no playback adapter (Spotify not connected?)');
      return false;
    }
    const [first, ...rest] = items;
    this.nowPlayingItem = first;
    this.items = rest;
    this.playbackStatus = 'playing';
    this.notifyQueue();
    this.notifyNowPlaying();
    const ok = await this.adapter.playUri(first.uri, 0, rest.map((i) => i.uri));
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
