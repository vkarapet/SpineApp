import { clearContainer, createElement } from '../../utils/dom';
import { getProfile, saveProfile, saveResult, addAuditEntry } from '../../core/db';
import { generateUUID } from '../../utils/uuid';
import { computeChecksum } from '../../utils/crypto';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration, getDeviceOS, getBrowserInfo, getViewportDimensions } from '../../utils/device';
import { computeTugSensorMetrics } from './tug-metrics';
import { tugSessionSetup } from './tug-setup';
import { TugSensorEngine } from './tug-sensor';
import { TUG_PHASE_LABELS } from './tug-types';
import type { TugPhase } from './tug-types';
import { TUG_MAX_DURATION_MS, TUG_SENSOR_SAVE_INTERVAL_MS, TUG_WALK_DISTANCE_M, APP_VERSION } from '../../constants';
import type { RawTimerEvent, RawMotionEvent, RawEvent } from '../../types/assessment';
import type { AssessmentResult, SessionMetadata, UserProfile } from '../../types/db-schemas';
import { router } from '../../main';

// Shared state for results screen
export let lastTugResult: AssessmentResult | null = null;

export async function renderTugActive(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profileOrUndef = await getProfile();
  if (!profileOrUndef) {
    router.navigate('#/splash', true);
    return;
  }
  const profile: UserProfile = profileOrUndef;

  // Pick up wake lock from countdown
  let wakeLock: WakeLockSentinel | null =
    ((window as unknown as Record<string, unknown>).__tugWakeLock as WakeLockSentinel) ?? null;
  delete (window as unknown as Record<string, unknown>).__tugWakeLock;

  if (!wakeLock && 'wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as Navigator).wakeLock.request('screen');
    } catch { /* not available */ }
  }

  const viewport = getViewportDimensions();
  const localUuid = generateUUID();
  const sessionStartISO = new Date().toISOString();

  const sessionMetadata: SessionMetadata = {
    hand_used: 'n/a',
    fatigue_rating: tugSessionSetup.fatigue,
    medication_taken: tugSessionSetup.medication,
    screen_width_px: viewport.width,
    screen_height_px: viewport.height,
    target_radius_px: 0,
    device_os: getDeviceOS(),
    browser: getBrowserInfo(),
    app_version: APP_VERSION,
    walking_aid: tugSessionSetup.walkingAid,
  };

  // Pre-allocate event arrays
  const rawMotionEvents: RawMotionEvent[] = [];
  const rawTimerEvents: RawTimerEvent[] = [];
  let running = false;
  let startTime = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let saveInterval: ReturnType<typeof setInterval> | null = null;
  let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

  // Build UI
  const wrapper = createElement('div', { className: 'tug-active tug-active--sensor' });

  // GO signal overlay
  const goSignal = createElement('div', {
    className: 'assessment-active__go',
    textContent: 'GO!',
    'aria-live': 'assertive',
  });

  // Phase label
  const phaseLabel = createElement('div', {
    className: 'tug-sensor__phase-label',
    textContent: 'Starting...',
  });

  // Timer display
  const timerDisplay = createElement('div', {
    className: 'tug-active__timer',
    textContent: '00:00.0',
  });

  // Walk info (steps + distance) — shown during walking phases
  const walkInfo = createElement('div', { className: 'tug-sensor__walk-info' });
  walkInfo.style.display = 'none';

  const stepsDisplay = createElement('span', { textContent: 'Steps: 0' });
  const distDisplay = createElement('span', { textContent: 'Dist: 0.0m' });
  walkInfo.appendChild(stepsDisplay);
  walkInfo.appendChild(distDisplay);

  // Progress bar for distance
  const progressContainer = createElement('div', { className: 'tug-sensor__progress' });
  progressContainer.style.display = 'none';
  const progressBar = createElement('div', { className: 'tug-sensor__progress-bar' });
  const progressLabel = createElement('span', {
    className: 'tug-sensor__progress-label',
    textContent: `0.0 / ${TUG_WALK_DISTANCE_M.toFixed(1)}m`,
  });
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressLabel);

  // Turn info — shown during turning phases
  const turnInfo = createElement('div', { className: 'tug-sensor__turn-info' });
  turnInfo.style.display = 'none';
  turnInfo.textContent = 'Turn: 0° / 160°';

  // Emergency stop button
  const stopBtn = createElement('button', {
    className: 'tug-active__stop-btn',
    textContent: 'STOP (Emergency)',
    'aria-label': 'Emergency stop',
  });
  stopBtn.addEventListener('click', () => {
    if (running) endAssessment(false, true);
  });

  // Gesture prevention
  wrapper.style.touchAction = 'none';
  wrapper.style.userSelect = 'none';
  (wrapper.style as unknown as Record<string, string>)['-webkit-touch-callout'] = 'none';
  document.body.style.overscrollBehavior = 'none';

  // beforeunload handler
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (running) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  // Navigation guard
  const removeGuard = router.addGuard((_from, _to) => {
    if (!running) return true;
    const leave = confirm('End test early? Data from this session will be discarded.');
    if (leave) cleanup();
    return leave;
  });

  // Sensor engine
  const engine = new TugSensorEngine({
    onStateUpdate(state) {
      // Update phase label
      phaseLabel.textContent = TUG_PHASE_LABELS[state.phase] ?? state.phase;

      // Show/hide walk info
      const isWalking = state.phase === 'walking_out' || state.phase === 'walking_back';
      walkInfo.style.display = isWalking ? 'flex' : 'none';
      progressContainer.style.display = isWalking ? 'flex' : 'none';

      if (isWalking) {
        stepsDisplay.textContent = `Steps: ${state.steps}`;
        distDisplay.textContent = `Dist: ${state.distance.toFixed(1)}m`;
        const pct = Math.min(100, (state.distance / state.targetDistance) * 100);
        progressBar.style.width = `${pct}%`;
        progressLabel.textContent = `${state.distance.toFixed(1)} / ${state.targetDistance.toFixed(1)}m`;
      }

      // Show/hide turn info
      const isTurning = state.phase === 'turning_out' || state.phase === 'turning_sit';
      turnInfo.style.display = isTurning ? 'block' : 'none';

      if (isTurning) {
        turnInfo.textContent = `Turn: ${Math.round(state.cumulativeYaw)}° / ${Math.round(state.targetYaw)}°`;
      }
    },

    onPhaseChange(_from: TugPhase, to: TugPhase) {
      phaseLabel.textContent = TUG_PHASE_LABELS[to] ?? to;
    },

    onStepDetected(_step) {
      // Visual/haptic feedback on step
      if (supportsVibration()) vibrate(10);
    },

    onTurnCue() {
      audioManager.play('beep');
      if (supportsVibration()) vibrate(50);
    },

    onComplete(finalElapsedMs: number) {
      // Record stop event with the engine's final time (may be backdated to sit-down impact)
      rawTimerEvents.push({
        kind: 'timer',
        t: finalElapsedMs,
        event: 'stop',
        source: 'sensor',
      });
      endAssessment(false, false, finalElapsedMs);
    },
  });

  // Retrieve calibration gravity
  const calGravity = window.__tugCalibrationGravity;
  if (calGravity) {
    engine.calibrate(calGravity);
  }

  // DeviceMotion handler
  const motionHandler = (event: DeviceMotionEvent) => {
    if (!running) return;
    const elapsed = performance.now() - startTime;

    // Record raw event
    rawMotionEvents.push({
      kind: 'motion',
      t: elapsed,
      ax: event.accelerationIncludingGravity?.x ?? 0,
      ay: event.accelerationIncludingGravity?.y ?? 0,
      az: event.accelerationIncludingGravity?.z ?? 0,
      gx: event.rotationRate?.beta ?? 0,
      gy: event.rotationRate?.gamma ?? 0,
      gz: event.rotationRate?.alpha ?? 0,
    });

    // Feed to engine
    engine.handleMotionEvent(event);
  };

  function formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  function cleanup(): void {
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    if (saveInterval) clearInterval(saveInterval);
    if (safetyTimeout) clearTimeout(safetyTimeout);
    window.removeEventListener('devicemotion', motionHandler);
    window.removeEventListener('beforeunload', onBeforeUnload);
    removeGuard();
    document.body.style.overscrollBehavior = '';
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    delete window.__tugCalibrationGravity;
  }

  async function endAssessment(timedOut: boolean, manualStop: boolean, overrideElapsedMs?: number): Promise<void> {
    if (!running) return;
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    if (saveInterval) clearInterval(saveInterval);
    if (safetyTimeout) clearTimeout(safetyTimeout);
    window.removeEventListener('devicemotion', motionHandler);

    // Use backdated time from engine if provided, otherwise real wall-clock time
    const elapsed = overrideElapsedMs ?? (performance.now() - startTime);

    // Ensure stop event is recorded
    if (!rawTimerEvents.some(e => e.event === 'stop')) {
      rawTimerEvents.push({
        kind: 'timer',
        t: elapsed,
        event: 'stop',
        source: manualStop ? 'manual' : 'sensor',
      });
    }

    audioManager.play('end');
    if (supportsVibration()) vibrate(50);

    // Update UI
    timerDisplay.textContent = formatTime(elapsed);
    stopBtn.style.display = 'none';
    walkInfo.style.display = 'none';
    progressContainer.style.display = 'none';
    turnInfo.style.display = 'none';

    const endMsg = createElement('div', {
      className: 'tug-active__end-msg',
      textContent: timedOut ? 'Safety timeout reached' : manualStop ? 'Test stopped' : 'Test complete!',
    });
    wrapper.appendChild(endMsg);

    // Combine all raw data
    const allRawData: RawEvent[] = [...rawTimerEvents, ...rawMotionEvents];

    // Compute metrics
    const phaseTransitions = engine.getPhaseTransitions();
    const metrics = computeTugSensorMetrics(allRawData, phaseTransitions, engine.getPhaseData());
    const checksum = await computeChecksum(allRawData);

    const isFlagged = timedOut || manualStop;
    let flagReason: string | null = null;
    if (timedOut) flagReason = 'Safety timeout: test exceeded 2 minutes';
    else if (manualStop) flagReason = 'Manual stop during sensor test';

    const finalResult: AssessmentResult = {
      local_uuid: localUuid,
      participant_id: profile.participant_id,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'tug_v1',
      status: 'in_progress',
      session_metadata: sessionMetadata,
      raw_data: allRawData,
      computed_metrics: metrics,
      flagged: isFlagged,
      flag_reason: flagReason,
      synced: false,
      sync_attempts: 0,
      checksum,
    };

    try {
      await saveResult(finalResult);

      if (!profile.first_assessment_completed) {
        profile.first_assessment_completed = true;
        await saveProfile(profile);
      }

      lastTugResult = finalResult;
    } catch (err) {
      console.error('Failed to save TUG sensor result:', err);
    }

    cleanup();

    setTimeout(() => {
      router.navigate('#/assessment/tug_v1/results', true);
    }, 500);
  }

  // Assemble DOM
  wrapper.appendChild(goSignal);
  wrapper.appendChild(phaseLabel);
  wrapper.appendChild(timerDisplay);
  wrapper.appendChild(walkInfo);
  wrapper.appendChild(progressContainer);
  wrapper.appendChild(turnInfo);
  wrapper.appendChild(stopBtn);
  container.appendChild(wrapper);

  // Audit start
  await addAuditEntry({
    action: 'assessment_started',
    entity_id: localUuid,
    details: { task_type: 'tug_v1', walking_aid: tugSessionSetup.walkingAid },
  });

  // Record start event
  rawTimerEvents.push({
    kind: 'timer',
    t: 0,
    event: 'start',
    source: 'sensor',
  });

  // Initial incremental save
  const partialResult: AssessmentResult = {
    local_uuid: localUuid,
    participant_id: profile.participant_id,
    device_id: profile.device_id,
    timestamp_start: sessionStartISO,
    task_type: 'tug_v1',
    status: 'in_progress',
    session_metadata: sessionMetadata,
    raw_data: [...rawTimerEvents],
    computed_metrics: { duration_actual_ms: 0, tug_time_s: 0 },
    flagged: false,
    flag_reason: null,
    synced: false,
    sync_attempts: 0,
    checksum: '',
  };

  try {
    await saveResult(partialResult);
  } catch (err) {
    console.error('Incremental save failed:', err);
  }

  // Show GO signal
  goSignal.style.display = 'flex';
  audioManager.play('go');
  if (supportsVibration()) vibrate(30);

  setTimeout(() => {
    goSignal.style.display = 'none';
    running = true;
    startTime = performance.now();

    // Start sensor engine
    engine.start();

    // Start DeviceMotion listener
    window.addEventListener('devicemotion', motionHandler);

    // Timer display
    timerInterval = setInterval(() => {
      if (!running) return;
      const elapsed = performance.now() - startTime;
      timerDisplay.textContent = formatTime(elapsed);
    }, 100);

    // Incremental saves
    saveInterval = setInterval(async () => {
      if (!running) return;
      const elapsed = performance.now() - startTime;
      try {
        await saveResult({
          local_uuid: localUuid,
          participant_id: profile.participant_id,
          device_id: profile.device_id,
          timestamp_start: sessionStartISO,
          task_type: 'tug_v1',
          status: 'in_progress',
          session_metadata: sessionMetadata,
          raw_data: [...rawTimerEvents, ...rawMotionEvents],
          computed_metrics: { duration_actual_ms: Math.round(elapsed), tug_time_s: 0 },
          flagged: false,
          flag_reason: null,
          synced: false,
          sync_attempts: 0,
          checksum: '',
        });
      } catch (err) {
        console.error('Incremental sensor save failed:', err);
      }
    }, TUG_SENSOR_SAVE_INTERVAL_MS);

    // Safety timeout
    safetyTimeout = setTimeout(() => {
      if (running) endAssessment(true, false);
    }, TUG_MAX_DURATION_MS);
  }, 500);
}

