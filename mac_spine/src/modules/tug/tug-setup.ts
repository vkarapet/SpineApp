import { clearContainer, createElement } from '../../utils/dom';
import { createHeader } from '../../components/header';
import { createButton } from '../../components/button';
import { router } from '../../main';
import type { TugSessionSetup } from './tug-types';

export let tugSessionSetup: TugSessionSetup = {
  walkingAid: 'none',
  fatigue: null,
  medication: null,
};

export function renderTugSetup(container: HTMLElement): void {
  clearContainer(container);

  const header = createHeader({
    title: 'Pre-Test Setup',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'assessment-setup' });
  main.setAttribute('role', 'main');

  // Walking aid selection
  const aidSection = createElement('section', { className: 'assessment-setup__section' });
  aidSection.appendChild(
    createElement('h2', { textContent: 'Walking aid used?' }),
  );

  const aidGroup = createElement('div', { className: 'assessment-setup__med-group' });
  aidGroup.setAttribute('role', 'radiogroup');
  aidGroup.setAttribute('aria-label', 'Walking aid selection');

  let selectedAid: TugSessionSetup['walkingAid'] = 'none';

  const aidOptions: { label: string; value: TugSessionSetup['walkingAid'] }[] = [
    { label: 'None', value: 'none' },
    { label: 'Cane', value: 'cane' },
    { label: 'Walker', value: 'walker' },
    { label: 'Other', value: 'other' },
  ];

  const aidButtons: HTMLButtonElement[] = [];

  for (const opt of aidOptions) {
    const btn = createElement('button', {
      className: 'assessment-setup__med-btn',
      textContent: opt.label,
    }) as HTMLButtonElement;

    if (opt.value === 'none') {
      btn.classList.add('assessment-setup__med-btn--active');
    }

    btn.addEventListener('click', () => {
      selectedAid = opt.value;
      aidButtons.forEach((b) => b.classList.remove('assessment-setup__med-btn--active'));
      btn.classList.add('assessment-setup__med-btn--active');
    });
    aidButtons.push(btn);
    aidGroup.appendChild(btn);
  }
  aidSection.appendChild(aidGroup);

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
      tugSessionSetup = {
        walkingAid: selectedAid,
        fatigue: selectedFatigue,
        medication: selectedMed,
      };
      router.navigate('#/assessment/tug_v1/instructions');
    },
  });

  main.appendChild(aidSection);
  main.appendChild(fatigueSection);
  main.appendChild(medSection);
  main.appendChild(continueBtn);

  container.appendChild(header);
  container.appendChild(main);
}
