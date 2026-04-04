import type { TugPhase, PhaseTransition } from './tug-types';
import {
  type Vec3,
  type DetectedStep,
  magnitude,
  lowPassFilter,
  decomposeAcceleration,
  computeTilt,
  computeYawRate,
  StepDetector,
  SlidingWindowRMS,
  percentile,
} from './tug-signal-processing';
import {
  TUG_GRAVITY_FILTER_ALPHA,
  TUG_STANDUP_ACCEL_THRESHOLD,
  TUG_STANDUP_TILT_THRESHOLD,
  TUG_STANDUP_TILT_HOLD_MS,
  TUG_STANDUP_MAX_DURATION_MS,
  TUG_WALK_DISTANCE_M,
  TUG_YAW_RATE_SMOOTH_ALPHA,
  TUG_TURN_MIN_ANGLE,
  TUG_TURN_EXIT_RMS_FLOOR,
  TUG_TURN_EXIT_RMS_SCALE,
  TUG_TURN_RMS_WINDOW_SAMPLES,
  TUG_TURN_SETTLE_MS,
  TUG_TURN_MAX_DURATION_MS,
  TUG_TURN_WALK_YAW_BUFFER_SIZE,
  TUG_SITDOWN_SPIKE_THRESHOLD,
  TUG_SITDOWN_REST_ACCEL_TOLERANCE,
  TUG_SITDOWN_REST_DURATION_MS,
  TUG_SITDOWN_MAX_DURATION_MS,
  TUG_SENSOR_UI_UPDATE_MS,
} from '../../constants';

export interface TugSensorState {
  phase: TugPhase;
  elapsedMs: number;
  steps: number;
  distance: number;
  targetDistance: number;
  cumulativeYaw: number;
  targetYaw: number;
  tilt: number;
  accelMagnitude: number;
}

export interface TugSensorCallbacks {
  onStateUpdate(state: TugSensorState): void;
  onPhaseChange(from: TugPhase, to: TugPhase): void;
  onStepDetected(step: DetectedStep): void;
  onTurnCue(): void;
  onComplete(finalElapsedMs: number): void;
}

export class TugSensorEngine {
  private gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
  private restGravity: Vec3 = { x: 0, y: 0, z: 9.81 };
  private phase: TugPhase = 'idle';
  private stepDetector = new StepDetector();
  private callbacks: TugSensorCallbacks;

  private startTime = 0;
  private phaseStartTime = 0;

  // Standing up state
  private standupAccelExceeded = false;
  private standupTiltStart = 0;

  // Walking state
  private walkDistance = 0;
  private walkSteps = 0;
  private walkStrideLengths: number[] = [];
  private turnCueFired = false;

  // Yaw tracking
  private smoothedYawRate = 0;
  // Walking phase yaw calibration (collected during walking_out)
  private walkingYawRatesSigned: number[] = [];  // signed — for drift bias
  private walkingYawRatesAbs: number[] = [];     // absolute — for noise gate / exit threshold

  // Turn detection — signed cumulative heading + adaptive thresholds
  private turnCumulativeYaw = 0;
  private turnExitThreshold = TUG_TURN_EXIT_RMS_FLOOR;
  private turnYawRMS = new SlidingWindowRMS(TUG_TURN_RMS_WINDOW_SAMPLES);
  private turnSettleSince = 0;
  private turnYawBias = 0;

  // Real dt tracking
  private lastEventTime = 0;

  // Sitting down state
  private sitdownPhaseTriggered = false;
  private sitdownSpikeTime = 0;   // when the impact spike occurred (the actual sit-down moment)
  private restStartTime = 0;

  // Phase transitions
  private transitions: PhaseTransition[] = [];

  // Per-phase accumulated data
  private phaseData: Map<TugPhase, {
    steps: number;
    distance: number;
    strideLengths: number[];
    cumulativeYaw: number;
  }> = new Map();

  // UI throttle
  private lastUIUpdate = 0;

