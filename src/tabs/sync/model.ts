import { getAppContext } from '../../app/global';
import { loadTargetsMilestones, loadTargetsOverrides, loadTargetsTiers } from '../targets/model';
import { loadAssignments, loadTeams } from '../teams/model';

export const GETBACK_BASE_URL = 'https://getback.easycnc.be';

export type GetBackSettings = {
  id: string;
  readPassphrase: string;
  writePassphrase: string;
};

export type AllianceBulletinV1 = {
  schema: 'AllianceDashboard.Bulletin';
  schemaVersion: 1;
  exportedAt: number;
  teams: unknown[];
  teamAssignments: Record<string, string>;
  targets: {
    tiers: unknown;
    milestones: unknown[];
    overrides: unknown;
    teamMilestonesByTeamId: Record<string, unknown[]>;
  };
};

export function loadGetBackSettings(): GetBackSettings {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'getback_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, null);
    const obj = raw && typeof raw === 'object' ? raw : {};
    return {
      id: String(obj.id || '').trim(),
      readPassphrase: String(obj.readPassphrase || ''),
      writePassphrase: String(obj.writePassphrase || '')
    };
  } catch {
    return { id: '', readPassphrase: '', writePassphrase: '' };
  }
}

export function saveGetBackSettings(next: Partial<GetBackSettings>): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'getback_v1';
  const cur = loadGetBackSettings();
  const merged: GetBackSettings = {
    id: next.id !== undefined ? String(next.id || '').trim() : cur.id,
    readPassphrase: next.readPassphrase !== undefined ? String(next.readPassphrase || '') : cur.readPassphrase,
    writePassphrase: next.writePassphrase !== undefined ? String(next.writePassphrase || '') : cur.writePassphrase
  };
  try {
    ctx.storage.save(key, merged);
  } catch {
    // ignore
  }

  try {
    const prev: any = ctx.store.getState().data;
    ctx.store.setState({ data: { ...(prev || {}), _renderTick: ((prev?._renderTick as number) || 0) + 1 } });
  } catch {
    // ignore
  }
}

export function buildBulletinV1(): AllianceBulletinV1 {
  const overrides: any = loadTargetsOverrides() as any;
  const teamMilestonesByTeamId: Record<string, unknown[]> = {};
  try {
    if (overrides && typeof overrides === 'object') {
      Object.keys(overrides).forEach((teamId) => {
        try {
          const entry = (overrides as any)[teamId];
          const miles = entry && Array.isArray(entry.milestones) ? entry.milestones : [];
          if (miles.length) teamMilestonesByTeamId[String(teamId)] = miles;
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  return {
    schema: 'AllianceDashboard.Bulletin',
    schemaVersion: 1,
    exportedAt: Date.now(),
    teams: loadTeams() as any,
    teamAssignments: loadAssignments() as any,
    targets: {
      tiers: loadTargetsTiers() as any,
      milestones: loadTargetsMilestones() as any,
      overrides,
      teamMilestonesByTeamId
    }
  };
}
