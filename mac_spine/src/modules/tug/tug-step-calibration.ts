import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile, saveProfile, addAuditEntry } from '../../core/db';
import { requestMotionPermission } from '../../utils/motion-permission';
import {
  APP_VERSION,
  TUG_STEP_CAL_EXPECTED_STEPS,
  TUG_STEP_CAL_CAPTURE_INIT_THRESHOLD,
  TUG_STEP_CAL_THRESHOLD_MULTIPLIER,
  TUG_STEP_CAL_PREP_COUNTDOWN_MS,
  TUG_STEP_CAL_TAIL_TRIM_MS,
  TUG_STEP_MIN_INTERVAL_MS,
  TUG_STEP_PEAK_VALLEY_MAX_MS,
} from '../../constants';
import {
  type Vec3,
  lowPassFilter,
  decomposeAcceleration,
  StepDetector,
} from './tug-signal-processing';
import { TUG_CONFIG } from './tug-types';
import type { TugStepCalibration } from '../../types/db-schemas';
import { router } from '../../main';

type Stage = 'intro' | 'capture' | 'capture-review' | 'verify' | 'verify-result';

interface CaptureResult {
  peakValleyDiffs: number[];
  median: number;
  threshold: number;
}

export async function renderTugStepCalibration(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();
  if (!profile) {
    router.navigate('#/splash', true);
    return;
  }

  // First-run gate: if sensor permission/practice hasn't been completed yet,
  // run the gravity calibration screen first.
  if (!profile.practice_completed) {
    router.navigate('#/assessment/tug_v1/practice', true);
    return;
  }

  audioManager.initOnGesture();

  let stage: Stage = 'intro';
  let lastCapture: CaptureResult | null = null;

  const wrapper = createElement('main', { className: 'tug-stepcal' });
  wrapper.setAttribute('role', 'main');
  container.appendChild(wrapper);

  function render(): void {
    clearContainer(wrapper);
    switch (stage) {
      case 'intro': renderIntro(); break;
      case 'capture': renderCapture(); break;
      case 'capture-review': renderCaptureReview(); break;
      case 'verify': renderVerify(); break;
      case 'verify-result': renderVerifyResult(); break;
    }
  }

  function renderIntro(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Walking Calibration' }));
    const body = createElement('div', { className: 'tug-stepcal__body' });
    body.innerHTML = `
      <p>We need to teach the app what your walking looks like so it can detect your steps reliably during the TUG test.</p>
      <p><strong>This takes two short passes:</strong></p>
      <ol class="tug-stepcal__list">
        <li><strong>Capture:</strong> walk 5 normal steps with the phone in your pocket.</li>
        <li><strong>Verify:</strong> walk 5 more steps; we'll play a tick for each detected step and you'll confirm if the count matched.</li>
      </ol>
      <p class="tug-stepcal__note"><strong>Phone in your front trouser pocket</strong> — same as during the real test. Calibration only applies to that placement.</p>
    `;
    wrapper.appendChild(body);

    wrapper.appendChild(createButton({
      text: 'Start Calibration',
      variant: 'primary',
      fullWidth: true,
      onClick: async () => {
        const perm = await requestMotionPermission();
        if (perm !== 'granted') {
          alert('Motion sensor permission is required to calibrate.');
          return;
        }
        stage = 'capture';
        render();
      },
    }));

    wrapper.appendChild(createButton({
      text: 'Cancel',
      variant: 'text',
      onClick: () => router.navigate('#/menu'),
    }));
  }

  function renderCapture(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Capture Walking' }));
    wrapper.appendChild(elFromHTML(`
      <p>Tap <strong>Start</strong>, then slip the phone into your front pocket and take <strong>${TUG_STEP_CAL_EXPECTED_STEPS} normal walking steps</strong>. Take out the phone and tap <strong>Stop</strong> when you finish.</p>
    `));

    const status = createElement('div', { className: 'tug-stepcal__status', textContent: 'Ready when you are.' });
    wrapper.appendChild(status);

    let recording = false;
    let samples: { t: number; vAccel: number }[] = [];
    let gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let startTime = 0;

    const motionHandler = (ev: DeviceMotionEvent) => {
      if (!recording) return;
      const t = performance.now() - startTime;
      const accelRaw: Vec3 = {
        x: ev.accelerationIncludingGravity?.x ?? 0,
        y: ev.accelerationIncludingGravity?.y ?? 0,
        z: ev.accelerationIncludingGravity?.z ?? 0,
      };
      gravity = lowPassFilter(accelRaw, gravity, TUG_CONFIG.gravityFilterAlpha);
      const dec = decomposeAcceleration(accelRaw, gravity);
      samples.push({ t, vAccel: dec.vertical });
    };

    function cleanup(): void {
      window.removeEventListener('devicemotion', motionHandler);
      if (countdownTimer) clearInterval(countdownTimer);
    }

    const startBtn = createButton({
      text: 'Start',
      variant: 'primary',
      fullWidth: true,
      onClick: () => {
        startBtn.disabled = true;
        startBtn.classList.add('btn--disabled');
        // 3-second countdown so they can pocket the phone
        let remaining = Math.ceil(TUG_STEP_CAL_PREP_COUNTDOWN_MS / 1000);
        status.textContent = `Pocket the phone now... ${remaining}`;
        countdownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            status.textContent = `Pocket the phone now... ${remaining}`;
            return;
          }
          if (countdownTimer) clearInterval(countdownTimer);
          status.textContent = `Walk ${TUG_STEP_CAL_EXPECTED_STEPS} steps now. Tap Stop when done.`;
          recording = true;
          samples = [];
          startTime = performance.now();
          window.addEventListener('devicemotion', motionHandler);
          stopBtn.disabled = false;
          stopBtn.classList.remove('btn--disabled');
        }, 1000);
      },
    });

    const stopBtn = createButton({
      text: 'Stop',
      variant: 'secondary',
      fullWidth: true,
      disabled: true,
      onClick: () => {
        recording = false;
        cleanup();
        // Trim tail to remove phone-removal noise
        const cutoffT = (performance.now() - startTime) - TUG_STEP_CAL_TAIL_TRIM_MS;
        const trimmed = samples.filter((s) => s.t <= cutoffT);
        lastCapture = analyzeSamples(trimmed);
        stage = 'capture-review';
        render();
      },
    });

    wrapper.appendChild(startBtn);
    wrapper.appendChild(stopBtn);
  }

  function renderCaptureReview(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Capture Complete' }));
    const detected = lastCapture?.peakValleyDiffs.length ?? 0;
    const median = lastCapture?.median ?? 0;
    const threshold = lastCapture?.threshold ?? 0;

    wrapper.appendChild(elFromHTML(`
      <p>Detected <strong>${detected}</strong> peak-valley events.</p>
      <p class="tug-stepcal__note">Median swing: ${median.toFixed(2)} m/s². Computed threshold: ${threshold.toFixed(2)} m/s².</p>
      <p>Next we'll verify by playing a tick on each detected step as you walk.</p>
    `));

    wrapper.appendChild(createButton({
      text: 'Continue to Verify',
      variant: 'primary',
      fullWidth: true,
      onClick: () => { stage = 'verify'; render(); },
    }));

    wrapper.appendChild(createButton({
      text: 'Re-record',
      variant: 'secondary',
      fullWidth: true,
      onClick: () => { lastCapture = null; stage = 'capture'; render(); },
    }));
  }

  function renderVerify(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Verify Calibration' }));
    wrapper.appendChild(elFromHTML(`
      <p>Tap <strong>Start</strong>, pocket the phone, walk <strong>${TUG_STEP_CAL_EXPECTED_STEPS} steps</strong>. You'll hear a tick for each step the app detects. Take out the phone and tap <strong>Stop</strong> when done.</p>
    `));

    const status = createElement('div', { className: 'tug-stepcal__status', textContent: 'Ready when you are.' });
    wrapper.appendChild(status);

    const counter = createElement('div', { className: 'tug-stepcal__counter', textContent: '0' });
    counter.style.display = 'none';
    wrapper.appendChild(counter);

    let recording = false;
    let gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
    let startTime = 0;
    let detectedSteps = 0;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    const detector = new StepDetector({
      initialThreshold: lastCapture?.threshold ?? TUG_CONFIG.stepInitialThreshold,
      minIntervalMs: TUG_STEP_MIN_INTERVAL_MS,
      peakValleyMaxMs: TUG_STEP_PEAK_VALLEY_MAX_MS,
    });

    const motionHandler = (ev: DeviceMotionEvent) => {
      if (!recording) return;
      const t = performance.now() - startTime;
      const accelRaw: Vec3 = {
        x: ev.accelerationIncludingGravity?.x ?? 0,
        y: ev.accelerationIncludingGravity?.y ?? 0,
        z: ev.accelerationIncludingGravity?.z ?? 0,
      };
      gravity = lowPassFilter(accelRaw, gravity, TUG_CONFIG.gravityFilterAlpha);
      const dec = decomposeAcceleration(accelRaw, gravity);
      const step = detector.processSample(t, dec.vertical);
      if (step) {
        detectedSteps += 1;
        counter.textContent = String(detectedSteps);
        audioManager.playTick();
      }
    };

    function cleanup(): void {
      window.removeEventListener('devicemotion', motionHandler);
      if (countdownTimer) clearInterval(countdownTimer);
    }

    const startBtn = createButton({
      text: 'Start',
      variant: 'primary',
      fullWidth: true,
      onClick: () => {
        startBtn.disabled = true;
        startBtn.classList.add('btn--disabled');
        let remaining = Math.ceil(TUG_STEP_CAL_PREP_COUNTDOWN_MS / 1000);
        status.textContent = `Pocket the phone now... ${remaining}`;
        countdownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            status.textContent = `Pocket the phone now... ${remaining}`;
            return;
          }
          if (countdownTimer) clearInterval(countdownTimer);
          status.textContent = `Walk ${TUG_STEP_CAL_EXPECTED_STEPS} steps now.`;
          counter.style.display = 'block';
          recording = true;
          startTime = performance.now();
          window.addEventListener('devicemotion', motionHandler);
          stopBtn.disabled = false;
          stopBtn.classList.remove('btn--disabled');
        }, 1000);
      },
    });

    const stopBtn = createButton({
      text: 'Stop',
      variant: 'secondary',
      fullWidth: true,
      disabled: true,
      onClick: () => {
        recording = false;
        cleanup();
        verifyDetected = detectedSteps;
        stage = 'verify-result';
        render();
      },
    });

    wrapper.appendChild(startBtn);
    wrapper.appendChild(stopBtn);
  }

  let verifyDetected = 0;

  function renderVerifyResult(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'How did we do?' }));
    wrapper.appendChild(elFromHTML(`
      <p>The app detected <strong>${verifyDetected}</strong> step${verifyDetected === 1 ? '' : 's'}.</p>
      <p>Did each tick match a step you actually took?</p>
    `));

    wrapper.appendChild(createButton({
      text: 'Yes — save calibration',
      variant: 'primary',
      fullWidth: true,
      onClick: async () => {
        if (!lastCapture) return;
        const cal: TugStepCalibration = {
          threshold_mps2: round3(lastCapture.threshold),
          median_peak_valley_mps2: round3(lastCapture.median),
          n_samples: lastCapture.peakValleyDiffs.length,
          calibrated_at: new Date().toISOString(),
          app_version: APP_VERSION,
        };
        const p = await getProfile();
        if (!p) return;
        p.tug_step_calibration = cal;
        p.updated_at = new Date().toISOString();
        await saveProfile(p);
        await addAuditEntry({
          action: 'tug_step_calibration_saved',
          entity_id: p.participant_id,
          details: { threshold_mps2: cal.threshold_mps2, median_peak_valley_mps2: cal.median_peak_valley_mps2, n_samples: cal.n_samples },
        });
        router.navigate('#/assessment/tug_v1/instructions');
      },
    }));

    wrapper.appendChild(createButton({
      text: 'No — try again',
      variant: 'secondary',
      fullWidth: true,
      onClick: () => { lastCapture = null; stage = 'capture'; render(); },
    }));

    wrapper.appendChild(createButton({
      text: 'Cancel',
      variant: 'text',
      onClick: () => router.navigate('#/menu'),
    }));
  }

  render();
}

