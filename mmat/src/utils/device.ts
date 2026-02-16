export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function getDeviceOS(): string {
  if (isIOS()) return 'iOS';
  if (isAndroid()) return 'Android';
  return 'Unknown';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getScreenDimensions(): { width: number; height: number } {
  return {
    width: window.screen.width,
    height: window.screen.height,
  };
}

export function getViewportDimensions(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'Chrome iOS';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Edg/.test(ua)) return 'Edge';
  return 'Unknown';
}

export function isScreenReaderActive(): boolean {
  // Heuristic detection — not 100% reliable
  // Check for reduced motion as a proxy, or use ARIA live region timing
  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.style.position = 'absolute';
  el.style.left = '-10000px';
  document.body.appendChild(el);
  const isActive = el.offsetHeight === 0; // Very rough heuristic
  document.body.removeChild(el);

  // Also check for forced-colors or high-contrast mode as potential indicators
  return isActive || window.matchMedia('(forced-colors: active)').matches;
}

export function supportsVibration(): boolean {
  return 'vibrate' in navigator && !isIOS();
}

export function vibrate(duration: number): void {
  if (supportsVibration()) {
    navigator.vibrate(duration);
  }
}