const style = document.createElement('style');
style.textContent = `
  .tug-active {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
    z-index: var(--z-overlay);
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
  }
  .tug-active__timer {
    font-size: clamp(3rem, 15vw, 6rem);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    z-index: 6;
  }
  .tug-active__stop-btn {
    width: min(80vw, 20rem);
    min-height: 5rem;
    border: none;
    border-radius: var(--radius-lg);
    background: #D32F2F;
    color: #fff;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    z-index: 6;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .tug-active__stop-btn:active {
    background: #B71C1C;
    transform: scale(0.97);
  }
  .tug-active__end-msg {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    z-index: 6;
  }

  /* Sensor mode extras */
  .tug-sensor__phase-label {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-primary);
    z-index: 6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tug-sensor__walk-info {
    display: flex;
    gap: var(--space-6);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    z-index: 6;
  }
  .tug-sensor__progress {
    width: min(80vw, 20rem);
    height: 1.5rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-full);
    overflow: hidden;
    position: relative;
    z-index: 6;
    display: flex;
    align-items: center;
  }
  .tug-sensor__progress-bar {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width 0.2s ease-out;
    width: 0%;
  }
  .tug-sensor__progress-label {
    position: absolute;
    width: 100%;
    text-align: center;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    z-index: 1;
  }
  .tug-sensor__turn-info {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    z-index: 6;
  }
`;
document.head.appendChild(style);
