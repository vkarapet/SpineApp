type RouteHandler = (container: HTMLElement, params?: Record<string, string>) => void | Promise<void>;
type NavigationGuard = (from: string, to: string) => boolean | Promise<boolean>;

interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: RouteEntry[] = [];
  private guards: NavigationGuard[] = [];
  private container: HTMLElement | null = null;
  private currentHash = '';
  private started = false;

  setContainer(el: HTMLElement): void {
    this.container = el;
  }

  register(path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const patternStr = path.replace(/:([^/]+)/g, (_match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    this.routes.push({
      pattern: new RegExp(`^${patternStr}$`),
      paramNames,
      handler,
    });
  }

  addGuard(guard: NavigationGuard): () => void {
    this.guards.push(guard);
    return () => {
      const idx = this.guards.indexOf(guard);
      if (idx >= 0) this.guards.splice(idx, 1);
    };
  }

  async navigate(hash: string, replace = false): Promise<void> {
    // Run navigation guards
    for (const guard of this.guards) {
      const allowed = await guard(this.currentHash, hash);
      if (!allowed) return;
    }

    if (replace) {
      window.history.replaceState(null, '', hash);
    } else {
      window.history.pushState(null, '', hash);
    }

    await this.handleRoute(hash);
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    window.addEventListener('popstate', () => {
      this.handlePopState();
    });

    if (window.location.hash) {
      this.handleRoute(window.location.hash);
    }
  }

  private async handlePopState(): Promise<void> {
    const newHash = window.location.hash;

    // Run guards for popstate (back button)
    for (const guard of this.guards) {
      const allowed = await guard(this.currentHash, newHash);
      if (!allowed) {
        // Restore previous hash
        window.history.pushState(null, '', this.currentHash);
        return;
      }
    }

    await this.handleRoute(newHash);
  }

  private async handleRoute(hash: string): Promise<void> {
    if (!this.container) return;

    this.currentHash = hash;

    for (const route of this.routes) {
      const match = hash.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        await route.handler(this.container, params);
        return;
      }
    }

    // No route matched — go to splash
    if (hash !== '#/splash') {
      await this.navigate('#/splash', true);
    }
  }

  getCurrentRoute(): string {
    return this.currentHash;
  }
}
