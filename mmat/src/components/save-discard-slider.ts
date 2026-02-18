import { createElement } from '../utils/dom';

export interface SaveDiscardSliderConfig {
  onSave: () => void;
  onDiscard: () => void;
}

export function createSaveDiscardSlider(config: SaveDiscardSliderConfig): HTMLElement {
  const container = createElement('div', { className: 'sds' });
  container.setAttribute('role', 'slider');
  container.setAttribute('aria-label', 'Slide right to save, left to discard');

  const track = createElement('div', { className: 'sds__track' });

  const labelLeft = createElement('span', {
    className: 'sds__label sds__label--left',
    textContent: 'DISCARD',
  });
  const labelRight = createElement('span', {
    className: 'sds__label sds__label--right',
    textContent: 'SAVE',
  });

  // Centered result label — hidden until committed
  const resultLabel = createElement('span', {
    className: 'sds__result-label',
  });
  resultLabel.style.display = 'none';

  const thumb = createElement('div', { className: 'sds__thumb' });

  track.appendChild(labelLeft);
  track.appendChild(labelRight);
  track.appendChild(resultLabel);
  track.appendChild(thumb);
  container.appendChild(track);

  let committed = false;
  let dragging = false;
  let startX = 0;
  let dragOriginX = 0;   // thumb position when drag started
  let currentThumbX = 0; // live thumb position (JS-tracked, no DOM reads)

  function getTrackBounds() {
    const trackRect = track.getBoundingClientRect();
    const thumbW = thumb.offsetWidth;
    const minX = 0;
    const maxX = trackRect.width - thumbW;
    const centerX = maxX / 2;
    return { minX, maxX, centerX };
  }

  function setThumbPosition(x: number) {
    currentThumbX = x;
    thumb.style.left = `${x}px`;
  }

  function updateVisuals(normalized: number) {
    // normalized: -1 (far left) to +1 (far right), 0 = center
    const absNorm = Math.abs(normalized);

    // Fade labels as thumb approaches either end
    const labelOpacity = Math.max(0, 0.6 - absNorm * 0.85);
    labelLeft.style.opacity = String(labelOpacity);
    labelRight.style.opacity = String(labelOpacity);

    // Color track + thumb
    if (normalized > 0.05) {
      const intensity = Math.min(1, normalized / 0.7);
      track.style.background = `rgba(46, 125, 50, ${intensity * 0.25})`;
      thumb.style.background = `rgb(${Math.round(255 - intensity * 211)}, ${Math.round(255 - intensity * 130)}, ${Math.round(255 - intensity * 205)})`;
    } else if (normalized < -0.05) {
      const intensity = Math.min(1, Math.abs(normalized) / 0.7);
      track.style.background = `rgba(198, 40, 40, ${intensity * 0.25})`;
      thumb.style.background = `rgb(255, ${Math.round(255 - intensity * 195)}, ${Math.round(255 - intensity * 195)})`;
    } else {
      track.style.background = '';
      thumb.style.background = '';
    }
  }

  function commitResult(action: 'save' | 'discard') {
    committed = true;
    const { minX, maxX } = getTrackBounds();

    // Hide labels, show result text
    labelLeft.style.display = 'none';
    labelRight.style.display = 'none';
    resultLabel.style.display = '';

    if (action === 'save') {
      setThumbPosition(maxX);
      track.style.background = 'rgba(46, 125, 50, 0.3)';
      thumb.style.background = '#2E7D32';
      resultLabel.textContent = 'SAVED';
      resultLabel.style.color = '#2E7D32';
    } else {
      setThumbPosition(minX);
      track.style.background = 'rgba(198, 40, 40, 0.3)';
      thumb.style.background = '#C62828';
      resultLabel.textContent = 'DISCARDED';
      resultLabel.style.color = '#C62828';
    }

    thumb.classList.add('sds__thumb--committed');
  }

  // Initialize thumb at center
  requestAnimationFrame(() => {
    const { centerX } = getTrackBounds();
    setThumbPosition(centerX);
  });

  // --- Pointer event handlers on the TRACK (not the thumb) ---
  // Listening on the track with capture ensures we get all events
  // even if the finger drifts off the thumb during a drag.

  const onPointerDown = (e: PointerEvent) => {
    if (committed) return;
    // Only start drag if the pointer is on the thumb
    const thumbRect = thumb.getBoundingClientRect();
    const inThumb =
      e.clientX >= thumbRect.left - 8 && e.clientX <= thumbRect.right + 8 &&
      e.clientY >= thumbRect.top - 8 && e.clientY <= thumbRect.bottom + 8;
    if (!inThumb) return;

    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    dragOriginX = currentThumbX;
    track.setPointerCapture(e.pointerId);
    thumb.classList.add('sds__thumb--active');
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || committed) return;
    e.preventDefault();
    const { minX, maxX, centerX } = getTrackBounds();
    const dx = e.clientX - startX;
    const newX = Math.max(minX, Math.min(maxX, dragOriginX + dx));
    setThumbPosition(newX);

    const halfRange = centerX;
    const normalized = halfRange > 0 ? (newX - centerX) / halfRange : 0;
    updateVisuals(normalized);
  };

  const onPointerUp = (_e: PointerEvent) => {
    if (!dragging || committed) return;
    dragging = false;
    thumb.classList.remove('sds__thumb--active');

    const { centerX } = getTrackBounds();
    const halfRange = centerX;
    const normalized = halfRange > 0 ? (currentThumbX - centerX) / halfRange : 0;

    if (normalized >= 0.7) {
      commitResult('save');
      config.onSave();
    } else if (normalized <= -0.7) {
      commitResult('discard');
      config.onDiscard();
    } else {
      // Snap back to center
      thumb.style.transition = 'left 0.2s ease-out';
      setThumbPosition(centerX);
      updateVisuals(0);
      setTimeout(() => { thumb.style.transition = ''; }, 200);
    }
  };

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointercancel', onPointerUp);

  return container;
}

const style = document.createElement('style');
style.textContent = `
  .sds {
    width: 100%;
    padding: var(--space-2) 0;
  }
  .sds__track {
    position: relative;
    height: 3.5rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border);
    overflow: hidden;
    transition: background 0.15s ease;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .sds__label {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
    transition: opacity 0.1s ease;
  }
  .sds__label--left {
    left: var(--space-4);
    color: #C62828;
  }
  .sds__label--right {
    right: var(--space-4);
    color: #2E7D32;
  }
  .sds__result-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    pointer-events: none;
    z-index: 1;
  }
  .sds__thumb {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--color-border);
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    cursor: grab;
    z-index: 2;
    transition: background 0.15s ease;
    touch-action: none;
  }
  .sds__thumb--active {
    cursor: grabbing;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25);
    transform: translateY(-50%) scale(1.05);
  }
  .sds__thumb--committed {
    cursor: default;
    border-color: transparent;
  }
`;
document.head.appendChild(style);
