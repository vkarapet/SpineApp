import { clearContainer, createElement } from '../../utils/dom';
import { getProfile, saveProfile, saveResult, addAuditEntry } from '../../core/db';
import { generateUUID } from '../../utils/uuid';
import { computeChecksum } from '../../utils/crypto';
import { audioManager } from '../../utils/audio';
import { vibrate, supportsVibration, getDeviceOS, getBrowserInfo, getViewportDimensions } from '../../utils/device';
import { computeTugMetrics } from './tug-metrics';
import { tugSessionSetup } from './tug-setup';
import { TUG_MAX_DURATION_MS, APP_VERSION } from '../../constants';
import type { RawTimerEvent } from '../../types/assessment';
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

  // Acquire one if we don't have it
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
    test_mode: 'helper',
  };

  const rawEvents: RawTimerEvent[] = [];
  let running = false;
  let startTime = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

  // Build UI
  const wrapper = createElement('div', { className: 'tug-active' });

  // GO signal overlay
  const goSignal = createElement('div', {
    className: 'assessment-active__go',
    textContent: 'GO!',
    'aria-live': 'assertive',
  });

  // Timer display
  const timerDisplay = createElement('div', {
    className: 'tug-active__timer',
    textContent: '00:00.0',
  });

  // Stop button
  const stopBtn = createElement('button', {
    className: 'tug-active__stop-btn',
    textContent: 'STOP',
    'aria-label': 'Stop timer',
  });
  stopBtn.addEventListener('click', () => {
    if (running) endAssessment(false);
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
    if (safetyTimeout) clearTimeout(safetyTimeout);
    window.removeEventListener('beforeunload', onBeforeUnload);
    removeGuard();
    document.body.style.overscrollBehavior = '';
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  async function endAssessment(timedOut: boolean): Promise<void> {
    if (!running) return;
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    if (safetyTimeout) clearTimeout(safetyTimeout);

    const elapsed = performance.now() - startTime;

    // Record stop event
    rawEvents.push({
      kind: 'timer',
      t: elapsed,
      event: 'stop',
      source: 'manual',
    });

    audioManager.play('end');
    if (supportsVibration()) vibrate(50);

    // Update UI
    timerDisplay.textContent = formatTime(elapsed);
    stopBtn.style.display = 'none';

    const endMsg = createElement('div', {
      className: 'tug-active__end-msg',
      textContent: timedOut ? 'Safety timeout reached' : 'Done!',
    });
    wrapper.appendChild(endMsg);

    // Compute and save
    const metrics = computeTugMetrics(rawEvents);
    const checksum = await computeChecksum(rawEvents);

    const finalResult: AssessmentResult = {
      local_uuid: localUuid,
      subject_hash: profile.subject_hash,
      device_id: profile.device_id,
      timestamp_start: sessionStartISO,
      task_type: 'tug_v1',
      status: timedOut ? 'flagged' : 'complete',
      session_metadata: sessionMetadata,
      raw_data: rawEvents,
      computed_metrics: metrics,
      flagged: timedOut,
      flag_reason: timedOut ? 'Safety timeout: test exceeded 2 minutes' : null,
      synced: false,
      sync_attempts: 0,
      checksum,
    };

    try {
      await saveResult(finalResult);
      await addAuditEntry({
        action: 'assessment_completed',
        entity_id: localUuid,
        details: { task_type: 'tug_v1', tug_time_s: metrics.tug_time_s, timed_out: timedOut },
      });

      if (!profile.first_assessment_completed) {
        profile.first_assessment_completed = true;
        await saveProfile(profile);
      }

      lastTugResult = finalResult;
    } catch (err) {
      console.error('Failed to save TUG result:', err);
    }

    cleanup();

    setTimeout(() => {
      router.navigate('#/assessment/tug_v1/results', true);
    }, 500);
  }

  // Assemble DOM
  wrapper.appendChild(goSignal);
  wrapper.appendChild(timerDisplay);
  wrapper.appendChild(stopBtn);
  container.appendChild(wrapper);

  // Audit start
  await addAuditEntry({
    action: 'assessment_started',
    entity_id: localUuid,
    details: { task_type: 'tug_v1', walking_aid: tugSessionSetup.walkingAid },
  });

  // Incremental save with start event
  rawEvents.push({
    kind: 'timer',
    t: 0,
    event: 'start',
    source: 'manual',
  });

  const partialResult: AssessmentResult = {
    local_uuid: localUuid,
    subject_hash: profile.subject_hash,
    device_id: profile.device_id,
    timestamp_start: sessionStartISO,
    task_type: 'tug_v1',
    status: 'in_progress',
    session_metadata: sessionMetadata,
    raw_data: [...rawEvents],
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

    // Timer display update
    timerInterval = setInterval(() => {
      if (!running) return;
      const elapsed = performance.now() - startTime;
      timerDisplay.textContent = formatTime(elapsed);
    }, 100);

    // Safety timeout at 2 minutes
    safetyTimeout = setTimeout(() => {
      if (running) endAssessment(true);
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
`;
document.head.appendChild(style);
