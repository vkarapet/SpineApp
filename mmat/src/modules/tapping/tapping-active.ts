import { clearContainer, createElement } from '../../utils/dom';
import { getProfile, saveProfile, saveResult, addAuditEntry } from '../../core/db';
import { generateUUID } from '../../utils/uuid';
import { computeChecksum } from '../../utils/crypto';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration, getDeviceOS, getBrowserInfo, getViewportDimensions } from '../../utils/device';
import { computeTappingMetrics } from './tapping-metrics';
import { sessionSetup } from './tapping-setup';
import { ASSESSMENT_DURATION_MS, INCREMENTAL_SAVE_INTERVAL_MS, INCREMENTAL_SAVE_TAP_COUNT, APP_VERSION } from '../../constants';
import type { RawTapEvent } from '../../types/assessment';
import type { AssessmentResult, SessionMetadata, UserProfile } from '../../types/db-schemas';
import { showConfirm } from '../../components/confirm-dialog';
import { router } from '../../main';

// Shared state for results screen
export let lastAssessmentResult: AssessmentResult | null = null;

export async function renderTappingActive(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profileOrUndef = await getProfile();
  if (!profileOrUndef) {
    router.navigate('#/splash', true);
    return;
  }
  const profile: UserProfile = profileOrUndef;

  const wrapper = createElement('div', { className: 'tapping-active' });

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

  // Tap target
  const viewport = getViewportDimensions();
  const targetSize = Math.min(Math.max(120, viewport.width * 0.35), 160);
  const targetRadius = targetSize / 2;

  // Offset based on hand
  const handOffset = viewport.width * 0.1;
  const centerX =
    viewport.width / 2 + (sessionSetup.hand === 'right' ? handOffset / 2 : -handOffset / 2);
  const centerY = viewport.height * 0.7; // lower third

  const target = createElement('div', { className: 'tapping-active__target' });
  target.style.width = `${targetSize}px`;
  target.style.height = `${targetSize}px`;
  target.style.left = `${centerX - targetRadius}px`;
  target.style.top = `${centerY - targetRadius}px`;

  // Pre-allocate tap array
  const tapEvents: RawTapEvent[] = new Array(200);
  let tapIndex = 0;

  let activeTouchId: number | null = null;
  let running = false;
  let startTime = 0;
  const sessionStartISO = new Date().toISOString();
  const localUuid = generateUUID();
  let lastSaveTime = 0;
  let tapsSinceSave = 0;
  let saveTimer: ReturnType<typeof setInterval> | null = null;

  const sessionMetadata: SessionMetadata = {
    hand_used: sessionSetup.hand,
    dominant_hand: profile.preferences.dominant_hand,
    fatigue_rating: sessionSetup.fatigue,
    medication_taken: sessionSetup.medication,
    screen_width_px: viewport.width,
    screen_height_px: viewport.height,
    target_radius_px: targetRadius,
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

  // Navigation guard for Android back button
  const removeGuard = router.addGuard(async (_from, _to) => {
    if (!running) return true;
    const leave = await showConfirm('End test early? Data from this session will be discarded.');
    if (leave) cleanup();
    return leave;
  });

  // Record tap event
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
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left - targetRadius;
    const y = e.clientY - rect.top - targetRadius;

    // Palm rejection
    const radiusX = (e as PointerEvent).width ? (e as PointerEvent).width / 2 : 0;
    const radiusY = (e as PointerEvent).height ? (e as PointerEvent).height / 2 : 0;
    if (radiusX > 30 || radiusY > 30) {
      recordEvent(now, x, y, 'start', e.pointerId, true, 'palm');
      return;
    }

    // Lift-off rule: reject if another touch is active
    if (activeTouchId !== null && activeTouchId !== e.pointerId) {
      recordEvent(now, x, y, 'start', e.pointerId, true, 'multi_touch');
      return;
    }

    activeTouchId = e.pointerId;
    recordEvent(now, x, y, 'start', e.pointerId, false, null);

    // Visual feedback
    requestAnimationFrame(() => {
      target.classList.add('tapping-active__target--tapped');
      setTimeout(() => {
        target.classList.remove('tapping-active__target--tapped');
      }, 100);
    });

    // Haptic
    const hapticEnabled = profile?.preferences.haptic_enabled ?? true;
    if (hapticEnabled && supportsVibration()) {
      vibrate(10);
    }

    tapsSinceSave++;

    // Incremental save check
    if (tapsSinceSave >= INCREMENTAL_SAVE_TAP_COUNT) {
      doIncrementalSave();
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!running) return;

    const now = performance.now() - startTime;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left - targetRadius;
    const y = e.clientY - rect.top - targetRadius;

    if (e.pointerId === activeTouchId) {
      activeTouchId = null;
    }

    recordEvent(now, x, y, 'end', e.pointerId, false, null);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (!running) return;
    // Treat cancel as end (Safari fires on notification banners)
    const now = performance.now() - startTime;
    if (e.pointerId === activeTouchId) {
      activeTouchId = null;
    }
    recordEvent(now, 0, 0, 'end', e.pointerId, false, null);
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);

  // Also capture events outside target
  wrapper.addEventListener('pointerdown', (e) => {
    if (e.target !== target && running) {
      e.preventDefault();
    }
  });

  // Build incremental save
  async function doIncrementalSave(): Promise<void> {
    tapsSinceSave = 0;
    lastSaveTime = performance.now();
    const rawData = tapEvents.slice(0, tapIndex);
    const metrics = computeTappingMetrics(
      rawData,
      0, 0, // relative coords
      targetRadius,
      performance.now() - startTime,
    );

    const partialResult: AssessmentResult = {
      local_uuid: localUuid,
      participant_id: profile.participant_id,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'tapping_v1',
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

  // Cleanup function
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

    // Play end sound
    audioManager.play('end');
    if (supportsVibration()) vibrate(50);

    // Show time's up
    goSignal.textContent = "Time's Up!";
    goSignal.className = 'assessment-active__go assessment-active__go--end';
    goSignal.style.display = 'flex';
    target.style.display = 'none';

    const rawData = tapEvents.slice(0, tapIndex);
    const actualDuration = performance.now() - startTime;

    const metrics = computeTappingMetrics(
      rawData,
      0, 0, // coords are relative to target center
      targetRadius,
      actualDuration,
    );

    const checksum = await computeChecksum(rawData);

    const finalResult: AssessmentResult = {
      local_uuid: localUuid,
      participant_id: profile.participant_id,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'tapping_v1',
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

      lastAssessmentResult = finalResult;
    } catch (err) {
      console.error('Failed to save final result:', err);
    }

    cleanup();

    // Brief pause before results
    setTimeout(() => {
      router.navigate('#/assessment/tapping_v1/results', true);
    }, 500);
  }

  // Assemble DOM
  wrapper.appendChild(progressBar);
  wrapper.appendChild(goSignal);
  wrapper.appendChild(target);
  container.appendChild(wrapper);

  // Start the assessment
  await addAuditEntry({
    action: 'assessment_started',
    entity_id: localUuid,
    details: { task_type: 'tapping_v1', hand: sessionSetup.hand },
  });

  // GO signal
  goSignal.style.display = 'flex';
  audioManager.play('go');
  if (supportsVibration()) vibrate(30);

  // Start after brief GO display
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

    // Progress bar update
    const progressInterval = setInterval(() => {
      if (!running) {
        clearInterval(progressInterval);
        return;
      }
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / ASSESSMENT_DURATION_MS, 1);
      progressFill.style.width = `${progress * 100}%`;
    }, 50);

    // End timer
    setTimeout(() => {
      if (running) {
        endAssessment();
      }
    }, ASSESSMENT_DURATION_MS);
  }, 500);
}

const style = document.createElement('style');
style.textContent = `
  .tapping-active {
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
  .tapping-active__target {
    position: absolute;
    border-radius: 50%;
    background: var(--color-primary);
    border: 4px solid var(--color-primary-dark);
    cursor: pointer;
    z-index: 1;
    min-width: 20px;
  }
  .tapping-active__target--tapped {
    background: var(--color-primary-light);
  }
`;
document.head.appendChild(style);
