import { clearContainer, createElement } from '../../utils/dom';
import { getProfile, saveProfile, saveResult, addAuditEntry } from '../../core/db';
import { generateUUID } from '../../utils/uuid';
import { computeChecksum } from '../../utils/crypto';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration, getDeviceOS, getBrowserInfo, getViewportDimensions } from '../../utils/device';
import { computeGripMetrics, labelGripCycles } from './grip-metrics';
import { gripSessionSetup } from './grip-setup';
import { GRIP_DURATION_MS, GRIP_MIN_FINGERS, INCREMENTAL_SAVE_INTERVAL_MS, INCREMENTAL_SAVE_GRIP_COUNT, APP_VERSION } from '../../constants';
import type { AssessmentResult, SessionMetadata, UserProfile } from '../../types/db-schemas';
import { showConfirm } from '../../components/confirm-dialog';
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
  const progressBar = createElement('div', { className: 'assessment-active__progress' });
  const progressFill = createElement('div', { className: 'assessment-active__progress-fill' });
  progressBar.appendChild(progressFill);

  // GO signal
  const goSignal = createElement('div', {
    className: 'assessment-active__go',
    textContent: 'GO!',
    'aria-live': 'assertive',
  });

  // Finger indicators container
  const indicatorContainer = createElement('div', { className: 'grip-active__indicators' });

  const viewport = getViewportDimensions();

  // Raw paired touch records — grip labeling is done in post-processing
  interface RawTouch { touch_id: number; start_t: number; start_x: number; start_y: number; end_t: number; end_x: number; end_y: number; }
  const rawTouches: RawTouch[] = [];

  // Pending touches — start data waiting for their end event
  interface PendingTouch { touch_id: number; start_t: number; start_x: number; start_y: number; }
  const pendingTouches = new Map<number, PendingTouch>();

  // Grip state — keyed by Touch.identifier (UI only, not used for data labeling)
  const activeTouches = new Map<number, HTMLElement>();
  const cancelledIds = new Set<number>();
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
    fatigue_rating: null,
    medication_taken: null,
    hand_weakness: gripSessionSetup.weakness,
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

  // Prevent Safari multi-touch gesture interference (pinch/zoom cancels touches)
  const preventGesture = (e: Event) => e.preventDefault();
  wrapper.addEventListener('gesturestart', preventGesture);
  wrapper.addEventListener('gesturechange', preventGesture);
  document.addEventListener('gesturestart', preventGesture);
  document.addEventListener('gesturechange', preventGesture);

  // Lock touch-action on document during test
  const savedDocTouchAction = document.documentElement.style.touchAction;
  const savedBodyTouchAction = document.body.style.touchAction;
  document.documentElement.style.touchAction = 'none';
  document.body.style.touchAction = 'none';

  // beforeunload handler
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (running) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  // Navigation guard
  const removeGuard = router.addGuard(async (_from, _to) => {
    if (!running) return true;
    const leave = await showConfirm('End test early? Data from this session will be discarded.');
    if (leave) cleanup();
    return leave;
  });

  // Flush any pending touches that never got an end event (e.g. test ended mid-grip)
  function flushPendingTouches(now: number): void {
    for (const [, pending] of pendingTouches) {
      rawTouches.push({
        touch_id: pending.touch_id,
        start_t: pending.start_t,
        start_x: pending.start_x,
        start_y: pending.start_y,
        end_t: now,
        end_x: pending.start_x,
        end_y: pending.start_y,
      });
    }
    pendingTouches.clear();
  }

  function clearAllCircles(): void {
    for (const [, circle] of activeTouches) {
      circle.remove();
    }
    activeTouches.clear();
    cancelledIds.clear();
  }

  // Reconcile circle UI from e.touches — the authoritative list of
  // active touches on screen. Creates circles for new touches, updates
  // positions for existing ones. Only removes circles for touches that
  // have genuinely disappeared (not in e.touches AND not cancelled).
  // Cancelled circles persist until a full release or new grip attempt.
  function reconcileCircles(touches: TouchList): void {
    const currentIds = new Set<number>();

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      currentIds.add(touch.identifier);

      let circle = activeTouches.get(touch.identifier);
      if (!circle) {
        circle = createElement('div', { className: 'grip-active__circle' });
        if (gripAchieved) circle.classList.add('grip-active__circle--grip');
        indicatorContainer.appendChild(circle);
        activeTouches.set(touch.identifier, circle);
      }
      circle.style.left = `${touch.clientX}px`;
      circle.style.top = `${touch.clientY}px`;

      // If this touch was previously cancelled but reappears, un-cancel it
      cancelledIds.delete(touch.identifier);
    }

    // Remove circles for touches that are gone AND not cancelled
    for (const [id, circle] of activeTouches) {
      if (!currentIds.has(id) && !cancelledIds.has(id)) {
        circle.remove();
        activeTouches.delete(id);
      }
    }

    // Grip detection
    if (activeTouches.size >= GRIP_MIN_FINGERS && !gripAchieved) {
      gripAchieved = true;
      activeTouches.forEach((el) => el.classList.add('grip-active__circle--grip'));

      const hapticEnabled = profile?.preferences.haptic_enabled ?? true;
      if (hapticEnabled && supportsVibration()) vibrate(10);

      gripsSinceSave++;
      if (gripsSinceSave >= INCREMENTAL_SAVE_GRIP_COUNT) doIncrementalSave();
    }
  }

  // Touch event handlers
  const onTouchStart = (e: TouchEvent) => {
    if (!running) return;
    e.preventDefault();

    // If all existing circles are orphans from a previous cancel,
    // this is a new grip attempt — clean up before starting fresh
    if (activeTouches.size > 0 && cancelledIds.size === activeTouches.size) {
      if (gripAchieved) gripCycleCount++;
      gripAchieved = false;
      clearAllCircles();
    }

    const now = performance.now() - startTime;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      pendingTouches.set(touch.identifier, {
        touch_id: touch.identifier,
        start_t: now,
        start_x: touch.clientX,
        start_y: touch.clientY,
      });
    }
    reconcileCircles(e.touches);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!running) return;

    const now = performance.now() - startTime;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Pair with pending start data
      const pending = pendingTouches.get(touch.identifier);
      if (pending) {
        rawTouches.push({
          touch_id: pending.touch_id,
          start_t: pending.start_t,
          start_x: pending.start_x,
          start_y: pending.start_y,
          end_t: now,
          end_x: touch.clientX,
          end_y: touch.clientY,
        });
        pendingTouches.delete(touch.identifier);
      }

      // Remove circle for this lifted finger
      const circle = activeTouches.get(touch.identifier);
      if (circle) {
        circle.remove();
        activeTouches.delete(touch.identifier);
      }
      cancelledIds.delete(touch.identifier);
    }

    // Full release — no more active touches on screen
    if (e.touches.length === 0) {
      if (gripAchieved) gripCycleCount++;
      clearAllCircles();
      gripAchieved = false;
    }
  };

  const onTouchCancel = (e: TouchEvent) => {
    if (!running) return;

    const now = performance.now() - startTime;

    // Record cancelled touches as completed contacts
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pending = pendingTouches.get(touch.identifier);
      if (pending) {
        rawTouches.push({
          touch_id: pending.touch_id,
          start_t: pending.start_t,
          start_x: pending.start_x,
          start_y: pending.start_y,
          end_t: now,
          end_x: touch.clientX,
          end_y: touch.clientY,
        });
        pendingTouches.delete(touch.identifier);
      }

      // Mark as cancelled but keep the circle visible — the finger is
      // likely still on screen, the OS just stole the touch tracking.
      // Circles persist until the next touchstart cleans up orphans.
      cancelledIds.add(touch.identifier);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!running) return;
    e.preventDefault();
    reconcileCircles(e.touches);
  };

  wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
  wrapper.addEventListener('touchend', onTouchEnd, { passive: false });
  wrapper.addEventListener('touchcancel', onTouchCancel, { passive: false });
  wrapper.addEventListener('touchmove', onTouchMove, { passive: false });

  // Incremental save
  async function doIncrementalSave(): Promise<void> {
    gripsSinceSave = 0;
    lastSaveTime = performance.now();
    const rawData = labelGripCycles([...rawTouches]);
    const metrics = computeGripMetrics(rawData, performance.now() - startTime);

    const partialResult: AssessmentResult = {
      local_uuid: localUuid,
      participant_id: profile.participant_id,

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
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
    document.documentElement.style.touchAction = savedDocTouchAction;
    document.body.style.touchAction = savedBodyTouchAction;
  }

  // End assessment
  async function endAssessment(): Promise<void> {
    running = false;
    if (saveTimer) clearInterval(saveTimer);

    audioManager.play('end');
    if (supportsVibration()) vibrate(50);

    goSignal.textContent = "Time's Up!";
    goSignal.className = 'assessment-active__go assessment-active__go--end';
    goSignal.style.display = 'flex';
    indicatorContainer.style.display = 'none';

    // Flush any touches still in progress (test ended mid-grip)
    if (pendingTouches.size > 0) {
      flushPendingTouches(performance.now() - startTime);
    }

    // Post-process: label all touches with grip cycle info
    const rawData = labelGripCycles(rawTouches);
    const actualDuration = performance.now() - startTime;

    const metrics = computeGripMetrics(rawData, actualDuration);
    const checksum = await computeChecksum(rawData);

    const finalResult: AssessmentResult = {
      local_uuid: localUuid,
      participant_id: profile.participant_id,

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
      checksum,
    };

    try {
      await saveResult(finalResult);

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
    // Force layout flush so first touch coordinates are accurate
    void wrapper.offsetHeight;
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
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .grip-active__circle {
    position: fixed;
    width: 20mm;
    height: 20mm;
    border-radius: 50%;
    border: 3mm solid #7A003C;
    background: transparent;
    box-sizing: content-box;
    transform: translate(-50%, -50%);
    transition: border-color 100ms ease;
    pointer-events: none;
  }
  .grip-active__circle--grip {
    border-color: var(--color-success);
  }
`;
document.head.appendChild(style);
