// Min viewport overlay logic — the overlay HTML is in index.html
// This component provides the JS to manage it programmatically

export function initMinViewportOverlay(): void {
  const checkViewport = () => {
    const overlay = document.getElementById('min-viewport-overlay');
    if (!overlay) return;

    if (window.innerWidth < 320 || window.innerHeight < 480) {
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
    } else {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  };

  window.addEventListener('resize', checkViewport);
  checkViewport();
}
