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
  TUG_STEP_CAL_OUTLIER_RATIO,
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

type Stage = 'intro' | 'capture' | 'capture-review';

interface CandidateEvent {
  t: number;
  peakValleyDiff: number;
}

interface CaptureResult {
  candidates: CandidateEvent[];
  selected: CandidateEvent[];   // chosen N (=5) walking steps, with timestamps
  selectedDiffs: number[];
  median: number;
  minDiff: number;
  threshold: number;             // MULTIPLIER × minDiff
  burstStartT: number | null;
  burstEndT: number | null;
}

interface VerticalSample {
  t: number;
  vertical: number;
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
  let lastSamples: VerticalSample[] = [];

  const wrapper = createElement('main', { className: 'tug-stepcal' });
  wrapper.setAttribute('role', 'main');
  container.appendChild(wrapper);

  function render(): void {
    clearContainer(wrapper);
    switch (stage) {
      case 'intro': renderIntro(); break;
      case 'capture': renderCaptureScreen(); break;
      case 'capture-review': renderCaptureReview(); break;
    }
  }

  function renderIntro(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Walking Calibration' }));
    wrapper.appendChild(elFromHTML(`
      <div class="tug-stepcal__body">
        <p>We need to learn what your walking looks like so step detection is reliable during the TUG test.</p>
        <p>Press Start, hold still during a 3-second countdown, then walk <strong>${TUG_STEP_CAL_EXPECTED_STEPS} normal steps</strong> and bring your legs together. Tap Stop. We'll show you the recording so you can confirm each step was detected.</p>
        <p class="tug-stepcal__note"><strong>Hold the phone flat against the center of your chest (sternum)</strong> with one hand, screen facing outward. Use the same placement during the TUG test.</p>
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

  function renderCaptureScreen(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Capture Walking' }));

    wrapper.appendChild(elFromHTML(`
      <p>Press <strong>Start</strong>, hold the phone flat against your sternum, and stay still for the 3-second countdown.</p>
      <p>At the <strong>GO</strong> cue, walk ${TUG_STEP_CAL_EXPECTED_STEPS} normal steps and bring your legs together. Tap <strong>Stop</strong> when you finish.</p>
    `));

    const status = createElement('div', { className: 'tug-stepcal__status', textContent: 'Ready when you are.' });
    wrapper.appendChild(status);

    const goFlash = createElement('div', { className: 'tug-stepcal__go-flash', textContent: 'GO!' });
    goFlash.style.display = 'none';
    wrapper.appendChild(goFlash);

    let phase: 'idle' | 'baseline' | 'recording' = 'idle';
    let gravity: Vec3 = { x: 0, y: 0, z: 9.81 };
    let recordStartT = 0;
    let samples: { t: number; horizontal: number; vertical: number }[] = [];
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    const motionHandler = (ev: DeviceMotionEvent) => {
      const accelRaw: Vec3 = {
        x: ev.accelerationIncludingGravity?.x ?? 0,
        y: ev.accelerationIncludingGravity?.y ?? 0,
        z: ev.accelerationIncludingGravity?.z ?? 0,
      };
      gravity = lowPassFilter(accelRaw, gravity, TUG_CONFIG.gravityFilterAlpha);

      if (phase !== 'recording') return;

      const t = performance.now() - recordStartT;
      const dec = decomposeAcceleration(accelRaw, gravity);
      samples.push({ t, horizontal: dec.horizontal, vertical: dec.vertical });
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

        phase = 'baseline';
        samples = [];
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
          phase = 'recording';
          recordStartT = performance.now();
          status.textContent = `Walk ${TUG_STEP_CAL_EXPECTED_STEPS} steps now`;
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
        lastSamples = samples.map((s) => ({ t: s.t, vertical: s.vertical }));
        lastCapture = analyzeWithGroundTruth(samples, TUG_STEP_CAL_EXPECTED_STEPS);
        stage = 'capture-review';
        render();
      },
    });

    wrapper.appendChild(startBtn);
    wrapper.appendChild(stopBtn);
  }

  function renderCaptureReview(): void {
    wrapper.appendChild(createElement('h1', { textContent: 'Review Detection' }));
    const cand = lastCapture?.candidates.length ?? 0;
    const selected = lastCapture?.selected ?? [];
    const medianDiff = lastCapture?.median ?? 0;
    const threshold = lastCapture?.threshold ?? 0;

    if (selected.length < TUG_STEP_CAL_EXPECTED_STEPS) {
      wrapper.appendChild(elFromHTML(`
        <p>We only identified <strong>${selected.length}</strong> step-like events out of ${TUG_STEP_CAL_EXPECTED_STEPS} expected (${cand} total candidates). Please walk a bit more deliberately and try again.</p>
      `));
      wrapper.appendChild(createButton({
        text: 'Re-record',
        variant: 'primary',
        fullWidth: true,
        onClick: () => { lastCapture = null; lastSamples = []; stage = 'capture'; render(); },
      }));
      wrapper.appendChild(createButton({
        text: 'Cancel',
        variant: 'text',
        onClick: () => router.navigate('#/menu'),
      }));
      return;
    }

    wrapper.appendChild(elFromHTML(`
      <p>The line below is your vertical chest acceleration during the recording. Each marker is a step the detector identified.</p>
      <p><strong>Check that each marker lines up with one of your ${TUG_STEP_CAL_EXPECTED_STEPS} steps</strong>, and that no real step was missed.</p>
    `));

    wrapper.appendChild(buildSparkline(lastSamples, selected.map((s) => s.t)));

    wrapper.appendChild(elFromHTML(`
      <p class="tug-stepcal__note">${selected.length} steps identified out of ${cand} candidates. Median step swing ${medianDiff.toFixed(2)} m/s²; threshold ${threshold.toFixed(2)} m/s².</p>
    `));

    wrapper.appendChild(createButton({
      text: 'Looks right — save calibration',
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
            median_peak_valley_mps2: cal.median_peak_valley_mps2,
            min_peak_valley_mps2: round3(lastCapture.minDiff),
            n_samples: cal.n_samples,
            min_interval_ms: TUG_STEP_MIN_INTERVAL_MS,
          },
        });
        router.navigate('#/assessment/tug_v1/instructions');
      },
    }));

    wrapper.appendChild(createButton({
      text: 'Re-record',
      variant: 'secondary',
      fullWidth: true,
      onClick: () => { lastCapture = null; lastSamples = []; stage = 'capture'; render(); },
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
  samples: { t: number; horizontal: number; vertical: number }[],
  expectedSteps: number,
): CaptureResult {
  // Step 1: permissive candidate detection on vertical user-accel
  // (gravity-projected component — the body-bounce signal at the sternum).
  const detector = new StepDetector({
    initialThreshold: TUG_STEP_CAL_CAPTURE_INIT_THRESHOLD,
    minIntervalMs: TUG_STEP_MIN_INTERVAL_MS,
    peakValleyMaxMs: TUG_STEP_PEAK_VALLEY_MAX_MS,
  });
  const candidates: CandidateEvent[] = [];
  for (const s of samples) {
    const step = detector.processSample(s.t, s.vertical, s.vertical);
    if (step) {
      candidates.push({ t: step.peakT, peakValleyDiff: step.peakAccel - step.valleyAccel });
    }
  }

  // Step 2: find the longest temporal burst (events within BURST_MAX_GAP_MS of each other)
  const burst = findLongestBurst(candidates, TUG_STEP_CAL_BURST_MAX_GAP_MS);

  // Step 3a: reject burst-wide outliers (P-V > RATIO × burst-median). Catches
  // a residual hand-raise event that survived the tail trim, or any other
  // anomalously-large peak unrelated to walking.
  const burstMedian = medianOf(burst.map((c) => c.peakValleyDiff));
  const filtered = burstMedian > 0
    ? burst.filter((c) => c.peakValleyDiff <= TUG_STEP_CAL_OUTLIER_RATIO * burstMedian)
    : burst;

  // Step 3b: select the N largest peak-valley diffs from the filtered set,
  // then sort them chronologically for rendering.
  const sortedByMagnitude = [...filtered].sort((a, b) => b.peakValleyDiff - a.peakValleyDiff);
  const selected = sortedByMagnitude.slice(0, expectedSteps).sort((a, b) => a.t - b.t);
  const selectedDiffs = selected.map((c) => c.peakValleyDiff);

  // Step 4: threshold = MULTIPLIER × min(selected). Vertical bounce at the
  // sternum is a clean once-per-step signal, so the weakest observed step
  // sets a safe floor — anything walking-like will clear it with margin.
  const minDiff = selectedDiffs.length > 0 ? Math.min(...selectedDiffs) : 0;
  const median = medianOf(selectedDiffs);
  const threshold = TUG_STEP_CAL_THRESHOLD_MULTIPLIER * minDiff;

  return {
    candidates,
    selected,
    selectedDiffs,
    median,
    minDiff,
    threshold,
    burstStartT: burst.length > 0 ? burst[0].t : null,
    burstEndT: burst.length > 0 ? burst[burst.length - 1].t : null,
  };
}

/**
 * Render the vertical-accel trace as an inline SVG sparkline with vertical
 * tick marks at each detected step time. Lets the participant eyeball
 * whether the markers line up with their actual steps.
 */
function buildSparkline(samples: VerticalSample[], markerTimes: number[]): HTMLElement {
  const W = 320;
  const H = 140;
  const PAD_X = 4;
  const PAD_Y = 8;

  const wrap = document.createElement('div');
  wrap.className = 'tug-stepcal__spark';

  if (samples.length < 2) {
    wrap.textContent = 'No signal recorded.';
    return wrap;
  }

  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const dt = Math.max(1, t1 - t0);

  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of samples) {
    if (s.vertical < vMin) vMin = s.vertical;
    if (s.vertical > vMax) vMax = s.vertical;
  }
  const vSpan = Math.max(0.5, vMax - vMin);

  const xOf = (t: number) => PAD_X + ((t - t0) / dt) * (W - 2 * PAD_X);
  const yOf = (v: number) => PAD_Y + (1 - (v - vMin) / vSpan) * (H - 2 * PAD_Y);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'tug-stepcal__spark-svg');

  for (const t of markerTimes) {
    const line = document.createElementNS(ns, 'line');
    const x = xOf(t);
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x));
    line.setAttribute('y1', String(PAD_Y));
    line.setAttribute('y2', String(H - PAD_Y));
    line.setAttribute('class', 'tug-stepcal__spark-marker');
    svg.appendChild(line);
  }

  const poly = document.createElementNS(ns, 'polyline');
  const pts: string[] = [];
  for (const s of samples) pts.push(`${xOf(s.t).toFixed(1)},${yOf(s.vertical).toFixed(1)}`);
  poly.setAttribute('points', pts.join(' '));
  poly.setAttribute('class', 'tug-stepcal__spark-line');
  svg.appendChild(poly);

  for (const t of markerTimes) {
    let nearest = samples[0];
    let bestDt = Math.abs(samples[0].t - t);
    for (const s of samples) {
      const d = Math.abs(s.t - t);
      if (d < bestDt) { bestDt = d; nearest = s; }
    }
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(xOf(nearest.t)));
    dot.setAttribute('cy', String(yOf(nearest.vertical)));
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'tug-stepcal__spark-dot');
    svg.appendChild(dot);
  }

  wrap.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'tug-stepcal__spark-legend';
  legend.textContent = `${(dt / 1000).toFixed(1)} s of recording • ${markerTimes.length} detected steps`;
  wrap.appendChild(legend);

  return wrap;
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
  .tug-stepcal__spark {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tug-stepcal__spark-svg {
    width: 100%;
    height: 140px;
    display: block;
  }
  .tug-stepcal__spark-line {
    fill: none;
    stroke: var(--color-primary);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .tug-stepcal__spark-marker {
    stroke: var(--color-accent, #FDBF57);
    stroke-width: 2;
    opacity: 0.7;
    vector-effect: non-scaling-stroke;
  }
  .tug-stepcal__spark-dot {
    fill: var(--color-accent, #FDBF57);
    stroke: var(--color-primary);
    stroke-width: 1;
  }
  .tug-stepcal__spark-legend {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary, var(--color-primary));
    text-align: center;
  }
`;
document.head.appendChild(style);
