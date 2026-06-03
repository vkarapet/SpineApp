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
  TUG_STEP_CAL_BURST_MAX_GAP_MS,
  TUG_STEP_MIN_INTERVAL_MS,
  TUG_STEP_PEAK_VALLEY_MAX_MS,
} from '../../constants';
import {
  type Vec3,
  type DetectedStep,
  lowPassFilter,
  decomposeAcceleration,
  StepDetector,
} from './tug-signal-processing';
import { TUG_CONFIG } from './tug-types';
import type { TugStepCalibration } from '../../types/db-schemas';
import { router } from '../../main';

type Stage = 'intro' | 'capture' | 'capture-review' | 'verify' | 'verify-result';

interface CandidateEvent {
  t: number;
  peakValleyDiff: number;
}

interface CaptureResult {
  candidates: CandidateEvent[];
  selectedDiffs: number[];      // P-V diffs of the chosen N (=5) walking steps
  median: number;               // median of the selected
  minDiff: number;               // min of the selected — drives the threshold
  threshold: number;             // 0.5 × minDiff
  burstStartT: number | null;
  burstEndT: number | null;
}

export async function renderTugStepCalibration(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();
  if (!profile) {
    router.navigate('#/splash', true);
    return;
  }

  // First-run gate: sensor permission/practice must be completed first.
  if (!profile.practice_completed) {
    router.navigate('#/assessment/tug_v1/practice', true);
    return;
  }

  audioManager.initOnGesture();
  audioManager.setEnabled(profile.preferences.audio_enabled ?? true);
  await audioManager.preloadAll();

  let stage: Stage = 'intro';
  let lastCapture: CaptureResult | null = null;
  let verifyDetected = 0;

  const wrapper = createElement('main', { className: 'tug-stepcal' });
  wrapper.setAttribute('role', 'main');
  container.appendChild(wrapper);

  function render(): void {
    clearContainer(wrapper);
    switch (stage) {
      case 'intro': renderIntro(); break;
      case 'capture': renderRecordingScreen('capture'); break;
      case 'capture-review': renderCaptureReview(); break;
      case 'verify': renderRecordingScreen('verify'); break;
      case 'verify-result': renderVerifyResult(); break;
    }
  }

  function renderIntro(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Walking Calibration' }));
    wrapper.appendChild(elFromHTML(`
      <div class="tug-stepcal__body">
        <p>We need to learn what your walking looks like so step detection is reliable during the TUG test.</p>
        <p><strong>Two short passes:</strong></p>
        <ol class="tug-stepcal__list">
          <li><strong>Capture:</strong> walk ${TUG_STEP_CAL_EXPECTED_STEPS} normal steps and bring your legs together.</li>
          <li><strong>Verify:</strong> walk ${TUG_STEP_CAL_EXPECTED_STEPS} more steps. You'll hear a tick per detected step; you confirm the count.</li>
        </ol>
        <p class="tug-stepcal__note"><strong>Hold the phone in your hand</strong>, screen facing you, so you can see the prompts and the counter. Use the same placement during the TUG test.</p>
      </div>
    `));

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

  /**
   * Shared recording screen used for both capture and verify. Differences:
   *   - capture: no live ticks; on Stop, runs ground-truth analysis
   *   - verify:  live ticks + on-screen counter; on Stop, navigates to result
   */
  function renderRecordingScreen(mode: 'capture' | 'verify'): void {
    const isVerify = mode === 'verify';
    wrapper.appendChild(createElement('h1', {
      textContent: isVerify ? 'Verify Calibration' : 'Capture Walking',
    }));

    wrapper.appendChild(elFromHTML(`
      <p>Press <strong>Start</strong>, hold the phone in front of you, and stay still for the 3-second countdown.</p>
      <p>At the <strong>GO</strong> cue, walk ${TUG_STEP_CAL_EXPECTED_STEPS} normal steps${isVerify ? '' : ' and bring your legs together'}. Tap <strong>Stop</strong> when you finish.</p>
    `));

    const status = createElement('div', { className: 'tug-stepcal__status', textContent: 'Ready when you are.' });
    wrapper.appendChild(status);

    // Verify-only: counter "n / 5"
    const counter = createElement('div', { className: 'tug-stepcal__counter' });
    counter.textContent = `0 / ${TUG_STEP_CAL_EXPECTED_STEPS}`;
    counter.style.display = 'none';
    if (isVerify) wrapper.appendChild(counter);

    // GO flash overlay
    const goFlash = createElement('div', { className: 'tug-stepcal__go-flash', textContent: 'GO!' });
    goFlash.style.display = 'none';
    wrapper.appendChild(goFlash);

    // State
    let phase: 'idle' | 'baseline' | 'recording' = 'idle';
    let gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
    let baselineSampleCount = 0;
    let recordStartT = 0;
    let samples: { t: number; vAccel: number }[] = [];
    let detectedCount = 0;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    // Verify-only step detector (seeded from the saved capture threshold)
    const verifyDetector = isVerify
      ? new StepDetector({
        initialThreshold: lastCapture?.threshold ?? TUG_CONFIG.stepInitialThreshold,
        minIntervalMs: TUG_STEP_MIN_INTERVAL_MS,
        peakValleyMaxMs: TUG_STEP_PEAK_VALLEY_MAX_MS,
      })
      : null;

    const motionHandler = (ev: DeviceMotionEvent) => {
      const accelRaw: Vec3 = {
        x: ev.accelerationIncludingGravity?.x ?? 0,
        y: ev.accelerationIncludingGravity?.y ?? 0,
        z: ev.accelerationIncludingGravity?.z ?? 0,
      };
      gravity = lowPassFilter(accelRaw, gravity, TUG_CONFIG.gravityFilterAlpha);

      if (phase === 'baseline') {
        baselineSampleCount += 1;
        return;
      }
      if (phase !== 'recording') return;

      const t = performance.now() - recordStartT;
      const dec = decomposeAcceleration(accelRaw, gravity);
      samples.push({ t, vAccel: dec.vertical });

      if (verifyDetector) {
        const step = verifyDetector.processSample(t, dec.vertical);
        if (step) {
          detectedCount += 1;
          counter.textContent = `${detectedCount} / ${TUG_STEP_CAL_EXPECTED_STEPS}`;
          audioManager.playTick();
        }
      }
    };

    function cleanup(): void {
      window.removeEventListener('devicemotion', motionHandler);
      if (countdownTimer) clearInterval(countdownTimer);
    }

    function flashGo(): void {
      audioManager.play('go');
      goFlash.style.display = 'flex';
      setTimeout(() => { goFlash.style.display = 'none'; }, 600);
    }

    const startBtn = createButton({
      text: 'Start',
      variant: 'primary',
      fullWidth: true,
      onClick: () => {
        startBtn.disabled = true;
        startBtn.classList.add('btn--disabled');

        // Begin baseline phase
        phase = 'baseline';
        samples = [];
        detectedCount = 0;
        baselineSampleCount = 0;
        window.addEventListener('devicemotion', motionHandler);

        let remaining = Math.ceil(TUG_STEP_CAL_PREP_COUNTDOWN_MS / 1000);
        status.textContent = `Hold still... ${remaining}`;
        countdownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            status.textContent = `Hold still... ${remaining}`;
            return;
          }
          if (countdownTimer) clearInterval(countdownTimer);
          // Switch to recording
          phase = 'recording';
          recordStartT = performance.now();
          status.textContent = `Walk ${TUG_STEP_CAL_EXPECTED_STEPS} steps now`;
          if (isVerify) counter.style.display = 'block';
          flashGo();
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
        phase = 'idle';
        cleanup();
        if (isVerify) {
          verifyDetected = detectedCount;
          stage = 'verify-result';
        } else {
          lastCapture = analyzeWithGroundTruth(samples, TUG_STEP_CAL_EXPECTED_STEPS);
          stage = 'capture-review';
        }
        render();
      },
    });

    wrapper.appendChild(startBtn);
    wrapper.appendChild(stopBtn);
  }

  function renderCaptureReview(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Capture Complete' }));
    const cand = lastCapture?.candidates.length ?? 0;
    const selected = lastCapture?.selectedDiffs ?? [];
    const minDiff = lastCapture?.minDiff ?? 0;
    const threshold = lastCapture?.threshold ?? 0;

    if (selected.length < TUG_STEP_CAL_EXPECTED_STEPS) {
      wrapper.appendChild(elFromHTML(`
        <p>We only identified <strong>${selected.length}</strong> step-like events out of ${TUG_STEP_CAL_EXPECTED_STEPS} expected (${cand} total candidates). Please walk a bit more deliberately and try again.</p>
      `));
      wrapper.appendChild(createButton({
        text: 'Re-record',
        variant: 'primary',
        fullWidth: true,
        onClick: () => { lastCapture = null; stage = 'capture'; render(); },
      }));
      wrapper.appendChild(createButton({
        text: 'Cancel',
        variant: 'text',
        onClick: () => router.navigate('#/menu'),
      }));
      return;
    }

    wrapper.appendChild(elFromHTML(`
      <p>Identified <strong>${selected.length}</strong> walking steps from ${cand} candidate events.</p>
      <p class="tug-stepcal__note">Smallest step swing: ${minDiff.toFixed(2)} m/s². Computed threshold: ${threshold.toFixed(2)} m/s² (= 0.5 × smallest).</p>
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

  function renderVerifyResult(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'How did we do?' }));
    wrapper.appendChild(elFromHTML(`
      <p>The app detected <strong>${verifyDetected}</strong> step${verifyDetected === 1 ? '' : 's'} out of ${TUG_STEP_CAL_EXPECTED_STEPS}.</p>
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
          n_samples: lastCapture.selectedDiffs.length,
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
          details: {
            threshold_mps2: cal.threshold_mps2,
            min_peak_valley_mps2: round3(lastCapture.minDiff),
            median_peak_valley_mps2: cal.median_peak_valley_mps2,
            n_samples: cal.n_samples,
          },
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
 * Ground-truth-anchored calibration analysis.
 *
 * Given a recording where the participant performed exactly N walking steps
 * (plus a leg-together event and possibly other noise), find the N events
 * that are most likely the walking steps and derive the runtime threshold.
 *
 * Strategy:
 *   1. Candidate pass with a permissive detector (no adaptation, very low
 *      threshold) — captures the walking steps, the leg-together event, and
 *      any small spurious events.
 *   2. Find the temporal "walking burst": the longest contiguous run of
 *      candidate events with gaps no larger than BURST_MAX_GAP_MS. The
 *      walking pattern is rhythmic and clustered in time; sporadic noise
 *      events are separated by larger gaps.
 *   3. Within the burst, take the N largest peak-valley diffs. The leg-
 *      together event tends to be a smaller swing and will fall out.
 *   4. threshold = 0.5 × min(selected diffs). Conservative — every observed
 *      walking step would clear this threshold with 100% margin.
 */
function analyzeWithGroundTruth(
  samples: { t: number; vAccel: number }[],
  expectedSteps: number,
): CaptureResult {
  // Step 1: permissive candidate detection
  const detector = new StepDetector({
    initialThreshold: TUG_STEP_CAL_CAPTURE_INIT_THRESHOLD,
    minIntervalMs: TUG_STEP_MIN_INTERVAL_MS,
    peakValleyMaxMs: TUG_STEP_PEAK_VALLEY_MAX_MS,
  });
  const candidates: CandidateEvent[] = [];
  for (const s of samples) {
    const step = detector.processSample(s.t, s.vAccel);
    if (step) {
      candidates.push({ t: step.t, peakValleyDiff: step.peakAccel - step.valleyAccel });
    }
  }

  // Step 2: find the longest temporal burst (events within BURST_MAX_GAP_MS of each other)
  const burst = findLongestBurst(candidates, TUG_STEP_CAL_BURST_MAX_GAP_MS);

  // Step 3: select the N largest peak-valley diffs in the burst
  const sortedByMagnitude = [...burst].sort((a, b) => b.peakValleyDiff - a.peakValleyDiff);
  const selected = sortedByMagnitude.slice(0, expectedSteps);
  const selectedDiffs = selected.map((c) => c.peakValleyDiff);

  // Step 4: threshold from min of selected
  const minDiff = selectedDiffs.length > 0 ? Math.min(...selectedDiffs) : 0;
  const threshold = TUG_STEP_CAL_THRESHOLD_MULTIPLIER * minDiff;
  const median = medianOf(selectedDiffs);

  return {
    candidates,
    selectedDiffs,
    median,
    minDiff,
    threshold,
    burstStartT: burst.length > 0 ? burst[0].t : null,
    burstEndT: burst.length > 0 ? burst[burst.length - 1].t : null,
  };
}

/** Find the longest contiguous run of events with gaps <= maxGapMs. */
function findLongestBurst(events: CandidateEvent[], maxGapMs: number): CandidateEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let bestStart = 0;
  let bestLen = 1;
  let curStart = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t - sorted[i - 1].t <= maxGapMs) {
      const curLen = i - curStart + 1;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = i;
    }
  }
  return sorted.slice(bestStart, bestStart + bestLen);
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

// Reference to silence unused-import warning for type re-export consumers
void (null as unknown as DetectedStep);

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
  .tug-stepcal__go-flash {
    position: fixed;
    inset: 0;
    background: var(--color-primary);
    color: #fff;
    font-size: clamp(4rem, 20vw, 10rem);
    font-weight: var(--font-weight-bold);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: none;
  }
`;
document.head.appendChild(style);