  // Accel magnitude (for raw display)
  private lastAccelMag = 9.81;
  private lastTilt = 0;

  constructor(callbacks: TugSensorCallbacks) {
    this.callbacks = callbacks;
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

    // Extract raw accelerometer data
    const accelRaw: Vec3 = {
      x: event.accelerationIncludingGravity?.x ?? 0,
      y: event.accelerationIncludingGravity?.y ?? 0,
      z: event.accelerationIncludingGravity?.z ?? 0,
    };

    // Extract rotation rate (degrees/s)
    const rotRate: Vec3 = {
      x: event.rotationRate?.beta ?? 0,
      y: event.rotationRate?.gamma ?? 0,
      z: event.rotationRate?.alpha ?? 0,
    };

    // Update gravity estimate
    this.gravity = lowPassFilter(accelRaw, this.gravity, TUG_GRAVITY_FILTER_ALPHA);

    // Decompose acceleration relative to gravity
    const decomposed = decomposeAcceleration(accelRaw, this.gravity);

    // Compute tilt from rest position
    const tilt = computeTilt(this.gravity, this.restGravity);
    this.lastTilt = tilt;

    // Compute yaw rate
    const yawRate = computeYawRate(rotRate, this.gravity);

    // Raw acceleration magnitude
    const accelMag = magnitude(accelRaw);
    this.lastAccelMag = accelMag;

    // Compute real dt from consecutive event timestamps
    const realDt = this.lastEventTime > 0
      ? Math.min((now - this.lastEventTime) / 1000, 0.1) // cap at 100ms to handle pauses
      : (event.interval ?? 16) / 1000;
    this.lastEventTime = now;

    // EMA smoothing for informational yaw rate
    this.smoothedYawRate = TUG_YAW_RATE_SMOOTH_ALPHA * yawRate
      + (1 - TUG_YAW_RATE_SMOOTH_ALPHA) * this.smoothedYawRate;
    // Collect yaw rate samples during walking_out for adaptive turn thresholds
    if (this.phase === 'walking_out') {
      this.walkingYawRatesSigned.push(yawRate);
      this.walkingYawRatesAbs.push(Math.abs(yawRate));
      if (this.walkingYawRatesSigned.length > TUG_TURN_WALK_YAW_BUFFER_SIZE) {
        this.walkingYawRatesSigned.shift();
        this.walkingYawRatesAbs.shift();
      }
    }

    // Feed into phase-specific detector
    this.processPhase(elapsed, decomposed.vertical, accelMag, tilt, yawRate, realDt);

    // Throttled UI update
    if (now - this.lastUIUpdate >= TUG_SENSOR_UI_UPDATE_MS) {
      this.lastUIUpdate = now;
      this.callbacks.onStateUpdate(this.getState(elapsed));
    }
  }

  private processPhase(
    elapsed: number,
    verticalAccel: number,
    accelMag: number,
    tilt: number,
    yawRate: number,
    dt: number,
  ): void {
    const phaseElapsed = elapsed - (this.phaseStartTime - this.startTime);

    switch (this.phase) {
      case 'standing_up':
        this.processStandingUp(elapsed, accelMag, tilt, phaseElapsed);
        break;
      case 'walking_out':
      case 'walking_back':
        this.processWalking(elapsed, verticalAccel);
        break;
      case 'turning_out':
        this.processTurning(elapsed, yawRate, dt, phaseElapsed);
        break;
      case 'sitting_down':
        this.processSittingDown(elapsed, accelMag, tilt, phaseElapsed);
        break;
    }
  }

