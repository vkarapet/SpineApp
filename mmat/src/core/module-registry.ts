import type { AssessmentModule, MetricConfig } from '../types/assessment';

export class ModuleRegistry {
  private modules = new Map<string, AssessmentModule>();

  register(module: AssessmentModule): void {
    this.modules.set(module.id, module);
  }

  getModule(id: string): AssessmentModule | undefined {
    return this.modules.get(id);
  }

  getAllModules(): AssessmentModule[] {
    return Array.from(this.modules.values());
  }

  getMetrics(id: string): MetricConfig[] {
    return this.modules.get(id)?.metrics ?? [];
  }

  getModulesByPrefix(prefix: string): AssessmentModule[] {
    return Array.from(this.modules.values()).filter((m) => m.id.startsWith(prefix));
  }
}
