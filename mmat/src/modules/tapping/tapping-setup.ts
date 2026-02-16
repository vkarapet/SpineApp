import { clearContainer, createElement } from '../../utils/dom';
import { createHeader } from '../../components/header';
import { createButton } from '../../components/button';
import { getProfile } from '../../core/db';
import { router } from '../../main';

// Store session setup data for the assessment
export let sessionSetup: {
  hand: 'left' | 'right';
  fatigue: number | null;
  medication: boolean | null;
} = { hand: 'right', fatigue: null, medication: null };

export function renderTappingSetup(container: HTMLElement): void {
  clearContainer(container);

  const header = createHeader({
    title: 'Pre-Test Setup',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'assessment-setup' });
  main.setAttribute('role', 'main');

  // Hand selection
  const handSection = createElement('section', { className: 'assessment-setup__section' });
  handSection.appendChild(
    createElement('h2', { textContent: 'Which hand are you using?' }),
  );

  const handGroup = createElement('div', { className: 'assessment-setup__hand-group' });
  handGroup.setAttribute('role', 'radiogroup');
  handGroup.setAttribute('aria-label', 'Hand selection');

  let selectedHand: 'left' | 'right' = 'right';

  // Pre-select from settings
  getProfile().then((profile) => {
    if (profile?.preferences.dominant_hand) {
      selectedHand = profile.preferences.dominant_hand;
      updateHandSelection();
    }
  });

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

  leftBtn.addEventListener('click', () => {
    selectedHand = 'left';
    updateHandSelection();
  });
  rightBtn.addEventListener('click', () => {
    selectedHand = 'right';
    updateHandSelection();
  });

  handGroup.appendChild(leftBtn);
  handGroup.appendChild(rightBtn);
  handSection.appendChild(handGroup);

  // Fatigue rating
  const fatigueSection = createElement('section', { className: 'assessment-setup__section' });
  fatigueSection.appendChild(
    createElement('h2', { textContent: 'How are you feeling right now?' }),
  );
  fatigueSection.appendChild(
    createElement('p', {
      className: 'assessment-setup__optional',
      textContent: '(Optional)',
    }),
  );

  const fatigueGroup = createElement('div', { className: 'assessment-setup__scale' });
  let selectedFatigue: number | null = null;

  for (let i = 1; i <= 5; i++) {
    const labels = ['Very Tired', 'Tired', 'Neutral', 'Alert', 'Very Alert'];
    const btn = createElement('button', {
      className: 'assessment-setup__scale-btn',
      textContent: String(i),
      'aria-label': labels[i - 1],
    });
    btn.addEventListener('click', () => {
      selectedFatigue = i;
      fatigueGroup.querySelectorAll('.assessment-setup__scale-btn').forEach((b) => {
        b.classList.remove('assessment-setup__scale-btn--active');
      });
      btn.classList.add('assessment-setup__scale-btn--active');
    });
    fatigueGroup.appendChild(btn);
  }

  const fatigueLabels = createElement('div', { className: 'assessment-setup__scale-labels' });
  fatigueLabels.appendChild(createElement('span', { textContent: 'Very Tired' }));
  fatigueLabels.appendChild(createElement('span', { textContent: 'Very Alert' }));

  fatigueSection.appendChild(fatigueGroup);
  fatigueSection.appendChild(fatigueLabels);

  // Medication
  const medSection = createElement('section', { className: 'assessment-setup__section' });
  medSection.appendChild(
    createElement('h2', { textContent: 'Have you taken your medication today?' }),
  );
  medSection.appendChild(
    createElement('p', { className: 'assessment-setup__optional', textContent: '(Optional)' }),
  );

  const medGroup = createElement('div', { className: 'assessment-setup__med-group' });
  let selectedMed: boolean | null = null;

  for (const opt of [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
    { label: 'N/A', value: null },
  ] as const) {
    const btn = createElement('button', {
      className: 'assessment-setup__med-btn',
      textContent: opt.label,
    });
    btn.addEventListener('click', () => {
      selectedMed = opt.value;
      medGroup.querySelectorAll('.assessment-setup__med-btn').forEach((b) => {
        b.classList.remove('assessment-setup__med-btn--active');
      });
      btn.classList.add('assessment-setup__med-btn--active');
    });
    medGroup.appendChild(btn);
  }
  medSection.appendChild(medGroup);

  // Continue button
  const continueBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    onClick: () => {
      sessionSetup = {
        hand: selectedHand,
        fatigue: selectedFatigue,
        medication: selectedMed,
      };
      router.navigate('#/assessment/tapping_v1/instructions');
    },
  });

  main.appendChild(handSection);
  main.appendChild(fatigueSection);
  main.appendChild(medSection);
  main.appendChild(continueBtn);

  container.appendChild(header);
  container.appendChild(main);
}
