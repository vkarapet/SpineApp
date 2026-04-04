import { describe, it, expect } from 'vitest';
import { ModuleRegistry } from '../../../src/core/module-registry';
import type { AssessmentModule } from '../../../src/types/assessment';

function createMockModule(id: string): AssessmentModule {
  return {
    id,
    name: `Module ${id}`,
    version: '1.0.0',
    description: 'Test module',
    redcap: { instrument: 'test', fieldMap: {} },
    metrics: [{ key: 'speed', label: 'Speed', unit: 'Hz', higherIsBetter: true }],
    getInstructions: () => ({ title: '', body: '', importantPoints: [], showMeHow: false }),
    createUI: () => {},
    start: () => {},
    stop: () => [],
    computeMetrics: () => ({
      tap_count: 0, frequency_hz: 0, rhythm_cv: 0,
      accuracy_mean_dist_px: 0, accuracy_pct_in_target: 0, duration_actual_ms: 0,
    }),
  };
}

describe('ModuleRegistry', () => {
  it('should register and retrieve modules', () => {
    const registry = new ModuleRegistry();
    const mod = createMockModule('test_v1');
    registry.register(mod);
    expect(registry.getModule('test_v1')).toBe(mod);
  });

  it('should return undefined for unknown modules', () => {
    const registry = new ModuleRegistry();
    expect(registry.getModule('unknown')).toBeUndefined();
  });

  it('should list all modules', () => {
    const registry = new ModuleRegistry();
    registry.register(createMockModule('a_v1'));
    registry.register(createMockModule('b_v1'));
    expect(registry.getAllModules()).toHaveLength(2);
  });

  it('should get metrics for a module', () => {
    const registry = new ModuleRegistry();
    registry.register(createMockModule('test_v1'));
    expect(registry.getMetrics('test_v1')).toHaveLength(1);
    expect(registry.getMetrics('unknown')).toHaveLength(0);
  });

  it('should filter modules by prefix', () => {
    const registry = new ModuleRegistry();
    registry.register(createMockModule('tapping_v1'));
    registry.register(createMockModule('tapping_v2'));
    registry.register(createMockModule('other_v1'));
    expect(registry.getModulesByPrefix('tapping')).toHaveLength(2);
  });
});