  private processStandingUp(elapsed: number, accelMag: number, tilt: number, phaseElapsed: number): void {
    // Check if acceleration exceeded threshold at some point
    if (accelMag >= TUG_STANDUP_ACCEL_THRESHOLD) {
      this.standupAccelExceeded = true;
    }

    // Check tilt sustained
    if (tilt >= TUG_STANDUP_TILT_THRESHOLD) {
      if (this.standupTiltStart === 0) {
        this.standupTiltStart = elapsed;
      }
    } else {
      this.standupTiltStart = 0;
    }

    const tiltSustained =
      this.standupTiltStart > 0 &&
      (elapsed - this.standupTiltStart) >= TUG_STANDUP_TILT_HOLD_MS;

    // Transition: accel exceeded AND tilt sustained AND at least 1s
    if (this.standupAccelExceeded && tiltSustained && phaseElapsed >= 1000) {
      this.transitionTo('walking_out', elapsed, 'standup_detected');
      return;
    }

    // Safety: auto-advance at max duration
    if (phaseElapsed >= TUG_STANDUP_MAX_DURATION_MS) {
      this.transitionTo('walking_out', elapsed, 'standup_timeout');
    }
  }

  private processWalking(elapsed: number, verticalAccel: number): void {
    const step = this.stepDetector.processSample(elapsed, verticalAccel);

    if (step) {
      this.walkSteps++;
      this.walkDistance += step.strideLength;
      this.walkStrideLengths.push(step.strideLength);
      this.updatePhaseData(this.phase, step);
      this.callbacks.onStepDetected(step);

      // Audio cue at target distance (walking_out only)
      if (this.phase === 'walking_out' && !this.turnCueFired && this.walkDistance >= TUG_WALK_DISTANCE_M) {
        this.turnCueFired = true;
        this.callbacks.onTurnCue();
      }
    }

    // Transition when distance reached
    if (this.walkDistance >= TUG_WALK_DISTANCE_M) {
      if (this.phase === 'walking_out') {
        this.transitionTo('turning_out', elapsed, 'walk_out_complete');
      } else {
        this.transitionTo('sitting_down', elapsed, 'walk_back_complete');
      }
    }
  }

  /**
   * Turning phase: cumulative heading integration with adaptive thresholds.
   * Integrates |yawRate| × dt (bias-corrected) to track how far the user has
   * rotated. Turn completes when cumulative angle ≥ min threshold AND yaw RMS
   * has settled below the adaptive exit threshold.
   */
  private processTurning(elapsed: number, yawRate: number, dt: number, phaseElapsed: number): void {
    // Integrate SIGNED yaw rate (bias-corrected). Walking oscillation cancels
    // out (alternating +/-), while turn rotation accumulates consistently
    // in one direction. No noise gate needed.
    this.turnCumulativeYaw += (yawRate - this.turnYawBias) * dt;

    // Update sliding window RMS of raw yaw rate
    const yawRMS = this.turnYawRMS.update(yawRate);

    // Update phase data with cumulative yaw (absolute for display)
    const pd = this.phaseData.get('turning_out');
    if (pd) pd.cumulativeYaw = Math.abs(this.turnCumulativeYaw);

    // Check completion: sufficient angle AND activity settled
    const angleComplete = Math.abs(this.turnCumulativeYaw) >= TUG_TURN_MIN_ANGLE;
    const activitySettled = yawRMS < this.turnExitThreshold;

    if (angleComplete && activitySettled) {
      // Require sustained settling
      if (this.turnSettleSince === 0) {
        this.turnSettleSince = elapsed;
      }
      if ((elapsed - this.turnSettleSince) >= TUG_TURN_SETTLE_MS) {
        this.transitionTo('walking_back', elapsed, 'turn_complete');
        return;
      }
    } else {
      this.turnSettleSince = 0;
    }

    // Safety: force transition after max duration
    if (phaseElapsed >= TUG_TURN_MAX_DURATION_MS) {
      this.transitionTo('walking_back', elapsed, 'turn_timeout');
    }
  }

