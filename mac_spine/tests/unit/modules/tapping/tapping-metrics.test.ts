import { describe, it, expect } from 'vitest';
import { computeTappingMetrics, getRhythmLabel, getAccuracyLabel } from '../../../../src/modules/tapping/tapping-metrics';
import type { RawTapEvent } from '../../../../src/types/assessment';

function makeTap(t: number, x = 0, y = 0, rejected = false, reason: string | null = null): RawTapEvent {
  return { t, x, y, type: 'start', touch_id: 1, rejected, reject_reason: reason };
}

function makeEnd(t: number): RawTapEvent {
  return { t, x: 0, y: 0, type: 'end', touch_id: 1, rejected: false, reject_reason: null };
}

describe('computeTappingMetrics', () => {
  it('should handle 0 taps', () => {
    const metrics = computeTappingMetrics([], 0, 0, 70, 15000);
    expect(metrics.tap_count).toBe(0);
    expect(metrics.frequency_hz).toBe(0);
    expect(metrics.rhythm_cv).toBe(0);
  });

  it('should handle 1 tap', () => {
    const events: RawTapEvent[] = [makeTap(100), makeEnd(150)];
    const metrics = computeTappingMetrics(events, 0, 0, 70, 15000);
    expect(metrics.tap_count).toBe(1);
    expect(metrics.rhythm_cv).toBe(0);
  });

  it('should count only valid taps', () => {
    const events: RawTapEvent[] = [
      makeTap(100),
      makeEnd(150),
      makeTap(200, 0, 0, true, 'multi_touch'), // rejected
      makeTap(300),
      makeEnd(350),
      makeTap(400, 0, 0, true, 'palm'), // rejected
      makeTap(500),
      makeEnd(550),
    ];
    const metrics = computeTappingMetrics(events, 0, 0, 70, 15000);
    expect(metrics.tap_count).toBe(3);
  });

  it('should compute frequency correctly', () => {
    // 10 taps in 5 seconds = 2 Hz
    const events: RawTapEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(makeTap(i * 500));
      events.push(makeEnd(i * 500 + 100));
    }
    const metrics = computeTappingMetrics(events, 0, 0, 70, 5000);
    expect(metrics.tap_count).toBe(10);
    expect(metrics.frequency_hz).toBe(2);
  });

  it('should compute rhythm CV for regular tapping', () => {
    // Perfectly regular tapping (100ms intervals)
    const events: RawTapEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(makeTap(i * 100));
      events.push(makeEnd(i * 100 + 50));
    }
    const metrics = computeTappingMetrics(events, 0, 0, 70, 1000);
    expect(metrics.rhythm_cv).toBe(0); // Perfect regularity
  });

  it('should compute higher rhythm CV for irregular tapping', () => {
    const events: RawTapEvent[] = [
      makeTap(0), makeEnd(50),
      makeTap(100), makeEnd(150), // interval: 100
      makeTap(300), makeEnd(350), // interval: 200
      makeTap(350), makeEnd(400), // interval: 50
      makeTap(600), makeEnd(650), // interval: 250
    ];
    const metrics = computeTappingMetrics(events, 0, 0, 70, 15000);
    expect(metrics.rhythm_cv).toBeGreaterThan(0);
  });

  it('should compute accuracy correctly', () => {
    // All taps at center (0,0) with target radius 70
    const events: RawTapEvent[] = [
      makeTap(100, 0, 0),
      makeEnd(150),
      makeTap(200, 0, 0),
      makeEnd(250),
    ];
    const metrics = computeTappingMetrics(events, 0, 0, 70, 15000);
    expect(metrics.accuracy_mean_dist_px).toBe(0);
    expect(metrics.accuracy_pct_in_target).toBe(100);
  });

  it('should handle taps outside target', () => {
    const events: RawTapEvent[] = [
      makeTap(100, 100, 100), // outside target (distance ~141)
      makeEnd(150),
      makeTap(200, 0, 0), // at center
      makeEnd(250),
    ];
    const metrics = computeTappingMetrics(events, 0, 0, 70, 15000);
    expect(metrics.accuracy_pct_in_target).toBe(50);
  });
});

describe('getRhythmLabel', () => {
  it('should return Good for CV < 0.10', () => {
    expect(getRhythmLabel(0.05)).toBe('Good');
  });

  it('should return Fair for CV 0.10-0.25', () => {
    expect(getRhythmLabel(0.15)).toBe('Fair');
  });

  it('should return Variable for CV > 0.25', () => {
    expect(getRhythmLabel(0.30)).toBe('Variable');
  });
});

describe('getAccuracyLabel', () => {
  it('should return Excellent for >90%', () => {
    expect(getAccuracyLabel(95)).toBe('Excellent');
  });

  it('should return Good for 70-90%', () => {
    expect(getAccuracyLabel(80)).toBe('Good');
  });

  it('should return Fair for <70%', () => {
    expect(getAccuracyLabel(60)).toBe('Fair');
  });
});
