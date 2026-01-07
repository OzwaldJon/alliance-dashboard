import { getAppContext } from '../../app/global';

export type TierKey = 'gold' | 'silver' | 'bronze';

export type TargetTier = {
  minBestOff: number;
  minBestDef: number;
  minAvgDef: number;
};

export type TargetsTiers = {
  gold: TargetTier;
  silver: TargetTier;
  bronze: TargetTier;
};

export type Milestone = {
  id: string;
  bases: number;
  deadline: string;
};

export type TeamTargetsOverride = {
  enabled: boolean;
  tiers?: TargetsTiers;
  milestones?: Milestone[];
};

export type TargetsOverrides = Record<string, TeamTargetsOverride>;

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value: unknown, fallback: number): number {
  const n = Math.floor(toFiniteNumber(value, fallback));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTier(value: any): TargetTier {
  return {
    minBestOff: toInt(value?.minBestOff, 0),
    minBestDef: toInt(value?.minBestDef, 0),
    minAvgDef: toInt(value?.minAvgDef, 0)
  };
}

export function normalizeTargetsTiers(value: any): TargetsTiers {
  const v = value && typeof value === 'object' ? value : {};
  return {
    gold: normalizeTier(v.gold),
    silver: normalizeTier(v.silver),
    bronze: normalizeTier(v.bronze)
  };
}

export function normalizeMilestones(value: any): Milestone[] {
  if (!Array.isArray(value)) return [];
  const out: Milestone[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = String((item as any).id ?? '').trim();
    const bases = toInt((item as any).bases, 0);
    const deadline = String((item as any).deadline ?? '').trim();
    if (!id) continue;
    if (!bases || bases <= 0) continue;
    if (!deadline) continue;
    out.push({ id, bases, deadline });
  }
  return out;
}

export function normalizeOverrides(value: any): TargetsOverrides {
  const v = value && typeof value === 'object' ? value : {};
  const out: TargetsOverrides = {};
  for (const k of Object.keys(v)) {
    const entry = (v as any)[k];
    if (!entry || typeof entry !== 'object') continue;
    const enabled = !!(entry as any).enabled;
    const tiers = (entry as any).tiers && typeof (entry as any).tiers === 'object' ? normalizeTargetsTiers((entry as any).tiers) : undefined;
    const milestones = Array.isArray((entry as any).milestones) ? normalizeMilestones((entry as any).milestones) : undefined;
    out[String(k)] = { enabled, tiers, milestones };
  }
  return out;
}

function bumpTargetsTick(): void {
  try {
    const ctx = getAppContext();
    const prev: any = ctx.store.getState().data;
    ctx.store.setState({ data: { ...(prev || {}), _targetsTick: ((prev?._targetsTick as number) || 0) + 1 } });
  } catch {
    // ignore
  }
}

export function loadTargetsTiers(): TargetsTiers {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_tiers_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, null);
    return normalizeTargetsTiers(raw);
  } catch {
    return normalizeTargetsTiers(null);
  }
}

export function saveTargetsTiers(next: TargetsTiers): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_tiers_v1';
  try {
    ctx.storage.save(key, normalizeTargetsTiers(next));
  } catch {
    // ignore
  }
  bumpTargetsTick();
}

export function loadTargetsMilestones(): Milestone[] {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_milestones_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, '[]');
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeMilestones(arr);
  } catch {
    return [];
  }
}

export function saveTargetsMilestones(arr: Milestone[]): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_milestones_v1';
  try {
    ctx.storage.save(key, Array.isArray(arr) ? arr : []);
  } catch {
    // ignore
  }
  bumpTargetsTick();
}

export function loadTargetsOverrides(): TargetsOverrides {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_overrides_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, '{}');
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeOverrides(obj);
  } catch {
    return {};
  }
}

export function saveTargetsOverrides(obj: TargetsOverrides): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'targets_overrides_v1';
  try {
    ctx.storage.save(key, obj && typeof obj === 'object' ? obj : {});
  } catch {
    // ignore
  }
  bumpTargetsTick();
}

