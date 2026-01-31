/**
 * Parses a text command for metronome BPM.
 * Examples: "120 bpm", "90", "metronome 100", "60 beats per minute"
 */
const BPM_PATTERNS = [
  /\b(\d+)\s*bpm\b/i,
  /\bmetronome\s+(\d+)/i,
  /\b(\d+)\s*beats?\s*(?:per\s*minute)?/i,
  /\b(\d+)\s*$/,
  /^(\d+)\s*$/,
];

export function parseMetronomeBpm(text: string): number | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  for (const pattern of BPM_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const bpm = parseInt(match[1], 10);
      if (bpm >= 40 && bpm <= 240) return bpm;
    }
  }

  // Try parsing a bare number
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 40 && num <= 240) return num;

  return null;
}
