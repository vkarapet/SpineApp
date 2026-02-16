import { createElement } from '../utils/dom';
import { formatDateShort } from '../utils/date';
import type { AssessmentResult } from '../types/db-schemas';

export function createDataTable(results: AssessmentResult[]): HTMLElement {
  const container = createElement('div', { className: 'data-table-container' });

  const table = createElement('table', { className: 'data-table' });
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', 'Assessment history data');

  const thead = createElement('thead', {});
  thead.innerHTML = `
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Speed</th>
      <th scope="col">Rhythm</th>
      <th scope="col">Accuracy</th>
      <th scope="col">Hand</th>
    </tr>
  `;

  const tbody = createElement('tbody', {});
  for (const r of results) {
    const m = r.computed_metrics;
    const tr = createElement('tr', {
      className: r.flagged ? 'data-table__row--flagged' : '',
    });
    tr.innerHTML = `
      <td>${formatDateShort(r.timestamp_start)}</td>
      <td>${m.frequency_hz.toFixed(1)}</td>
      <td>${m.rhythm_cv.toFixed(2)}</td>
      <td>${m.accuracy_pct_in_target.toFixed(0)}%</td>
      <td>${r.session_metadata.hand_used}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
  return container;
}

const style = document.createElement('style');
style.textContent = `
  .data-table-container {
    overflow-x: auto;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }
  .data-table th,
  .data-table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }
  .data-table th {
    font-weight: var(--font-weight-semibold);
    background: var(--color-bg-secondary);
    position: sticky;
    top: 0;
  }
  .data-table__row--flagged {
    opacity: 0.5;
  }
`;
document.head.appendChild(style);
