import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { audioManager } from '../../utils/audio';
import { getProfile } from '../../core/db';
import { router } from '../../main';

export function renderTugInstructions(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', { className: 'assessment-instructions' });
  wrapper.setAttribute('role', 'main');

  const title = createElement('h1', { textContent: 'Timed Up & Go' });

  const body = createElement('div', { className: 'assessment-instructions__body' });
  body.innerHTML = `<p>The phone will go in your pocket and automatically detect each phase:</p>`;

  const steps = createElement('div', { className: 'assessment-instructions__important' });
  steps.innerHTML = `
    <ol class="tug-instructions__steps">
      <li>Place the phone in your front trouser pocket</li>
      <li>Sit in a chair with your back against the chair</li>
      <li>Sit still &mdash; the test starts automatically after 3 seconds</li>
      <li>When you hear the start tone, stand up and walk forward</li>
      <li>You will hear a beep at 3 meters &mdash; turn around at the marker</li>
      <li>Walk back &mdash; another beep at 3 meters</li>
      <li>Sit down &mdash; the test ends automatically</li>
    </ol>
  `;

  const helperNote = createElement('div', { className: 'tug-instructions__helper-note' });
  helperNote.innerHTML = `<p><strong>Note:</strong> Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.</p>`;

  const readyBtn = createButton({
    text: "I'm Ready",
    variant: 'primary',
    fullWidth: true,
    onClick: async () => {
      audioManager.initOnGesture();
      const profile = await getProfile();
      const audioEnabled = profile?.preferences.audio_enabled ?? true;
      audioManager.setEnabled(audioEnabled);
      await audioManager.preloadAll();

      const needsPractice = profile && !profile.practice_completed;
      if (needsPractice) {
        router.navigate('#/assessment/tug_v1/practice');
      } else {
        router.navigate('#/assessment/tug_v1/countdown');
      }
    },
  });

  const actions = createElement('div', { className: 'assessment-instructions__actions' });
  actions.appendChild(readyBtn);

  const cancelBtn = createButton({
    text: 'Cancel',
    variant: 'text',
    onClick: () => router.navigate('#/menu'),
  });

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  wrapper.appendChild(steps);
  wrapper.appendChild(helperNote);
  wrapper.appendChild(actions);
  wrapper.appendChild(cancelBtn);
  container.appendChild(wrapper);
}

const style = document.createElement('style');
style.textContent = `
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
