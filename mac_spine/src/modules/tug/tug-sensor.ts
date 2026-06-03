import type { TugPhase, PhaseTransition, TugSensorConfig, WalkOutPhaseData } from './tug-types';
import {
  type Vec3,
  type DetectedStep,
  magnitude,
  lowPassFilter,
  decomposeAcceleration,
  StepDetector,
} from './tug-signal-processing';

export interface TugSensorState {
  phase: TugPhase;
  elapsedMs: number;
  steps: number;
  distance: number;
  targetDistance: number;
  accelMagnitude: number;
}

export interface TugSensorCallbacks {
  onStateUpdate(state: TugSensorState): void;
  onPhaseChange(from: TugPhase, to: TugPhase): void;
  onStepDetected(step: DetectedStep): void;
  onWalkCompleteCue(): void;
  onComplete(finalElapsedMs: number): void;
}

export class TugSensorEngine {
  private gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
  private phase: TugPhase = 'idle';
  private stepDetector: StepDetector;
  private callbacks: TugSensorCallbacks;
  private config: TugSensorConfig;

  private startTime = 0;
  private phaseStartTime = 0;

  // Walking state
  private walkDistance = 0;
  private walkSteps = 0;
  private walkStrideLengths: number[] = [];
  private walkStepIntervals: number[] = [];
  private walkFirstStepT: number | null = null;
  private walkLastStepT: number | null = null;
  private walkCueFired = false;

  // Sitting down state
  private sitdownSpikeSeen = false;
  private sitdownSpikeTime = 0;
  private restStartTime = 0;

  private transitions: PhaseTransition[] = [];

  private walkOutData: WalkOutPhaseData = {
    steps: 0, distance: 0, strideLengths: [], stepIntervals: [],
    firstStepT: null, lastStepT: null,
  };

  private lastUIUpdate = 0;
  private lastAccelMag = 9.81;

  constructor(callbacks: TugSensorCallbacks, config: TugSensorConfig) {
    this.callbacks = callbacks;
    this.config = config;
    this.stepDetector = new StepDetector({
      initialThreshold: config.stepInitialThreshold,
      minIntervalMs: config.stepMinIntervalMs,
      peakValleyMaxMs: config.stepPeakValleyMaxMs,
    });
  }

  calibrate(gravityEstimate: Vec3): void {
    this.gravity = { ...gravityEstimate };
  }

  start(): void {
    this.phase = 'walking_out';
    this.startTime = performance.now();
    this.phaseStartTime = this.startTime;
    this.transitions.push({
      from: 'idle',
      to: 'walking_out',
      t: 0,
      trigger: 'test_start',
    });
    this.resetWalkOut();
  }

  handleMotionEvent(event: DeviceMotionEvent): void {
    if (this.phase === 'idle' || this.phase === 'complete') return;

    const now = performance.now();
    const elapsed = now - this.startTime;

    const accelRaw: Vec3 = {
      x: event.accelerationIncludingGravity?.x ?? 0,
      y: event.accelerationIncludingGravity?.y ?? 0,
      z: event.accelerationIncludingGravity?.z ?? 0,
    };

    this.gravity = lowPassFilter(accelRaw, this.gravity, this.config.gravityFilterAlpha);

    const decomposed = decomposeAcceleration(accelRaw, this.gravity);
    this.lastAccelMag = magnitude(accelRaw);

    switch (this.phase) {
      case 'walking_out':
        this.processWalkingOut(elapsed, decomposed.magnitude, decomposed.vertical);
        break;
      case 'sitting_down':
        this.processSittingDown(elapsed, elapsed - (this.phaseStartTime - this.startTime));
        break;
    }

    if (now - this.lastUIUpdate >= this.config.sensorUiUpdateMs) {
      this.lastUIUpdate = now;
      this.callbacks.onStateUpdate(this.getState(elapsed));
    }
  }

