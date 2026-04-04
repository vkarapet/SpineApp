export interface TugSessionSetup {
  walkingAid: 'none' | 'cane' | 'walker' | 'other';
  fatigue: number | null;
  medication: boolean | null;
}

export type TugClinicalBand = 'normal' | 'moderate_risk' | 'high_risk';

export type TugPhase =
  | 'idle'
  | 'standing_up'
  | 'walking_out'
  | 'turning_out'
  | 'walking_back'
  | 'turning_sit'
  | 'sitting_down'
  | 'complete';

export const TUG_PHASE_LABELS: Record<TugPhase, string> = {
  idle: 'Ready',
  standing_up: 'Standing Up',
  walking_out: 'Walking',
  turning_out: 'Turning',
  walking_back: 'Walking Back',
  turning_sit: 'Turning',
  sitting_down: 'Sitting Down',
  complete: 'Complete',
};

export const TUG_PHASE_ORDER: TugPhase[] = [
  'standing_up',
  'walking_out',
  'turning_out',
  'walking_back',
  'turning_sit',
  'sitting_down',
  'complete',
];

export interface PhaseTransition {
  from: TugPhase;
  to: TugPhase;
  t: number;
  trigger: string;
}

export interface PhaseMetrics {
  phase: TugPhase;
  durationMs: number;
  startT: number;
  endT: number;
  steps?: number;
  distance?: number;
  strideLengths?: number[];
  cumulativeYaw?: number;
}
