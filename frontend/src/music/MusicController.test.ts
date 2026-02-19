/**
 * Unit tests for MusicController queue operations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
    musicController.clear();
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

  it('clear empties the queue', () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    musicController.clear();
    const q = musicController.getQueue();
    expect(q.items.length).toBe(0);
  });

  it('next advances currentIndex and plays', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    const ok = await musicController.next();
    expect(ok).toBe(true);
    const q = musicController.getQueue();
    expect(q.currentIndex).toBe(0);
  });

  it('previous decrements currentIndex', async () => {
    musicController.addToQueue({ title: 'A', artist: 'X', uri: 'spotify:track:1' });
    musicController.addToQueue({ title: 'B', artist: 'X', uri: 'spotify:track:2' });
    await musicController.playIndex(1);
    await musicController.previous();
    const q = musicController.getQueue();
    expect(q.currentIndex).toBe(0);
  });
});