  private processWalkingOut(elapsed: number, magnitude: number, verticalAccel: number): void {
    const step = this.stepDetector.processSample(elapsed, magnitude, verticalAccel);

    if (step) {
      this.walkSteps++;
      this.walkDistance += step.strideLength;
      this.walkStrideLengths.push(step.strideLength);

      if (this.walkFirstStepT === null) {
        this.walkFirstStepT = step.t;
      } else if (this.walkLastStepT !== null) {
        // Capture interval between consecutive steps (skips the first step).
        this.walkStepIntervals.push(step.t - this.walkLastStepT);
      }
      this.walkLastStepT = step.t;

      this.callbacks.onStepDetected(step);
    }

    if (!this.walkCueFired && this.walkDistance >= this.config.walkDistanceM) {
      this.walkCueFired = true;
      this.snapshotWalkOut();
      this.callbacks.onWalkCompleteCue();
      // Participant physically turns and walks back; sensor only waits for sit.
      this.transitionTo('sitting_down', elapsed, 'walk_out_complete');
    }
  }

  private processSittingDown(elapsed: number, phaseElapsed: number): void {
    if (this.checkSittingImpact(elapsed)) {
      // Backdate to the impact spike — the actual sit-down moment.
      this.transitionTo('complete', this.sitdownSpikeTime, 'sitting_detected');
      this.callbacks.onComplete(this.sitdownSpikeTime);
      return;
    }

    if (phaseElapsed >= this.config.sitdownMaxDurationMs) {
      this.transitionTo('complete', elapsed, 'sitdown_timeout');
      this.callbacks.onComplete(elapsed);
    }
  }

  private checkSittingImpact(elapsed: number): boolean {
    const gravMag = magnitude(this.gravity);
    const deviation = Math.abs(this.lastAccelMag - gravMag);

    if (deviation > this.config.sitdownSpikeThreshold) {
      this.sitdownSpikeSeen = true;
      this.sitdownSpikeTime = elapsed;
    }

    if (!this.sitdownSpikeSeen) return false;

    if (deviation < this.config.sitdownRestAccelTolerance) {
      if (this.restStartTime === 0) this.restStartTime = elapsed;
      if ((elapsed - this.restStartTime) >= this.config.sitdownRestDurationMs) {
        return true;
      }
    } else {
      this.restStartTime = 0;
    }

    return false;
  }

  private transitionTo(nextPhase: TugPhase, elapsed: number, trigger: string): void {
    const from = this.phase;
    this.transitions.push({ from, to: nextPhase, t: elapsed, trigger });
    this.callbacks.onPhaseChange(from, nextPhase);

    this.phase = nextPhase;
    this.phaseStartTime = performance.now();

    if (nextPhase === 'sitting_down') {
      this.sitdownSpikeSeen = false;
      this.sitdownSpikeTime = 0;
      this.restStartTime = 0;
    }
  }

  private resetWalkOut(): void {
    this.stepDetector.reset();
    this.walkDistance = 0;
    this.walkSteps = 0;
    this.walkStrideLengths = [];
    this.walkStepIntervals = [];
    this.walkFirstStepT = null;
    this.walkLastStepT = null;
    this.walkCueFired = false;
    this.walkOutData = {
      steps: 0, distance: 0, strideLengths: [], stepIntervals: [],
      firstStepT: null, lastStepT: null,
    };
  }

  private snapshotWalkOut(): void {
    this.walkOutData = {
      steps: this.walkSteps,
      distance: this.walkDistance,
      strideLengths: [...this.walkStrideLengths],
      stepIntervals: [...this.walkStepIntervals],
      firstStepT: this.walkFirstStepT,
      lastStepT: this.walkLastStepT,
    };
  }

  private getState(elapsed: number): TugSensorState {
    const isWalking = this.phase === 'walking_out';
    return {
      phase: this.phase,
      elapsedMs: elapsed,
      steps: isWalking ? this.walkSteps : 0,
      distance: isWalking ? this.walkDistance : 0,
      targetDistance: this.config.walkDistanceM,
      accelMagnitude: this.lastAccelMag,
    };
  }

  getPhaseTransitions(): PhaseTransition[] {
    return [...this.transitions];
  }

  getWalkOutData(): WalkOutPhaseData {
    return { ...this.walkOutData, strideLengths: [...this.walkOutData.strideLengths], stepIntervals: [...this.walkOutData.stepIntervals] };
  }

  getCurrentPhase(): TugPhase {
    return this.phase;
  }
}
