/**
 * Unit tests for MusicController queue operations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { musicController } from './MusicController';

const mockAdapter = {
  playUri: async () => true,
  pause: async () => {},
  resume: async () => {},
  seek: async () => {},
};

describe('MusicController queue operations', () => {
  beforeEach(() => {
    musicController.setPlaybackAdapter(mockAdapter);
    musicController.stop();
  });

  it('addToQueue adds items', () => {
    musicController.addToQueue({ title: 'Song A', artist: 'Artist A', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'Song B', artist: 'Artist B', uri: 'spotify:track:2' });
    const q = musicController.getQueue();
    expect(q.items.length).toBe(2);
    expect(q.items[0].title).toBe('Song A');
    expect(q.items[1].title).toBe('Song B');
  });

  it('addToQueue ignores invalid URIs', () => {
    musicController.addToQueue({ title: 'Bad', artist: 'X', uri: 'invalid' });
    expect(musicController.getQueue().items.length).toBe(0);
  });

  it('removeAt removes by index', () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    musicController.addToQueue({ title: 'C', artist: 'X', uri: 'spotify:track:3' });
    expect(musicController.removeAt(1)).toBe(true);
    const q = musicController.getQueue();
    expect(q.items.length).toBe(2);
    expect(q.items[0].title).toBe('A');
    expect(q.items[1].title).toBe('C');
  });

  it('removeAt returns false for invalid index', () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    expect(musicController.removeAt(-1)).toBe(false);
    expect(musicController.removeAt(5)).toBe(false);
    expect(musicController.getQueue().items.length).toBe(1);
  });

  it('move reorders items', () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    musicController.addToQueue({ title: 'C', artist: 'X', uri: 'spotify:track:3' });
    expect(musicController.move(2, 0)).toBe(true);
    const q = musicController.getQueue();
    expect(q.items[0].title).toBe('C');
    expect(q.items[1].title).toBe('A');
    expect(q.items[2].title).toBe('B');
  });

  it('move returns false for invalid indices', () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    expect(musicController.move(-1, 0)).toBe(false);
    expect(musicController.move(0, 5)).toBe(false);
    expect(musicController.move(0, 0)).toBe(false);
  });

  it('clearQueue empties the upcoming queue but keeps now playing intact', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    await musicController.next();
    musicController.clearQueue();
    const q = musicController.getQueue();
    expect(q.items.length).toBe(1);
    expect(q.currentIndex).toBe(0);
    expect(q.items[0]?.title).toBe('A');
    expect(musicController.getNowPlaying()?.item.title).toBe('A');
    expect(musicController.getPlaybackStatus()).toBe('playing');
  });

  it('next advances currentIndex without deleting the first queued song', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    const ok = await musicController.next();
    expect(ok).toBe(true);
    const np = musicController.getNowPlaying();
    const q = musicController.getQueue();
    expect(np?.item.title).toBe('A');
    expect(q.currentIndex).toBe(0);
    expect(q.items.map((item) => item.title)).toEqual(['A', 'B']);
  });

  it('addToQueueAndStartIfIdle appends without replacing an active song', async () => {
    const playUri = vi.fn(async () => true);
    musicController.setPlaybackAdapter({
      playUri,
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
    });

    await musicController.addAndPlay([
      { id: 'now', title: 'Now', artist: 'X', uri: 'spotify:track:now' },
      { id: 'queued', title: 'Queued', artist: 'X', uri: 'spotify:track:queued' },
    ]);

    playUri.mockClear();

    const ok = await musicController.addToQueueAndStartIfIdle([
      { id: 'later-1', title: 'Later 1', artist: 'Y', uri: 'spotify:track:later-1' },
      { id: 'later-2', title: 'Later 2', artist: 'Y', uri: 'spotify:track:later-2' },
    ]);

    expect(ok).toBe(true);
    expect(playUri).not.toHaveBeenCalled();
    expect(musicController.getNowPlaying()?.item.title).toBe('Now');
    expect(musicController.getQueue().currentIndex).toBe(0);
    expect(musicController.getQueue().items.map((item) => item.title)).toEqual(['Now', 'Queued', 'Later 1', 'Later 2']);
  });

  it('next starts the next queued song and preserves the remaining queue order', async () => {
    const playUri = vi.fn(async () => true);
    musicController.setPlaybackAdapter({
      playUri,
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
    });

    await musicController.addAndPlay([
      { id: 'now', title: 'Now', artist: 'X', uri: 'spotify:track:now' },
      { id: 'next', title: 'Next', artist: 'X', uri: 'spotify:track:next' },
      { id: 'later', title: 'Later', artist: 'X', uri: 'spotify:track:later' },
    ]);

    playUri.mockClear();

    const ok = await musicController.next();

    expect(ok).toBe(true);
    expect(playUri).toHaveBeenCalledWith('spotify:track:next', 0, ['spotify:track:later']);
    expect(musicController.getNowPlaying()?.item.title).toBe('Next');
    expect(musicController.getQueue().currentIndex).toBe(1);
    expect(musicController.getQueue().items.map((item) => item.title)).toEqual(['Now', 'Next', 'Later']);
  });

  it('coalesces duplicate next calls during the same track transition', async () => {
    let resolvePlay: ((value: boolean) => void) | undefined;
    const playUri = vi
      .fn<(...args: any[]) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePlay = resolve;
          })
      );
    musicController.setPlaybackAdapter({
      playUri,
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
    });

    await musicController.addAndPlay([
      { id: 'now', title: 'Now', artist: 'X', uri: 'spotify:track:now' },
      { id: 'next', title: 'Next', artist: 'X', uri: 'spotify:track:next' },
      { id: 'later', title: 'Later', artist: 'X', uri: 'spotify:track:later' },
    ]);

    playUri.mockClear();

    const firstSkip = musicController.next();
    const secondSkip = musicController.next();

    expect(playUri).toHaveBeenCalledTimes(1);
    expect(musicController.getNowPlaying()?.item.title).toBe('Next');
    expect(musicController.getQueue().currentIndex).toBe(1);
    expect(musicController.getQueue().items.map((item) => item.title)).toEqual(['Now', 'Next', 'Later']);

    expect(resolvePlay).toBeTypeOf('function');
    resolvePlay!(true);

    await expect(firstSkip).resolves.toBe(true);
    await expect(secondSkip).resolves.toBe(true);
    expect(playUri).toHaveBeenCalledTimes(1);
    expect(musicController.getNowPlaying()?.item.title).toBe('Next');
    expect(musicController.getQueue().currentIndex).toBe(1);
    expect(musicController.getQueue().items.map((item) => item.title)).toEqual(['Now', 'Next', 'Later']);
  });

  it('treats queue item 1 as the next song after the current track', async () => {
    await musicController.addAndPlay([
      { id: 'now', title: 'Now', artist: 'X', uri: 'spotify:track:now' },
      { id: 'next', title: 'Next', artist: 'X', uri: 'spotify:track:next' },
      { id: 'later', title: 'Later', artist: 'X', uri: 'spotify:track:later' },
    ]);

    const queueBeforeSkip = musicController.getQueue();
    expect(queueBeforeSkip.currentIndex).toBe(0);
    expect(queueBeforeSkip.items[1]?.title).toBe('Next');

    await musicController.next();

    expect(musicController.getNowPlaying()?.item.title).toBe('Next');
    expect(musicController.getQueue().currentIndex).toBe(1);
    expect(musicController.getQueue().items[1]?.title).toBe('Next');
    expect(musicController.getQueue().items[2]?.title).toBe('Later');
  });

  it('previous restarts current song', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    await musicController.playIndex(1);
    const ok = await musicController.previous();
    expect(ok).toBe(true);
    const np = musicController.getNowPlaying();
    expect(np?.item.title).toBe('B');
  });

  it('stop clears queue and now playing', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    await musicController.next();

    musicController.stop();

    expect(musicController.getQueue().items).toEqual([]);
    expect(musicController.getNowPlaying()).toBeNull();
    expect(musicController.getPlaybackStatus()).toBe('stopped');
  });

  it('restores previous state when playIndex playback fails', async () => {
    const playUri = vi
      .fn<(...args: any[]) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    musicController.setPlaybackAdapter({
      playUri,
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
    });

    await musicController.addAndPlay([
      { id: 'now', title: 'Now', artist: 'X', uri: 'spotify:track:now' },
      { id: 'next', title: 'Next', artist: 'X', uri: 'spotify:track:next' },
      { id: 'later', title: 'Later', artist: 'X', uri: 'spotify:track:later' },
    ]);

    const ok = await musicController.playIndex(1);

    expect(ok).toBe(false);
    expect(musicController.getNowPlaying()?.item.title).toBe('Now');
    expect(musicController.getQueue().currentIndex).toBe(0);
    expect(musicController.getQueue().items.map((item) => item.title)).toEqual(['Now', 'Next', 'Later']);
    expect(musicController.getPlaybackStatus()).toBe('playing');
  });
});
