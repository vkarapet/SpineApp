import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { getProfile, saveProfile } from '../../core/db';
import { requestMotionPermission } from '../../utils/motion-permission';
import { TUG_CALIBRATION_SAMPLES } from '../../constants';
import { router } from '../../main';

declare global {
  interface Window {
    __tugCalibrationGravity?: { x: number; y: number; z: number };
  }
}

export function renderTugPractice(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-practice' });
  wrapper.setAttribute('role', 'main');

  const intro = createElement('div', { className: 'assessment-practice__intro' });
  intro.innerHTML = `
    <h1>Sensor Check</h1>
    <p>We need to enable the motion sensors and calibrate the device.</p>
    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
      Tap the button below to grant sensor permission. Place the phone on a flat surface or hold it steady.
    </p>
  `;

  const statusArea = createElement('div', { className: 'tug-practice__status' });

  const enableBtn = createButton({
    text: 'Enable Sensors',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      enableBtn.setAttribute('disabled', 'true');
      statusArea.textContent = 'Requesting permission...';

      const result = await requestMotionPermission();

      if (result === 'granted') {
        statusArea.textContent = 'Permission granted. Calibrating...';
        runCalibration(wrapper, statusArea, container);
      } else if (result === 'denied') {
        statusArea.innerHTML = `
          <p style="color: #C62828;">Sensor permission denied.</p>
          <p style="font-size: var(--font-size-sm);">Motion sensors are required for this test. Please grant permission and try again.</p>
        `;
        const retryBtn = createButton({
          text: 'Try Again',
          variant: 'secondary',
          fullWidth: true,
          onClick: () => renderTugPractice(container),
        });
        statusArea.appendChild(retryBtn);
      } else {
        statusArea.innerHTML = `
          <p style="color: #C62828;">Motion sensors not available on this device.</p>
          <p style="font-size: var(--font-size-sm);">This test requires a device with an accelerometer.</p>
        `;
        const backBtn = createButton({
          text: 'Go Back',
          variant: 'secondary',
          fullWidth: true,
          onClick: () => router.navigate('#/assessment/tug_v1/instructions'),
        });
        statusArea.appendChild(backBtn);
      }
    },
  });

  intro.appendChild(enableBtn);
  intro.appendChild(statusArea);
  wrapper.appendChild(intro);
  container.appendChild(wrapper);
}

function runCalibration(wrapper: HTMLElement, statusArea: HTMLElement, container: HTMLElement): void {
  const samples: { x: number; y: number; z: number }[] = [];
  let hasGyroscope = true;
  let sampleRate = 0;
  let firstSampleTime = 0;
  let lastSampleTime = 0;

  const handler = (event: DeviceMotionEvent) => {
    const now = performance.now();
    if (samples.length === 0) firstSampleTime = now;
    lastSampleTime = now;

    samples.push({
      x: event.accelerationIncludingGravity?.x ?? 0,
      y: event.accelerationIncludingGravity?.y ?? 0,
      z: event.accelerationIncludingGravity?.z ?? 0,
    });

    // Check gyroscope availability on first sample
    if (samples.length === 1) {
      hasGyroscope = event.rotationRate?.alpha !== null && event.rotationRate?.alpha !== undefined;
    }

    statusArea.textContent = `Calibrating... ${samples.length}/${TUG_CALIBRATION_SAMPLES}`;

    if (samples.length >= TUG_CALIBRATION_SAMPLES) {
      window.removeEventListener('devicemotion', handler);

      // Compute mean gravity
      const gravity = { x: 0, y: 0, z: 0 };
      for (const s of samples) {
        gravity.x += s.x;
        gravity.y += s.y;
        gravity.z += s.z;
      }
      gravity.x /= samples.length;
      gravity.y /= samples.length;
      gravity.z /= samples.length;

      // Compute sample rate
      const durationS = (lastSampleTime - firstSampleTime) / 1000;
      sampleRate = durationS > 0 ? Math.round(samples.length / durationS) : 60;

      // Store calibration data
      window.__tugCalibrationGravity = gravity;

      showCalibrationResults(wrapper, gravity, hasGyroscope, sampleRate, container);
    }
  };

  window.addEventListener('devicemotion', handler);

  // Timeout: if no events after 3s, sensors aren't working
  setTimeout(() => {
    if (samples.length === 0) {
      window.removeEventListener('devicemotion', handler);
      statusArea.innerHTML = `
        <p style="color: #C62828;">No sensor data received.</p>
        <p style="font-size: var(--font-size-sm);">Motion sensors may not be available on this device.</p>
      `;
      const retryBtn = createButton({
        text: 'Try Again',
        variant: 'secondary',
        fullWidth: true,
        onClick: () => renderTugPractice(container),
      });
      statusArea.appendChild(retryBtn);
    }
  }, 3000);
}

function showCalibrationResults(
  wrapper: HTMLElement,
  gravity: { x: number; y: number; z: number },
  hasGyroscope: boolean,
  sampleRate: number,
  container: HTMLElement,
): void {
  clearContainer(wrapper);

  const results = createElement('div', { className: 'assessment-practice__results' });

  const gravMag = Math.sqrt(gravity.x ** 2 + gravity.y ** 2 + gravity.z ** 2);

  results.innerHTML = `
    <h2>Sensors Ready</h2>
    <div class="tug-practice__sensor-info">
      <div class="tug-practice__sensor-row">
        <span>Accelerometer</span>
        <span style="color: #2E7D32; font-weight: 600;">Active</span>
      </div>
      <div class="tug-practice__sensor-row">
        <span>Gyroscope</span>
        <span style="color: ${hasGyroscope ? '#2E7D32' : '#F57F17'}; font-weight: 600;">
          ${hasGyroscope ? 'Active' : 'Not available'}
        </span>
      </div>
      <div class="tug-practice__sensor-row">
        <span>Sample rate</span>
        <span>${sampleRate} Hz</span>
      </div>
      <div class="tug-practice__sensor-row">
        <span>Gravity magnitude</span>
        <span>${gravMag.toFixed(2)} m/s\u00B2</span>
      </div>
    </div>
  `;

  if (!hasGyroscope) {
    const warning = createElement('div', { className: 'tug-practice__gyro-warning' });
    warning.textContent = 'Without a gyroscope, turn detection may be less accurate.';
    results.appendChild(warning);
  }

  const startBtn = createButton({
    text: 'Start Real Test',
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      const profile = await getProfile();
      if (profile) {
        profile.practice_completed = true;
        await saveProfile(profile);
      }
      router.navigate('#/assessment/tug_v1/countdown');
    },
  });

  const practiceAgainBtn = createButton({
    text: 'Re-Calibrate',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => renderTugPractice(container),
  });

  results.appendChild(startBtn);
  results.appendChild(practiceAgainBtn);
  wrapper.appendChild(results);
}

const style = document.createElement('style');
style.textContent = `
  .tug-practice__status {
    margin-top: var(--space-4);
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .tug-practice__sensor-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-4) 0;
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
  .tug-practice__sensor-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
  }
  .tug-practice__gyro-warning {
    padding: var(--space-3) var(--space-4);
    background: #FFF8E1;
    border: 1px solid #FFD54F;
    border-radius: var(--radius-md);
    text-align: center;
    color: #F57F17;
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-4);
  }
`;
document.head.appendChild(style);
