import type { TugPhase, PhaseTransition, TugSensorConfig } from './tug-types';
import {
  type Vec3,
  type DetectedStep,
  magnitude,
  lowPassFilter,
  decomposeAcceleration,
  computeTilt,
  StepDetector,
} from './tug-signal-processing';

export interface TugSensorState {
  phase: TugPhase;
  elapsedMs: number;
  steps: number;
  distance: number;
  targetDistance: number;
  tilt: number;
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
  private restGravity: Vec3 = { x: 0, y: 0, z: 9.81 };
  private phase: TugPhase = 'idle';
  private stepDetector: StepDetector;
  private callbacks: TugSensorCallbacks;
  private config: TugSensorConfig;

  private startTime = 0;
  private phaseStartTime = 0;

  // Standing up state
  private standupAccelExceeded = false;
  private standupTiltStart = 0;

  // Walking state (walking_out only)
  private walkDistance = 0;
  private walkSteps = 0;
  private walkStepIntervals: number[] = [];
  private walkLastStepT = 0;
  private walkCueFired = false;

  // Sitting down state
  private sitdownSpikeSeen = false;
  private sitdownSpikeTime = 0;
  private restStartTime = 0;

  // Phase transitions
  private transitions: PhaseTransition[] = [];

  // Per-phase data (walking_out captures stride length list)
  private phaseData: Map<TugPhase, {
    steps: number;
    distance: number;
    strideLengths: number[];
    stepIntervals: number[];
  }> = new Map();

  // UI throttle
  private lastUIUpdate = 0;

