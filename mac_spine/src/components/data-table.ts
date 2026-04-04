import { createElement } from '../utils/dom';
import { formatDateShort } from '../utils/date';
import type { AssessmentResult } from '../types/db-schemas';
import type { AssessmentModule } from '../types/assessment';

export function createDataTable(results: AssessmentResult[], mod?: AssessmentModule): HTMLElement {
  const container = createElement('div', { className: 'data-table-container' });

  const table = createElement('table', { className: 'data-table' });
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', 'Assessment history data');

  // Build columns from module metrics or use fallback
  const metricCols = mod?.metrics ?? [
    { key: 'frequency_hz', label: 'Speed', unit: 'Hz', higherIsBetter: true },
    { key: 'rhythm_cv', label: 'Rhythm', unit: '', higherIsBetter: true },
  ];

  const thead = createElement('thead', {});
  const headerRow = `<tr>
      <th scope="col">Date</th>
      ${metricCols.map((c) => `<th scope="col">${c.label}</th>`).join('')}
      <th scope="col">Hand</th>
    </tr>`;
  thead.innerHTML = headerRow;

  const tbody = createElement('tbody', {});
  for (const r of results) {
    const m = r.computed_metrics;
    const tr = createElement('tr', {
      className: r.flagged ? 'data-table__row--flagged' : '',
    });
    const metricCells = metricCols.map((c) => {
      const val = m[c.key];
      if (val === undefined) return '<td>-</td>';
      return `<td>${(val as number).toFixed(c.key === 'rhythm_cv' ? 2 : 1)}${c.unit ? ' ' + c.unit : ''}</td>`;
    }).join('');
    tr.innerHTML = `
      <td>${formatDateShort(r.timestamp_start)}</td>
      ${metricCells}
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
