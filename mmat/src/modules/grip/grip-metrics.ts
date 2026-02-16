import type { RawTapEvent, ComputedMetrics } from '../../types/assessment';
import { GRIP_MIN_FINGERS } from '../../constants';

interface ReconstructedCycle {
  gripTimestamp: number;
  fingerCount: number;
}

export function computeGripMetrics(
  rawData: RawTapEvent[],
  durationMs: number,
): ComputedMetrics {
  // Reconstruct grip cycles from raw pointer events
  const cycles = reconstructCycles(rawData);

  const gripCount = cycles.length;
  const durationSec = durationMs / 1000;
  const frequencyHz = durationSec > 0 ? gripCount / durationSec : 0;

  // Rhythm CV (coefficient of variation of inter-grip intervals)
  let rhythmCv = 0;
  if (cycles.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < cycles.length; i++) {
      intervals.push(cycles[i].gripTimestamp - cycles[i - 1].gripTimestamp);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0) {
      const variance =
        intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      const stddev = Math.sqrt(variance);
      rhythmCv = stddev / mean;
    }
  }

  return {
    tap_count: gripCount,
    frequency_hz: Math.round(frequencyHz * 100) / 100,
    rhythm_cv: Math.round(rhythmCv * 10000) / 10000,
    accuracy_mean_dist_px: 0,
    accuracy_pct_in_target: 0,
    duration_actual_ms: Math.round(durationMs),
    grip_count: gripCount,
  };
}

function reconstructCycles(rawData: RawTapEvent[]): ReconstructedCycle[] {
  const cycles: ReconstructedCycle[] = [];
  const activePointers = new Set<number>();
  let gripAchieved = false;
  let currentGripTimestamp = 0;
  let currentFingerCount = 0;

  for (const event of rawData) {
    if (event.rejected) continue;

    if (event.type === 'start') {
      activePointers.add(event.touch_id);

      if (activePointers.size >= GRIP_MIN_FINGERS && !gripAchieved) {
        gripAchieved = true;
        currentGripTimestamp = event.t;
        currentFingerCount = activePointers.size;
      }
    } else if (event.type === 'end') {
      activePointers.delete(event.touch_id);

      if (activePointers.size === 0 && gripAchieved) {
        cycles.push({
          gripTimestamp: currentGripTimestamp,
          fingerCount: currentFingerCount,
        });
        gripAchieved = false;
      }
    }
  }

  return cycles;
}

export function getRhythmLabel(cv: number): string {
  if (cv < 0.1) return 'Good';
  if (cv <= 0.25) return 'Fair';
  return 'Variable';
}

