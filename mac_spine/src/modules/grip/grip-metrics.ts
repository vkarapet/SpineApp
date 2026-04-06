import type { GripTouchRecord, RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isGripTouchRecord } from '../../types/assessment';
import { GRIP_MIN_FINGERS } from '../../constants';

/**
 * Post-process raw paired touches into labeled GripTouchRecords.
 * Reconstructs grip cycles by simulating the same logic used for
 * real-time UI: a grip is detected when GRIP_MIN_FINGERS are
 * simultaneously on screen, and a cycle completes on full release.
 *
 * This runs once at the end of the test, so grip_number assignment
 * is guaranteed to be consistent regardless of touchcancel timing.
 */
export function labelGripCycles(
  rawTouches: Array<{ touch_id: number; start_t: number; start_x: number; start_y: number; end_t: number; end_x: number; end_y: number }>,
): GripTouchRecord[] {
  if (rawTouches.length === 0) return [];

  // Build a timeline of start/end events, sorted by time
  interface TimelineEvent {
    t: number;
    type: 'start' | 'end';
    index: number; // index into rawTouches
  }

  const timeline: TimelineEvent[] = [];
  for (let i = 0; i < rawTouches.length; i++) {
    timeline.push({ t: rawTouches[i].start_t, type: 'start', index: i });
    timeline.push({ t: rawTouches[i].end_t, type: 'end', index: i });
  }
  // Sort by time, starts before ends at same time
  timeline.sort((a, b) => a.t - b.t || (a.type === 'start' ? -1 : 1));

  // Walk the timeline tracking active touches
  const activeIndices = new Set<number>();
  let gripAchieved = false;
  let gripNumber = 0;

  // Track which touches belong to the current cycle and whether it's a grip
  let currentCycleIndices = new Set<number>();
  let currentCycleIsGrip = false;

  // Final labels: index → { is_grip, grip_number }
  const labels = new Map<number, { is_grip: boolean; grip_number: number | null }>();

  for (const event of timeline) {
    if (event.type === 'start') {
      activeIndices.add(event.index);
      currentCycleIndices.add(event.index);

      if (activeIndices.size >= GRIP_MIN_FINGERS && !gripAchieved) {
        gripAchieved = true;
        currentCycleIsGrip = true;
      }
    } else {
      activeIndices.delete(event.index);

      // Full release — all fingers off screen
      if (activeIndices.size === 0) {
        if (gripAchieved) gripNumber++;

        // Label all touches in this cycle
        for (const idx of currentCycleIndices) {
          labels.set(idx, {
            is_grip: currentCycleIsGrip,
            grip_number: currentCycleIsGrip ? gripNumber : null,
          });
        }

        // Reset for next cycle
        gripAchieved = false;
        currentCycleIsGrip = false;
        currentCycleIndices = new Set();
      }
    }
  }

  // Handle any touches still in a cycle at the end (test ended mid-grip)
  if (currentCycleIndices.size > 0) {
    if (gripAchieved) gripNumber++;
    for (const idx of currentCycleIndices) {
      labels.set(idx, {
        is_grip: currentCycleIsGrip,
        grip_number: currentCycleIsGrip ? gripNumber : null,
      });
    }
  }

  // Build final records
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