/**
 * Analyze a buffered window of vertical acceleration samples for step-like
 * peak-valley pairs. Uses a permissive detector (no adaptation) so we capture
 * all candidate events; the median of their peak-valley diffs gives the
 * participant's typical swing.
 */
function analyzeSamples(samples: { t: number; vAccel: number }[]): CaptureResult {
  const detector = new StepDetector({
    initialThreshold: TUG_STEP_CAL_CAPTURE_INIT_THRESHOLD,
    minIntervalMs: TUG_STEP_MIN_INTERVAL_MS,
    peakValleyMaxMs: TUG_STEP_PEAK_VALLEY_MAX_MS,
  });
  const diffs: number[] = [];
  for (const s of samples) {
    const step = detector.processSample(s.t, s.vAccel);
    if (step) {
      diffs.push(step.peakAccel - step.valleyAccel);
    }
  }
  const median = medianOf(diffs);
  const threshold = TUG_STEP_CAL_THRESHOLD_MULTIPLIER * median;
  return { peakValleyDiffs: diffs, median, threshold };
}

function medianOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function elFromHTML(html: string): HTMLElement {
  const tmpl = document.createElement('template');
  tmpl.innerHTML = html.trim();
  return tmpl.content.firstElementChild as HTMLElement;
}

const style = document.createElement('style');
style.textContent = `
  .tug-stepcal {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 30rem;
    margin: 0 auto;
  }
  .tug-stepcal h1 {
    font-size: var(--font-size-xl);
    margin: 0;
  }
  .tug-stepcal__body p,
  .tug-stepcal p {
    margin: 0;
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
  }
  .tug-stepcal__list {
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tug-stepcal__note {
    background: var(--color-bg-secondary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }
  .tug-stepcal__status {
    text-align: center;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-primary);
    margin: var(--space-3) 0;
  }
  .tug-stepcal__counter {
    font-size: 5rem;
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: var(--color-primary);
    line-height: 1;
  }
`;
document.head.appendChild(style);
