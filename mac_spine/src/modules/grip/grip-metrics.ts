import type { GripTouchRecord, RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isGripTouchRecord } from '../../types/assessment';
import { GRIP_MIN_FINGERS } from '../../constants';

/**
 * Maximum gap (ms) between consecutive touch starts within the same
 * grip attempt. Touches starting within this window of each other
 * are grouped into the same cycle. This accounts for the fact that
 * fingers rarely land at exactly the same millisecond.
 */
const CYCLE_GAP_MS = 200;

/**
 * Post-process raw paired touches into labeled GripTouchRecords.
 *
 * Groups touches into cycles based on proximity of start times
 * (within CYCLE_GAP_MS of each other). A cycle is a grip if it
 * contains GRIP_MIN_FINGERS or more touches. This approach is
 * robust to touchcancel events which artificially shorten end times.
 */
export function labelGripCycles(
  rawTouches: Array<{ touch_id: number; start_t: number; start_x: number; start_y: number; end_t: number; end_x: number; end_y: number }>,
): GripTouchRecord[] {
  if (rawTouches.length === 0) return [];

  // Sort by start time
  const sorted = rawTouches.map((t, i) => ({ ...t, origIndex: i }));
  sorted.sort((a, b) => a.start_t - b.start_t);

  // Group into cycles: consecutive touches within CYCLE_GAP_MS
  const cycles: Array<{ indices: number[]; isGrip: boolean }> = [];
  let currentCycle: number[] = [sorted[0].origIndex];
  let lastStartT = sorted[0].start_t;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_t - lastStartT <= CYCLE_GAP_MS) {
      // Still within the same cycle
      currentCycle.push(sorted[i].origIndex);
    } else {
      // Gap too large — finalize previous cycle, start new one
      cycles.push({
        indices: currentCycle,
        isGrip: currentCycle.length >= GRIP_MIN_FINGERS,
      });
      currentCycle = [sorted[i].origIndex];
    }
    lastStartT = sorted[i].start_t;
  }
  // Finalize last cycle
  cycles.push({
    indices: currentCycle,
    isGrip: currentCycle.length >= GRIP_MIN_FINGERS,
  });

  // Assign grip numbers (1-indexed, only for grip cycles)
  const labels = new Map<number, { is_grip: boolean; grip_number: number | null }>();
  let gripNumber = 0;

  for (const cycle of cycles) {
    if (cycle.isGrip) gripNumber++;
    for (const idx of cycle.indices) {
      labels.set(idx, {
        is_grip: cycle.isGrip,
        grip_number: cycle.isGrip ? gripNumber : null,
      });
    }
  }

  // Build final records in original order
  return rawTouches.map((raw, i) => {
    const label = labels.get(i) ?? { is_grip: false, grip_number: null };
    return {
      touch_id: raw.touch_id,
      start_t: raw.start_t,
      start_x: raw.start_x,
      start_y: raw.start_y,
      end_t: raw.end_t,
      end_x: raw.end_x,
      end_y: raw.end_y,
      is_grip: label.is_grip,
      grip_number: label.grip_number,
    };
  });
}

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
