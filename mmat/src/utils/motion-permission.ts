export type MotionPermissionResult = 'granted' | 'denied' | 'not_supported';

export function hasDeviceMotionAPI(): boolean {
  return typeof DeviceMotionEvent !== 'undefined';
}

/**
 * Request permission to use DeviceMotion sensors.
 * - iOS 13+: calls DeviceMotionEvent.requestPermission() (must be from gesture handler)
 * - Android: tries addEventListener, resolves 'granted' if event fires within 1s
 * - Fallback: 'not_supported'
 */
export async function requestMotionPermission(): Promise<MotionPermissionResult> {
  if (!hasDeviceMotionAPI()) {
    return 'not_supported';
  }

  // iOS 13+ requires explicit permission request
  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof DME.requestPermission === 'function') {
    try {
      const result = await DME.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  // Android / other: try to listen for an event
  return new Promise<MotionPermissionResult>((resolve) => {
    let resolved = false;

    const handler = () => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('devicemotion', handler);
        resolve('granted');
      }
    };

    window.addEventListener('devicemotion', handler);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('devicemotion', handler);
        resolve('not_supported');
      }
    }, 1000);
  });
}
