import type { GripTouchRecord, RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isGripTouchRecord } from '../../types/assessment';
import { GRIP_MIN_FINGERS } from '../../constants';

/**
 * Post-process raw paired touches into labeled GripTouchRecords.
 *
 * A grip cycle is a group of touches where at least GRIP_MIN_FINGERS
 * were on screen simultaneously. Two touches overlap if one starts
 * before the other ends (start_a < end_b AND start_b < end_a).
 *
 * Touches are grouped into cycles by connectivity: if touch A overlaps
 * touch B and touch B overlaps touch C, all three are in the same cycle.
 * A cycle is a grip if it contains GRIP_MIN_FINGERS or more touches.
 *
 * To handle touchcancel (which artificially shortens end times), each
 * touch's effective end time is extended to at least the latest start
 * time among all touches that overlap with it. This ensures that if
 * finger C starts while A and B are physically on screen (even if A/B
 * were cancelled), they're recognized as simultaneous.
 *
 * A small tolerance (CANCEL_TOLERANCE_MS) bridges the gap between a
 * touchcancel end and the next touchstart — the browser may cancel
 * existing touches just milliseconds before registering a new one,
 * even though all fingers are physically on screen simultaneously.
 */

/** Tolerance (ms) for bridging touchcancel gaps. */
const CANCEL_TOLERANCE_MS = 50;

export function labelGripCycles(
  rawTouches: Array<{ touch_id: number; start_t: number; start_x: number; start_y: number; end_t: number; end_x: number; end_y: number }>,
): GripTouchRecord[] {
  if (rawTouches.length === 0) return [];

  const n = rawTouches.length;

  // Compute effective end times: extend each touch's end_t to account
  // for touchcancel. Add tolerance to bridge cancel→start gaps, then
  // iteratively extend overlapping touches until stable.
  const effectiveEnd = rawTouches.map(t => t.end_t + CANCEL_TOLERANCE_MS);

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const aStart = rawTouches[i].start_t;
        const bStart = rawTouches[j].start_t;
        const overlaps = aStart < effectiveEnd[j] && bStart < effectiveEnd[i];
        if (overlaps) {
          const maxEnd = Math.max(effectiveEnd[i], effectiveEnd[j]);
          if (effectiveEnd[i] < maxEnd) { effectiveEnd[i] = maxEnd; changed = true; }
          if (effectiveEnd[j] < maxEnd) { effectiveEnd[j] = maxEnd; changed = true; }
        }
      }
    }
  }

  // Build overlap graph and find connected components (cycles)
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const overlaps =
        rawTouches[i].start_t < effectiveEnd[j] &&
        rawTouches[j].start_t < effectiveEnd[i];
      if (overlaps) union(i, j);
    }
  }

  // Group indices by component
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!components.has(root)) components.set(root, []);
    components.get(root)!.push(i);
  }

  // Sort cycles by earliest start time, assign grip numbers
  const cycles = Array.from(components.values()).sort(
    (a, b) => Math.min(...a.map(i => rawTouches[i].start_t)) -
              Math.min(...b.map(i => rawTouches[i].start_t)),
  );

  const labels = new Map<number, { is_grip: boolean; grip_number: number | null }>();
  let gripNumber = 0;

  for (const cycle of cycles) {
    const isGrip = cycle.length >= GRIP_MIN_FINGERS;
    if (isGrip) gripNumber++;
    for (const idx of cycle) {
      labels.set(idx, {
        is_grip: isGrip,
        grip_number: isGrip ? gripNumber : null,
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
