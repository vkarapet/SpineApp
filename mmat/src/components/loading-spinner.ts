import { createElement } from '../utils/dom';

export function createLoadingSpinner(message = 'Loading...'): HTMLDivElement {
  const container = createElement('div', { className: 'loading-spinner' });
  container.appendChild(createElement('div', { className: 'spinner' }));
  container.appendChild(createElement('p', { textContent: message }));
  return container;
}
