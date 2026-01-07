import { getGameApi } from './gameApi';

let refreshInFlight = false;

type StoreLike<State = any> = {
  getState(): State;
  setState(patch: Partial<State>): void;
};

function isClientLibReady(): boolean {
  try {
    return !!getGameApi().mainData;
  } catch {
    return false;
  }
}

function getMainData(): any | null {
  try {
    if (!isClientLibReady()) return null;
    return getGameApi().mainData || null;
  } catch {
    return null;
  }
}

function getAllianceMemberIds(mainData: any): any[] {
  try {
    const alliance = mainData && mainData.get_Alliance && mainData.get_Alliance();
    if (!alliance) return [];
    const ids = alliance.getMemberIds && alliance.getMemberIds();
    const list = ids && ids.l;
    return Array.isArray(list) ? list.slice() : [];
  } catch {
    return [];
  }
}

function fetchPublicPlayerInfo(playerId: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const w: any = window as any;
      const ClientLib = w.ClientLib;
      const cm = ClientLib.Net.CommunicationManager.GetInstance();
      const handler = (_context: any, data: any) => resolve(data);
      const errHandler = (e: any) => reject(e || new Error('GetPublicPlayerInfo failed'));

      if (w.webfrontend && w.webfrontend.phe && w.webfrontend.phe.cnc && w.webfrontend.phe.cnc.Util && w.webfrontend.phe.cnc.Util.createEventDelegate) {
        cm.SendSimpleCommand(
          'GetPublicPlayerInfo',
          { id: playerId },
          w.webfrontend.phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, null, handler),
          errHandler
        );
      } else {
        cm.SendSimpleCommand('GetPublicPlayerInfo', { id: playerId }, handler, errHandler);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function formatAgo(msAgo: number): string | null {
  try {
    if (msAgo === null || msAgo === undefined || !isFinite(msAgo)) return null;
    if (msAgo < 0) msAgo = 0;
    const sec = Math.floor(msAgo / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    const hr = Math.floor(min / 60);
    if (hr < 48) return hr + 'h';
    const day = Math.floor(hr / 24);
    if (day < 30) return day + 'd';
    const mo = Math.floor(day / 30);
    if (mo < 24) return mo + 'mo';
    const yr = Math.floor(mo / 12);
    return yr + 'y';
  } catch {
    return null;
  }
}

function getLastSeenFromPublicInfo(data: any): string | null {
  try {
    if (!data) return null;
    const candidates = [data.ll, data.l, data.ls, data.la, data.lastSeen, data.last_login, data.lastLogin, data.lastActive];
    for (let i = 0; i < candidates.length; i++) {
      const v = candidates[i];
      if (v === null || v === undefined) continue;
      if (typeof v !== 'number') continue;
      if (!isFinite(v)) continue;

      let tsMs = v;
      if (v > 0 && v < 100000000000) tsMs = v * 1000;
      if (tsMs > 0) {
        const ago = formatAgo(Date.now() - tsMs);
        if (ago) return ago;
      }
    }

    const ageCandidates = [data.ia, data.inactive, data.inactiveDays, data.id];
    for (let j = 0; j < ageCandidates.length; j++) {
      const v2 = ageCandidates[j];
      if (v2 === null || v2 === undefined) continue;
      if (typeof v2 !== 'number') continue;
      if (!isFinite(v2)) continue;
      if (v2 >= 0 && v2 < 10000) return Math.floor(v2) + 'd';
    }

    return null;
  } catch {
    return null;
  }
}

function getAllianceRoleMap(alliance: any): Record<string, string> {
  const map: Record<string, string> = Object.create(null);
  try {
    if (!alliance) return map;

    const roster = typeof alliance.get_MemberDataAsArray === 'function' ? alliance.get_MemberDataAsArray() : null;
    if (Array.isArray(roster) && roster.length) {
      for (let i = 0; i < roster.length; i++) {
        const m = roster[i];
        const pid = m && (m.PlayerId !== undefined ? m.PlayerId : m.Id !== undefined ? m.Id : null);
        const roleName = m && (m.RoleName || m.Role || m.RoleId || m.RankName);
        if (pid !== null && pid !== undefined && roleName) map[String(pid)] = String(roleName);
      }
      return map;
    }

    const memberData = typeof alliance.get_MemberData === 'function' ? alliance.get_MemberData() : null;
    const dict = memberData && (memberData.d || memberData);
    if (dict && typeof dict === 'object') {
      Object.keys(dict).forEach((k) => {
        const m = (dict as any)[k];
        const pid = m && (m.PlayerId !== undefined ? m.PlayerId : m.Id !== undefined ? m.Id : k);
        const roleName = m && (m.RoleName || m.Role || m.RoleId || m.RankName);
        if (pid !== null && pid !== undefined && roleName) map[String(pid)] = String(roleName);
      });
    }
  } catch {
    // ignore
  }
  return map;
}

function getAllianceLastSeenMaps(alliance: any): {
  byId: Record<string, string>;
  byName: Record<string, string>;
  byIdMsAgo: Record<string, number>;
  byNameMsAgo: Record<string, number>;
} {
  const byId: Record<string, string> = Object.create(null);
  const byName: Record<string, string> = Object.create(null);
  const byIdMsAgo: Record<string, number> = Object.create(null);
  const byNameMsAgo: Record<string, number> = Object.create(null);

  function getMemberPid(m: any, fallbackKey: any): any {
    try {
      if (!m) return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
      if (m.PlayerId !== undefined && m.PlayerId !== null) return m.PlayerId;
      if (m.Id !== undefined && m.Id !== null) return m.Id;
      if (m.pId !== undefined && m.pId !== null) return m.pId;
      if (m.pid !== undefined && m.pid !== null) return m.pid;
      if (m.p !== undefined && m.p !== null) return m.p;
      if (m.i !== undefined && m.i !== null) return m.i;
      return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
    } catch {
      return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
    }
  }

  function normalizeTsMs(v: any): number | null {
    try {
      if (v === null || v === undefined) return null;
      if (typeof v !== 'number') return null;
      if (!isFinite(v)) return null;
      if (v > 0 && v < 100000000000) return v * 1000;
      return v;
    } catch {
      return null;
    }
  }

  function addEntry(pidMaybe: any, nameMaybe: any, lastMs: number | null): void {
    try {
      if (!lastMs) return;
      const msAgo = Date.now() - lastMs;
      const ago = formatAgo(msAgo);
      if (!ago) return;
      if (pidMaybe !== null && pidMaybe !== undefined) {
        byId[String(pidMaybe)] = ago;
        byIdMsAgo[String(pidMaybe)] = msAgo;
      }
      if (nameMaybe) {
        byName[String(nameMaybe)] = ago;
        byNameMsAgo[String(nameMaybe)] = msAgo;
      }
    } catch {
      // ignore
    }
  }

  try {
    if (!alliance) return { byId, byName, byIdMsAgo, byNameMsAgo };

    const roster = typeof alliance.get_MemberDataAsArray === 'function' ? alliance.get_MemberDataAsArray() : null;
    if (Array.isArray(roster) && roster.length) {
      for (let i = 0; i < roster.length; i++) {
        const m = roster[i];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = getMemberPid(m, null);
        const lastMs = normalizeTsMs(m && (m.LastSeen !== undefined ? m.LastSeen : m.lastSeen !== undefined ? m.lastSeen : m.l !== undefined ? m.l : m.ll !== undefined ? m.ll : null));
        addEntry(pid, name, lastMs);
      }
      return { byId, byName, byIdMsAgo, byNameMsAgo };
    }

    const memberData = typeof alliance.get_MemberData === 'function' ? alliance.get_MemberData() : null;
    const dict = memberData && (memberData.d || memberData);
    if (dict && typeof dict === 'object') {
      Object.keys(dict).forEach((k) => {
        const m = (dict as any)[k];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = getMemberPid(m, k);
        const lastMs = normalizeTsMs(m && (m.LastSeen !== undefined ? m.LastSeen : m.lastSeen !== undefined ? m.lastSeen : m.l !== undefined ? m.l : m.ll !== undefined ? m.ll : null));
        addEntry(pid, name, lastMs);
      });
    }
  } catch {
    // ignore
  }

  return { byId, byName, byIdMsAgo, byNameMsAgo };
}

function getAlliancePresenceMaps(alliance: any): { byId: Record<string, string>; byName: Record<string, string> } {
  const byId: Record<string, string> = Object.create(null);
  const byName: Record<string, string> = Object.create(null);

  function addEntry(pidMaybe: any, nameMaybe: any, statusText: string | null): void {
    try {
      if (!statusText) return;
      if (pidMaybe !== null && pidMaybe !== undefined) byId[String(pidMaybe)] = statusText;
      if (nameMaybe) byName[String(nameMaybe)] = statusText;
    } catch {
      // ignore
    }
  }

  function mapOnlineState(v: any): string | null {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : Number(v);
      if (!isFinite(n)) return null;
      if (n === 1) return 'Online';
      if (n === 2) return 'Away';
      return null;
    } catch {
      return null;
    }
  }

  try {
    if (!alliance) return { byId, byName };

    const roster = typeof alliance.get_MemberDataAsArray === 'function' ? alliance.get_MemberDataAsArray() : null;
    if (Array.isArray(roster) && roster.length) {
      for (let i = 0; i < roster.length; i++) {
        const m = roster[i];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = m && (m.Id !== undefined ? m.Id : m.PlayerId !== undefined ? m.PlayerId : null);
        const status = mapOnlineState(m && (m.OnlineState !== undefined ? m.OnlineState : m.os !== undefined ? m.os : null));
        addEntry(pid, name, status);
      }
      return { byId, byName };
    }

    const memberData = typeof alliance.get_MemberData === 'function' ? alliance.get_MemberData() : null;
    const dict = memberData && (memberData.d || memberData);
    if (dict && typeof dict === 'object') {
      Object.keys(dict).forEach((k) => {
        const m = (dict as any)[k];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = m && (m.Id !== undefined ? m.Id : m.PlayerId !== undefined ? m.PlayerId : k);
        const status = mapOnlineState(m && (m.OnlineState !== undefined ? m.OnlineState : m.os !== undefined ? m.os : null));
        addEntry(pid, name, status);
      });
    }
  } catch {
    // ignore
  }

  return { byId, byName };
}

function getAllianceHubMaps(alliance: any): { byId: Record<string, boolean>; byName: Record<string, boolean> } {
  const byId: Record<string, boolean> = Object.create(null);
  const byName: Record<string, boolean> = Object.create(null);

  function addEntry(pidMaybe: any, nameMaybe: any, hasHub: any): void {
    try {
      if (pidMaybe !== null && pidMaybe !== undefined) byId[String(pidMaybe)] = !!hasHub;
      if (nameMaybe) byName[String(nameMaybe)] = !!hasHub;
    } catch {
      // ignore
    }
  }

  function getHasHub(m: any): boolean {
    try {
      if (!m) return false;
      if (m.HasControlHubCodeBool !== undefined) return !!m.HasControlHubCodeBool;
      if (m.HasControlHubCode !== undefined) return !!m.HasControlHubCode;
      if (m.hc !== undefined) return !!m.hc;
      return false;
    } catch {
      return false;
    }
  }

  try {
    if (!alliance) return { byId, byName };

    const roster = typeof alliance.get_MemberDataAsArray === 'function' ? alliance.get_MemberDataAsArray() : null;
    if (Array.isArray(roster) && roster.length) {
      for (let i = 0; i < roster.length; i++) {
        const m = roster[i];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = m && (m.Id !== undefined ? m.Id : m.PlayerId !== undefined ? m.PlayerId : null);
        addEntry(pid, name, getHasHub(m));
      }
      return { byId, byName };
    }

    const memberData = typeof alliance.get_MemberData === 'function' ? alliance.get_MemberData() : null;
    const dict = memberData && (memberData.d || memberData);
    if (dict && typeof dict === 'object') {
      Object.keys(dict).forEach((k) => {
        const m = (dict as any)[k];
        const name = m && (m.n || m.Name || m.PlayerName);
        const pid = m && (m.Id !== undefined ? m.Id : m.PlayerId !== undefined ? m.PlayerId : k);
        addEntry(pid, name, getHasHub(m));
      });
    }
  } catch {
    // ignore
  }

  return { byId, byName };
}

function getAllianceMemberInfoMaps(alliance: any): { byId: Record<string, any>; byName: Record<string, any> } {
  const byId: Record<string, any> = Object.create(null);
  const byName: Record<string, any> = Object.create(null);

  function normalizeName(v: any): string | null {
    try {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s ? s : null;
    } catch {
      return null;
    }
  }

  function getPid(m: any, fallbackKey: any): any {
    try {
      if (!m) return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
      if (m.PlayerId !== undefined && m.PlayerId !== null) return m.PlayerId;
      if (m.Id !== undefined && m.Id !== null) return m.Id;
      if (m.pId !== undefined && m.pId !== null) return m.pId;
      if (m.pid !== undefined && m.pid !== null) return m.pid;
      if (m.p !== undefined && m.p !== null) return m.p;
      if (m.i !== undefined && m.i !== null) return m.i;
      return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
    } catch {
      return fallbackKey !== undefined && fallbackKey !== null ? fallbackKey : null;
    }
  }

  function add(m: any, fallbackKey: any): void {
    try {
      const pid = getPid(m, fallbackKey);
      const name = normalizeName(m && (m.Name || m.n || m.PlayerName));
      if (pid !== null && pid !== undefined) byId[String(pid)] = m;
      if (name) byName[String(name)] = m;
    } catch {
      // ignore
    }
  }

  try {
    if (!alliance) return { byId, byName };

    const roster = typeof alliance.get_MemberDataAsArray === 'function' ? alliance.get_MemberDataAsArray() : null;
    if (Array.isArray(roster) && roster.length) {
      for (let i = 0; i < roster.length; i++) add(roster[i], null);
      return { byId, byName };
    }

    const memberData = typeof alliance.get_MemberData === 'function' ? alliance.get_MemberData() : null;
    const dict = memberData && (memberData.d || memberData);
    if (dict && typeof dict === 'object') {
      Object.keys(dict).forEach((k) => add((dict as any)[k], k));
    }
  } catch {
    // ignore
  }

  return { byId, byName };
}

function playerFromPublicInfo(
  data: any,
  roleOverride: any,
  lastSeenOverride: any,
  lastSeenMsAgoOverride: any,
  presenceOverride: any,
  hasHubOverride: any
): any {
  try {
    const id = data && (data.i !== undefined ? data.i : data.p);
    const name = data && (data.n || data.pn);
    const score = data && (data.p !== undefined ? data.p : undefined);
    const rank = data && (data.r !== undefined ? data.r : undefined);
    const baseCount = data && data.c && Array.isArray(data.c) ? data.c.length : undefined;
    const inactive = data && (data.ii === true || data.ii === 1);

    const presence = presenceOverride || null;
    const lastSeen = presence || lastSeenOverride || getLastSeenFromPublicInfo(data) || (inactive ? 'Inactive' : null);
    const role = roleOverride || (data && (data.rr || data.role || data.roleName || data.rn)) || 'Member';

    return {
      id: String(id !== undefined ? id : name),
      name: name || 'Unknown',
      role: String(role),
      rank,
      score,
      lastSeen: lastSeen || undefined,
      lastSeenMsAgo: !presence && typeof lastSeenMsAgoOverride === 'number' && isFinite(lastSeenMsAgoOverride) ? lastSeenMsAgoOverride : undefined,
      presence: presence || undefined,
      hasHub: !!hasHubOverride,
      bases: baseCount,
      raw: data
    };
  } catch {
    return null;
  }
}

export async function refreshPlayersTs(store: StoreLike): Promise<void> {
  if (refreshInFlight) return;
  refreshInFlight = true;

  const prev: any = store.getState()?.data;
  const hadPlayers = !!(prev && prev.players && prev.players.length);
  store.setState({
    data: {
      ...(prev || {}),
      loading: !hadPlayers,
      error: null,
      lastRefreshStatus: hadPlayers ? 'Refreshing…' : prev?.lastRefreshStatus || null
    }
  });

  try {
    const md = getMainData();
    if (!md) {
      const cur: any = store.getState()?.data;
      store.setState({ data: { ...(cur || {}), loading: false, lastRefreshAt: Date.now(), lastRefreshStatus: 'ClientLib not ready' } });
      return;
    }

    const alliance = md.get_Alliance && md.get_Alliance();
    if (!alliance || (alliance.get_Exists && !alliance.get_Exists())) {
      const cur: any = store.getState()?.data;
      store.setState({
        data: {
          ...(cur || {}),
          loading: false,
          error: 'No alliance found (join/create an alliance).',
          lastRefreshAt: Date.now(),
          lastRefreshStatus: 'No alliance'
        }
      });
      return;
    }

    const roleMap = getAllianceRoleMap(alliance);

    const lastSeenMaps = getAllianceLastSeenMaps(alliance);
    const lastSeenById = lastSeenMaps.byId;
    const lastSeenByName = lastSeenMaps.byName;
    const lastSeenByIdMsAgo = lastSeenMaps.byIdMsAgo;
    const lastSeenByNameMsAgo = lastSeenMaps.byNameMsAgo;

    const presenceMaps = getAlliancePresenceMaps(alliance);
    const presenceById = presenceMaps.byId;
    const presenceByName = presenceMaps.byName;

    const hubMaps = getAllianceHubMaps(alliance);
    const hubById = hubMaps.byId;
    const hubByName = hubMaps.byName;

    const memberInfoMaps = getAllianceMemberInfoMaps(alliance);
    const memberInfoById = memberInfoMaps.byId;
    const memberInfoByName = memberInfoMaps.byName;

    const memberIds = getAllianceMemberIds(md);
    if (!memberIds.length) {
      const cur: any = store.getState()?.data;
      store.setState({
        data: {
          ...(cur || {}),
          players: [],
          selectedPlayerId: null,
          loading: false,
          error: null,
          lastRefreshAt: Date.now(),
          lastRefreshStatus: 'Waiting for member IDs…'
        }
      });
      return;
    }

    const playersRaw = await Promise.all(
      memberIds.map(async (id) => {
        try {
          const data = await fetchPublicPlayerInfo(id);
          const nm = data && (data.n || data.pn);

          const lastSeenOverride = lastSeenById[String(id)] || (nm ? lastSeenByName[String(nm)] : null);
          const lastSeenMsAgoOverride = lastSeenByIdMsAgo[String(id)] || (nm ? lastSeenByNameMsAgo[String(nm)] : null);
          const presenceOverride = presenceById[String(id)] || (nm ? presenceByName[String(nm)] : null);
          const hasHubOverride = hubById[String(id)] || (nm ? hubByName[String(nm)] : null);

          const p = playerFromPublicInfo(
            data,
            roleMap[String(id)] || (nm ? roleMap[String(nm)] : null),
            lastSeenOverride,
            lastSeenMsAgoOverride,
            presenceOverride,
            hasHubOverride
          );

          if (p) {
            const m = memberInfoById[String(id)] || (nm ? memberInfoByName[String(nm)] : null);
            if (m) p.member = m;
          }

          return p;
        } catch {
          return null;
        }
      })
    );

    const players = (playersRaw || []).filter((p) => !!p);

    if (players.length === 0) {
      const cur: any = store.getState()?.data;
      store.setState({
        data: {
          ...(cur || {}),
          players: [],
          selectedPlayerId: null,
          loading: false,
          error: null,
          lastRefreshAt: Date.now(),
          lastRefreshStatus: 'Waiting for member data…'
        }
      });
      return;
    }

    players.sort((a: any, b: any) => {
      const ra = typeof a.rank === 'number' ? a.rank : 999999;
      const rb = typeof b.rank === 'number' ? b.rank : 999999;
      if (ra !== rb) return ra - rb;
      return String(a.name).localeCompare(String(b.name));
    });

    const selected = store.getState()?.data?.selectedPlayerId;
    const nextSelected = selected && players.some((p: any) => p.id === selected) ? selected : players[0] ? players[0].id : null;

    const cur: any = store.getState()?.data;
    store.setState({
      data: {
        ...(cur || {}),
        players,
        selectedPlayerId: nextSelected,
        loading: false,
        error: null,
        lastRefreshAt: Date.now(),
        lastRefreshStatus: 'OK'
      }
    });
  } catch (e: any) {
    const msg = String(e && e.message ? e.message : e);
    const cur: any = store.getState()?.data;
    store.setState({
      data: {
        ...(cur || {}),
        loading: false,
        error: msg,
        lastRefreshAt: Date.now(),
        lastRefreshStatus: msg
      }
    });
  } finally {
    refreshInFlight = false;
  }
}
