import { AppContext } from '../app/uiShell';
import { getGameApi } from './gameApi';

type PvpOverlayStats = {
  scanned: number;
  hasXY: number;
  visible: number;
  drawn: number;
  nullScore: number;
  zeroScore: number;
  rectMissing: number;
  maxScoreSeen: number;
  sampleScores: number[];
  worldObjHits: number;
  scoreHits: number;
  debug: string;
  lastError: string | null;
};

let STATS: PvpOverlayStats = {
  scanned: 0,
  hasXY: 0,
  visible: 0,
  drawn: 0,
  nullScore: 0,
  zeroScore: 0,
  rectMissing: 0,
  maxScoreSeen: 0,
  sampleScores: [],
  worldObjHits: 0,
  scoreHits: 0,
  debug: '',
  lastError: null
};

export function getPvpOverlayStats(): PvpOverlayStats {
  return STATS;
}

function summarizeWorldObj(obj: any): string {
  try {
    if (!obj) return 'null';
    const ctor = (obj as any)?.constructor?.name ? String((obj as any).constructor.name) : 'obj';

    const methods: string[] = [];
    try {
      const proto = Object.getPrototypeOf(obj);
      const names = proto ? Object.getOwnPropertyNames(proto) : [];
      for (let i = 0; i < names.length; i++) {
        const n = names[i];
        if (!n || typeof n !== 'string') continue;
        if (typeof (obj as any)[n] !== 'function') continue;
        if (!/score|point|combat/i.test(n)) continue;
        methods.push(n);
        if (methods.length >= 8) break;
      }
    } catch {
      // ignore
    }

    const props: string[] = [];
    try {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!k || typeof k !== 'string') continue;
        if (!/score|point|combat/i.test(k)) continue;
        props.push(k);
        if (props.length >= 6) break;
      }
    } catch {
      // ignore
    }

    return ctor +
      (methods.length ? ' m=' + methods.join('|') : '') +
      (props.length ? ' p=' + props.join('|') : '');
  } catch {
    return 'err';
  }
}

