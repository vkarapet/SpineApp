export interface TugSessionSetup {
  walkingAid: 'none' | 'cane' | 'walker';
}

export interface TugSensorConfig {
  gravityFilterAlpha: number;
  walkDistanceM: number;
  // Sit down
  sitdownSpikeThreshold: number;
  sitdownRestAccelTolerance: number;
  sitdownRestDurationMs: number;
  sitdownMaxDurationMs: number;
  sensorUiUpdateMs: number;
}

export const TUG_CONFIG: TugSensorConfig = {
  gravityFilterAlpha: 0.1,
  walkDistanceM: 3.0,
  sitdownSpikeThreshold: 3.0,
  sitdownRestAccelTolerance: 0.5,
  sitdownRestDurationMs: 1500,
  sitdownMaxDurationMs: 30000,
  sensorUiUpdateMs: 100,
};

export const WALKING_AID_LABELS: Record<string, string> = {
  none: 'no aid',
  cane: 'cane',
  walker: 'walker',
};

export type TugClinicalBand = 'normal' | 'moderate_risk' | 'high_risk';

export type TugPhase =
  | 'idle'
  | 'walking_out'
  | 'sitting_down'
  | 'complete';

export const TUG_PHASE_LABELS: Record<TugPhase, string> = {
  idle: 'Ready',
  walking_out: 'Walking',
  sitting_down: 'Return and sit',
  complete: 'Complete',
};

export const TUG_PHASE_ORDER: TugPhase[] = [
  'walking_out',
  'sitting_down',
  'complete',
];

export interface PhaseTransition {
  from: TugPhase;
  to: TugPhase;
  t: number;
  trigger: string;
}

export interface WalkOutPhaseData {
  steps: number;
  distance: number;
  strideLengths: number[];
  stepIntervals: number[];
  firstStepT: number | null;
  lastStepT: number | null;
}
