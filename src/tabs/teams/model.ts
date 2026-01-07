import { getAppContext } from '../../app/global';

export type TeamType = 'PVP' | 'PVE';

export type TeamObjective = {
  id: string;
  x: number;
  y: number;
  poiLevel: number | null;
  poiTypeId: number | null;
};

export type Team = {
  id: string;
  name: string;
  type: TeamType;
  objectives: TeamObjective[];
};

export type TeamAssignments = Record<string, string>; // playerId -> teamId

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeTeamType(value: unknown): TeamType {
  return String(value ?? '').toUpperCase() === 'PVE' ? 'PVE' : 'PVP';
}

function normalizeObjective(obj: any): TeamObjective | null {
  if (!obj || typeof obj !== 'object') return null;
  const id = normalizeId(obj.id) || String(Date.now()) + '_' + Math.random().toString(16).slice(2);
  const x = toFiniteNumber(obj.x, NaN);
  const y = toFiniteNumber(obj.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const poiLevelRaw = obj.poiLevel;
  const poiTypeIdRaw = obj.poiTypeId;

  const poiLevel = poiLevelRaw === undefined || poiLevelRaw === null ? null : toFiniteNumber(poiLevelRaw, NaN);
  const poiTypeId = poiTypeIdRaw === undefined || poiTypeIdRaw === null ? null : toFiniteNumber(poiTypeIdRaw, NaN);

  return {
    id,
    x,
    y,
    poiLevel: poiLevel !== null && Number.isFinite(poiLevel) ? poiLevel : null,
    poiTypeId: poiTypeId !== null && Number.isFinite(poiTypeId) ? poiTypeId : null
  };
}

export function normalizeTeam(value: any): Team | null {
  if (!value || typeof value !== 'object') return null;
  const id = normalizeId(value.id);
  const name = normalizeId(value.name);
  if (!id || !name) return null;

  const objectivesRaw = Array.isArray(value.objectives) ? value.objectives : [];
  const objectives: TeamObjective[] = [];
  for (const o of objectivesRaw) {
    const norm = normalizeObjective(o);
    if (norm) objectives.push(norm);
  }

  return {
    id,
    name,
    type: normalizeTeamType(value.type),
    objectives
  };
}

export function normalizeTeams(value: any): Team[] {
  if (!Array.isArray(value)) return [];
  const out: Team[] = [];
  for (const t of value) {
    const norm = normalizeTeam(t);
    if (norm) out.push(norm);
  }
  return out;
}

export function normalizeAssignments(value: any): TeamAssignments {
  const v = value && typeof value === 'object' ? value : {};
  const out: TeamAssignments = {};
  for (const k of Object.keys(v)) {
    const teamId = normalizeId((v as any)[k]);
    if (teamId) out[String(k)] = teamId;
  }
  return out;
}

function bumpTeamsTick(): void {
  try {
    const ctx = getAppContext();
    const prev: any = ctx.store.getState().data;
    ctx.store.setState({ data: { ...(prev || {}), _teamsTick: ((prev?._teamsTick as number) || 0) + 1 } });
  } catch {
    // ignore
  }
}

export function loadTeams(): Team[] {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'teams_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, '[]');
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeTeams(arr);
  } catch {
    return [];
  }
}

export function saveTeams(teams: Team[]): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'teams_v1';
  try {
    ctx.storage.save(key, Array.isArray(teams) ? teams : []);
  } catch {
    // ignore
  }
  bumpTeamsTick();
}

export function loadAssignments(): TeamAssignments {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'team_assign_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, '{}');
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeAssignments(obj);
  } catch {
    return {};
  }
}

export function saveAssignments(assign: TeamAssignments): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'team_assign_v1';
  try {
    ctx.storage.save(key, assign && typeof assign === 'object' ? assign : {});
  } catch {
    // ignore
  }
  bumpTeamsTick();
}

export function clearAssignments(): void {
  saveAssignments({});
}

export function addTeam(name: string, type: TeamType): void {
  const nm = String(name ?? '').trim();
  if (!nm) return;
  const teams = loadTeams();
  teams.push({ id: String(Date.now()) + '_' + Math.random().toString(16).slice(2), name: nm, type, objectives: [] });
  saveTeams(teams);
}

export function deleteTeamAndUnassign(teamId: string): void {
  const tid = String(teamId ?? '');
  if (!tid) return;

  const teams = loadTeams();
  const idx = teams.findIndex((t) => t.id === tid);
  if (idx >= 0) {
    teams.splice(idx, 1);
    saveTeams(teams);
  }

  const assign = loadAssignments();
  let changed = false;
  for (const pid of Object.keys(assign)) {
    if (assign[pid] === tid) {
      delete assign[pid];
      changed = true;
    }
  }
  if (changed) saveAssignments(assign);
}

export function deleteTeamObjective(teamId: string, objectiveIndex: number): void {
  const teams = loadTeams();
  const idx = teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return;
  const cur = teams[idx];
  const nextObjs = cur.objectives.slice();
  if (objectiveIndex < 0 || objectiveIndex >= nextObjs.length) return;
  nextObjs.splice(objectiveIndex, 1);
  teams[idx] = { ...cur, objectives: nextObjs };
  saveTeams(teams);
}

export function renameTeam(teamId: string, newName: string): void {
  const tid = String(teamId ?? '').trim();
  const nm = String(newName ?? '').trim();
  if (!tid) return;
  if (!nm) return;

  const teams = loadTeams();
  const idx = teams.findIndex((t) => t.id === tid);
  if (idx < 0) return;
  const cur = teams[idx];
  if (String(cur.name || '').trim() === nm) return;
  teams[idx] = { ...cur, name: nm };
  saveTeams(teams);
}

export function getCountsByTeamId(): Record<string, number> {
  const assign = loadAssignments();
  const counts: Record<string, number> = Object.create(null);
  try {
    const m = assign && typeof assign === 'object' ? assign : Object.create(null);
    Object.keys(m).forEach((pid) => {
      const tid = (m as any)[pid];
      if (!tid) return;
      counts[String(tid)] = (counts[String(tid)] || 0) + 1;
    });
  } catch {
    // ignore
  }
  return counts;
}