  private processSittingDown(
    elapsed: number, _accelMag: number, _tilt: number,
    phaseElapsed: number,
  ): void {
    if (this.checkSittingImpact(elapsed)) {
      // Backdate to the impact spike — that's the actual sit-down moment.
      // The stillness period is just confirmation; the timer should stop at impact.
      this.transitionTo('complete', this.sitdownSpikeTime, 'sitting_detected');
      this.callbacks.onComplete(this.sitdownSpikeTime);
      return;
    }

    // Safety: auto-complete at max duration
    if (phaseElapsed >= TUG_SITDOWN_MAX_DURATION_MS) {
      this.transitionTo('complete', elapsed, 'sitdown_timeout');
      this.callbacks.onComplete(elapsed);
    }
  }

  /** Detect sitting: acceleration spike (impact) followed by brief stillness. */
  private checkSittingImpact(elapsed: number): boolean {
    const gravMag = magnitude(this.gravity);
    const deviation = Math.abs(this.lastAccelMag - gravMag);

    // Detect impact spike — record the most recent one as the sit-down moment.
    // Walking spikes won't be followed by 1.5s stillness, so only the real
    // sit-down spike will lead to confirmation.
    if (deviation > TUG_SITDOWN_SPIKE_THRESHOLD) {
      this.sitdownPhaseTriggered = true;
      this.sitdownSpikeTime = elapsed;
    }

    if (!this.sitdownPhaseTriggered) return false;

    // After spike, check for brief stillness
    if (deviation < TUG_SITDOWN_REST_ACCEL_TOLERANCE) {
      if (this.restStartTime === 0) this.restStartTime = elapsed;
      if ((elapsed - this.restStartTime) >= TUG_SITDOWN_REST_DURATION_MS) {
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

    // Reset phase-specific state
    if (nextPhase === 'walking_out' || nextPhase === 'walking_back') {
      this.stepDetector.reset();
      this.walkDistance = 0;
      this.walkSteps = 0;
      this.walkStrideLengths = [];
      this.turnCueFired = false;
      this.initPhaseData(nextPhase);
    } else if (nextPhase === 'turning_out') {
      // Compute adaptive thresholds from walking_out yaw rate statistics
      // P75 of |yawRate| → scales noise gate and exit threshold to walking intensity
      const yawAbsP75 = percentile(this.walkingYawRatesAbs, 75);
      // Signed mean → gyro drift bias (should be near 0 for straight walking)
      const signedMean = this.walkingYawRatesSigned.length > 0
        ? this.walkingYawRatesSigned.reduce((a, b) => a + b, 0) / this.walkingYawRatesSigned.length
        : 0;

      this.turnExitThreshold = Math.max(TUG_TURN_EXIT_RMS_FLOOR, yawAbsP75 * TUG_TURN_EXIT_RMS_SCALE);
      this.turnYawBias = signedMean; // drift correction (not walking oscillation magnitude)

      // Reset turn integration state
      this.turnCumulativeYaw = 0;
      this.turnYawRMS.reset();
      this.turnSettleSince = 0;
      this.initPhaseData(nextPhase);
    } else if (nextPhase === 'sitting_down') {
      this.sitdownPhaseTriggered = false;
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
      cumulativeYaw: 0,
    });
  }

  private updatePhaseData(phase: TugPhase, step: DetectedStep): void {
    const pd = this.phaseData.get(phase);
    if (pd) {
      pd.steps++;
      pd.distance += step.strideLength;
      pd.strideLengths.push(step.strideLength);
    }
  }

  private getState(elapsed: number): TugSensorState {
    const isWalking = this.phase === 'walking_out' || this.phase === 'walking_back';
    const isTurning = this.phase === 'turning_out';
    return {
      phase: this.phase,
      elapsedMs: elapsed,
      steps: isWalking ? this.walkSteps : 0,
      distance: isWalking ? this.walkDistance : 0,
      targetDistance: TUG_WALK_DISTANCE_M,
      cumulativeYaw: isTurning ? Math.abs(this.turnCumulativeYaw) : 0,
      targetYaw: TUG_TURN_MIN_ANGLE,
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
    cumulativeYaw: number;
  }> {
    return new Map(this.phaseData);
  }

  getCurrentPhase(): TugPhase {
    return this.phase;
  }
}
