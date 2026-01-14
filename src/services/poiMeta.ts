export type PoiMeta = {
  poiLevel: number | null;
  poiTypeId: number | null;
};

export type ObjectiveMeta = PoiMeta & {
  objectiveKind?: string;
  objectiveLevel?: number | null;
};

export const POI_TYPE_NAME_BY_ID: Record<number, string> = {
  1: 'Tiberium',
  2: 'Crystal',
  3: 'Reactor',
  4: 'Tungsten',
  5: 'Uranium',
  6: 'Aircraft',
  7: 'Resonator'
};

export const POI_TYPE_COLOR_BY_ID: Record<number, string> = {
  1: '#3CE685',
  2: '#44DBF4',
  3: '#84DCE3',
  4: '#CC6F66',
  5: '#B0ADF6',
  6: '#BDD7E5',
  7: '#F5A6C7'
};

export function normalizeToTileCoord(v: unknown, grid: unknown): number | null {
  try {
    const n = Number(v);
    if (!isFinite(n)) return null;
    const g = Number(grid);
    if (isFinite(g) && g > 0 && n > 5000) return Math.floor(n / g);
    return Math.floor(n);
  } catch {
    return null;
  }
}

function toFiniteOrNull(v: unknown): number | null {
  try {
    const n = Number(v);
    return isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function tryReadLevel(obj: any): number | null {
  try {
    if (!obj) return null;
    if (typeof obj.get_Level === 'function') return toFiniteOrNull(obj.get_Level());
    if (typeof obj.get_BaseLevel === 'function') return toFiniteOrNull(obj.get_BaseLevel());
    if (typeof obj.get_Lvl === 'function') return toFiniteOrNull(obj.get_Lvl());
    if (typeof obj.get_LevelValue === 'function') return toFiniteOrNull(obj.get_LevelValue());
  } catch {
    // ignore
  }
  return null;
}

function getVisObjectTypeName(vt: any): string {
  try {
    const ClientLib: any = (window as any).ClientLib;
    const E = ClientLib?.Vis?.VisObject?.EObjectType;
    if (!E) return '';
    for (const k of Object.keys(E)) {
      try {
        if ((E as any)[k] === vt) return String(k);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return '';
}

export function getObjectiveMetaFromVisObject(
  selectedObj: any,
  opts?: { x?: number; y?: number; gridW?: number; gridH?: number }
): ObjectiveMeta {
  const poi = getPoiMetaFromVisObject(selectedObj, opts);
  let objectiveKind: string | undefined = undefined;
  let objectiveLevel: number | null | undefined = undefined;

  try {
    const ClientLib: any = (window as any).ClientLib;
    const VT = ClientLib?.Vis?.VisObject?.EObjectType;
    const vt = selectedObj?.get_VisObjectType?.();

    // Tunnel exits currently look like: poiTypeId=0 + poiLevel=<level>.
    // Force-classify them so UI does not show "TypeId 0".
    try {
      if (poi && poi.poiTypeId !== null && Number(poi.poiTypeId) === 0 && poi.poiLevel !== null && isFinite(Number(poi.poiLevel))) {
        objectiveKind = 'tunnelExit';
        objectiveLevel = Number(poi.poiLevel);
        return { poiLevel: null, poiTypeId: null, objectiveKind, objectiveLevel };
      }
    } catch {
      // ignore
    }

    const isPoi = VT && (vt === VT.RegionPointOfInterest || String(vt) === String(VT.RegionPointOfInterest));
    if (isPoi) {
      objectiveKind = 'poi';
      objectiveLevel = poi.poiLevel;
      return { ...poi, objectiveKind, objectiveLevel };
    }

    const isNpcBase = VT && (vt === VT.RegionNPCBase || String(vt) === String(VT.RegionNPCBase));
    if (isNpcBase) {
      objectiveKind = 'npcBase';
      objectiveLevel = tryReadLevel(selectedObj);
      return { ...poi, objectiveKind, objectiveLevel };
    }

    const vtName = getVisObjectTypeName(vt);
    const looksLikeTunnel = /tunnel/i.test(vtName) || /tunnel/i.test(String(selectedObj?.constructor?.name || ''));
    if (looksLikeTunnel) {
      objectiveKind = 'tunnelExit';
      objectiveLevel = tryReadLevel(selectedObj);
      return { poiLevel: null, poiTypeId: null, objectiveKind, objectiveLevel };
    }
  } catch {
    // ignore
  }

  return { ...poi, objectiveKind, objectiveLevel };
}

export function formatObjectiveLabel(meta: ObjectiveMeta): { icon: string | null; text: string; color: string | null } {
  try {
    const kind = meta && meta.objectiveKind ? String(meta.objectiveKind) : '';
    const lvl = meta && meta.objectiveLevel !== undefined && meta.objectiveLevel !== null && isFinite(Number(meta.objectiveLevel)) ? Number(meta.objectiveLevel) : null;

    if (kind === 'npcBase') {
      const txt = lvl !== null ? ' [Base ' + String(lvl) + ']' : ' [Base]';
      return { icon: 'mdi:skull', text: txt, color: '#FFD54A' };
    }

    if (kind === 'tunnelExit') {
      const txt = lvl !== null ? ' [Tunnel ' + String(lvl) + ']' : ' [Tunnel]';
      return { icon: null, text: txt, color: null };
    }

    // Only show POI label when it looks like a real POI (typeId>0).
    try {
      if (meta && meta.poiTypeId !== null && isFinite(Number(meta.poiTypeId)) && Number(meta.poiTypeId) > 0) {
        const poiFmt = formatPoiLabel(meta);
        return { icon: null, text: poiFmt.text, color: poiFmt.color };
      }
    } catch {
      // ignore
    }

    return { icon: null, text: '', color: null };
  } catch {
    return { icon: null, text: '', color: null };
  }
}

export function getPoiMetaFromVisObject(selectedObj: any, opts?: { x?: number; y?: number; gridW?: number; gridH?: number }): PoiMeta {
  let poiLevel: number | null = null;
  let poiTypeId: number | null = null;

  try {
    if (selectedObj && typeof selectedObj.get_Level === 'function') {
      const n = Number(selectedObj.get_Level());
      if (isFinite(n)) poiLevel = n;
    }
  } catch {
    // ignore
  }

  try {
    if (selectedObj && typeof selectedObj.get_Type === 'function') {
      const n = Number(selectedObj.get_Type());
      if (isFinite(n)) poiTypeId = n;
    }
  } catch {
    // ignore
  }

  if (poiLevel !== null || poiTypeId !== null) return { poiLevel, poiTypeId };

  try {
    const ClientLib: any = (window as any).ClientLib;
    const VT = ClientLib?.Vis?.VisObject?.EObjectType;
    const vt = selectedObj?.get_VisObjectType?.();
    const isPoi = VT && (vt === VT.RegionPointOfInterest || String(vt) === String(VT.RegionPointOfInterest));
    if (!isPoi) return { poiLevel: null, poiTypeId: null };

    const visMain = ClientLib?.Vis?.VisMain?.GetInstance?.() ?? null;
    const region = visMain?.get_Region?.() ?? null;
    if (!region) return { poiLevel: null, poiTypeId: null };

    const gw = opts?.gridW !== undefined && opts?.gridW !== null ? Number(opts.gridW) : typeof region.get_GridWidth === 'function' ? Number(region.get_GridWidth()) : NaN;
    const gh = opts?.gridH !== undefined && opts?.gridH !== null ? Number(opts.gridH) : typeof region.get_GridHeight === 'function' ? Number(region.get_GridHeight()) : NaN;

    const x =
      opts?.x !== undefined && opts?.x !== null
        ? Math.floor(Number(opts.x))
        : typeof selectedObj.get_X === 'function'
          ? normalizeToTileCoord(selectedObj.get_X(), gw)
          : null;
    const y =
      opts?.y !== undefined && opts?.y !== null
        ? Math.floor(Number(opts.y))
        : typeof selectedObj.get_Y === 'function'
          ? normalizeToTileCoord(selectedObj.get_Y(), gh)
          : null;
    if (x === null || y === null) return { poiLevel: null, poiTypeId: null };

    const obj = typeof region.GetObjectFromPosition === 'function' ? region.GetObjectFromPosition(x * gw, y * gh) : null;
    if (obj) {
      try {
        if (typeof obj.get_Level === 'function') {
          const n = Number(obj.get_Level());
          if (isFinite(n)) poiLevel = n;
        }
      } catch {
        // ignore
      }
      try {
        if (typeof obj.get_Type === 'function') {
          const n = Number(obj.get_Type());
          if (isFinite(n)) poiTypeId = n;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    return { poiLevel: null, poiTypeId: null };
  }

  return { poiLevel, poiTypeId };
}

export function formatPoiLabel(meta: PoiMeta): { text: string; color: string | null } {
  try {
    const lvl = meta && meta.poiLevel !== undefined && meta.poiLevel !== null && isFinite(Number(meta.poiLevel)) ? Number(meta.poiLevel) : null;
    const tid = meta && meta.poiTypeId !== undefined && meta.poiTypeId !== null && isFinite(Number(meta.poiTypeId)) ? Number(meta.poiTypeId) : null;
    if (lvl === null || tid === null) return { text: '', color: null };
    const nm = POI_TYPE_NAME_BY_ID[tid] ? String(POI_TYPE_NAME_BY_ID[tid]) : 'TypeId ' + String(tid);
    const color = POI_TYPE_COLOR_BY_ID[tid] ? String(POI_TYPE_COLOR_BY_ID[tid]) : null;
    return { text: ' [' + nm + ' ' + String(lvl) + ']', color };
  } catch {
    return { text: '', color: null };
  }
}
