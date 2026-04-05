import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile, saveProfile } from '../../core/db';
import { router } from '../../main';
import type { TugPhoneMode } from './tug-types';

function getModeContent(mode: TugPhoneMode): { intro: string; steps: string; helperNote: string } {
  if (mode === 'hand') {
    return {
      intro: 'Hold the phone against your chest and it will automatically detect each phase:',
      steps: `
        <ol class="tug-instructions__steps">
          <li><strong>Do not turn off the screen</strong> &mdash; hold the phone against your chest with the screen facing you</li>
          <li>Sit in a chair with your back against the chair</li>
          <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
          <li>When you hear the start tone, stand up and walk forward</li>
          <li>You will hear a beep at 3 meters &mdash; turn around and walk back to the chair</li>
          <li>Sit down and remain still &mdash; an end tone will mark the end of the test</li>
        </ol>
      `,
      helperNote: 'Keep the phone stable and flat against your chest throughout the test. An emergency stop button is always available on screen.',
    };
  }
  return {
    intro: 'The phone will go in your pocket and automatically detect each phase:',
    steps: `
      <ol class="tug-instructions__steps">
        <li><strong>Do not turn off the screen</strong> &mdash; place the phone in your front trouser pocket with the screen on</li>
        <li>Sit in a chair with your back against the chair</li>
        <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
        <li>When you hear the start tone, stand up and walk forward</li>
        <li>You will hear a beep at 3 meters &mdash; turn around and walk back to the chair</li>
        <li>Sit down and remain still &mdash; an end tone will mark the end of the test</li>
      </ol>
    `,
    helperNote: 'Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.',
  };
}

export async function renderTugInstructions(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();

  // Auto-navigate to sensor check on first run (if never calibrated)
  if (!profile?.practice_completed) {
    router.navigate('#/assessment/tug_v1/practice');
    return;
  }

  let currentMode: TugPhoneMode = profile?.preferences.tug_phone_mode ?? 'pocket';

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  // ── Title ─────────────────────────────────────────────────────
  const title = createElement('h1', { textContent: 'Timed Up & Go' });

  // ── Mode slider ───────────────────────────────────────────────
  const modeSection = createElement('div', { className: 'tug-mode-section' });
  const modeLabel = createElement('span', {
    className: 'tug-mode-section__label',
    textContent: 'Test Mode',
  });

  const track = createElement('div', {
    className: 'tug-mode-slider',
    role: 'radiogroup',
    'aria-label': 'Phone placement during test',
  });

  const optPocket = createElement('span', {
    className: 'tug-mode-slider__option' + (currentMode === 'pocket' ? ' tug-mode-slider__option--active' : ''),
    textContent: 'Pocket',
    role: 'radio',
  });
  optPocket.setAttribute('aria-checked', currentMode === 'pocket' ? 'true' : 'false');
  optPocket.tabIndex = 0;

  const optHand = createElement('span', {
    className: 'tug-mode-slider__option' + (currentMode === 'hand' ? ' tug-mode-slider__option--active' : ''),
    textContent: 'In Hand',
    role: 'radio',
  });
  optHand.setAttribute('aria-checked', currentMode === 'hand' ? 'true' : 'false');
  optHand.tabIndex = 0;

  const pill = createElement('div', {
    className: 'tug-mode-slider__pill' + (currentMode === 'hand' ? ' tug-mode-slider__pill--right' : ''),
  });

  track.appendChild(pill);
  track.appendChild(optPocket);
  track.appendChild(optHand);
  modeSection.appendChild(modeLabel);
  modeSection.appendChild(track);

  async function setMode(mode: TugPhoneMode): Promise<void> {
    if (currentMode === mode) return;
    currentMode = mode;

    optPocket.classList.toggle('tug-mode-slider__option--active', mode === 'pocket');
    optPocket.setAttribute('aria-checked', mode === 'pocket' ? 'true' : 'false');
    optHand.classList.toggle('tug-mode-slider__option--active', mode === 'hand');
    optHand.setAttribute('aria-checked', mode === 'hand' ? 'true' : 'false');
    pill.classList.toggle('tug-mode-slider__pill--right', mode === 'hand');

    updateContent();

    const p = await getProfile();
    if (!p) return;
    p.preferences.tug_phone_mode = mode;
    p.updated_at = new Date().toISOString();
    await saveProfile(p);
  }

  optPocket.addEventListener('click', () => setMode('pocket'));
  optPocket.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') setMode('pocket'); });
  optHand.addEventListener('click', () => setMode('hand'));
  optHand.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') setMode('hand'); });

  // ── I'm Ready ─────────────────────────────────────────────────
  const readyBtn = createButton({
    text: "I'm Ready",
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const p = await getProfile();
      const audioEnabled = p?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      router.navigate('#/assessment/tug_v1/countdown');
    },
  });

  // ── Sensor Calibration ────────────────────────────────────────
  const calibrateBtn = createButton({
    text: 'Sensor Calibration',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/tug_v1/practice'),
  });

  // ── Test Sound ────────────────────────────────────────────────
  const soundSection = createElement('div', { className: 'tug-instructions__sound-section' });

  const testSoundBtn = createButton({
    text: 'Test Sound',
    variant: 'secondary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const p = await getProfile();
      const audioEnabled = p?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();
      audioManager.play('beep');
    },
  });

  const volumeNote = createElement('p', {
    className: 'tug-instructions__volume-note',
    textContent: 'Ensure your phone volume is turned up. You will hear a tone at the start, a beep at 3 meters, and a tone when the test ends.',
  });

  soundSection.appendChild(testSoundBtn);
  soundSection.appendChild(volumeNote);

  // ── Divider ───────────────────────────────────────────────────
  const divider = createElement('hr', { className: 'tug-instructions__divider' });

  // ── Instructions (dynamic) ────────────────────────────────────
  const body = createElement('div', { className: 'assessment-instructions__body' });
  const steps = createElement('div', { className: 'assessment-instructions__important' });
  const helperNote = createElement('div', { className: 'tug-instructions__helper-note' });

  function updateContent(): void {
    const content = getModeContent(currentMode);
    body.innerHTML = `<p>${content.intro}</p>`;
    steps.innerHTML = content.steps;
    helperNote.innerHTML = `<p><strong>Note:</strong> ${content.helperNote}</p>`;
  }

  updateContent();

  // ── Cancel ────────────────────────────────────────────────────
  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  // ── Assemble ──────────────────────────────────────────────────
  wrapper.appendChild(title);
  wrapper.appendChild(modeSection);
  wrapper.appendChild(readyBtn);
  wrapper.appendChild(calibrateBtn);
  wrapper.appendChild(soundSection);
  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(divider);
  wrapper.appendChild(body);
  wrapper.appendChild(steps);
  wrapper.appendChild(helperNote);
  container.appendChild(wrapper);
}

