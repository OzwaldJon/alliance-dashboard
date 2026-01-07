import { getAppContext } from '../../app/global';

export type PoiUiState = {
  simOpen: boolean;
  overviewOpen: boolean;
  ownedOpen: boolean;
  ownedGroups: Record<string, boolean>;
};

export type PoiTypeInfo = {
  typeId: number;
  name: string;
  color: string;
};

export const POI_TYPES: PoiTypeInfo[] = [
  { typeId: 1, name: 'Tiberium', color: '#3CE685' },
  { typeId: 2, name: 'Crystal', color: '#44DBF4' },
  { typeId: 3, name: 'Reactor', color: '#84DCE3' },
  { typeId: 4, name: 'Tungsten', color: '#CC6F66' },
  { typeId: 5, name: 'Uranium', color: '#B0ADF6' },
  { typeId: 6, name: 'Aircraft', color: '#BDD7E5' },
  { typeId: 7, name: 'Resonator', color: '#F5A6C7' },
  { typeId: 8, name: 'Resonator', color: '#F5A6C7' }
];

export function getPoiTypeName(typeId: number): string | null {
  const tid = Number(typeId);
  if (!Number.isFinite(tid)) return null;
  const found = POI_TYPES.find((t) => t.typeId === tid);
  return found ? found.name : null;
}

export function getPoiTypeColor(typeId: number): string | null {
  const tid = Number(typeId);
  if (!Number.isFinite(tid)) return null;
  const found = POI_TYPES.find((t) => t.typeId === tid);
  return found ? found.color : null;
}

export function loadPoiUi(): PoiUiState {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'poi_ui_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, null);
    const obj = raw && typeof raw === 'object' ? raw : {};
    return {
      simOpen: obj.simOpen !== undefined ? !!obj.simOpen : true,
      overviewOpen: obj.overviewOpen !== undefined ? !!obj.overviewOpen : true,
      ownedOpen: obj.ownedOpen !== undefined ? !!obj.ownedOpen : true,
      ownedGroups: obj.ownedGroups && typeof obj.ownedGroups === 'object' ? (obj.ownedGroups as Record<string, boolean>) : {}
    };
  } catch {
    return { simOpen: true, overviewOpen: true, ownedOpen: true, ownedGroups: {} };
  }
}

export function savePoiUi(next: PoiUiState): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'poi_ui_v1';
  try {
    ctx.storage.save(key, next);
  } catch {
    // ignore
  }
}

export function isOwnedGroupOpen(ui: PoiUiState, poiType: number): boolean {
  try {
    const k = String(poiType);
    return !!(ui.ownedGroups && ui.ownedGroups[k]);
  } catch {
    return false;
  }
}

export function setOwnedGroupOpen(ui: PoiUiState, poiType: number, open: boolean): void {
  try {
    const k = String(poiType);
    if (!ui.ownedGroups || typeof ui.ownedGroups !== 'object') ui.ownedGroups = {};
    ui.ownedGroups[k] = !!open;
    savePoiUi(ui);
  } catch {
    // ignore
  }
}
