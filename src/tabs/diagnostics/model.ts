import { getAppContext } from '../../app/global';
import { computeTierForPlayer } from '../../services/targetsTier';
import { loadAssignments, loadTeams } from '../teams/model';

export function downloadFile(filename: string, text: string, mime?: string): void {
  try {
    const mt = mime ? String(mime) : 'text/plain;charset=utf-8';
    const blob = new Blob([String(text)], { type: mt });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      try {
        a.remove();
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(String(text ?? ''));
    return;
  } catch {
    // ignore
  }
  try {
    window.prompt('Copy to clipboard:', String(text ?? ''));
  } catch {
    // ignore
  }
}

export type LocalStorageSnapshot = {
  version: string;
  prefix: string;
  exportedAt: number;
  data: Record<string, string | null>;
};

export function exportLocalStorageSnapshot(): LocalStorageSnapshot {
  const ctx = getAppContext();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (String(k).indexOf(ctx.storage.LS_PREFIX) !== 0) continue;
      keys.push(String(k));
    }
    keys.sort();
    const data: Record<string, string | null> = Object.create(null);
    keys.forEach((k) => {
      try {
        data[k] = localStorage.getItem(k);
      } catch {
        // ignore
      }
    });
    return {
      version: ctx.SCRIPT_VERSION,
      prefix: ctx.storage.LS_PREFIX,
      exportedAt: Date.now(),
      data
    };
  } catch {
    return { version: ctx.SCRIPT_VERSION, prefix: ctx.storage.LS_PREFIX, exportedAt: Date.now(), data: {} };
  }
}

export function clearAllDashboardData(): void {
  const ctx = getAppContext();
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && String(k).indexOf(ctx.storage.LS_PREFIX) === 0) toRemove.push(String(k));
  }
  toRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });

  const s: any = ctx.store.getState();
  ctx.store.setState({
    data: {
      ...(s?.data ?? {}),
      _teamsTick: ((s?.data?._teamsTick as number) || 0) + 1,
      _tplTick: ((s?.data?._tplTick as number) || 0) + 1
    }
  });
}

export function restoreFromSnapshot(snapshot: LocalStorageSnapshot, clearBefore: boolean): void {
  const ctx = getAppContext();
  const data = snapshot?.data;
  if (!data || typeof data !== 'object') return;

  if (clearBefore) {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && String(k).indexOf(ctx.storage.LS_PREFIX) === 0) toRemove.push(String(k));
    }
    toRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
  }

  Object.keys(data).forEach((k) => {
    try {
      if (String(k).indexOf(ctx.storage.LS_PREFIX) !== 0) return;
      const v = (data as any)[k];
      if (v === null || v === undefined) return;
      localStorage.setItem(String(k), String(v));
    } catch {
      // ignore
    }
  });

  const s: any = ctx.store.getState();
  ctx.store.setState({
    data: {
      ...(s?.data ?? {}),
      _teamsTick: ((s?.data?._teamsTick as number) || 0) + 1,
      _tplTick: ((s?.data?._tplTick as number) || 0) + 1
    }
  });
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.indexOf('"') >= 0 || s.indexOf(';') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function tsvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Keep it simple/robust: TSV doesn't have a universally supported quoting standard.
  // Replace control separators with spaces.
  return s.replace(/\r/g, '').replace(/\n/g, ' ').replace(/\t/g, ' ');
}

function round2(v: unknown): unknown {
  try {
    if (v === null || v === undefined || v === '') return '';
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return v;
    return Math.round(n * 100) / 100;
  } catch {
    return v;
  }
}

