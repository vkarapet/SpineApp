import type { RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isTimerEvent } from '../../types/assessment';
import { TUG_NORMAL_THRESHOLD_S, TUG_HIGH_RISK_THRESHOLD_S } from '../../constants';
import type { TugClinicalBand, TugPhase, PhaseTransition } from './tug-types';

export function computeTugMetrics(rawData: RawSessionData): ComputedMetrics {
  const timerEvents = rawData.filter(isTimerEvent);

  const startEvent = timerEvents.find((e) => e.event === 'start');
  const stopEvent = timerEvents.find((e) => e.event === 'stop');

  if (!startEvent || !stopEvent) {
    return { duration_actual_ms: 0, tug_time_s: 0 };
  }

  const durationMs = stopEvent.t - startEvent.t;
  const timeS = Math.round((durationMs / 1000) * 10) / 10;

  return {
    duration_actual_ms: Math.round(durationMs),
    tug_time_s: timeS,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function cv(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return 0;
  return sd(xs) / m;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeTugSensorMetrics(
  rawData: RawSessionData,
  phaseTransitions: PhaseTransition[],
  phaseData: Map<TugPhase, {
    steps: number;
    distance: number;
    strideLengths: number[];
    stepIntervals: number[];
  }>,
): ComputedMetrics {
  const base = computeTugMetrics(rawData);

  // Phase durations from transitions
  const phaseDurations: Partial<Record<TugPhase, number>> = {};
  for (let i = 0; i < phaseTransitions.length - 1; i++) {
    const current = phaseTransitions[i];
    const next = phaseTransitions[i + 1];
    phaseDurations[current.to] = next.t - current.t;
  }
  if (phaseTransitions.length > 0) {
    const last = phaseTransitions[phaseTransitions.length - 1];
    if (last.to !== 'complete') {
      phaseDurations[last.to] = base.duration_actual_ms - last.t;
    }
  }

  const walkOut = phaseData.get('walking_out');
  const walkOutDurationMs = phaseDurations.walking_out ?? 0;
  const walkOutDurationS = walkOutDurationMs / 1000;

  const strides = walkOut?.strideLengths ?? [];
  const stepIntervals = walkOut?.stepIntervals ?? [];
  const walkOutSteps = walkOut?.steps ?? 0;
  const walkOutDistance = walkOut?.distance ?? 0;

  const avgStride = mean(strides);
  const strideCv = cv(strides);
  const avgStepTimeMs = mean(stepIntervals);
  const stepTimeCv = cv(stepIntervals);
  const cadenceSpm = walkOutDurationS > 0 ? (walkOutSteps * 60) / walkOutDurationS : 0;
  const gaitSpeed = walkOutDurationS > 0 ? walkOutDistance / walkOutDurationS : 0;

  return {
    ...base,
    standup_duration_ms: Math.round(phaseDurations.standing_up ?? 0),
    walk_out_steps: walkOutSteps,
    walk_out_distance_m: round2(walkOutDistance),
    walk_out_duration_ms: Math.round(walkOutDurationMs),
    walk_out_avg_stride_length_m: round2(avgStride),
    walk_out_stride_cv: round3(strideCv),
    walk_out_cadence_spm: round2(cadenceSpm),
    walk_out_avg_step_time_ms: Math.round(avgStepTimeMs),
    walk_out_step_time_cv: round3(stepTimeCv),
    walk_out_gait_speed_mps: round2(gaitSpeed),
  };
}

export function getClinicalBand(timeS: number): TugClinicalBand {
  if (timeS <= TUG_NORMAL_THRESHOLD_S) return 'normal';
  if (timeS <= TUG_HIGH_RISK_THRESHOLD_S) return 'moderate_risk';
  return 'high_risk';
}

export function getClinicalLabel(band: TugClinicalBand): string {
  switch (band) {
    case 'normal':
      return 'Normal mobility';
    case 'moderate_risk':
      return 'Moderate fall risk';
    case 'high_risk':
      return 'High fall risk';
  }
}