export function loadGlobalTargets(): { tiers: TargetsTiers; milestones: Milestone[] } {
  return {
    tiers: loadTargetsTiers(),
    milestones: loadTargetsMilestones()
  };
}

export function saveGlobalTier(key: TierKey, nextTier: TargetTier): void {
  const next = loadTargetsTiers();
  next[key] = normalizeTier(nextTier);
  saveTargetsTiers(next);
}

export function addGlobalMilestone(bases: number, deadline: string): void {
  const arr = loadTargetsMilestones();
  arr.push({ id: String(Date.now()) + '_' + Math.random().toString(16).slice(2), bases: Math.floor(bases), deadline });
  saveTargetsMilestones(arr);
}

export function deleteGlobalMilestone(index: number): void {
  const arr = loadTargetsMilestones();
  if (index < 0 || index >= arr.length) return;
  arr.splice(index, 1);
  saveTargetsMilestones(arr);
}

export function loadTargetsForTeamScope(
  teamId: string,
  globalFallback: { tiers: TargetsTiers; milestones: Milestone[] }
):
 {
  editable: boolean;
  enabled: boolean;
  tiers: TargetsTiers;
  milestones: Milestone[];
} {
  const ov = loadTargetsOverrides();
  const entry = teamId ? ov[teamId] : undefined;
  const enabled = !!(entry && entry.enabled);
  if (!enabled) {
    return { editable: false, enabled: false, tiers: globalFallback.tiers, milestones: globalFallback.milestones };
  }
  return {
    editable: true,
    enabled: true,
    tiers: entry?.tiers ? normalizeTargetsTiers(entry.tiers) : globalFallback.tiers,
    milestones: entry?.milestones ? normalizeMilestones(entry.milestones) : []
  };
}

export function setTeamOverrideEnabled(teamId: string, enabled: boolean): void {
  const ov = loadTargetsOverrides();
  const entry = ov[teamId] && typeof ov[teamId] === 'object' ? ov[teamId] : { enabled: false };
  entry.enabled = !!enabled;
  if (entry.enabled) {
    if (!entry.tiers) entry.tiers = loadTargetsTiers();
    if (!entry.milestones) entry.milestones = [];
  }
  ov[teamId] = entry;
  saveTargetsOverrides(ov);
}

export function saveTeamTier(teamId: string, key: TierKey, nextTier: TargetTier): void {
  const ov = loadTargetsOverrides();
  const entry = ov[teamId] && typeof ov[teamId] === 'object' ? ov[teamId] : { enabled: true };
  entry.enabled = true;
  const base = entry.tiers ? normalizeTargetsTiers(entry.tiers) : loadTargetsTiers();
  base[key] = normalizeTier(nextTier);
  entry.tiers = base;
  ov[teamId] = entry;
  saveTargetsOverrides(ov);
}

export function addTeamMilestone(teamId: string, bases: number, deadline: string): void {
  const ov = loadTargetsOverrides();
  const entry = ov[teamId] && typeof ov[teamId] === 'object' ? ov[teamId] : { enabled: true };
  entry.enabled = true;
  const arr = entry.milestones ? normalizeMilestones(entry.milestones) : [];
  arr.push({ id: String(Date.now()) + '_' + Math.random().toString(16).slice(2), bases: Math.floor(bases), deadline });
  entry.milestones = arr;
  ov[teamId] = entry;
  saveTargetsOverrides(ov);
}

export function deleteTeamMilestone(teamId: string, index: number): void {
  const ov = loadTargetsOverrides();
  const entry = ov[teamId] && typeof ov[teamId] === 'object' ? ov[teamId] : null;
  if (!entry || !entry.enabled) return;
  const arr = entry.milestones ? normalizeMilestones(entry.milestones) : [];
  if (index < 0 || index >= arr.length) return;
  arr.splice(index, 1);
  entry.milestones = arr;
  ov[teamId] = entry;
  saveTargetsOverrides(ov);
}