  // Accel magnitude (for raw display)
  private lastAccelMag = 9.81;
  private lastTilt = 0;

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
    this.restGravity = { ...gravityEstimate };
  }

  start(): void {
    this.phase = 'standing_up';
    this.startTime = performance.now();
    this.phaseStartTime = this.startTime;
    this.transitions.push({
      from: 'idle',
      to: 'standing_up',
      t: 0,
      trigger: 'test_start',
    });
    this.initPhaseData('standing_up');
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
    const tilt = computeTilt(this.gravity, this.restGravity);
    this.lastTilt = tilt;
    const accelMag = magnitude(accelRaw);
    this.lastAccelMag = accelMag;

    this.processPhase(elapsed, decomposed.vertical, accelMag, tilt);

    if (now - this.lastUIUpdate >= this.config.sensorUiUpdateMs) {
      this.lastUIUpdate = now;
      this.callbacks.onStateUpdate(this.getState(elapsed));
    }
  }

  private processPhase(
    elapsed: number,
    verticalAccel: number,
    accelMag: number,
    tilt: number,
  ): void {
    const phaseElapsed = elapsed - (this.phaseStartTime - this.startTime);

    switch (this.phase) {
      case 'standing_up':
        this.processStandingUp(elapsed, accelMag, tilt, phaseElapsed);
        break;
      case 'walking_out':
        this.processWalkingOut(elapsed, verticalAccel);
        break;
      case 'sitting_down':
        this.processSittingDown(elapsed, phaseElapsed);
        break;
    }
  }

  private processStandingUp(elapsed: number, accelMag: number, tilt: number, phaseElapsed: number): void {
    if (accelMag >= this.config.standupAccelThreshold) {
      this.standupAccelExceeded = true;
    }

    if (tilt >= this.config.standupTiltThreshold) {
      if (this.standupTiltStart === 0) this.standupTiltStart = elapsed;
    } else {
      this.standupTiltStart = 0;
    }

    const tiltSustained =
      this.standupTiltStart > 0 &&
      (elapsed - this.standupTiltStart) >= this.config.standupTiltHoldMs;

    if (this.standupAccelExceeded && tiltSustained && phaseElapsed >= 1000) {
      this.transitionTo('walking_out', elapsed, 'standup_detected');
      return;
    }

    if (phaseElapsed >= this.config.standupMaxDurationMs) {
      this.transitionTo('walking_out', elapsed, 'standup_timeout');
    }
  }

  private processWalkingOut(elapsed: number, verticalAccel: number): void {
    const step = this.stepDetector.processSample(elapsed, verticalAccel);

    if (step) {
      this.walkSteps++;
      this.walkDistance += step.strideLength;
      if (this.walkLastStepT > 0) {
        this.walkStepIntervals.push(step.t - this.walkLastStepT);
      }
      this.walkLastStepT = step.t;
      this.updatePhaseData(this.phase, step);
      this.callbacks.onStepDetected(step);
    }

    if (!this.walkCueFired && this.walkDistance >= this.config.walkDistanceM) {
      this.walkCueFired = true;
      this.callbacks.onWalkCompleteCue();
      // Transition straight to sitting_down — the participant physically turns
      // and walks back; the sensor just waits for the sit impact.
      this.transitionTo('sitting_down', elapsed, 'walk_out_complete');
    }
  }

  private processSittingDown(elapsed: number, phaseElapsed: number): void {
    if (this.checkSittingImpact(elapsed)) {
      // Backdate to the impact spike — that's the actual sit-down moment.
      this.transitionTo('complete', this.sitdownSpikeTime, 'sitting_detected');
      this.callbacks.onComplete(this.sitdownSpikeTime);
      return;
    }

    if (phaseElapsed >= this.config.sitdownMaxDurationMs) {
      this.transitionTo('complete', elapsed, 'sitdown_timeout');
      this.callbacks.onComplete(elapsed);
    }
  }

  /** Detect sitting: acceleration spike (impact) followed by brief stillness. */
  private checkSittingImpact(elapsed: number): boolean {
    const gravMag = magnitude(this.gravity);
    const deviation = Math.abs(this.lastAccelMag - gravMag);

    // Record the most recent impact spike as a candidate sit-down moment.
    // Walking spikes won't be followed by 1.5s stillness, so only the real
    // sit-down spike will lead to confirmation.
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

    if (nextPhase === 'walking_out') {
      this.stepDetector.reset();
      this.walkDistance = 0;
      this.walkSteps = 0;
      this.walkStepIntervals = [];
      this.walkLastStepT = 0;
      this.walkCueFired = false;
      this.initPhaseData(nextPhase);
    } else if (nextPhase === 'sitting_down') {
      this.sitdownSpikeSeen = false;
      this.sitdownSpikeTime = 0;
      this.restStartTime = 0;
      this.initPhaseData(nextPhase);
    }
  }

  private initPhaseData(phase: TugPhase): void {
    this.phaseData.set(phase, {
      steps: 0,
      distance: 0,
      strideLengths: [],
      stepIntervals: [],
    });
  }

  private updatePhaseData(phase: TugPhase, step: DetectedStep): void {
    const pd = this.phaseData.get(phase);
    if (pd) {
      pd.steps++;
      pd.distance += step.strideLength;
      pd.strideLengths.push(step.strideLength);
      if (this.walkStepIntervals.length > 0) {
        pd.stepIntervals = [...this.walkStepIntervals];
      }
    }
  }

  private getState(elapsed: number): TugSensorState {
    const isWalking = this.phase === 'walking_out';
    return {
      phase: this.phase,
      elapsedMs: elapsed,
      steps: isWalking ? this.walkSteps : 0,
      distance: isWalking ? this.walkDistance : 0,
      targetDistance: this.config.walkDistanceM,
      tilt: this.lastTilt,
      accelMagnitude: this.lastAccelMag,
    };
  }

  getPhaseTransitions(): PhaseTransition[] {
    return [...this.transitions];
  }

  getPhaseData(): Map<TugPhase, {
    steps: number;
    distance: number;
    strideLengths: number[];
    stepIntervals: number[];
  }> {
    return new Map(this.phaseData);
  }

  getCurrentPhase(): TugPhase {
    return this.phase;
  }
}
