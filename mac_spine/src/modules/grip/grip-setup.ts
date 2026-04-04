import { clearContainer, createElement } from '../../utils/dom';
import { createHeader } from '../../components/header';
import { createButton } from '../../components/button';
import { router } from '../../main';

export let gripSessionSetup: {
  hand: 'left' | 'right';
  weakness: 'none' | 'mild' | 'moderate' | 'severe' | null;
} = { hand: 'right', weakness: null };

export function renderGripSetup(container: HTMLElement): void {
  clearContainer(container);

  const header = createHeader({
    title: 'Pre-Test Setup',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'assessment-setup' });
  main.setAttribute('role', 'main');

  // ── Hand selection ───────────────────────────────────────────────────────
  const handSection = createElement('section', { className: 'assessment-setup__section' });
  handSection.appendChild(
    createElement('h2', { textContent: 'Which hand are you using?' }),
  );

  let selectedHand: 'left' | 'right' = 'right';

  const handTrack = createElement('div', {
    className: 'grip-setup__hand-slider',
    role: 'radiogroup',
    'aria-label': 'Hand selection',
  });

  const handPill = createElement('div', { className: 'grip-setup__hand-slider__pill' });

  const optLeft = createElement('span', {
    className: 'grip-setup__hand-slider__option',
    textContent: 'Left',
    role: 'radio',
  });
  optLeft.setAttribute('aria-checked', 'false');
  optLeft.tabIndex = 0;

  const optRight = createElement('span', {
    className: 'grip-setup__hand-slider__option grip-setup__hand-slider__option--active',
    textContent: 'Right',
    role: 'radio',
  });
  optRight.setAttribute('aria-checked', 'true');
  optRight.tabIndex = 0;

  function setHand(hand: 'left' | 'right'): void {
    selectedHand = hand;
    optLeft.classList.toggle('grip-setup__hand-slider__option--active', hand === 'left');
    optLeft.setAttribute('aria-checked', String(hand === 'left'));
    optRight.classList.toggle('grip-setup__hand-slider__option--active', hand === 'right');
    optRight.setAttribute('aria-checked', String(hand === 'right'));
    handPill.classList.toggle('grip-setup__hand-slider__pill--right', hand === 'right');
  }

  optLeft.addEventListener('click', () => setHand('left'));
  optLeft.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') setHand('left'); });
  optRight.addEventListener('click', () => setHand('right'));
  optRight.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') setHand('right'); });

  handTrack.appendChild(handPill);
  handTrack.appendChild(optLeft);
  handTrack.appendChild(optRight);
  handSection.appendChild(handTrack);

  // ── Hand weakness ────────────────────────────────────────────────────────
  const weaknessSection = createElement('section', { className: 'assessment-setup__section' });
  weaknessSection.appendChild(
    createElement('h2', { textContent: 'Do you experience any weakness in this hand?' }),
  );

  const WEAKNESS_OPTIONS: { value: 'none' | 'mild' | 'moderate' | 'severe'; label: string }[] = [
    { value: 'none',     label: 'No weakness' },
    { value: 'mild',     label: 'Mild' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'severe',   label: 'Severe' },
  ];

  let selectedWeakness: 'none' | 'mild' | 'moderate' | 'severe' | null = null;

  const weaknessGroup = createElement('div', { className: 'assessment-setup__weakness-group' });
  weaknessGroup.setAttribute('role', 'radiogroup');
  weaknessGroup.setAttribute('aria-label', 'Hand weakness level');

  const weaknessBtns: HTMLElement[] = [];

  for (const opt of WEAKNESS_OPTIONS) {
    const btn = createElement('button', {
      className: 'assessment-setup__weakness-btn',
      textContent: opt.label,
      'aria-pressed': 'false',
    });
    btn.dataset.value = opt.value;
    btn.addEventListener('click', () => {
      selectedWeakness = opt.value;
      weaknessBtns.forEach((b) => {
        b.classList.remove('assessment-setup__weakness-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('assessment-setup__weakness-btn--active');
      btn.setAttribute('aria-pressed', 'true');
      continueBtn.disabled = false;
      continueBtn.classList.remove('btn--disabled');
    });
    weaknessGroup.appendChild(btn);
    weaknessBtns.push(btn);
  }

  weaknessSection.appendChild(weaknessGroup);

  // ── Continue button ──────────────────────────────────────────────────────
  const continueBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    disabled: true,
    onClick: () => {
      if (!selectedWeakness) return;
      gripSessionSetup = {
        hand: selectedHand,
        weakness: selectedWeakness,
      };
      router.navigate('#/assessment/grip_v1/instructions');
    },
  });

  main.appendChild(handSection);
  main.appendChild(weaknessSection);
  main.appendChild(continueBtn);

  container.appendChild(header);
  container.appendChild(main);
}

const style = document.createElement('style');
style.textContent = `
  .grip-setup__hand-slider {
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
  .grip-setup__hand-slider__pill {
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
  .grip-setup__hand-slider__pill--right {
    transform: translateX(100%);
  }
  .grip-setup__hand-slider__option {
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
  .grip-setup__hand-slider__option--active {
    color: #fff;
  }
  .assessment-setup__weakness-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .assessment-setup__weakness-btn {
    min-height: var(--tap-target-preferred);
    padding: var(--space-3) var(--space-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.1s, background 0.1s;
  }
  .assessment-setup__weakness-btn--active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }
`;
document.head.appendChild(style);