function tryGetNumberFromRegion(region: any, names: string[]): { v: number; k: string } | null {
  for (let i = 0; i < names.length; i++) {
    const k = names[i];
    try {
      if (region && typeof region[k] === 'function') {
        const n = Number(region[k]());
        if (isFinite(n)) return { v: n, k };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function tryWorldGetObject(world: any, x: number, y: number, gw: number, gh: number): any {
  try {
    if (!world || typeof (world as any).GetObjectFromPosition !== 'function') return null;

    const attempts: Array<[number, number]> = [];
    // Treat x/y as "raw" first.
    attempts.push([Number(x), Number(y)]);
    // Try as tiles -> pixels.
    attempts.push([Number(x) * Number(gw), Number(y) * Number(gh)]);
    // Try as pixels -> tiles.
    if (Number(gw) > 0 && Number(gh) > 0) attempts.push([Number(x) / Number(gw), Number(y) / Number(gh)]);

    for (let i = 0; i < attempts.length; i++) {
      const ax = attempts[i][0];
      const ay = attempts[i][1];
      if (!isFinite(ax) || !isFinite(ay)) continue;
      try {
        const o = (world as any).GetObjectFromPosition(ax, ay);
        if (o) return o;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function discoverRegionPositionGetters(region: any): string[] {
  try {
    const proto = region ? Object.getPrototypeOf(region) : null;
    const names = proto ? Object.getOwnPropertyNames(proto) : [];
    const out: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      if (!n || typeof n !== 'string') continue;
      if (!n.startsWith('get_')) continue;
      if (!/(pos|position|center|view|scroll)/i.test(n)) continue;
      out.push(n);
      if (out.length >= 10) break;
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeCoordToTile(v: number, g: number): number {
  try {
    // If this looks like pixels (large), convert using grid size.
    if (v > 5000 && g > 0) return v / g;
  } catch {
    // ignore
  }
  return v;
}

function tryRegionGetObject(region: any, xTile: number, yTile: number, gw: number, gh: number): any {
  try {
    if (!region || typeof (region as any).GetObjectFromPosition !== 'function') return null;
    const px = Number(xTile) * Number(gw);
    const py = Number(yTile) * Number(gh);
    try {
      const o = (region as any).GetObjectFromPosition(px, py);
      if (o) return o;
    } catch {
      // ignore
    }
    try {
      const o = (region as any).GetObjectFromPosition(Number(xTile), Number(yTile));
      if (o) return o;
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
  return null;
}

function getXYFromCityLike(obj: any): { x: number; y: number } | null {
  try {
    if (!obj) return null;
    const getNum = (v: any): number | null => {
      const n = Number(v);
      return isFinite(n) ? n : null;
    };

    const tryProp = (o: any, k: string): number | null => {
      try {
        return getNum(o && o[k] !== undefined ? o[k] : null);
      } catch {
        return null;
      }
    };

    const tryFn = (o: any, k: string): number | null => {
      try {
        if (o && typeof o[k] === 'function') return getNum(o[k]());
      } catch {
        return null;
      }
      return null;
    };

    const x =
      tryFn(obj, 'get_PosX') ??
      tryFn(obj, 'get_X') ??
      tryFn(obj, 'get_x') ??
      tryProp(obj, 'x') ??
      tryProp(obj, 'X') ??
      tryProp(obj, 'cx') ??
      tryProp(obj, 'Cx');

    const y =
      tryFn(obj, 'get_PosY') ??
      tryFn(obj, 'get_Y') ??
      tryFn(obj, 'get_y') ??
      tryProp(obj, 'y') ??
      tryProp(obj, 'Y') ??
      tryProp(obj, 'cy') ??
      tryProp(obj, 'Cy');

    if (x === null || y === null) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function getCityScore(city: any): number | null {
  try {
    if (!city) return null;

    const tryFn = (k: string): number | null => {
      try {
        if (typeof city[k] === 'function') {
          const n = Number(city[k]());
          return isFinite(n) ? n : null;
        }
      } catch {
        return null;
      }
      return null;
    };

    const tryProp = (k: string): number | null => {
      try {
        const n = Number(city[k]);
        return isFinite(n) ? n : null;
      } catch {
        return null;
      }
    };

    const methodCandidates = [
      'get_Score',
      'get_ScoreValue',
      'get_RawScore',
      'get_ScorePoints',
      'get_ScorePoint',
      'get_CombatScore',
      'get_CombatScoreValue',
      'get_PointScore',
      'get_ScoreTotal',
      'get_TotalScore'
    ];
    for (let i = 0; i < methodCandidates.length; i++) {
      const v = tryFn(methodCandidates[i]);
      // Some objects return 0 for unavailable score; treat 0 as "not found".
      if (v !== null && v !== undefined && v > 0) return v;
    }

    const propCandidates = ['score', 'Score', 's', 'sc', 'ScorePoints', 'CombatScore', 'TotalScore'];
    for (let i = 0; i < propCandidates.length; i++) {
      const v = tryProp(propCandidates[i]);
      if (v !== null && v !== undefined && v > 0) return v;
    }

    // Sometimes the score is nested.
    try {
      const d = (city as any).d || (city as any).data || (city as any).Details || null;
      if (d && typeof d === 'object') {
        for (let i = 0; i < propCandidates.length; i++) {
          const k = propCandidates[i];
          const n = Number((d as any)[k]);
          if (isFinite(n) && n > 0) return n;
        }
      }
    } catch {
      // ignore
    }

    return null;
  } catch {
    return null;
  }
}

function getObjScore(obj: any): number | null {
  try {
    if (!obj) return null;
    const tryFn = (k: string): number | null => {
      try {
        if (typeof obj[k] === 'function') {
          const n = Number(obj[k]());
          return isFinite(n) ? n : null;
        }
      } catch {
        return null;
      }
      return null;
    };
    const tryProp = (k: string): number | null => {
      try {
        const n = Number(obj[k]);
        return isFinite(n) ? n : null;
      } catch {
        return null;
      }
    };

    const methodCandidates = [
      'get_Score',
      'get_ScoreValue',
      'get_BaseScore',
      'get_TotalScore',
      'get_ScoreTotal',
      'get_CombatScore',
      'get_Points',
      'get_ScorePoints'
    ];
    for (let i = 0; i < methodCandidates.length; i++) {
      const v = tryFn(methodCandidates[i]);
      if (v !== null && v !== undefined && v > 0) return v;
    }

    const propCandidates = ['score', 'Score', 'BaseScore', 'TotalScore', 'Points'];
    for (let i = 0; i < propCandidates.length; i++) {
      const v = tryProp(propCandidates[i]);
      if (v !== null && v !== undefined && v > 0) return v;
    }

    try {
      const inner = (obj as any).get_CityData && typeof (obj as any).get_CityData === 'function' ? (obj as any).get_CityData() : null;
      const v = getObjScore(inner);
      if (v !== null && v !== undefined && v > 0) return v;
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
  return null;
}

function extractCityList(cities: any): any[] {
  try {
    if (!cities) return [];
    if (Array.isArray(cities)) return cities;

    try {
      if (typeof cities.get_Values === 'function') {
        const v = cities.get_Values();
        if (Array.isArray(v)) return v;
      }
    } catch {
      // ignore
    }

    try {
      if (Array.isArray(cities.l)) return cities.l;
    } catch {
      // ignore
    }

    try {
      if (cities.d && typeof cities.d === 'object') {
        const vals = Object.values(cities.d);
        if (Array.isArray(vals)) return vals;
      }
    } catch {
      // ignore
    }

    try {
      const out: any[] = [];
      const keys = Object.keys(cities);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!k) continue;
        const v = (cities as any)[k];
        if (v) out.push(v);
      }
      return out;
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
  return [];
}

function tryGetRegionObjectXY(obj: any): { x: number; y: number } | null {
  try {
    if (!obj) return null;
    const x = typeof obj.get_RawX === 'function' ? Number(obj.get_RawX()) : null;
    const y = typeof obj.get_RawY === 'function' ? Number(obj.get_RawY()) : null;
    if (x === null || y === null || !isFinite(x) || !isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function shouldConsiderVisObject(obj: any): boolean {
  try {
    if (!obj || typeof obj.get_VisObjectType !== 'function') return false;
    const vt = obj.get_VisObjectType();
    // We keep this loose to avoid depending on specific enum numbers.
    // In practice we only accept objects that have raw x/y and a GetRectCity works for them.
    void vt;

    // Prefer actual city/base-ish objects (these methods exist on many region objects).
    if (typeof obj.get_Id === 'function') return true;
  } catch {
    // ignore
  }
  return false;
}

function normalizeBoundsToTiles(opts: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  gw: number;
  gh: number;
  worldW: number | null;
  worldH: number | null;
}): { minX: number; maxX: number; minY: number; maxY: number } | null {
  try {
    const { minX, maxX, minY, maxY, gw, gh, worldW, worldH } = opts;
    if (![minX, maxX, minY, maxY, gw, gh].every((n) => isFinite(n))) return null;
    if (gw <= 0 || gh <= 0) return null;

    // Heuristic: if bounds look larger than world width/height, they are probably pixel coords.
    const worldWn = worldW !== null && worldW !== undefined && isFinite(worldW) ? Number(worldW) : null;
    const worldHn = worldH !== null && worldH !== undefined && isFinite(worldH) ? Number(worldH) : null;

    const looksLikePixels =
      (worldWn !== null && maxX > worldWn + 50) ||
      (worldHn !== null && maxY > worldHn + 50) ||
      // Fallback: very large numbers usually mean pixels
      maxX > 5000 ||
      maxY > 5000;

    const toTileX = (v: number) => (looksLikePixels ? v / gw : v);
    const toTileY = (v: number) => (looksLikePixels ? v / gh : v);

    let aMinX = toTileX(minX);
    let aMaxX = toTileX(maxX);
    let aMinY = toTileY(minY);
    let aMaxY = toTileY(maxY);

    if (![aMinX, aMaxX, aMinY, aMaxY].every((n) => isFinite(n))) return null;

    // Clamp if we have world size.
    if (worldWn !== null) {
      aMinX = Math.max(0, Math.min(worldWn, aMinX));
      aMaxX = Math.max(0, Math.min(worldWn, aMaxX));
    }
    if (worldHn !== null) {
      aMinY = Math.max(0, Math.min(worldHn, aMinY));
      aMaxY = Math.max(0, Math.min(worldHn, aMaxY));
    }

    return { minX: aMinX, maxX: aMaxX, minY: aMinY, maxY: aMaxY };
  } catch {
    return null;
  }
}

function getRegionRectKey(region: any): string {
  try {
    const minX = typeof region.get_MinXPosition === 'function' ? Number(region.get_MinXPosition()) : 0;
    const maxX = typeof region.get_MaxXPosition === 'function' ? Number(region.get_MaxXPosition()) : 0;
    const minY = typeof region.get_MinYPosition === 'function' ? Number(region.get_MinYPosition()) : 0;
    const maxY = typeof region.get_MaxYPosition === 'function' ? Number(region.get_MaxYPosition()) : 0;
    return String([minX, maxX, minY, maxY].map((x) => (isFinite(x) ? x : 0)).join(','));
  } catch {
    return '0,0,0,0';
  }
}

function tryGetCityRect(region: any, x: number, y: number, cityObj: any): { x: number; y: number; w: number; h: number } | null {
  try {
    if (!region) return null;

    // Prefer (x,y)
    try {
      if (typeof region.GetRectCity === 'function') {
        const r = region.GetRectCity(Number(x), Number(y));
        if (r) {
          const rx = Number((r as any).x ?? (r as any).X);
          const ry = Number((r as any).y ?? (r as any).Y);
          const rw = Number((r as any).w ?? (r as any).W ?? (r as any).width ?? (r as any).Width);
          const rh = Number((r as any).h ?? (r as any).H ?? (r as any).height ?? (r as any).Height);
          if (isFinite(rx) && isFinite(ry) && isFinite(rw) && isFinite(rh)) return { x: rx, y: ry, w: rw, h: rh };
        }
      }
    } catch {
      // ignore
    }

    // Fallback (city)
    try {
      if (typeof region.GetRectCity === 'function') {
        const r = region.GetRectCity(cityObj);
        if (r) {
          const rx = Number((r as any).x ?? (r as any).X);
          const ry = Number((r as any).y ?? (r as any).Y);
          const rw = Number((r as any).w ?? (r as any).W ?? (r as any).width ?? (r as any).Width);
          const rh = Number((r as any).h ?? (r as any).H ?? (r as any).height ?? (r as any).Height);
          if (isFinite(rx) && isFinite(ry) && isFinite(rw) && isFinite(rh)) return { x: rx, y: ry, w: rw, h: rh };
        }
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  return null;
}

function tryGetVisOrigin(region: any): { x: number; y: number } {
  try {
    if (region && typeof region.GetRectVis === 'function') {
      const r = region.GetRectVis();
      if (r) {
        const rx = Number((r as any).x ?? (r as any).X);
        const ry = Number((r as any).y ?? (r as any).Y);
        if (isFinite(rx) && isFinite(ry)) return { x: rx, y: ry };
      }
    }
  } catch {
    // ignore
  }
  return { x: 0, y: 0 };
}

export function initPvpOverlay(ctx: AppContext): void {
  let enabled = false;
  let threshold = 0;

  let overlay: HTMLElement | null = null;
  let timer: number | null = null;
  let lastRegionKey = '';
  let lastDebugLogTs = 0;

  function ensureOverlay(): HTMLElement | null {
    try {
      if (overlay && overlay.parentNode) return overlay;
      const el = document.createElement('div');
      el.id = 'cad-pvp-overlay';
      el.style.cssText =
        'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
      document.body.appendChild(el);
      overlay = el;
      return el;
    } catch {
      return null;
    }
  }

  function clearOverlay(): void {
    try {
      if (!overlay) return;
      overlay.innerHTML = '';
    } catch {
      // ignore
    }
  }

  function stop(): void {
    try {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    } catch {
      // ignore
    }
    try {
      clearOverlay();
    } catch {
      // ignore
    }
  }

  function start(): void {
    if (timer !== null) return;
    timer = window.setInterval(tick, 850);
    tick();
  }

  function readSettingsFromStore(): void {
    try {
      const s: any = ctx.store.getState();
      const ui = s && s.ui ? s.ui : {};
      enabled = !!ui.pvpHighlightEnabled;
      const t = Number(ui.pvpScoreThreshold);
      threshold = isFinite(t) ? t : 0;
    } catch {
      enabled = false;
      threshold = 0;
    }
  }

  function tick(): void {
    try {
      STATS = {
        scanned: 0,
        hasXY: 0,
        visible: 0,
        drawn: 0,
        nullScore: 0,
        zeroScore: 0,
        rectMissing: 0,
        maxScoreSeen: 0,
        sampleScores: [],
        worldObjHits: 0,
        scoreHits: 0,
        debug: '',
        lastError: null
      };
      readSettingsFromStore();
      if (!enabled || threshold <= 0) {
        stop();
        return;
      }

      const api = getGameApi({ refresh: true });
      const region = api.region || (api.visMain && api.visMain.get_Region ? api.visMain.get_Region() : null);
      const md = api.mainData;
      const world = api.world;
      if (!region || !md) return;

      let visAreaComplete: boolean | null = null;
      try {
        visAreaComplete = typeof (region as any).get_VisAreaComplete === 'function' ? !!(region as any).get_VisAreaComplete() : null;
      } catch {
        visAreaComplete = null;
      }

      const minX = typeof (region as any).get_MinXPosition === 'function' ? Number((region as any).get_MinXPosition()) : null;
      const maxX = typeof (region as any).get_MaxXPosition === 'function' ? Number((region as any).get_MaxXPosition()) : null;
      const minY = typeof (region as any).get_MinYPosition === 'function' ? Number((region as any).get_MinYPosition()) : null;
      const maxY = typeof (region as any).get_MaxYPosition === 'function' ? Number((region as any).get_MaxYPosition()) : null;
      const hasBounds =
        minX !== null && maxX !== null && minY !== null && maxY !== null && isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY);

      const gw = region && region.get_GridWidth ? Number(region.get_GridWidth()) : null;
      const gh = region && region.get_GridHeight ? Number(region.get_GridHeight()) : null;

      const origin = tryGetVisOrigin(region);

      let rectVis: any = null;
      try {
        rectVis = typeof (region as any).GetRectVis === 'function' ? (region as any).GetRectVis() : null;
      } catch {
        rectVis = null;
      }
      const rectVisX = rectVis ? Number((rectVis as any).x ?? (rectVis as any).X) : null;
      const rectVisY = rectVis ? Number((rectVis as any).y ?? (rectVis as any).Y) : null;
      const rectVisW = rectVis ? Number((rectVis as any).w ?? (rectVis as any).W ?? (rectVis as any).width ?? (rectVis as any).Width) : null;
      const rectVisH = rectVis ? Number((rectVis as any).h ?? (rectVis as any).H ?? (rectVis as any).height ?? (rectVis as any).Height) : null;
      const hasRectVis =
        rectVisX !== null && rectVisY !== null && rectVisW !== null && rectVisH !== null &&
        isFinite(rectVisX) && isFinite(rectVisY) && isFinite(rectVisW) && isFinite(rectVisH) &&
        rectVisW > 0 && rectVisH > 0;

      const discoveredGetters = discoverRegionPositionGetters(region);

      const curRegionKey = getRegionRectKey(region);
      if (curRegionKey === lastRegionKey) {
        // Still refresh markers; but skip expensive full re-build if possible.
      }
      lastRegionKey = curRegionKey;

      const root = ensureOverlay();
      if (!root) return;
      root.innerHTML = '';

      if ((!hasBounds || minX === null || maxX === null || minY === null || maxY === null) && !hasRectVis) return;
      if (!gw || !gh || !isFinite(gw) || !isFinite(gh) || gw <= 0 || gh <= 0) return;

      let worldW: number | null = null;
      let worldH: number | null = null;
      try {
        const srv = (md as any).get_Server && typeof (md as any).get_Server === 'function' ? (md as any).get_Server() : null;
        worldW = srv && typeof srv.get_WorldWidth === 'function' ? Number(srv.get_WorldWidth()) : null;
        worldH = srv && typeof srv.get_WorldHeight === 'function' ? Number(srv.get_WorldHeight()) : null;
      } catch {
        worldW = null;
        worldH = null;
      }

      // Prefer actual visible rect if available. If not, min/max positions on this client are world bounds,
      // so we fall back to a fixed-radius scan around current view center.
      let rawMinX = 0;
      let rawMaxX = 0;
      let rawMinY = 0;
      let rawMaxY = 0;

      let centerX: number | null = null;
      let centerY: number | null = null;
      let centerKX: string | null = null;
      let centerKY: string | null = null;

      if (!hasRectVis) {
        const cx = tryGetNumberFromRegion(region, [
          'get_CenterXPosition',
          'get_CenterPosX',
          'get_ViewXPosition',
          'get_ViewX',
          'get_PosXPosition',
          'get_PosX',
          'get_XPosition',
          'get_X'
        ]);
        const cy = tryGetNumberFromRegion(region, [
          'get_CenterYPosition',
          'get_CenterPosY',
          'get_ViewYPosition',
          'get_ViewY',
          'get_PosYPosition',
          'get_PosY',
          'get_YPosition',
          'get_Y'
        ]);
        centerX = cx ? cx.v : null;
        centerKX = cx ? cx.k : null;
        centerY = cy ? cy.v : null;
        centerKY = cy ? cy.k : null;
      }

      if (hasRectVis) {
        rawMinX = Number(rectVisX);
        rawMaxX = Number(rectVisX) + Number(rectVisW);
        rawMinY = Number(rectVisY);
        rawMaxY = Number(rectVisY) + Number(rectVisH);
      } else if (centerX !== null && centerY !== null) {
        // Convert center (maybe pixels) to tiles.
        const cxt = normalizeCoordToTile(centerX, Number(gw));
        const cyt = normalizeCoordToTile(centerY, Number(gh));
        const r = 70; // tile radius
        rawMinX = (cxt - r) * Number(gw);
        rawMaxX = (cxt + r) * Number(gw);
        rawMinY = (cyt - r) * Number(gh);
        rawMaxY = (cyt + r) * Number(gh);
      } else {
        // Last fallback: use world bounds.
        rawMinX = Number(minX);
        rawMaxX = Number(maxX);
        rawMinY = Number(minY);
        rawMaxY = Number(maxY);
      }

      const norm = normalizeBoundsToTiles({
        minX: rawMinX,
        maxX: rawMaxX,
        minY: rawMinY,
        maxY: rawMaxY,
        gw: Number(gw),
        gh: Number(gh),
        worldW,
        worldH
      });
      if (!norm) {
        STATS.debug =
          'norm=null' +
          ' raw=[' +
          [rawMinX, rawMaxX, rawMinY, rawMaxY].map((n) => (n === null || n === undefined ? 'null' : String(Math.round(Number(n))))).join(',') +
          '] gw=' +
          String(gw) +
          ' gh=' +
          String(gh) +
          ' visArea=' +
          String(visAreaComplete) +
          ' rectVis=' +
          (hasRectVis
            ? String([rectVisX, rectVisY, rectVisW, rectVisH].map((n) => String(Math.round(Number(n)))).join(','))
            : 'null');
        return;
      }

      const idsSeen: Record<string, boolean> = Object.create(null);
      const pad = 0;
      const x0 = Math.max(0, Math.floor(norm.minX - pad));
      const x1 = Math.max(0, Math.floor(norm.maxX + pad));
      const y0 = Math.max(0, Math.floor(norm.minY - pad));
      const y1 = Math.max(0, Math.floor(norm.maxY + pad));

      const hasRegionGetObj = typeof (region as any).GetObjectFromPosition === 'function';
      const hasWorldGetObj = world && typeof (world as any).GetObjectFromPosition === 'function';

      // Probe once per tick to understand coordinate expectations.
      let probe: any = null;
      let probe2: any = null;
      let probe3: any = null;
      try {
        const cx = Math.floor((x0 + x1) / 2);
        const cy = Math.floor((y0 + y1) / 2);
        if (hasRegionGetObj) {
          probe = (region as any).GetObjectFromPosition(Number(cx) * gw, Number(cy) * gh);
          probe2 = (region as any).GetObjectFromPosition(Number(cx), Number(cy));
          // Also try probing directly around the reported center (in case our bounds are wrong).
          if (centerX !== null && centerY !== null) {
            const cxt = normalizeCoordToTile(centerX, Number(gw));
            const cyt = normalizeCoordToTile(centerY, Number(gh));
            probe3 = tryRegionGetObject(region, Math.round(cxt), Math.round(cyt), Number(gw), Number(gh));
          }
        }
      } catch {
        probe = null;
        probe2 = null;
        probe3 = null;
      }

      const probeInfo = (o: any): string => {
        try {
          if (!o) return 'null';
          const vt = typeof o.get_VisObjectType === 'function' ? String(o.get_VisObjectType()) : '?';
          const id = typeof o.get_Id === 'function' ? String(o.get_Id()) : '?';
          const p = tryGetRegionObjectXY(o);
          const xy = p ? String(p.x) + ':' + String(p.y) : '?';
          return 'vt=' + vt + ' id=' + id + ' xy=' + xy;
        } catch {
          return 'err';
        }
      };

      STATS.debug =
        'raw=[' +
        [rawMinX, rawMaxX, rawMinY, rawMaxY].map((n) => (n === null || n === undefined ? 'null' : String(Math.round(Number(n))))).join(',') +
        ']' +
        ' norm=[' +
        [norm.minX, norm.maxX, norm.minY, norm.maxY].map((n) => String(Math.round(Number(n)))).join(',') +
        ']' +
        ' gw=' +
        String(Math.round(Number(gw))) +
        ' gh=' +
        String(Math.round(Number(gh))) +
        ' visArea=' +
        String(visAreaComplete) +
        ' rectVis=' +
        (hasRectVis
          ? String([rectVisX, rectVisY, rectVisW, rectVisH].map((n) => String(Math.round(Number(n)))).join(','))
          : 'null') +
        ' center=' +
        (centerX !== null && centerY !== null ? String(Math.round(centerX)) + ',' + String(Math.round(centerY)) : 'null') +
        (centerKX || centerKY ? ' centerK=' + String(centerKX || '?') + ',' + String(centerKY || '?') : '') +
        (discoveredGetters.length ? ' getters=' + discoveredGetters.join('|') : '') +
        ' regionGetObj=' +
        String(hasRegionGetObj) +
        ' worldGetObj=' +
        String(!!hasWorldGetObj) +
        ' probePix(' +
        probeInfo(probe) +
        ')' +
        ' probeRaw(' +
        probeInfo(probe2) +
        ')' +
        ' probeCenter(' +
        probeInfo(probe3) +
        ')';

      const maxChecks = 2200;
      let checks = 0;

      const cxTile = Math.max(x0, Math.min(x1, Math.floor((x0 + x1) / 2)));
      const cyTile = Math.max(y0, Math.min(y1, Math.floor((y0 + y1) / 2)));
      const maxR = Math.max(Math.abs(x1 - cxTile), Math.abs(cxTile - x0), Math.abs(y1 - cyTile), Math.abs(cyTile - y0));

      const visit = (x: number, y: number): void => {
        if (checks >= maxChecks) return;
        if (x < x0 || x > x1 || y < y0 || y > y1) return;
        checks++;
        let obj: any = null;
        try {
          obj = tryRegionGetObject(region, Number(x), Number(y), Number(gw), Number(gh));
        } catch {
          obj = null;
        }
        if (!obj) return;
        if (!shouldConsiderVisObject(obj)) return;

        let idKey = '';
        try {
          if (typeof obj.get_Id === 'function') idKey = String(obj.get_Id());
        } catch {
          idKey = '';
        }
        if (!idKey) {
          try {
            const p = tryGetRegionObjectXY(obj);
            idKey = p ? String(p.x) + ':' + String(p.y) : '';
          } catch {
            idKey = '';
          }
        }
        if (!idKey) return;
        if (idsSeen[idKey]) return;
        idsSeen[idKey] = true;

        STATS.scanned++;

        const xy = tryGetRegionObjectXY(obj);
        if (!xy) return;
        STATS.hasXY++;
        STATS.visible++;

        // Score is typically available on the world object at that position.
        let score: number | null = null;
        try {
          const wobj = tryWorldGetObject(world, Number(xy.x), Number(xy.y), Number(gw), Number(gh));
          if (wobj) {
            STATS.worldObjHits++;
            if (STATS.worldObjHits === 1) {
              try {
                STATS.debug += ' wobj=' + summarizeWorldObj(wobj);
              } catch {
                // ignore
              }
            }
          }
          score = getObjScore(wobj);
        } catch {
          score = null;
        }

        if (score === null || score === undefined || !isFinite(Number(score))) {
          STATS.nullScore++;
          return;
        }
        const scoreN = Number(score);
        if (scoreN <= 0) {
          STATS.zeroScore++;
          return;
        }
        STATS.scoreHits++;
        if (scoreN > STATS.maxScoreSeen) STATS.maxScoreSeen = scoreN;
        if (STATS.sampleScores.length < 8) STATS.sampleScores.push(scoreN);

        if (scoreN < threshold) return;

        const rect = tryGetCityRect(region, xy.x, xy.y, obj);
        if (!rect) {
          STATS.rectMissing++;
          return;
        }

          const m = document.createElement('div');
          m.className = 'cad-pvp-marker';

          const size = 8;
          const leftRaw = rect.x + rect.w - size - 2;
          const topRaw = rect.y + 2;
          const leftWithOrigin = origin.x + leftRaw;
          const topWithOrigin = origin.y + topRaw;

          const pick = (raw: number, withOrigin: number, min: number, max: number): number => {
            try {
              const pad2 = 120;
              const okRaw = isFinite(raw) && raw >= min - pad2 && raw <= max + pad2;
              const okOrigin = isFinite(withOrigin) && withOrigin >= min - pad2 && withOrigin <= max + pad2;
              if (okOrigin && !okRaw) return withOrigin;
              if (okRaw && !okOrigin) return raw;
              if (okOrigin) return withOrigin;
              return raw;
            } catch {
              return raw;
            }
          };

          const left = pick(leftRaw, leftWithOrigin, 0, window.innerWidth);
          const top = pick(topRaw, topWithOrigin, 0, window.innerHeight);

          m.style.cssText =
            'position:fixed;left:' +
            String(Math.round(left)) +
            'px;top:' +
            String(Math.round(top)) +
            'px;width:' +
            String(size) +
            'px;height:' +
            String(size) +
            'px;border-radius:999px;background:rgba(239,68,68,.95);box-shadow:0 0 0 2px rgba(0,0,0,.55), 0 0 10px rgba(239,68,68,.35);';

        root.appendChild(m);
        STATS.drawn++;
      };

      // Visit center first, then expand outwards in rings.
      visit(cxTile, cyTile);
      for (let r = 1; r <= maxR && checks < maxChecks; r++) {
        const xL = cxTile - r;
        const xR = cxTile + r;
        const yT = cyTile - r;
        const yB = cyTile + r;

        for (let x = xL; x <= xR && checks < maxChecks; x++) {
          visit(x, yT);
          visit(x, yB);
        }
        for (let y = yT + 1; y <= yB - 1 && checks < maxChecks; y++) {
          visit(xL, y);
          visit(xR, y);
        }
      }

      // Append checks count to debug for visibility.
      try {
        STATS.debug += ' checks=' + String(checks) + ' worldHits=' + String(STATS.worldObjHits) + ' scoreHits=' + String(STATS.scoreHits);
      } catch {
        // ignore
      }

      if (STATS.scanned === 0) {
        const now = Date.now();
        if (now - lastDebugLogTs > 2500) {
          lastDebugLogTs = now;
          try {
            // eslint-disable-next-line no-console
            console.info('[AllianceDashboard][PVP Overlay] scanned=0 debug:', STATS.debug);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      try {
        STATS.lastError = 'tick_failed';
      } catch {
        // ignore
      }
    }
  }

  // Watch for setting changes
  try {
    ctx.store.subscribe(() => {
      try {
        const prevEnabled = enabled;
        readSettingsFromStore();
        if (enabled && threshold > 0) {
          if (!prevEnabled) start();
        } else {
          stop();
        }
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  // Initial state
  readSettingsFromStore();
  if (enabled && threshold > 0) start();
}