const style = document.createElement('style');
style.textContent = `
  /* ── Mode slider ─────────────────────────────────────────── */
  .tug-mode-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tug-mode-section__label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tug-mode-slider {
    position: relative;
    display: flex;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 3px;
    min-height: var(--tap-target-min);
    align-items: stretch;
    cursor: pointer;
    user-select: none;
  }
  .tug-mode-slider__pill {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc(50% - 3px);
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: transform 0.2s ease;
    pointer-events: none;
    z-index: 0;
  }
  .tug-mode-slider__pill--right {
    transform: translateX(100%);
  }
  .tug-mode-slider__option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full);
    position: relative;
    z-index: 1;
    transition: color 0.2s;
  }
  .tug-mode-slider__option--active {
    color: #fff;
  }

  /* ── Sound section ───────────────────────────────────────── */
  .tug-instructions__sound-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tug-instructions__volume-note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed);
    text-align: center;
  }

  /* ── Divider ─────────────────────────────────────────────── */
  .tug-instructions__divider {
    border: none;
    border-top: 2px solid var(--color-secondary);
    margin: var(--space-2) 0;
  }

  /* ── Instructions ────────────────────────────────────────── */
  .tug-instructions__steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    counter-reset: step;
  }
  .tug-instructions__steps li {
    position: relative;
    padding-left: var(--space-6);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
  }
  .tug-instructions__steps li::before {
    content: counter(step);
    counter-increment: step;
    position: absolute;
    left: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 2px;
  }
  .tug-instructions__helper-note {
    background: var(--color-bg-secondary);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    line-height: var(--line-height-relaxed);
  }
  .tug-instructions__helper-note p {
    margin: 0;
    font-size: var(--font-size-base);
  }
`;
document.head.appendChild(style);
