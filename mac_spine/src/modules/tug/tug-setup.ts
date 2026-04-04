import { clearContainer, createElement } from '../../utils/dom';
import { createHeader } from '../../components/header';
import { createButton } from '../../components/button';
import { router } from '../../main';
import type { TugSessionSetup } from './tug-types';

export let tugSessionSetup: TugSessionSetup = {
  walkingAid: 'none',
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

  // Space requirement notice
  const notice = createElement('p', { className: 'assessment-setup__notice' });
  notice.textContent = 'Please ensure you have a chair, and at least 3 metres of space to complete this test.';
  main.appendChild(notice);

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

  // Continue button
  const continueBtn = createButton({
    text: 'Continue',
    variant: 'primary',
    fullWidth: true,
    onClick: () => {
      tugSessionSetup = { walkingAid: selectedAid };
      router.navigate('#/assessment/tug_v1/instructions');
    },
  });

  main.appendChild(aidSection);
  main.appendChild(continueBtn);

  container.appendChild(header);
  container.appendChild(main);
}
