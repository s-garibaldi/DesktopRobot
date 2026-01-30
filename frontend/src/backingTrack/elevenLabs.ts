/**
 * ElevenLabs Music API client.
 * Composes instrumental backing tracks from a text prompt.
 * API: https://elevenlabs.io/docs/api-reference/music/compose
 */

import type { BackingTrackSpec } from './types';

/** One measure = 4 beats. Duration in ms = 4 * (60000 / bpm) = 240000 / bpm. */
const BEATS_PER_MEASURE = 4;
const MS_PER_MINUTE = 60_000;

/** ElevenLabs API requires music_length_ms >= 3000. We use 10 s minimum. */
const MIN_DURATION_MS = 10_000;
const MAX_DURATION_MS = 15_000;

function durationMsForOneMeasure(bpm: number): number {
  const ms = Math.round((BEATS_PER_MEASURE / bpm) * MS_PER_MINUTE);
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms));
}

function buildPrompt(spec: BackingTrackSpec): string {
  const parts: string[] = [];
  if (spec.chords?.length) {
    parts.push(`Chord progression: ${spec.chords.join(' - ')}.`);
  }
  if (spec.bpm) {
    parts.push(`${spec.bpm} BPM.`);
  }
  if (spec.style) {
    parts.push(`${spec.style} style.`);
  }
  parts.push(
    'Full backing: chords, bass, pads, and percussion. No solos, no lead lines, no melodic leads. ' +
      'Instrumental only, no vocals. Looping-friendly ending.'
  );
  return parts.join(' ');
}

/**
 * Generate backing track audio from ElevenLabs Music API.
 * Returns the audio as ArrayBuffer (mp3).
 */
export async function generateBackingTrack(
  spec: BackingTrackSpec,
  apiKey: string
): Promise<ArrayBuffer> {
  const prompt = buildPrompt(spec);
  const bpm = spec.bpm ?? 90;
  const musicLengthMs = durationMsForOneMeasure(bpm);

  const response = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: musicLengthMs,
      force_instrumental: true,
      model_id: 'music_v1',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs music API error ${response.status}: ${errText}`);
  }

  return response.arrayBuffer();
}
