export type GameApiSnapshot = {
  ClientLib?: any;
  mainData?: any;
  chat?: any;
  visMain?: any;
  region?: any;
  world?: any;
};

let cached: GameApiSnapshot | null = null;

function tryBuildSnapshot(): GameApiSnapshot | null {
  try {
    const w: any = window as any;
    const ClientLib: any = w.ClientLib;
    if (!ClientLib) return null;

    const mainData = ClientLib?.Data?.MainData?.GetInstance?.() ?? null;
    if (!mainData) return null;

    const chat = mainData?.get_Chat?.() ?? null;

    const visMain = ClientLib?.Vis?.VisMain?.GetInstance?.() ?? null;
    const region = visMain?.get_Region?.() ?? null;

    const world = mainData?.get_World?.() ?? null;

    return { ClientLib, mainData, chat, visMain, region, world };
  } catch {
    return null;
  }
}

export function getGameApi(opts?: { refresh?: boolean }): GameApiSnapshot {
  try {
    if (opts?.refresh) cached = null;

    if (cached && (cached.mainData || cached.ClientLib)) {
      if (cached.mainData) return cached;
    }

    const snap = tryBuildSnapshot();
    if (snap) {
      cached = snap;
      return snap;
    }
  } catch {
    // ignore
  }

  return cached || {};
}

export function resetGameApiCache(): void {
  cached = null;
}
