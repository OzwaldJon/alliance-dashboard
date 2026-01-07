import { getAppContext } from '../../app/global';
import { formatNumber } from '../../services/format';
import { getGameApi } from '../../services/gameApi';
import { centerMapTo } from '../../services/map';
import { getPoiTypeColor, getPoiTypeName } from '../poi/model';

export function registerNotificationsTabTs(): void {
  const ctx = getAppContext();
  const { registry, makeEl } = ctx;

  registry.registerTab({
    id: 'notifications',
    title: 'Notifications',
    icon: 'mdi:bell-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const card = makeEl('div', { class: 'cad-card' });
      (card as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;';

      const head = makeEl('div');
      (head as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;';

      const h = makeEl('h3');
      h.textContent = 'NotificationGetRange explorer';
      (h as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';

      const status = makeEl('div');
      (status as HTMLElement).style.cssText =
        'flex:0 0 auto;font-size:11px;font-weight:800;color:rgba(233,238,247,.86);border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.20);padding:6px 10px;border-radius:999px;white-space:nowrap;';
      status.textContent = 'Idle';

      head.appendChild(h);
      head.appendChild(status);

      const filterBar = makeEl('div');
      (filterBar as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const filterLabel = makeEl('div');
      filterLabel.textContent = 'Filter:';
      (filterLabel as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';

      const typeFilterSelect = makeEl('select') as HTMLSelectElement;
      typeFilterSelect.style.cssText =
        'min-width:240px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
      const optAll = makeEl('option') as HTMLOptionElement;
      optAll.value = '';
      optAll.textContent = 'All types';
      typeFilterSelect.appendChild(optAll);

      const loadMoreBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      loadMoreBtn.textContent = 'Load more';
      loadMoreBtn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

      filterBar.appendChild(filterLabel);
      filterBar.appendChild(typeFilterSelect);
      filterBar.appendChild(loadMoreBtn);

      const decodedWrap = makeEl('div');
      (decodedWrap as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      let lastItems: any[] = [];

      let selectedEnumFilter: string = '';

      let pagingAllItems: any[] = [];
      let pagingIdSeen: Record<string, boolean> = Object.create(null);
      let pagingNextSkip = 0;
      let pagingLoading = false;
      let pagingHasMore = true;
      const pagingPageSize = 50;

      function setStatus(t: string): void {
        try {
          status.textContent = t;
        } catch {
          // ignore
        }
      }

      function updateLoadMoreBtn(): void {
        try {
          loadMoreBtn.disabled = !!pagingLoading || !pagingHasMore;
          loadMoreBtn.style.display = pagingHasMore ? 'inline-flex' : 'none';
          if (pagingLoading) loadMoreBtn.textContent = 'Loading…';
          else loadMoreBtn.textContent = 'Load more';
        } catch {
          // ignore
        }
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

      function tryResolveBaseIdToXY(baseId: any): { x: number; y: number } | null {
        try {
          const id = Number(baseId);
          if (!isFinite(id) || id <= 0) return null;

          const api = getGameApi();
          const md = api.mainData;
          if (!md) return null;

          const cities = (md.get_Cities && md.get_Cities()) || (md.get_City && md.get_City()) || null;

          const tryGetCityFromCollection = (coll: any): any | null => {
            if (!coll) return null;
            try {
              if (typeof coll.GetCity === 'function') return coll.GetCity(id);
            } catch {
              // ignore
            }
            try {
              if (typeof coll.get_Item === 'function') return coll.get_Item(id);
            } catch {
              // ignore
            }
            try {
              if (typeof coll.get === 'function') return coll.get(id);
            } catch {
              // ignore
            }
            try {
              const v = coll[id];
              if (v) return v;
            } catch {
              // ignore
            }
            return null;
          };

          let city: any = null;
          city = tryGetCityFromCollection(cities);
          if (!city) {
            try {
              if (typeof md.GetCity === 'function') city = md.GetCity(id);
            } catch {
              // ignore
            }
          }
          if (!city) {
            try {
              if (typeof md.get_CityById === 'function') city = md.get_CityById(id);
            } catch {
              // ignore
            }
          }

          const xy = getXYFromCityLike(city);
          if (xy) return xy;
        } catch {
          // ignore
        }
        return null;
      }

      function addCenterButtonImpl(row: HTMLElement, xy: { x: number; y: number } | null, label: string | null): void {
        try {
          if (!xy) return;

          const idx = (() => {
            try {
              const cur = Number((row as any).__cadCenterBtnCount || 0);
              (row as any).__cadCenterBtnCount = cur + 1;
              (row as any).__cadHasCenterBtn = true;
              return cur;
            } catch {
              (row as any).__cadHasCenterBtn = true;
              return 0;
            }
          })();

          const btn = makeEl('button', { type: 'button' }) as HTMLButtonElement;
          btn.textContent = label ? label : 'Center ' + String(xy.x) + ':' + String(xy.y);
          btn.style.cssText =
            'position:absolute;top:' +
            String(8 + idx * 26) +
            'px;right:8px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(233,238,247,.86);border-radius:999px;padding:4px 8px;font-size:11px;line-height:1;cursor:pointer;';
          btn.addEventListener('click', (ev) => {
            try {
              ev.preventDefault();
              ev.stopPropagation();
            } catch {
              // ignore
            }
            try {
              centerMapTo(xy.x, xy.y);
            } catch {
              // ignore
            }
          });
          row.appendChild(btn);
        } catch {
          // ignore
        }
      }

      function addCenterButton(row: HTMLElement, xy: { x: number; y: number } | null): void {
        try {
          addCenterButtonImpl(row, xy, null);
        } catch {
          // ignore
        }
      }

      function addJsonToggle(row: HTMLElement, n: any): void {
        try {
          if ((row as any).__cadHasJsonBtn) return;
          (row as any).__cadHasJsonBtn = true;

          const pre = makeEl('pre');
          (pre as HTMLElement).style.cssText =
            'margin:8px 0 0 0;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);border:1px solid rgba(255,255,255,.08);color:rgba(233,238,247,.92);font-size:11px;white-space:pre-wrap;word-break:break-word;display:none;';

          try {
            (pre as HTMLElement).textContent = JSON.stringify(n, null, 2);
          } catch {
            try {
              (pre as HTMLElement).textContent = String(n);
            } catch {
              (pre as HTMLElement).textContent = '[unserializable]';
            }
          }

          const btn = makeEl('button', { type: 'button' }) as HTMLButtonElement;
          btn.textContent = 'JSON';
          btn.style.cssText =
            'position:absolute;right:8px;bottom:8px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(233,238,247,.86);border-radius:999px;padding:4px 8px;font-size:11px;line-height:1;cursor:pointer;';

          btn.addEventListener('click', (ev) => {
            try {
              ev.preventDefault();
              ev.stopPropagation();
            } catch {
              // ignore
            }
            try {
              const isOpen = (pre as HTMLElement).style.display !== 'none';
              (pre as HTMLElement).style.display = isOpen ? 'none' : 'block';
              btn.textContent = isOpen ? 'JSON' : 'Hide JSON';
            } catch {
              // ignore
            }
          });

          row.appendChild(btn);
          row.appendChild(pre);
        } catch {
          // ignore
        }
      }

      function accentColorForNotification(enumName: string | null, params: Array<{ key: string; type: string; value: any }>): string | null {
        try {
          const n = String(enumName ?? '').trim();
          if (n === 'POIGained' || n === 'POILost') return '#f1c84b';
          if (n === 'AllianceNPCRaidOutgoing' || n === 'AllianceAttackOutgoing' || n === 'AllianceAttackIncoming') return '#3b82f6';
          if (
            n === 'AllianceNewMember' ||
            n === 'AllianceMemberLeft' ||
            n === 'AllianceMemberKicked' ||
            n === 'AllianceMemberRoleChanged' ||
            n === 'PlayerInvited' ||
            n === 'AllianceRelationshipChanged' ||
            n === 'AllianceRelationshipRequest'
          )
            return '#3b82f6';
          if (n === 'NewPlayerTitle') return '#f59e0b';
          if (/^Endgame/i.test(n) || /Viral/i.test(n)) return '#22d3ee';
          if (/^Combat/i.test(n)) return '#ef4444';

          // Fallback: param-based POI detection
          const hasPoi = params.some((p) => {
            const t = String(p?.type || '');
            return t === 'pot' || t === 'pol' || t === 'pos' || t === 'pon';
          });
          if (hasPoi) return '#f1c84b';
        } catch {
          // ignore
        }
        return null;
      }

      function updateTypeFilterOptions(items: any[]): void {
        try {
          const current = String(typeFilterSelect.value || '');
          const seen: Record<string, boolean> = Object.create(null);
          const types: string[] = [];

          (Array.isArray(items) ? items : []).forEach((n: any) => {
            try {
              const mdb = n && n.mdb !== undefined ? Number(n.mdb) : null;
              const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
              const key = enumName ? String(enumName) : '';
              if (!key || seen[key]) return;
              seen[key] = true;
              types.push(key);
            } catch {
              // ignore
            }
          });

          types.sort((a, b) => a.localeCompare(b));

          typeFilterSelect.innerHTML = '';
          typeFilterSelect.appendChild(optAll);
          types.forEach((t) => {
            const o = makeEl('option') as HTMLOptionElement;
            o.value = t;
            const friendly = friendlyTitleFromEnumName(t);
            o.textContent = friendly ? friendly : t;
            typeFilterSelect.appendChild(o);
          });

          typeFilterSelect.value = current;
          if (String(typeFilterSelect.value || '') !== current) typeFilterSelect.value = '';
        } catch {
          // ignore
        }
      }

      function getEnumName(value: any): string | null {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const en: any = ClientLib?.Data?.ENotificationId;
          if (!en) return null;
          const v = Number(value);
          if (!isFinite(v)) return null;
          const keys = Object.keys(en);
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (typeof en[k] === 'number' && Number(en[k]) === v) return k;
          }
        } catch {
          // ignore
        }
        return null;
      }

      function friendlyTitleFromEnumName(enumName: string | null): string | null {
        try {
          const n = String(enumName ?? '').trim();
          if (!n) return null;
          const map: Record<string, string> = {
            AllianceNPCRaidOutgoing: 'Alliance launched a raid',
            AllianceNewMember: 'New member',
            AllianceRelationshipChanged: 'Alliance Relationship Changed',
            AllianceRelationshipRequest: 'Alliance Relationship Request',
            CombatRaidWon: 'Alliance raid: Victory',
            CombatRaidTotalWon: 'Alliance raid: Total victory',
            POIGained: 'Alliance gained control over',
            POILost: 'Alliance lost control over',
            AllianceAttackOutgoing: 'Alliance launched an attack',
            CombatBattleTotalWonOffense: 'Alliance attack: Total victory',
            CombatBattleWonOffense: 'Alliance attack: Victory',
            CombatBattleTotalLostOffense: 'Alliance attack: Total defeat',
            AllianceMemberLeft: 'Alliance Member Left',
            AllianceMemberRoleChanged: 'Member role changed',
            AllianceMemberKicked: 'Alliance member kicked',
            PlayerInvited: 'Player invitation sent',
            NewPlayerTitle: 'Player promoted',
            AllianceAttackIncoming: 'Alliance under attack',
            CombatBattleLostDefense: 'Alliance defense: Defeat',
            CombatBattleTotalLostDefense: 'Alliance defense: Total defeat',
            EndgameSatelliteImpact: 'Available Satellite',
            EndgameImpactWarning: 'Incoming Satellite',
            EndgameAllianceTerminalLost: 'Alliance Lost Terminal Hub',
            EndgameWorldHubLost: 'Alliance Lost Shield Control Hub',
            EndgameWorldShieldReactivated: 'Fortress Shield Reactivated',
            EndgameWon: 'Alliance Destroyed the Fortress',
            EndgameAllianceViralAttack: 'Alliance started Viral Attack',
            EndgameAllianceFortressAttacked: 'Alliance attack fortress',
          };
          return map[n] ?? null;
        } catch {
          return null;
        }
      }

      function fmtTs(ts: any): string {
        try {
          const n = Number(ts);
          if (!isFinite(n) || n <= 0) return '-';
          return new Date(n).toLocaleString();
        } catch {
          return '-';
        }
      }

      function normalizeItems(raw: any): any[] {
        const arr: any[] = Array.isArray(raw) ? raw : raw && Array.isArray(raw.d) ? raw.d : [];
        return Array.isArray(arr) ? arr : [];
      }

      function decodeParams(p: any): Array<{ key: string; type: string; value: any }> {
        try {
          const arr: any[] = Array.isArray(p) ? p : [];
          return arr
            .map((it: any) => {
              const key = it && it.k !== undefined ? String(it.k) : '';
              const type = it && it.t !== undefined ? String(it.t) : '';
              const value = it && it.v !== undefined ? it.v : null;
              return { key, type, value };
            })
            .filter((x) => x.key || x.type);
        } catch {
          return [];
        }
      }

      function copyText(text: unknown): void {
        try {
          const t = String(text ?? '');
          const nav: any = navigator as any;
          if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            nav.clipboard.writeText(t);
            return;
          }
        } catch {
          // ignore
        }
        try {
          window.prompt('Copy to clipboard:', String(text ?? ''));
        } catch {
          // ignore
        }
      }

      function decodePackedCoords(v: any): string {
        try {
          const n = Number(v);
          if (!isFinite(n)) return '-';
          const y = n & 0xffff;
          const x = (n >>> 16) & 0xffff;
          if (!isFinite(x) || !isFinite(y)) return '-';
          return String(x) + ':' + String(y);
        } catch {
          return '-';
        }
      }

      function decodePackedCoordsXY(v: any): { x: number; y: number } | null {
        try {
          const n = Number(v);
          if (!isFinite(n)) return null;
          const y = n & 0xffff;
          const x = (n >>> 16) & 0xffff;
          if (!isFinite(x) || !isFinite(y)) return null;
          return { x, y };
        } catch {
          return null;
        }
      }

      function getPoiTypeEnumName(typeId: number): string | null {
        try {
          const tid = Number(typeId);
          if (!Number.isFinite(tid)) return null;
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const en: any = ClientLib?.Base?.EPOIType;
          if (!en) return null;
          const keys = Object.keys(en);
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (typeof en[k] === 'number' && Number(en[k]) === tid) return k;
          }
        } catch {
          // ignore
        }
        return null;
      }

      function tryGetPoiNameAt(x: number, y: number): string | null {
        try {
          const api = getGameApi();
          const region = api.region || (api.visMain && api.visMain.get_Region ? api.visMain.get_Region() : null);
          const world = api.world;

          const candidates: any[] = [];
          try {
            if (region && region.GetObjectFromPosition && region.get_GridWidth && region.get_GridHeight) {
              const gw = Number(region.get_GridWidth());
              const gh = Number(region.get_GridHeight());
              if (isFinite(gw) && isFinite(gh) && gw > 0 && gh > 0) {
                const o = region.GetObjectFromPosition(Number(x) * gw, Number(y) * gh);
                if (o) candidates.push(o);
              }
            }
          } catch {
            // ignore
          }
          try {
            if (region && region.GetObjectFromPosition) {
              const o = region.GetObjectFromPosition(Number(x), Number(y));
              if (o) candidates.push(o);
            }
          } catch {
            // ignore
          }
          try {
            const fn = world && (world.GetObjectFromPosition || world.GetObjectFromPositionEx || world.GetObjectFromPositionXY);
            if (fn) {
              const o = fn.call(world, Number(x), Number(y));
              if (o) candidates.push(o);
            }
          } catch {
            // ignore
          }

          for (let i = 0; i < candidates.length; i++) {
            const obj = candidates[i];
            if (!obj) continue;
            const tryFns = ['get_Name', 'get_NameText', 'get_Description', 'get_BaseName', 'get_ServerName'];
            for (let j = 0; j < tryFns.length; j++) {
              const fn = tryFns[j];
              try {
                if (typeof (obj as any)[fn] === 'function') {
                  const v = (obj as any)[fn]();
                  const s = v !== null && v !== undefined ? String(v).trim() : '';
                  if (s) return s;
                }
              } catch {
                // ignore
              }
            }
            try {
              const raw = (obj as any).Name ?? (obj as any).name ?? (obj as any).n;
              const s = raw !== null && raw !== undefined ? String(raw).trim() : '';
              if (s) return s;
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
        return null;
      }

      function mapParamsByType(params: Array<{ key: string; type: string; value: any }>): Record<string, any> {
        const map: Record<string, any> = Object.create(null);
        try {
          params.forEach((p) => {
            const t = String(p?.type || '').trim();
            if (!t) return;
            if (map[t] === undefined) {
              map[t] = p.value;
              return;
            }
            if (Array.isArray(map[t])) {
              map[t].push(p.value);
              return;
            }
            map[t] = [map[t], p.value];
          });
        } catch {
          // ignore
        }
        return map;
      }

      function getParamValue(params: Array<{ key: string; type: string; value: any }>, type: string): any {
        try {
          const t = String(type || '').trim();
          if (!t) return null;
          const p = params.find((x) => String(x?.type || '') === t);
          return p ? p.value : null;
        } catch {
          return null;
        }
      }

      function getAllParamValues(params: Array<{ key: string; type: string; value: any }>, type: string): any[] {
        try {
          const t = String(type || '').trim();
          if (!t) return [];
          return params.filter((x) => String(x?.type || '') === t).map((x) => x.value);
        } catch {
          return [];
        }
      }

      function getParamValueByKey(params: Array<{ key: string; type: string; value: any }>, key: string): any {
        try {
          const k = String(key || '').trim();
          if (!k) return null;
          const p = params.find((x) => String(x?.key || '') === k);
          return p ? p.value : null;
        } catch {
          return null;
        }
      }

      function renderRaidCard(row: HTMLElement, n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const pn = getParamValue(params, 'pn');
          const bin = getParamValue(params, 'bin');
          const bl = getParamValue(params, 'bl');
          const ncl = getParamValue(params, 'ncl');
          const ncct = getParamValue(params, 'ncct');
          const reportId = getParamValueByKey(params, 'reportId') ?? getParamValue(params, 'ri');

          const pnAll = getAllParamValues(params, 'pn');
          const binAll = getAllParamValues(params, 'bin');

          const hasSomething = pn !== null || bin !== null || bl !== null || ncl !== null || ncct !== null || reportId !== null;
          if (!hasSomething) return false;

          // Avoid hijacking two-party battle style notifications (they typically contain 2x pn and 2x bin).
          if (pnAll.length > 1 || binAll.length > 1) return false;

          // For "raid/attack" style cards, require either target info (coords/level) or an explicit report.
          const hasTargetInfo = ncl !== null || ncct !== null;
          const hasReport = reportId !== null;
          if (!hasTargetInfo && !hasReport) return false;

          // Require at least attacker name or reportId to treat as raid/attack card.
          if (pn === null && reportId === null) return false;

          const attacker = pn !== null ? String(pn) : '-';
          const baseName = Array.isArray(bin) && bin.length >= 2 ? String(bin[1]) : '-';
          const baseLvl = bl !== null && bl !== undefined ? String(bl) : '-';
          const targetLvl = ncl !== null && ncl !== undefined ? String(ncl) : '-';

          const coordsPacked = Array.isArray(ncct) && ncct.length ? ncct[0] : ncct;
          void reportId;

          // Add Center button for attacker base (raids only)
          try {
            const baseId = Array.isArray(bin) && bin.length ? bin[0] : null;
            const xy = tryResolveBaseIdToXY(baseId);
            addCenterButtonImpl(row, xy, xy ? 'Attacker ' + String(xy.x) + ':' + String(xy.y) : null);
          } catch {
            // ignore
          }

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';

          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Attacker', attacker);
          addKV('Attacker base', baseName);
          addKV('Attacker base lvl', baseLvl);
          addKV('Target lvl', targetLvl);
          void coordsPacked;

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderAllianceMemberCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          if (!enumName) return false;

          if (enumName !== 'AllianceNewMember' && enumName !== 'AllianceMemberLeft' && enumName !== 'AllianceMemberKicked' && enumName !== 'AllianceMemberRoleChanged') {
            return false;
          }

          const pnAll = getAllParamValues(params, 'pn').map((x) => String(x ?? '')).filter((s) => s.trim());
          const pnaAll = (() => {
            const out: string[] = [];
            const rawList = getAllParamValues(params, 'pna');
            for (let i = 0; i < rawList.length; i++) {
              const v: any = rawList[i];
              if (Array.isArray(v)) {
                for (let j = 0; j < v.length; j++) {
                  const s = String(v[j] ?? '').trim();
                  if (s) out.push(s);
                }
                continue;
              }
              const s = String(v ?? '').trim();
              if (s) out.push(s);
            }
            return out;
          })();
          const anAll = getAllParamValues(params, 'an').map((x) => String(x ?? '')).filter((s) => s.trim());
          const allianceName = anAll.length ? anAll[0] : '-';
          const roleName = (() => {
            const rn = getParamValue(params, 'rn');
            return rn !== null && rn !== undefined ? String(rn) : null;
          })();

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          if (enumName === 'AllianceNewMember') {
            addKV('Player', pnAll[0] ? pnAll[0] : '-');
            addKV('Alliance', allianceName);
          } else if (enumName === 'AllianceMemberLeft') {
            addKV('Player', pnAll[0] ? pnAll[0] : '-');
            addKV('Alliance', allianceName);
          } else if (enumName === 'AllianceMemberKicked') {
            addKV('Kicked', pnaAll.length ? pnaAll.join(', ') : '-');
            addKV('By', pnAll[0] ? pnAll[0] : '-');
            addKV('Alliance', allianceName);
          } else if (enumName === 'AllianceMemberRoleChanged') {
            addKV('Player', pnaAll.length ? pnaAll.join(', ') : pnAll[0] ? pnAll[0] : '-');
            if (pnAll.length) addKV('By', pnAll[0]);
            if (roleName) addKV('New role', roleName);
          }

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderInvitationCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          if (enumName !== 'PlayerInvited') return false;

          const pnAll = getAllParamValues(params, 'pn').map((x) => String(x ?? '')).filter((s) => s.trim());
          const an = getParamValue(params, 'an');
          const allianceName = an !== null && an !== undefined ? String(an) : '-';

          const inviter = pnAll.length ? pnAll[0] : '-';
          const invited = pnAll.length >= 2 ? pnAll[pnAll.length - 1] : '-';

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Alliance', allianceName);
          addKV('Inviter', inviter);
          addKV('Invited', invited);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderRelationshipCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          if (enumName !== 'AllianceRelationshipChanged' && enumName !== 'AllianceRelationshipRequest') return false;

          const anAll = getAllParamValues(params, 'an').map((x) => String(x ?? '')).filter((s) => s.trim());
          const pn = getParamValue(params, 'pn');
          const art = getParamValue(params, 'art');

          const a1 = anAll.length ? anAll[0] : '-';
          const a2 = anAll.length >= 2 ? anAll[1] : '-';
          const by = pn !== null && pn !== undefined ? String(pn) : '-';
          const rel = art !== null && art !== undefined ? String(art) : '-';

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Alliance A', a1);
          addKV('Alliance B', a2);
          addKV(enumName === 'AllianceRelationshipRequest' ? 'Requested by' : 'Changed by', by);
          addKV('Relation type', rel);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderEndgameCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          if (!enumName || !/^Endgame/i.test(enumName)) return false;

          const pn = getParamValue(params, 'pn');
          const an = getParamValue(params, 'an');
          const chi = getParamValue(params, 'chi');

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          const ally = an !== null && an !== undefined ? String(an) : null;
          const player = pn !== null && pn !== undefined ? String(pn) : null;
          const hubId = chi !== null && chi !== undefined ? String(chi) : null;

          if (ally) addKV('Alliance', ally);
          if (player) addKV('Player', player);
          if (hubId) addKV('Hub', hubId);

          if (!ally && !player && !hubId) return false;

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderPoiEventCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const pot = getParamValue(params, 'pot');
          const pol = getParamValue(params, 'pol');
          const pos = getParamValue(params, 'pos');
          const pon = getParamValue(params, 'pon');
          const co = getParamValue(params, 'co');
          if (pot === null && pol === null && pos === null && pon === null) return false;
          if (co === null && pot === null) return false;

          const coordsTxt = co !== null && co !== undefined ? decodePackedCoords(co) : '-';
          const xy = co !== null && co !== undefined ? decodePackedCoordsXY(co) : null;

          const poiType = pot !== null && pot !== undefined && isFinite(Number(pot)) ? Number(pot) : null;
          const poiLevel = pol !== null && pol !== undefined && isFinite(Number(pol)) ? Number(pol) : null;
          const poiScore = pos !== null && pos !== undefined && isFinite(Number(pos)) ? Number(pos) : null;

          const typeName = poiType !== null ? getPoiTypeName(poiType) : null;
          const typeColor = poiType !== null ? getPoiTypeColor(poiType) : null;

          const typeEnumName = poiType !== null ? getPoiTypeEnumName(poiType) : null;
          const typeTxt =
            typeName ? typeName : poiType !== null ? (typeEnumName ? String(typeEnumName) : 'TypeId ' + String(poiType)) : '-';
          const lvlTxt = poiLevel !== null ? String(poiLevel) : '-';
          const scoreTxt = poiScore !== null ? formatNumber(poiScore) : '-';

          let poiNameTxt = '-';
          try {
            if (xy) {
              const nm = tryGetPoiNameAt(xy.x, xy.y);
              if (nm) poiNameTxt = nm;
            }
          } catch {
            // ignore
          }
          if (poiNameTxt === '-') {
            try {
              if (pon !== null && pon !== undefined) poiNameTxt = String(pon);
            } catch {
              // ignore
            }
          }

          let showPoiName = false;
          try {
            if (poiNameTxt !== '-' && String(poiNameTxt).trim()) {
              const s = String(poiNameTxt).trim();
              // If it's just a numeric id (e.g. "8"), hide it.
              if (!/^[0-9]+$/.test(s)) showPoiName = true;
            }
          } catch {
            showPoiName = false;
          }

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';

          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('POI type', typeTxt);
          if (showPoiName) addKV('POI', poiNameTxt);
          addKV('POI level', lvlTxt);
          addKV('POI score', scoreTxt);
          void coordsTxt;

          try {
            if (typeColor) {
              const badge = makeEl('div');
              (badge as HTMLElement).style.cssText =
                'align-self:flex-start;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);border-radius:999px;padding:4px 8px;font-size:11px;color:rgba(233,238,247,.92);';
              const dot = makeEl('span');
              (dot as HTMLElement).style.cssText = 'width:10px;height:10px;border-radius:999px;background:' + typeColor + ';display:inline-block;';
              const txt = makeEl('span');
              txt.textContent = typeName ? typeName : 'POI';
              badge.appendChild(dot);
              badge.appendChild(txt);
              content.insertBefore(badge, grid);
            }
          } catch {
            // ignore
          }

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderCoordOnlyCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const co = getParamValue(params, 'co');
          const other = params.filter((p) => String(p?.type || '') !== 'co');
          if (co === null || other.length) return false;
          void co;

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';

          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';
          const k1 = makeEl('div');
          (k1 as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
          k1.textContent = 'Location';
          const v1 = makeEl('div');
          (v1 as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);';
          v1.textContent = 'Use the Center button';
          grid.appendChild(k1);
          grid.appendChild(v1);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderTwoPartyReportCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          const swapRoles = !!(enumName && /(Offense|AttackOutgoing)$/i.test(enumName));

          const pns = getAllParamValues(params, 'pn');
          const bins = getAllParamValues(params, 'bin');
          const bls = getAllParamValues(params, 'bl');
          const an = getParamValue(params, 'an');
          const of = getParamValue(params, 'of');
          const reportId = getParamValueByKey(params, 'reportId') ?? getParamValue(params, 'ri');

          if (reportId === null || reportId === undefined) return false;
          if (pns.length < 2 || bins.length < 2) return false;

          const aIdx = swapRoles ? 1 : 0;
          const dIdx = swapRoles ? 0 : 1;
          const attacker = String(pns[aIdx] ?? '-');
          const defender = String(pns[dIdx] ?? '-');
          const atkBaseName = Array.isArray(bins[aIdx]) && bins[aIdx].length >= 2 ? String(bins[aIdx][1]) : '-';
          const defBaseName = Array.isArray(bins[dIdx]) && bins[dIdx].length >= 2 ? String(bins[dIdx][1]) : '-';
          const atkBaseLvl = bls.length >= aIdx + 1 ? String(bls[aIdx]) : '-';
          const defBaseLvl = bls.length >= dIdx + 1 ? String(bls[dIdx]) : '-';
          const allianceName = an !== null && an !== undefined ? String(an) : '-';
          const outcome = of !== null && of !== undefined ? String(of) : '-';

          // Add Center buttons for attacker and defender bases
          try {
            const atkBaseId = Array.isArray(bins[aIdx]) && bins[aIdx].length ? bins[aIdx][0] : null;
            const defBaseId2 = Array.isArray(bins[dIdx]) && bins[dIdx].length ? bins[dIdx][0] : null;
            const atkXY = tryResolveBaseIdToXY(atkBaseId);
            const defXY = tryResolveBaseIdToXY(defBaseId2);
            addCenterButtonImpl(row, atkXY, atkXY ? 'Attacker ' + String(atkXY.x) + ':' + String(atkXY.y) : null);
            addCenterButtonImpl(row, defXY, defXY ? 'Defender ' + String(defXY.x) + ':' + String(defXY.y) : null);
          } catch {
            // ignore
          }

          let reportTxt = '-';
          try {
            reportTxt = typeof reportId === 'string' ? reportId : JSON.stringify(reportId);
          } catch {
            reportTxt = String(reportId ?? '-');
          }
          void reportTxt;

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Attacker', attacker);
          addKV('Attacker base', atkBaseName + (atkBaseLvl !== '-' ? ' (lvl ' + atkBaseLvl + ')' : ''));
          addKV('Defender', defender);
          addKV('Defender base', defBaseName + (defBaseLvl !== '-' ? ' (lvl ' + defBaseLvl + ')' : ''));
          addKV('Alliance', allianceName);
          addKV('Outcome', outcome);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderTwoPartyNoReportCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const reportId = getParamValueByKey(params, 'reportId') ?? getParamValue(params, 'ri');
          if (reportId !== null && reportId !== undefined) return false;

          const mdb = _n && _n.mdb !== undefined ? Number(_n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          const swapRoles = !!(enumName && /(Offense|AttackOutgoing)$/i.test(enumName));

          const pns = getAllParamValues(params, 'pn');
          const bins = getAllParamValues(params, 'bin');
          const bls = getAllParamValues(params, 'bl');
          const an = getParamValue(params, 'an');
          const of = getParamValue(params, 'of');
          const defBaseId = getParamValueByKey(params, 'defBaseId') ?? getParamValue(params, 'bi');

          if (pns.length < 2 || bins.length < 2) return false;

          const aIdx = swapRoles ? 1 : 0;
          const dIdx = swapRoles ? 0 : 1;
          const attacker = String(pns[aIdx] ?? '-');
          const defender = String(pns[dIdx] ?? '-');
          const atkBaseName = Array.isArray(bins[aIdx]) && bins[aIdx].length >= 2 ? String(bins[aIdx][1]) : '-';
          const defBaseName = Array.isArray(bins[dIdx]) && bins[dIdx].length >= 2 ? String(bins[dIdx][1]) : '-';
          const atkBaseLvl = bls.length >= aIdx + 1 ? String(bls[aIdx]) : '-';
          const defBaseLvl = bls.length >= dIdx + 1 ? String(bls[dIdx]) : '-';
          const allianceName = an !== null && an !== undefined ? String(an) : '-';
          const outcome = of !== null && of !== undefined ? String(of) : '-';
          void defBaseId;

          // Add Center buttons for attacker and defender bases
          try {
            const atkBaseId = Array.isArray(bins[aIdx]) && bins[aIdx].length ? bins[aIdx][0] : null;
            const defBaseId2 = Array.isArray(bins[dIdx]) && bins[dIdx].length ? bins[dIdx][0] : null;
            const atkXY = tryResolveBaseIdToXY(atkBaseId);
            const defXY = tryResolveBaseIdToXY(defBaseId2);
            addCenterButtonImpl(row, atkXY, atkXY ? 'Attacker ' + String(atkXY.x) + ':' + String(atkXY.y) : null);
            addCenterButtonImpl(row, defXY, defXY ? 'Defender ' + String(defXY.x) + ':' + String(defXY.y) : null);
          } catch {
            // ignore
          }

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Attacker', attacker);
          addKV('Attacker base', atkBaseName + (atkBaseLvl !== '-' ? ' (lvl ' + atkBaseLvl + ')' : ''));
          addKV('Defender', defender);
          addKV('Defender base', defBaseName + (defBaseLvl !== '-' ? ' (lvl ' + defBaseLvl + ')' : ''));
          addKV('Alliance', allianceName);
          addKV('Outcome', outcome);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderNpcNoReportCard(row: HTMLElement, _n: any, params: Array<{ key: string; type: string; value: any }>): boolean {
        try {
          const reportId = getParamValueByKey(params, 'reportId') ?? getParamValue(params, 'ri');
          if (reportId !== null && reportId !== undefined) return false;

          const pn = getParamValue(params, 'pn');
          const bin = getParamValue(params, 'bin');
          const bl = getParamValue(params, 'bl');
          const ncl = getParamValue(params, 'ncl');
          const ncct = getParamValue(params, 'ncct');
          const an = getParamValue(params, 'an');
          const of = getParamValue(params, 'of');
          const defBaseId = getParamValueByKey(params, 'defBaseId') ?? getParamValue(params, 'bi');

          if (pn === null && bin === null && ncl === null && ncct === null && an === null) return false;
          if (pn === null && bin === null) return false;
          if (ncl === null && ncct === null && an === null) return false;

          const attacker = pn !== null ? String(pn) : '-';
          const baseName = Array.isArray(bin) && bin.length >= 2 ? String(bin[1]) : '-';
          const baseLvl = bl !== null && bl !== undefined ? String(bl) : '-';
          const targetLvl = ncl !== null && ncl !== undefined ? String(ncl) : '-';
          const coordsPacked = Array.isArray(ncct) && ncct.length ? ncct[0] : ncct;
          void coordsPacked;
          const allianceName = an !== null && an !== undefined ? String(an) : '-';
          const outcome = of !== null && of !== undefined ? String(of) : '-';
          void defBaseId;

          const content = makeEl('div');
          (content as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:6px;';
          const grid = makeEl('div');
          (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 140px 1fr;gap:4px 10px;font-size:11px;';

          const addKV = (k: string, v: string) => {
            const kk = makeEl('div');
            (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
            kk.textContent = k;
            const vv = makeEl('div');
            (vv as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
            vv.textContent = v;
            grid.appendChild(kk);
            grid.appendChild(vv);
          };

          addKV('Attacker', attacker);
          addKV('Attacker base', baseName + (baseLvl !== '-' ? ' (lvl ' + baseLvl + ')' : ''));
          addKV('Target lvl', targetLvl);
          addKV('Alliance', allianceName);
          addKV('Outcome', outcome);

          content.appendChild(grid);
          row.appendChild(content);
          return true;
        } catch {
          return false;
        }
      }

      function renderDecoded(items: any[]): void {
        decodedWrap.innerHTML = '';

        let showItems: any[] = Array.isArray(items) ? items : [];
        try {
          const f = String(selectedEnumFilter || '');
          if (f) {
            showItems = showItems.filter((n: any) => {
              try {
                const mdb = n && n.mdb !== undefined ? Number(n.mdb) : null;
                const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
                return String(enumName || '') === f;
              } catch {
                return false;
              }
            });
          }
        } catch {
          // ignore
        }

        if (!showItems.length) {
          const empty = makeEl('div', { class: 'cad-empty', text: 'No data yet.' });
          (empty as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          decodedWrap.appendChild(empty);
          return;
        }

        showItems.forEach((n: any) => {
          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'position:relative;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;padding-bottom:44px;display:flex;flex-direction:column;gap:6px;';

          const top = makeEl('div');
          (top as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

          const title = makeEl('div');
          (title as HTMLElement).style.cssText = 'font-weight:900;font-size:12px;color:rgba(233,238,247,.92);';
          const mdb = n && n.mdb !== undefined ? Number(n.mdb) : null;
          const enumName = mdb !== null && isFinite(mdb) ? getEnumName(mdb) : null;
          const friendly = friendlyTitleFromEnumName(enumName);
          title.textContent = friendly ? friendly : 'Notification';

          const meta = makeEl('div');
          (meta as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';
          meta.textContent = 'Date/time: ' + fmtTs(n && n.t);

          top.appendChild(title);
          top.appendChild(meta);

          const params = decodeParams(n && n.p);

          // Add Center button when coordinates are present.
          try {
            const co = getParamValue(params, 'co');
            const ncct = getParamValue(params, 'ncct');
            const packed =
              co !== null && co !== undefined
                ? co
                : Array.isArray(ncct) && ncct.length
                  ? ncct[0]
                  : ncct !== null && ncct !== undefined
                    ? ncct
                    : null;
            const xy = packed !== null ? decodePackedCoordsXY(packed) : null;
            addCenterButton(row as HTMLElement, xy);
          } catch {
            // ignore
          }

          try {
            addJsonToggle(row as HTMLElement, n);
          } catch {
            // ignore
          }

          try {
            const c = accentColorForNotification(enumName, params);
            if (c) {
              (row as HTMLElement).style.borderLeft = '4px solid ' + c;
              (row as HTMLElement).style.paddingLeft = '12px';
            }
          } catch {
            // ignore
          }

          row.appendChild(top);

          // Specialized renderers (nice cards)
          const mdbVal = n && n.mdb !== undefined ? Number(n.mdb) : null;
          const hasMember = renderAllianceMemberCard(row as HTMLElement, n, params);
          const hasInvite = !hasMember && renderInvitationCard(row as HTMLElement, n, params);
          const hasRel = !hasMember && !hasInvite && renderRelationshipCard(row as HTMLElement, n, params);
          const hasEndgame = !hasMember && !hasInvite && !hasRel && renderEndgameCard(row as HTMLElement, n, params);

          const hasTwoPartyReport = !hasMember && !hasInvite && !hasRel && !hasEndgame && renderTwoPartyReportCard(row as HTMLElement, n, params);
          const hasRaid =
            !hasMember && !hasInvite && !hasRel && !hasEndgame && !hasTwoPartyReport && renderRaidCard(row as HTMLElement, n, params);
          const hasTwoPartyNoReport =
            !hasMember && !hasInvite && !hasRel && !hasEndgame && !hasTwoPartyReport && !hasRaid && renderTwoPartyNoReportCard(row as HTMLElement, n, params);
          const hasNpcNoReport =
            !hasMember &&
            !hasInvite &&
            !hasRel &&
            !hasEndgame &&
            !hasTwoPartyReport &&
            !hasRaid &&
            !hasTwoPartyNoReport &&
            renderNpcNoReportCard(row as HTMLElement, n, params);
          const hasPoi =
            !hasMember &&
            !hasInvite &&
            !hasRel &&
            !hasEndgame &&
            !hasTwoPartyReport &&
            !hasRaid &&
            !hasTwoPartyNoReport &&
            !hasNpcNoReport &&
            renderPoiEventCard(row as HTMLElement, n, params);
          const hasCoordOnly =
            !hasMember &&
            !hasInvite &&
            !hasRel &&
            !hasEndgame &&
            !hasTwoPartyReport &&
            !hasRaid &&
            !hasTwoPartyNoReport &&
            !hasNpcNoReport &&
            !hasPoi &&
            renderCoordOnlyCard(row as HTMLElement, n, params);

          const hasSpecial =
            hasMember || hasInvite || hasRel || hasEndgame || hasTwoPartyReport || hasRaid || hasTwoPartyNoReport || hasNpcNoReport || hasPoi || hasCoordOnly;

          if (!hasSpecial) {
            const grid = makeEl('div');
            (grid as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 160px 1fr;gap:4px 10px;font-size:11px;';

            if (!params.length) {
              const none = makeEl('div');
              (none as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';
              none.textContent = 'No params';
              row.appendChild(none);
              decodedWrap.appendChild(row);
              return;
            }

            params.forEach((pp) => {
              const k = makeEl('div');
              (k as HTMLElement).style.cssText = 'color:rgba(233,238,247,.70);';
              k.textContent = (pp.key ? pp.key : '-') + (pp.type ? ' [' + pp.type + ']' : '');
              const v = makeEl('div');
              (v as HTMLElement).style.cssText = 'color:rgba(233,238,247,.92);word-break:break-word;';
              try {
                v.textContent = typeof pp.value === 'string' ? pp.value : JSON.stringify(pp.value);
              } catch {
                v.textContent = String(pp.value ?? '');
              }
              grid.appendChild(k);
              grid.appendChild(v);
            });
            row.appendChild(grid);
            void mdbVal;
          }

          decodedWrap.appendChild(row);
        });
      }

      function setOutput(obj: any): void {
        try {
          lastItems = normalizeItems(obj);
          updateTypeFilterOptions(lastItems);
          renderDecoded(lastItems);
        } catch {
          lastItems = [];
          updateTypeFilterOptions([]);
          renderDecoded([]);
        }
      }

      function setOutputItemsOnly(items: any[]): void {
        try {
          lastItems = Array.isArray(items) ? items : [];
        } catch {
          lastItems = [];
        }
        try {
          updateTypeFilterOptions(lastItems);
          renderDecoded(lastItems);
        } catch {
          // ignore
        }
      }

      function mergeItems(existing: any[], incoming: any[]): any[] {
        const out: any[] = existing.slice();
        try {
          incoming.forEach((it) => {
            try {
              const id = it && it.id !== undefined && it.id !== null ? String(it.id) : '';
              if (id && pagingIdSeen[id]) return;
              if (id) pagingIdSeen[id] = true;
              out.push(it);
            } catch {
              // ignore
            }
          });
        } catch {
          // ignore
        }
        return out;
      }

      function resetPaging(): void {
        try {
          pagingAllItems = [];
          pagingIdSeen = Object.create(null);
          pagingNextSkip = 0;
          pagingHasMore = true;
          pagingLoading = false;
          updateLoadMoreBtn();
        } catch {
          // ignore
        }
      }

      function sendFetch(skip: number, take: number, append: boolean): void {
        setStatus('Loading…');
        pagingLoading = true;
        updateLoadMoreBtn();

        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const phe = w.phe;
          const cm = ClientLib && ClientLib.Net && ClientLib.Net.CommunicationManager ? ClientLib.Net.CommunicationManager.GetInstance() : null;
          const makeDelegate = phe && phe.cnc && phe.cnc.Util && typeof phe.cnc.Util.createEventDelegate === 'function' ? phe.cnc.Util.createEventDelegate : null;

          if (!ClientLib || !cm || !makeDelegate) {
            setStatus('Error');
            pagingLoading = false;
            updateLoadMoreBtn();
            setOutput({ error: 'Game API not available' });
            return;
          }

          const payload = {
            category: 0,
            skip,
            take,
            sortOrder: 1,
            ascending: false
          };

          const onResult = (_ctx: any, data: any) => {
            let arr: any[] = [];
            try {
              arr = normalizeItems(data);
            } catch {
              arr = [];
            }

            try {
              if (append) pagingAllItems = mergeItems(pagingAllItems, arr);
              else {
                resetPaging();
                pagingAllItems = mergeItems([], arr);
              }
            } catch {
              // ignore
            }

            try {
              const got = Array.isArray(arr) ? arr.length : 0;
              pagingNextSkip = skip + got;
              pagingHasMore = got >= take;
            } catch {
              pagingHasMore = false;
            }

            try {
              setStatus('OK • items: ' + String(pagingAllItems.length));
              setOutputItemsOnly(pagingAllItems);
            } catch {
              setStatus('OK');
            }

            pagingLoading = false;
            updateLoadMoreBtn();
          };

          cm.SendSimpleCommand('NotificationGetRange', payload, makeDelegate(ClientLib.Net.CommandResult, ctx, onResult), null);
        } catch {
          setStatus('Error');
          pagingLoading = false;
          updateLoadMoreBtn();
          setOutput({ error: 'Failed to fetch' });
        }
      }

      function fetchFirstPage(): void {
        resetPaging();
        sendFetch(pagingNextSkip, pagingPageSize, false);
      }

      function fetchNextPage(): void {
        if (pagingLoading || !pagingHasMore) return;
        sendFetch(pagingNextSkip, pagingPageSize, true);
      }

      loadMoreBtn.addEventListener('click', () => {
        try {
          fetchNextPage();
        } catch {
          // ignore
        }
      });

      typeFilterSelect.addEventListener('change', () => {
        try {
          selectedEnumFilter = String(typeFilterSelect.value || '');
        } catch {
          selectedEnumFilter = '';
        }
        try {
          renderDecoded(lastItems);
        } catch {
          // ignore
        }
      });

      wrap.addEventListener('scroll', () => {
        try {
          const el = wrap as HTMLElement;
          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 250;
          if (!nearBottom) return;
          fetchNextPage();
        } catch {
          // ignore
        }
      });

      card.appendChild(head);
      card.appendChild(filterBar);
      card.appendChild(decodedWrap);
      wrap.appendChild(card);
      container.appendChild(wrap);

      // Auto-load first page (50 items)
      try {
        setTimeout(() => {
          if (!pagingAllItems.length && !pagingLoading) fetchFirstPage();
        }, 0);
      } catch {
        // ignore
      }
    }
  });
}