export function buildPlayersCsv(): { filename: string; content: string } {
  const ctx = getAppContext();
  const s: any = ctx.store.getState();
  const players: any[] = s?.data && Array.isArray(s.data.players) ? s.data.players : [];
  const assign = loadAssignments();
  const teams = loadTeams() as any[];

  function teamNameForPlayerId(pid: unknown): string {
    try {
      const teamId = assign && (assign as any)[String(pid)] ? String((assign as any)[String(pid)]) : '';
      if (!teamId) return '';
      const t = teams.find((tt) => tt && String((tt as any).id) === teamId) || null;
      return t && (t as any).name ? String((t as any).name) : '';
    } catch {
      return '';
    }
  }

  const headers = [
    'Name',
    'Role',
    'Rank',
    'Score',
    'Bases',
    'LastSeenText',
    'Team',
    'Tier',
    'AvgOffenseLvl',
    'BestOffenseLvl',
    'AvgDefenseLvl',
    'BestDefenseLvl',
    'HasControlHubCode'
  ];

  const rows: string[] = [headers.join(';')];

  players.forEach((p) => {
    const m = p && p.member ? p.member : null;
    const row = [
      p && p.name ? p.name : '',
      p && p.role ? p.role : '',
      p && p.rank !== undefined && p.rank !== null ? p.rank : m && m.Rank !== undefined ? m.Rank : '',
      p && p.score !== undefined && p.score !== null ? round2(p.score) : '',
      m && m.Bases !== undefined ? round2(m.Bases) : p && p.bases !== undefined && p.bases !== null ? round2(p.bases) : '',
      p && p.lastSeen ? p.lastSeen : '',
      teamNameForPlayerId(p && p.id !== undefined ? p.id : ''),
      computeTierForPlayer(p),
      m && m.AvgOffenseLvl !== undefined ? round2(m.AvgOffenseLvl) : '',
      m && m.BestOffenseLvl !== undefined ? round2(m.BestOffenseLvl) : '',
      m && m.AvgDefenseLvl !== undefined ? round2(m.AvgDefenseLvl) : '',
      m && m.BestDefenseLvl !== undefined ? round2(m.BestDefenseLvl) : '',
      ((m && m.HasControlHubCode !== undefined ? m.HasControlHubCode : p && p.hasHub ? true : false) ? 'Yes' : 'No')
    ].map(csvEscape);

    rows.push(row.join(';'));
  });

  const csv = rows.join('\n');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    filename: 'AllianceDashboard_players_' + stamp + '.csv',
    content: csv
  };
}

export function buildPlayersTsv(): { filename: string; content: string } {
  const ctx = getAppContext();
  const s: any = ctx.store.getState();
  const players: any[] = s?.data && Array.isArray(s.data.players) ? s.data.players : [];
  const assign = loadAssignments();
  const teams = loadTeams() as any[];

  function teamNameForPlayerId(pid: unknown): string {
    try {
      const teamId = assign && (assign as any)[String(pid)] ? String((assign as any)[String(pid)]) : '';
      if (!teamId) return '';
      const t = teams.find((tt) => tt && String((tt as any).id) === teamId) || null;
      return t && (t as any).name ? String((t as any).name) : '';
    } catch {
      return '';
    }
  }

  const headers = [
    'Name',
    'Role',
    'Rank',
    'Score',
    'Bases',
    'LastSeenText',
    'Team',
    'Tier',
    'AvgOffenseLvl',
    'BestOffenseLvl',
    'AvgDefenseLvl',
    'BestDefenseLvl',
    'HasControlHubCode'
  ];

  const rows: string[] = [headers.join('\t')];

  players.forEach((p) => {
    const m = p && p.member ? p.member : null;
    const row = [
      p && p.name ? p.name : '',
      p && p.role ? p.role : '',
      p && p.rank !== undefined && p.rank !== null ? p.rank : m && m.Rank !== undefined ? m.Rank : '',
      p && p.score !== undefined && p.score !== null ? round2(p.score) : '',
      m && m.Bases !== undefined ? round2(m.Bases) : p && p.bases !== undefined && p.bases !== null ? round2(p.bases) : '',
      p && p.lastSeen ? p.lastSeen : '',
      teamNameForPlayerId(p && p.id !== undefined ? p.id : ''),
      computeTierForPlayer(p),
      m && m.AvgOffenseLvl !== undefined ? round2(m.AvgOffenseLvl) : '',
      m && m.BestOffenseLvl !== undefined ? round2(m.BestOffenseLvl) : '',
      m && m.AvgDefenseLvl !== undefined ? round2(m.AvgDefenseLvl) : '',
      m && m.BestDefenseLvl !== undefined ? round2(m.BestDefenseLvl) : '',
      ((m && m.HasControlHubCode !== undefined ? m.HasControlHubCode : p && p.hasHub ? true : false) ? 'Yes' : 'No')
    ].map(tsvEscape);

    rows.push(row.join('\t'));
  });

  const tsv = rows.join('\n');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    filename: 'AllianceDashboard_players_' + stamp + '.tsv',
    content: tsv
  };
}
