export interface TugSessionSetup {
  walkingAid: 'none' | 'cane' | 'walker';
}

export type TugPhoneMode = 'pocket' | 'hand';

export interface TugSensorConfig {
  gravityFilterAlpha: number;
  standupAccelThreshold: number;
  standupTiltThreshold: number;
  standupTiltHoldMs: number;
  standupMaxDurationMs: number;
  walkDistanceM: number;
  // Step detection
  stepInitialThreshold: number;
  stepMinIntervalMs: number;
  stepPeakValleyMaxMs: number;
  // Turn detection
  yawRateSmoothAlpha: number;
  turnMinAngle: number;
  turnExitRmsFloor: number;
  turnExitRmsScale: number;
  turnRmsWindowSamples: number;
  turnSettleMs: number;
  turnMaxDurationMs: number;
  turnWalkYawBufferSize: number;
  // Sit down
  sitdownSpikeThreshold: number;
  sitdownRestAccelTolerance: number;
  sitdownRestDurationMs: number;
  sitdownMaxDurationMs: number;
  sensorUiUpdateMs: number;
}

// Phone-in-pocket calibration
export const TUG_CONFIG_POCKET: TugSensorConfig = {
  gravityFilterAlpha: 0.1,
  standupAccelThreshold: 14.7,
  standupTiltThreshold: 45,
  standupTiltHoldMs: 200,
  standupMaxDurationMs: 4000,
  walkDistanceM: 3.0,
  // Step detection — lower threshold for better sensitivity
  stepInitialThreshold: 1.2,
  stepMinIntervalMs: 300,
  stepPeakValleyMaxMs: 500,
  // Turn detection — lower thresholds for earlier/easier completion
  yawRateSmoothAlpha: 0.3,
  turnMinAngle: 15,
  turnExitRmsFloor: 5,
  turnExitRmsScale: 0.5,
  turnRmsWindowSamples: 30,
  turnSettleMs: 100,
  turnMaxDurationMs: 8000,
  turnWalkYawBufferSize: 180,
  // Sit down
  sitdownSpikeThreshold: 3.0,
  sitdownRestAccelTolerance: 0.5,
  sitdownRestDurationMs: 1500,
  sitdownMaxDurationMs: 10000,
  sensorUiUpdateMs: 100,
};

// Phone-in-hand (sternum) calibration — copied from pocket for now.
// Tune after real-device testing.
export const TUG_CONFIG_HAND: TugSensorConfig = { ...TUG_CONFIG_POCKET };

export const WALKING_AID_LABELS: Record<string, string> = {
  none: 'no aid',
  cane: 'cane',
  walker: 'walker',
};

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
