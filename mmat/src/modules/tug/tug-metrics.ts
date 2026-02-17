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

export function computeTugSensorMetrics(
  rawData: RawSessionData,
  phaseTransitions: PhaseTransition[],
  phaseData: Map<TugPhase, {
    steps: number;
    distance: number;
    strideLengths: number[];
    cumulativeYaw: number;
  }>,
): ComputedMetrics {
  // Base timing from timer events
  const base = computeTugMetrics(rawData);

  // Phase durations from transitions
  const phaseDurations: Partial<Record<TugPhase, number>> = {};
  for (let i = 0; i < phaseTransitions.length - 1; i++) {
    const current = phaseTransitions[i];
    const next = phaseTransitions[i + 1];
    phaseDurations[current.to] = next.t - current.t;
  }
  // Last phase: from last transition to stop
  if (phaseTransitions.length > 0) {
    const last = phaseTransitions[phaseTransitions.length - 1];
    if (last.to !== 'complete') {
      phaseDurations[last.to] = base.duration_actual_ms - last.t;
    }
  }

  // Aggregate gait metrics from walk phases
  const walkOutData = phaseData.get('walking_out');
  const walkBackData = phaseData.get('walking_back');
  const turnOutData = phaseData.get('turning_out');
  const turnSitData = phaseData.get('turning_sit');

  const totalSteps = (walkOutData?.steps ?? 0) + (walkBackData?.steps ?? 0);
  const totalDistance = (walkOutData?.distance ?? 0) + (walkBackData?.distance ?? 0);

  const allStrides = [
    ...(walkOutData?.strideLengths ?? []),
    ...(walkBackData?.strideLengths ?? []),
  ];
  const avgStride = allStrides.length > 0
    ? allStrides.reduce((a, b) => a + b, 0) / allStrides.length
    : 0;

  const metrics: ComputedMetrics = {
    ...base,
    total_steps: totalSteps,
    total_distance_m: Math.round(totalDistance * 100) / 100,
    avg_stride_length_m: Math.round(avgStride * 100) / 100,

    // Walk phase details
    walk_out_steps: walkOutData?.steps ?? 0,
    walk_out_distance_m: Math.round((walkOutData?.distance ?? 0) * 100) / 100,
    walk_out_duration_ms: Math.round(phaseDurations.walking_out ?? 0),
    walk_back_steps: walkBackData?.steps ?? 0,
    walk_back_distance_m: Math.round((walkBackData?.distance ?? 0) * 100) / 100,
    walk_back_duration_ms: Math.round(phaseDurations.walking_back ?? 0),

    // Turn details
    turn_out_yaw_deg: Math.round(turnOutData?.cumulativeYaw ?? 0),
    turn_out_duration_ms: Math.round(phaseDurations.turning_out ?? 0),
    turn_sit_yaw_deg: Math.round(turnSitData?.cumulativeYaw ?? 0),
    turn_sit_duration_ms: Math.round(phaseDurations.turning_sit ?? 0),

    // Stand/sit durations
    standup_duration_ms: Math.round(phaseDurations.standing_up ?? 0),
    sitdown_duration_ms: Math.round(phaseDurations.sitting_down ?? 0),

    // Phase count completed
    phases_completed: phaseTransitions.filter(t => t.to !== 'idle').length,
  };

  return metrics;
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
