import { getAppContext } from '../../app/global';
import { formatNumber } from '../../services/format';

export type UiFilters = {
  teamId: string;
  onlineOnly: boolean;
  hasHubOnly: boolean;
};

export type Player = {
  id: number | string;
  name: string;
  role?: string;
  rank?: number;
  score?: number;
  bases?: number;
  presence?: 'Online' | 'Away' | 'Offline' | string;
  lastSeen?: string;
  lastSeenMsAgo?: number;
  hasHub?: boolean;
  member?: any;
  raw?: any;
};

export type BaseXY = { x: number; y: number };

export function getPlayerNoteKey(playerId: string | number): string {
  const ctx = getAppContext();
  return ctx.storage.LS_PREFIX + 'player_note_' + String(playerId);
}

export function getPlayerNote(playerId: string | number): string {
  try {
    const ctx = getAppContext();
    return (ctx.storage.load(getPlayerNoteKey(playerId), '') as any) || '';
  } catch {
    return '';
  }
}

export function setPlayerNote(playerId: string | number, note: string): void {
  try {
    const ctx = getAppContext();
    ctx.storage.save(getPlayerNoteKey(playerId), String(note ?? ''));
  } catch {
    // ignore
  }
}

export function getTeamIdForPlayer(assign: Record<string, string>, playerId: string | number): string {
  try {
    return assign && (assign as any)[String(playerId)] ? String((assign as any)[String(playerId)]) : '';
  } catch {
    return '';
  }
}

export function filterPlayers(players: Player[], query: string, filters: UiFilters, assign: Record<string, string>): Player[] {
  const q = (query || '').toLowerCase().trim();
  return (players || []).filter((p) => {
    if (q) {
      if (String(p?.name || '').toLowerCase().indexOf(q) === -1) return false;
    }
    if (filters?.onlineOnly) {
      const pr = p && p.presence ? String(p.presence) : '';
      if (pr !== 'Online' && pr !== 'Away') return false;
    }
    if (filters?.hasHubOnly) {
      if (!(p && p.hasHub)) return false;
    }
    if (filters?.teamId) {
      const tid = getTeamIdForPlayer(assign, p.id);
      if (tid !== String(filters.teamId)) return false;
    }
    return true;
  });
}

export function getBaseName(b: any): string {
  try {
    return b && (b.n || b.name || b.cn || b.CityName) ? String(b.n || b.name || b.cn || b.CityName) : 'Base';
  } catch {
    return 'Base';
  }
}

export function getBaseScore(_legacy: unknown, b: any): string {
  try {
    const v = b && (b.p !== undefined ? b.p : b.s !== undefined ? b.s : b.score !== undefined ? b.score : b.Score);
    return v === undefined || v === null ? '-' : formatNumber(v);
  } catch {
    return '-';
  }
}

export function getBaseCoords(b: any): string {
  try {
    const x = b && (b.x !== undefined ? b.x : b.X !== undefined ? b.X : b.cx !== undefined ? b.cx : b.Cx);
    const y = b && (b.y !== undefined ? b.y : b.Y !== undefined ? b.Y : b.cy !== undefined ? b.cy : b.Cy);
    if (x === undefined || x === null || y === undefined || y === null) return '-';
    return String(x) + ':' + String(y);
  } catch {
    return '-';
  }
}

export function getBaseXY(b: any): BaseXY | null {
  try {
    const x = b && (b.x !== undefined ? b.x : b.X !== undefined ? b.X : b.cx !== undefined ? b.cx : b.Cx);
    const y = b && (b.y !== undefined ? b.y : b.Y !== undefined ? b.Y : b.cy !== undefined ? b.cy : b.Cy);
    if (x === undefined || x === null || y === undefined || y === null) return null;
    const xn = Number(x);
    const yn = Number(y);
    if (!isFinite(xn) || !isFinite(yn)) return null;
    return { x: xn, y: yn };
  } catch {
    return null;
  }
}
