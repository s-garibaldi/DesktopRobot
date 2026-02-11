/**
 * Simple store for metronome BPM. Read by the metronome emotion for blink timing.
 */
let metronomeBpm = 60;

export function getMetronomeBpm(): number {
  return metronomeBpm;
}

export function setMetronomeBpm(bpm: number): void {
  metronomeBpm = Math.max(40, Math.min(240, Math.round(bpm)));
}
