import { loadTargetsMilestones, loadTargetsOverrides, loadTargetsTiers } from '../tabs/targets/model';
import { loadAssignments } from '../tabs/teams/model';

export type EffectiveTargets = {
  scope: 'everyone' | 'team';
  teamId: string;
  tiers: any;
  milestones: any[];
};

export function getPlayerTeamId(playerId: unknown): string {
  try {
    const assign = loadAssignments();
    return assign && (assign as any)[String(playerId)] ? String((assign as any)[String(playerId)]) : '';
  } catch {
    return '';
  }
}

export function getEffectiveTargetsForPlayer(player: any): EffectiveTargets {
  try {
    const globalTiers = loadTargetsTiers();
    const globalMilestones = loadTargetsMilestones();
    const teamId = getPlayerTeamId(player && player.id !== undefined ? player.id : '');
    if (!teamId) return { scope: 'everyone', teamId: '', tiers: globalTiers, milestones: globalMilestones };

    const ov = loadTargetsOverrides();
    const entry = ov && (ov as any)[teamId] ? (ov as any)[teamId] : null;
    const enabled = !!(entry && (entry as any).enabled);
    if (!enabled) return { scope: 'everyone', teamId: '', tiers: globalTiers, milestones: globalMilestones };

    const tiers = entry && (entry as any).tiers ? (entry as any).tiers : globalTiers;
    const milestones = entry && Array.isArray((entry as any).milestones) ? (entry as any).milestones : globalMilestones;
    return { scope: 'team', teamId, tiers, milestones };
  } catch {
    return { scope: 'everyone', teamId: '', tiers: loadTargetsTiers(), milestones: loadTargetsMilestones() };
  }
}

export function computeTierFromTiers(player: any, tiers: any): string {
  try {
    const p = player;
    const m = p && p.member ? p.member : null;
    const bestOffRaw = m && m.BestOffenseLvl !== undefined ? Number(m.BestOffenseLvl) : NaN;
    const bestDefRaw = m && m.BestDefenseLvl !== undefined ? Number(m.BestDefenseLvl) : NaN;
    const avgDefRaw = m && m.AvgDefenseLvl !== undefined ? Number(m.AvgDefenseLvl) : NaN;
    if (!isFinite(bestOffRaw) || !isFinite(bestDefRaw) || !isFinite(avgDefRaw)) return '';

    const bestOff = bestOffRaw;
    const bestDef = bestDefRaw;
    const avgDef = avgDefRaw;

    function meets(t: any): boolean {
      if (!t) return false;
      return bestOff >= Number(t.minBestOff || 0) && bestDef >= Number(t.minBestDef || 0) && avgDef >= Number(t.minAvgDef || 0);
    }

    if (meets(tiers.gold)) return 'Gold';
    if (meets(tiers.silver)) return 'Silver';
    if (meets(tiers.bronze)) return 'Bronze';
    return '';
  } catch {
    return '';
  }
}

export function computeTierForPlayer(player: any): string {
  try {
    const eff = getEffectiveTargetsForPlayer(player);
    return eff && eff.tiers ? computeTierFromTiers(player, eff.tiers) : '';
  } catch {
    return '';
  }
}
