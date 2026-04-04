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

  const handGroup = createElement('div', { className: 'assessment-setup__hand-group' });
  handGroup.setAttribute('role', 'radiogroup');
  handGroup.setAttribute('aria-label', 'Hand selection');

  let selectedHand: 'left' | 'right' = 'right';

  const leftBtn = createElement('button', {
    className: 'assessment-setup__hand-btn',
    textContent: 'Left',
    'aria-pressed': 'false',
  });

  const rightBtn = createElement('button', {
    className: 'assessment-setup__hand-btn assessment-setup__hand-btn--active',
    textContent: 'Right',
    'aria-pressed': 'true',
  });

  function updateHandSelection(): void {
    leftBtn.classList.toggle('assessment-setup__hand-btn--active', selectedHand === 'left');
    leftBtn.setAttribute('aria-pressed', String(selectedHand === 'left'));
    rightBtn.classList.toggle('assessment-setup__hand-btn--active', selectedHand === 'right');
    rightBtn.setAttribute('aria-pressed', String(selectedHand === 'right'));
  }

  leftBtn.addEventListener('click', () => { selectedHand = 'left'; updateHandSelection(); });
  rightBtn.addEventListener('click', () => { selectedHand = 'right'; updateHandSelection(); });

  handGroup.appendChild(leftBtn);
  handGroup.appendChild(rightBtn);
  handSection.appendChild(handGroup);

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
