/**
 * Music and face event emission for MusicController.
 * FACE_EVENT: stable events for face/emotion (GROOVING, NEUTRAL).
 * MUSIC_EVENT: debug logs for queue/playback state.
 */

import type { MusicQueue, NowPlaying, PlaybackStatus } from './types';

const NEUTRAL_AFTER_PAUSED_MS = 5000;
let neutralTimeout: ReturnType<typeof setTimeout> | null = null;

function emitFaceEvent(state: 'GROOVING' | 'NEUTRAL'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('FACE_EVENT', {
      detail: { state },
    })
  );
}

function emitMusicEvent(type: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const event = { type, ...payload };
  window.dispatchEvent(
    new CustomEvent('MUSIC_EVENT', {
      detail: event,
    })
  );
  console.log('[MUSIC_EVENT]', event);
}

export function handleMusicControllerEvent(event: {
  type: string;
  queue?: MusicQueue;
  nowPlaying?: NowPlaying | null;
  status?: PlaybackStatus;
}): void {
  switch (event.type) {
    case 'QUEUE_UPDATED':
      if (event.queue) {
        emitMusicEvent('QUEUE_UPDATED', {
          count: event.queue.items.length,
          currentIndex: event.queue.currentIndex,
        });
      }
      break;

    case 'NOW_PLAYING':
    case 'PLAYBACK_STATUS':
      if (event.status === 'playing') {
        if (neutralTimeout) {
          clearTimeout(neutralTimeout);
          neutralTimeout = null;
        }
        emitFaceEvent('GROOVING');
        if (event.nowPlaying) {
          emitMusicEvent('NOW_PLAYING', {
            title: event.nowPlaying.item.title,
            artist: event.nowPlaying.item.artist,
            progressMs: event.nowPlaying.progressMs,
            durationMs: event.nowPlaying.durationMs,
          });
        }
      } else if (event.status === 'paused') {
        if (neutralTimeout) clearTimeout(neutralTimeout);
        neutralTimeout = setTimeout(() => {
          neutralTimeout = null;
          emitFaceEvent('NEUTRAL');
        }, NEUTRAL_AFTER_PAUSED_MS);
        emitMusicEvent('PAUSED', {});
      } else if (event.status === 'stopped') {
        if (neutralTimeout) {
          clearTimeout(neutralTimeout);
          neutralTimeout = null;
        }
        emitFaceEvent('NEUTRAL');
        emitMusicEvent('STOPPED', {});
      }
      break;

    default:
      break;
  }
}
