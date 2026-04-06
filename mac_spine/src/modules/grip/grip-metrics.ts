import type { RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isGripTouchRecord } from '../../types/assessment';

export function computeGripMetrics(
  rawData: RawSessionData,
  durationMs: number,
): ComputedMetrics {
  const records = rawData.filter(isGripTouchRecord);

  // Find unique grip numbers (excluding null = non-grip touches)
  const gripNumbers = new Set<number>();
  for (const r of records) {
    if (r.grip_number !== null) gripNumbers.add(r.grip_number);
  }

  const gripCount = gripNumbers.size;
  const durationSec = durationMs / 1000;
  const frequencyHz = durationSec > 0 ? gripCount / durationSec : 0;

  // Rhythm CV (coefficient of variation of inter-grip intervals)
  // Use the earliest start_t of each grip cycle as the grip timestamp
  let rhythmCv = 0;
  if (gripCount >= 2) {
    const gripTimestamps: number[] = [];
    for (const num of Array.from(gripNumbers).sort((a, b) => a - b)) {
      let earliest = Infinity;
      for (const r of records) {
        if (r.grip_number === num && r.start_t < earliest) {
          earliest = r.start_t;
        }
      }
      gripTimestamps.push(earliest);
    }

    const intervals: number[] = [];
    for (let i = 1; i < gripTimestamps.length; i++) {
      intervals.push(gripTimestamps[i] - gripTimestamps[i - 1]);
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

export function getRhythmLabel(cv: number): string {
  if (cv < 0.1) return 'Good';
  if (cv <= 0.25) return 'Fair';
  return 'Variable';
}
