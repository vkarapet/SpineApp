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
  // There is no reliable way to detect screen readers from JavaScript.
  // Previous heuristics (offsetHeight, forced-colors) produced false positives
  // on normal mobile browsers. Return false and rely on the screen reader user
  // self-identifying via an accessible opt-out if needed.
  return false;
}

export function supportsVibration(): boolean {
  return 'vibrate' in navigator && !isIOS();
}

export function vibrate(duration: number): void {
  if (supportsVibration()) {
    navigator.vibrate(duration);
  }
}

export function supportsDeviceMotion(): boolean {
  return typeof DeviceMotionEvent !== 'undefined';
}
