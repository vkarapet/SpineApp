import { clearContainer, createElement } from '../../utils/dom';
import { getProfile, saveProfile, saveResult, addAuditEntry } from '../../core/db';
import { generateUUID } from '../../utils/uuid';
import { computeChecksum } from '../../utils/crypto';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration, getDeviceOS, getBrowserInfo, getViewportDimensions } from '../../utils/device';
import { computeGripMetrics } from './grip-metrics';
import { gripSessionSetup } from './grip-setup';
import { GRIP_DURATION_MS, GRIP_MIN_FINGERS, INCREMENTAL_SAVE_INTERVAL_MS, INCREMENTAL_SAVE_GRIP_COUNT, APP_VERSION } from '../../constants';
import type { RawTapEvent } from '../../types/assessment';
import type { AssessmentResult, SessionMetadata, UserProfile } from '../../types/db-schemas';
import { router } from '../../main';

// Shared state for results screen
export let lastGripResult: AssessmentResult | null = null;

export async function renderGripActive(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profileOrUndef = await getProfile();
  if (!profileOrUndef) {
    router.navigate('#/splash', true);
    return;
  }
  const profile: UserProfile = profileOrUndef;

  const wrapper = createElement('div', { className: 'grip-active' });

  // Progress bar
  const progressBar = createElement('div', { className: 'tapping-active__progress' });
  const progressFill = createElement('div', { className: 'tapping-active__progress-fill' });
  progressBar.appendChild(progressFill);

  // GO signal
  const goSignal = createElement('div', {
    className: 'tapping-active__go',
    textContent: 'GO!',
    'aria-live': 'assertive',
  });

  // Finger indicators container
  const indicatorContainer = createElement('div', { className: 'grip-active__indicators' });

  const viewport = getViewportDimensions();

  // Pre-allocate event array
  const tapEvents: RawTapEvent[] = new Array(500);
  let tapIndex = 0;

  // Grip state
  const activePointers = new Map<number, { x: number; y: number; el: HTMLElement }>();
  let gripAchieved = false;
  let gripCycleCount = 0;
  let running = false;
  let startTime = 0;
  const sessionStartISO = new Date().toISOString();
  const localUuid = generateUUID();
  let lastSaveTime = 0;
  let gripsSinceSave = 0;
  let saveTimer: ReturnType<typeof setInterval> | null = null;

  const sessionMetadata: SessionMetadata = {
    hand_used: gripSessionSetup.hand,
    fatigue_rating: gripSessionSetup.fatigue,
    medication_taken: gripSessionSetup.medication,
    screen_width_px: viewport.width,
    screen_height_px: viewport.height,
    target_radius_px: 0, // Not applicable for grip test
    device_os: getDeviceOS(),
    browser: getBrowserInfo(),
    app_version: APP_VERSION,
  };

  // Gesture prevention
  wrapper.style.touchAction = 'none';
  wrapper.style.userSelect = 'none';
  (wrapper.style as unknown as Record<string, string>)['-webkit-touch-callout'] = 'none';
  document.body.style.overscrollBehavior = 'none';

  const preventMove = (e: Event) => e.preventDefault();
  wrapper.addEventListener('touchmove', preventMove, { passive: false });
  wrapper.addEventListener('pointermove', preventMove, { passive: false });

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
    if (leave) {
      cleanup();
    }
    return leave;
  });

  // Record event
  function recordEvent(
    t: number,
    x: number,
    y: number,
    type: 'start' | 'end',
    touchId: number,
    rejected: boolean,
    rejectReason: string | null,
  ): void {
    const event: RawTapEvent = { t, x, y, type, touch_id: touchId, rejected, reject_reason: rejectReason };

    if (tapIndex < tapEvents.length) {
      tapEvents[tapIndex] = event;
    } else {
      tapEvents.push(event);
    }
    tapIndex++;
  }

  // Pointer event handlers
  const onPointerDown = (e: PointerEvent) => {
    if (!running) return;
    e.preventDefault();

    const now = performance.now() - startTime;

    // Create indicator circle
    const circle = createElement('div', { className: 'grip-active__circle' });
    circle.style.left = `${e.clientX - 20}px`;
    circle.style.top = `${e.clientY - 20}px`;
    indicatorContainer.appendChild(circle);

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, el: circle });

    // Record raw event
    recordEvent(now, e.clientX, e.clientY, 'start', e.pointerId, false, null);

    // Check for grip (4+ fingers)
    if (activePointers.size >= GRIP_MIN_FINGERS && !gripAchieved) {
      gripAchieved = true;

      // Turn all circles green
      activePointers.forEach(({ el }) => {
        el.classList.add('grip-active__circle--grip');
      });

      // Haptic
      const hapticEnabled = profile?.preferences.haptic_enabled ?? true;
      if (hapticEnabled && supportsVibration()) {
        vibrate(10);
      }

      gripsSinceSave++;

      // Incremental save check
      if (gripsSinceSave >= INCREMENTAL_SAVE_GRIP_COUNT) {
        doIncrementalSave();
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!running) return;

    const now = performance.now() - startTime;

    const pointer = activePointers.get(e.pointerId);
    if (pointer) {
      pointer.el.remove();
      activePointers.delete(e.pointerId);
    }

    recordEvent(now, e.clientX, e.clientY, 'end', e.pointerId, false, null);

    if (activePointers.size === 0) {
      if (gripAchieved) {
        gripCycleCount++;
      }
      gripAchieved = false;
      // Clear any remaining circle indicators
      indicatorContainer.innerHTML = '';
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (!running) return;
    const now = performance.now() - startTime;

    const pointer = activePointers.get(e.pointerId);
    if (pointer) {
      pointer.el.remove();
      activePointers.delete(e.pointerId);
    }

    recordEvent(now, 0, 0, 'end', e.pointerId, false, null);

    if (activePointers.size === 0) {
      if (gripAchieved) {
        gripCycleCount++;
      }
      gripAchieved = false;
      indicatorContainer.innerHTML = '';
    }
  };

  wrapper.addEventListener('pointerdown', onPointerDown);
  wrapper.addEventListener('pointerup', onPointerUp);
  wrapper.addEventListener('pointercancel', onPointerCancel);

  // Incremental save
  async function doIncrementalSave(): Promise<void> {
    gripsSinceSave = 0;
    lastSaveTime = performance.now();
    const rawData = tapEvents.slice(0, tapIndex);
    const metrics = computeGripMetrics(rawData, performance.now() - startTime);

    const partialResult: AssessmentResult = {
      local_uuid: localUuid,
      subject_hash: profile.subject_hash,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'grip_v1',
      status: 'in_progress',
      session_metadata: sessionMetadata,
      raw_data: rawData,
      computed_metrics: metrics,
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
  }

  // Cleanup
  function cleanup(): void {
    running = false;
    if (saveTimer) clearInterval(saveTimer);
    window.removeEventListener('beforeunload', onBeforeUnload);
    removeGuard();
    document.body.style.overscrollBehavior = '';
  }

  // End assessment
  async function endAssessment(): Promise<void> {
    running = false;
    if (saveTimer) clearInterval(saveTimer);

    audioManager.play('end');
    if (supportsVibration()) vibrate(50);

    goSignal.textContent = "Time's Up!";
    goSignal.className = 'tapping-active__go tapping-active__go--end';
    goSignal.style.display = 'flex';
    indicatorContainer.style.display = 'none';

    const rawData = tapEvents.slice(0, tapIndex);
    const actualDuration = performance.now() - startTime;

    const metrics = computeGripMetrics(rawData, actualDuration);
    const checksum = await computeChecksum(rawData);

    const finalResult: AssessmentResult = {
      local_uuid: localUuid,
      subject_hash: profile.subject_hash,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'grip_v1',
      status: 'complete',
      session_metadata: sessionMetadata,
      raw_data: rawData,
      computed_metrics: metrics,
      flagged: false,
      flag_reason: null,
      synced: false,
      sync_attempts: 0,
      checksum,
    };

    try {
      await saveResult(finalResult);
      await addAuditEntry({
        action: 'assessment_completed',
        entity_id: localUuid,
        details: { task_type: 'grip_v1', grip_count: metrics.tap_count },
      });

      if (!profile.first_assessment_completed) {
        profile.first_assessment_completed = true;
        await saveProfile(profile);
      }

      lastGripResult = finalResult;
    } catch (err) {
      console.error('Failed to save final result:', err);
    }

    cleanup();

    setTimeout(() => {
      router.navigate('#/assessment/grip_v1/results', true);
    }, 500);
  }

  // Assemble DOM
  wrapper.appendChild(progressBar);
  wrapper.appendChild(goSignal);
  wrapper.appendChild(indicatorContainer);
  container.appendChild(wrapper);

  // Start the assessment
  await addAuditEntry({
    action: 'assessment_started',
    entity_id: localUuid,
    details: { task_type: 'grip_v1', hand: gripSessionSetup.hand },
  });

  // GO signal
  goSignal.style.display = 'flex';
  audioManager.play('go');
  if (supportsVibration()) vibrate(30);

  setTimeout(() => {
    goSignal.style.display = 'none';
    running = true;
    startTime = performance.now();
    lastSaveTime = startTime;

    // Incremental save timer
    saveTimer = setInterval(() => {
      if (running && performance.now() - lastSaveTime >= INCREMENTAL_SAVE_INTERVAL_MS) {
        doIncrementalSave();
      }
    }, 500);

    // Progress bar
    const progressInterval = setInterval(() => {
      if (!running) {
        clearInterval(progressInterval);
        return;
      }
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / GRIP_DURATION_MS, 1);
      progressFill.style.width = `${progress * 100}%`;
    }, 50);

    // End timer
    setTimeout(() => {
      if (running) {
        endAssessment();
      }
    }, GRIP_DURATION_MS);
  }, 500);
}

const style = document.createElement('style');
style.textContent = `
  .grip-active {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
    z-index: var(--z-overlay);
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .grip-active__indicators {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .grip-active__circle {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary);
    opacity: 0.7;
    transition: background-color 100ms ease;
    pointer-events: none;
  }
  .grip-active__circle--grip {
    background: var(--color-success);
    opacity: 0.9;
  }
`;
document.head.appendChild(style);
