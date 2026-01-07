export function computeWorldKey(): string {
  try {
    const loc = window && window.location ? window.location : null;
    const host = loc && loc.hostname ? String(loc.hostname) : '';
    const path = loc && loc.pathname ? String(loc.pathname) : '';

    const m = path.match(/^\/(\d+)\//);
    if (m && m[1]) return 'w' + String(m[1]);

    const first = host.split('.')[0] ? String(host.split('.')[0]) : host;
    const key = first || host || 'unknown';
    return key.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } catch {
    return 'unknown';
  }
}

export function computePlayerKey(): string {
  try {
    let id: any = null;

    try {
      const qxAny: any = (window as any).qx;
      const app = qxAny && qxAny.core && qxAny.core.Init && qxAny.core.Init.getApplication ? qxAny.core.Init.getApplication() : null;
      const md = app && typeof app.getMainData === 'function' ? app.getMainData() : null;
      const p = md && typeof md.get_Player === 'function' ? md.get_Player() : null;
      if (p && typeof p.get_Id === 'function') id = p.get_Id();
      if (id === null || id === undefined) {
        if (p && (p.Id !== undefined || p.id !== undefined)) id = (p as any).Id ?? (p as any).id;
      }
    } catch {
      // ignore
    }

    try {
      if (id === null || id === undefined) {
        const ClientLib: any = (window as any).ClientLib;
        const md = ClientLib?.Data?.MainData?.GetInstance?.();
        const p = md?.get_Player?.();
        if (p && typeof p.get_Id === 'function') id = p.get_Id();
        if (id === null || id === undefined) {
          if (p && (p.Id !== undefined || p.id !== undefined)) id = (p as any).Id ?? (p as any).id;
        }
      }
    } catch {
      // ignore
    }

    const n = Number(id);
    if (isFinite(n) && n > 0) return 'p' + String(Math.floor(n));
  } catch {
    // ignore
  }
  return 'punknown';
}

export function createLsPrefix(basePrefix: string): string {
  return basePrefix + '__' + computeWorldKey() + '__' + computePlayerKey() + '__';
}

export function saveJson(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadJson<T>(key: string, defVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defVal;
    return JSON.parse(raw) as T;
  } catch {
    return defVal;
  }
}
