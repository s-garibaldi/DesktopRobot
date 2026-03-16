/**
 * Simple store for metronome BPM and paused state.
 * Read by the metronome emotion for blink timing and play/pause.
 */
let metronomeBpm = 60;
let metronomePaused = false;

export function getMetronomeBpm(): number {
  return metronomeBpm;
}

export function setMetronomeBpm(bpm: number): void {
  metronomeBpm = Math.max(40, Math.min(240, Math.round(bpm)));
}

export function getMetronomePaused(): boolean {
  return metronomePaused;
}

export function setMetronomePaused(paused: boolean): void {
  metronomePaused = paused;
}
