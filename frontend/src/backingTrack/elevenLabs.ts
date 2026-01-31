/**
 * ElevenLabs Music API client.
 * Composes instrumental backing tracks from a text prompt.
 * API: https://elevenlabs.io/docs/api-reference/music/compose
 */

import type { BackingTrackSpec } from './types';

/** API constraints – applied to every request regardless of input. */
const API = {
  /** music_length_ms: API minimum 3000 */
  MIN_DURATION_MS: 3_000,
  /** When 4 bars exceeds this, use 2 bars instead (keeps loops bar-aligned at low BPM). */
  BAR_SELECTION_THRESHOLD_MS: 10_000,
  /** If true, output is guaranteed instrumental (no vocals) */
  FORCE_INSTRUMENTAL: true,
  /** ElevenLabs model ID */
  MODEL_ID: 'music_v1' as const,
  /** Output format: codec_sample_rate_bitrate */
  OUTPUT_FORMAT: 'mp3_44100_128',
} as const;

const BEATS_PER_BAR = 4;
const MS_PER_MINUTE = 60_000;

/** Prompt suffix appended to every request – keeps output as a backing track. */
const PROMPT_SUFFIX =
  'Full backing: chords, bass, pads, and percussion. No solos, no lead lines, no melodic leads. ' +
  'Natural, organic instruments only—acoustic, real instruments; no synths, no electronic or synthetic sounds. Instrumental only, no vocals. ' +
  'Must loop perfectly: the very last moment must connect seamlessly to the very first—no fade out, no tail. ' +
  'Each loop must have a musical resolve: the phrase should resolve harmonically so it feels complete and leads naturally back to the start. ' +
  'Constant energy throughout, no intro, no outro, no narrative progression. Use at least 4 chord changes in the loop.';

/** Loop length in ms and bar count derived from BPM. Uses 8, 4, or 2 bars. */
function getLoopLength(spec: BackingTrackSpec): { ms: number; bars: number } {
  const bpm = spec.bpm ?? 90;
  // Duration for N bars = N * 4 beats * (60000 ms/min / bpm)
  const twoBarMs = Math.round((2 * BEATS_PER_BAR * MS_PER_MINUTE) / bpm);
  const fourBarMs = Math.round((4 * BEATS_PER_BAR * MS_PER_MINUTE) / bpm);
  const eightBarMs = Math.round((8 * BEATS_PER_BAR * MS_PER_MINUTE) / bpm);

  if (eightBarMs <= API.BAR_SELECTION_THRESHOLD_MS) {
    return { ms: eightBarMs, bars: 8 };
  }
  if (fourBarMs <= API.BAR_SELECTION_THRESHOLD_MS) {
    return { ms: fourBarMs, bars: 4 };
  }
  // Low BPM: 4 bars would be too long, use 2 bars (e.g. 60 BPM → 2 bars ≈ 8 s)
  return { ms: twoBarMs, bars: 2 };
}

function buildPrompt(spec: BackingTrackSpec, bars: number): string {
  const parts: string[] = [];
  if (spec.chords?.length) {
    parts.push(`Chord progression: ${spec.chords.join(' - ')}.`);
  }
  if (spec.bpm) {
    parts.push(`${spec.bpm} BPM.`);
  }
  parts.push(`Exactly ${bars} bars.`);
  if (spec.style) {
    parts.push(`${spec.style} style.`);
  }
  parts.push(PROMPT_SUFFIX);
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
  const { ms: musicLengthMs, bars } = getLoopLength(spec);
  const prompt = buildPrompt(spec, bars);
  const clampedMs = Math.max(API.MIN_DURATION_MS, musicLengthMs);

  const url = `https://api.elevenlabs.io/v1/music?output_format=${API.OUTPUT_FORMAT}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: clampedMs,
      force_instrumental: API.FORCE_INSTRUMENTAL,
      model_id: API.MODEL_ID,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs music API error ${response.status}: ${errText}`);
  }

  return response.arrayBuffer();
}
