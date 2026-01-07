import { getAppContext } from '../../app/global';
import { formatNumber } from '../../services/format';
import { getGameApi } from '../../services/gameApi';
import { centerMapTo } from '../../services/map';
import { loadTeams } from '../teams/model';
import {
  getPoiTypeColor,
  getPoiTypeName,
  isOwnedGroupOpen,
  loadPoiUi,
  savePoiUi,
  setOwnedGroupOpen
} from './model';

export function registerPoiTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'poi',
    title: 'POI',
    icon: 'mdi:map-marker-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const poiUi = loadPoiUi();

      function setSectionOpen(
        key: 'simOpen' | 'overviewOpen' | 'ownedOpen',
        open: boolean,
        chevron: HTMLElement,
        body: HTMLElement,
        openDisplay: 'block' | 'flex'
      ): void {
        try {
          (poiUi as any)[key] = !!open;
        } catch {
          // ignore
        }
        try {
          savePoiUi(poiUi);
        } catch {
          // ignore
        }
        try {
          body.style.display = (poiUi as any)[key] ? openDisplay : 'none';
        } catch {
          // ignore
        }
        try {
          chevron.textContent = (poiUi as any)[key] ? '▴' : '▾';
        } catch {
          // ignore
        }
      }

      function getPoiTypeRangeFromAlliance(): { start: number; count: number } | null {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Data || !ClientLib.Data.MainData) return null;
          const md = ClientLib.Data.MainData.GetInstance();
          const a = md && md.get_Alliance ? md.get_Alliance() : null;
          if (!a || !a.get_Exists || !a.get_Exists()) return null;
          const ranks = a.get_POIRankScore && a.get_POIRankScore();
          if (!ranks || !ranks.length) return null;

          let start = 0;
          try {
            if (ClientLib.Base && ClientLib.Base.EPOIType && ClientLib.Base.EPOIType.RankedTypeBegin !== undefined) {
              start = Number(ClientLib.Base.EPOIType.RankedTypeBegin);
            }
          } catch {
            // ignore
          }

          return { start, count: ranks.length };
        } catch {
          return null;
        }
      }

      function getWorldObjAt(x: number, y: number): any | null {
        try {
          const api = getGameApi();
          const world = api.world;
          if (!world) return null;
          const fn = world.GetObjectFromPosition || world.GetObjectFromPositionEx || world.GetObjectFromPositionXY;
          if (!fn) return null;
          return fn.call(world, x, y);
        } catch {
          return null;
        }
      }

      function getVisObjAt(x: number, y: number): any | null {
        try {
          const api = getGameApi();
          const region = api.region || (api.visMain && api.visMain.get_Region ? api.visMain.get_Region() : null);
          if (!region || !region.GetObjectFromPosition) return null;

          // Prefer pixel coords (more reliable)
          try {
            if (region.get_GridWidth && region.get_GridHeight) {
              const gw = Number(region.get_GridWidth());
              const gh = Number(region.get_GridHeight());
              if (isFinite(gw) && isFinite(gh) && gw > 0 && gh > 0) {
                const o = region.GetObjectFromPosition(Number(x) * gw, Number(y) * gh);
                if (o) return o;
              }
            }
          } catch {
            // ignore
          }

          // Fallback grid coords
          try {
            return region.GetObjectFromPosition(Number(x), Number(y));
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      }

      function tryExtractPoiMeta(obj: any): { level: number; typeId: number | null } | null {
        try {
          if (!obj) return null;
          const w: any = window as any;
          const ClientLib = w.ClientLib;

          let lvl: number | null = null;
          let typeId: number | null = null;

          // Vis region POI objects
          try {
            if (obj.get_VisObjectType && ClientLib?.Vis?.VisObject?.EObjectType) {
              const vt = obj.get_VisObjectType();
              const poiVt = ClientLib.Vis.VisObject.EObjectType.RegionPointOfInterest;
              if (vt === poiVt || String(vt) === String(poiVt)) {
                try {
                  if (obj.get_Type && isFinite(Number(obj.get_Type()))) typeId = Number(obj.get_Type());
                } catch {}
                try {
                  if (obj.get_Level && isFinite(Number(obj.get_Level()))) lvl = Number(obj.get_Level());
                } catch {}
                try {
                  if (lvl === null && obj.get_BaseLevel && isFinite(Number(obj.get_BaseLevel()))) lvl = Math.round(Number(obj.get_BaseLevel()));
                } catch {}
              }
            }
          } catch {
            // ignore
          }

          // Heuristic accessors
          try {
            if (lvl === null && obj.get_Level && isFinite(Number(obj.get_Level()))) lvl = Number(obj.get_Level());
            if (typeId === null && obj.get_Type && isFinite(Number(obj.get_Type()))) typeId = Number(obj.get_Type());
          } catch {
            // ignore
          }

          // Raw fields sometimes exist
          try {
            const cand = [obj.l, obj.L, obj.level, obj.Level, obj.poiLevel, obj.PoiLevel, obj.nLevel, obj.NLevel];
            for (let i = 0; i < cand.length; i++) {
              const v = cand[i];
              if (lvl === null && v !== undefined && v !== null && isFinite(Number(v))) lvl = Number(v);
            }
          } catch {
            // ignore
          }

          // World objects vary by build
          try {
            if (lvl === null && obj.get_Lvl && isFinite(Number(obj.get_Lvl()))) lvl = Number(obj.get_Lvl());
          } catch {}
          try {
            if (lvl === null && obj.get_BaseLevel && isFinite(Number(obj.get_BaseLevel()))) lvl = Math.round(Number(obj.get_BaseLevel()));
          } catch {}
          try {
            if (typeId === null && obj.Type !== undefined && isFinite(Number(obj.Type))) typeId = Number(obj.Type);
          } catch {}

          if (lvl === null || !isFinite(Number(lvl))) return null;
          return { level: Number(lvl), typeId: typeId !== null && isFinite(Number(typeId)) ? Number(typeId) : null };
        } catch {
          return null;
        }
      }

      function getRankedTypeIdFromPoiType(poiType: number): number | null {
        try {
          const pt = Number(poiType);
          if (!Number.isFinite(pt)) return null;
          const range = getPoiTypeRangeFromAlliance();
          if (!range) return null;
          const idx = pt - 1;
          if (!Number.isFinite(idx) || idx < 0 || idx >= range.count) return null;
          return Number(range.start) + idx;
        } catch {
          return null;
        }
      }

      function getPoiTypeFromRankedTypeId(rankedTypeId: number): number | null {
        try {
          const tid = Number(rankedTypeId);
          if (!Number.isFinite(tid)) return null;
          const range = getPoiTypeRangeFromAlliance();
          if (!range) return null;
          const idx = tid - Number(range.start);
          if (!Number.isFinite(idx) || idx < 0 || idx >= range.count) return null;
          return idx + 1;
        } catch {
          return null;
        }
      }

      function getOwnedPois(): any[] {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Data || !ClientLib.Data.MainData) return [];
          const md = ClientLib.Data.MainData.GetInstance();
          if (!md) return [];
          const a = md.get_Alliance && md.get_Alliance();
          if (!a || !a.get_Exists || !a.get_Exists()) return [];
          const op = a.get_OwnedPOIs && a.get_OwnedPOIs();
          if (!op || !op.map) return [];
          const arr: any[] = [];
          op.map((poi: any) => {
            try {
              arr.push(poi);
            } catch {
              // ignore
            }
          });
          return arr;
        } catch {
          return [];
        }
      }

      function buildTiers(): Array<[number, number, number]> {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Base || !ClientLib.Base.PointOfInterestTypes) return [];
          const poiUtil = ClientLib.Base.PointOfInterestTypes;
          if (!poiUtil || !poiUtil.GetNextScore) return [];
          const tiers: Array<[number, number, number]> = [];
          let prev = 0;
          for (let i = 0; i < 60; i++) {
            const next = poiUtil.GetNextScore(prev);
            if (!isFinite(Number(next)) || Number(next) === Number(prev)) break;
            tiers.push([i, prev, next]);
            prev = next;
          }
          return tiers;
        } catch {
          return [];
        }
      }

      function getTierFromScore(score: unknown, tiers: Array<[number, number, number]>): number {
        try {
          const s = Number(score);
          if (!isFinite(s) || s <= 0) return 0;
          for (let i = 0; i < tiers.length; i++) {
            if (s >= tiers[i][1] && s < tiers[i][2]) return tiers[i][0];
          }
          return tiers.length ? tiers[tiers.length - 1][0] : 0;
        } catch {
          return 0;
        }
      }

      function getServerMultiplier(): number {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Data || !ClientLib.Data.MainData) return 0;
          const md = ClientLib.Data.MainData.GetInstance();
          const srv = md && md.get_Server ? md.get_Server() : null;
          const m = srv && srv.get_POIGlobalBonusFactor ? Number(srv.get_POIGlobalBonusFactor()) : 0;
          return isFinite(m) ? m : 0;
        } catch {
          return 0;
        }
      }

      function formatGlobalFactor(raw: any): string {
        try {
          const v = Number(raw);
          if (!isFinite(v)) return '+0%';

          let pct = 0;
          // Heuristics:
          // - 0..1 => fraction (0.1 => 10%)
          // - 1..5 => multiplier (1.1 => +10%)
          // - otherwise assume already percent (10 => 10%)
          if (v > 0 && v < 1) pct = v * 100;
          else if (v >= 1 && v <= 5) pct = (v - 1) * 100;
          else pct = v;

          if (!isFinite(pct)) pct = 0;
          const rounded = Math.round(pct * 100) / 100;
          const txt = Number.isInteger(rounded) ? String(rounded) : String(rounded);
          return '+' + txt + '%';
        } catch {
          return '+0%';
        }
      }

      function formatPoiNumber(raw: any): string {
        try {
          const v = Number(raw);
          if (!isFinite(v)) return '-';
          const rounded = Math.round(v * 100) / 100;
          if (typeof Intl !== 'undefined' && (Intl as any).NumberFormat) {
            return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(rounded);
          }
          return String(rounded);
        } catch {
          return '-';
        }
      }

      function formatPoiBonusByType(poiType: number, raw: any): string {
        try {
          const v = Number(raw);
          if (!isFinite(v)) return '-';
          const pt = Number(poiType);
          // 1..3 => Tib/Crystal/Reactor: absolute per hour
          if (pt === 1 || pt === 2 || pt === 3) {
            return '+' + formatNumber(v) + '/h';
          }
          // 4..7 => percentage
          return '+' + formatPoiNumber(v) + '%';
        } catch {
          return '-';
        }
      }

      function getMaxPoiLevel(): number {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Data || !ClientLib.Data.MainData) return 65;
          const md = ClientLib.Data.MainData.GetInstance();
          const srv = md && md.get_Server ? md.get_Server() : null;
          const max = srv && srv.get_MaxCenterLevel ? Number(srv.get_MaxCenterLevel()) : 65;
          return isFinite(max) && max > 0 ? max : 65;
        } catch {
          return 65;
        }
      }

      function listPoiTypes(): Array<{ typeId: number; name: string }> {
        return [1, 2, 3, 4, 5, 6, 7].map((pt) => ({ typeId: pt, name: getPoiTypeName(pt) || 'TypeId ' + String(pt) }));
      }

      function getCurrentRankScoreForPoiType(poiType: number): { rank: number | null; score: number | null } | null {
        try {
          const range = getPoiTypeRangeFromAlliance();
          if (!range) return null;
          const pt = Number(poiType);
          if (!isFinite(pt)) return null;
          const idx = pt - 1;
          if (!isFinite(idx) || idx < 0 || idx >= range.count) return null;

          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const md = ClientLib.Data.MainData.GetInstance();
          const a = md && md.get_Alliance ? md.get_Alliance() : null;
          const ranks = a && a.get_POIRankScore ? a.get_POIRankScore() : null;
          if (!ranks || !ranks.length) return null;

          return {
            rank: ranks[idx] && ranks[idx].r !== undefined ? Number(ranks[idx].r) : null,
            score: ranks[idx] && ranks[idx].s !== undefined ? Number(ranks[idx].s) : null
          };
        } catch {
          return null;
        }
      }

      const simCard = makeEl('div', { class: 'cad-card' });
      (simCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const simHead = makeEl('div');
      (simHead as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 8px 0;';
      (simHead as HTMLElement).style.cursor = 'pointer';
      const sh = makeEl('h3');
      sh.textContent = 'Tier / rank simulator';
      (sh as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';
      const simChevron = makeEl('div');
      (simChevron as HTMLElement).style.cssText =
        'width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;color:rgba(233,238,247,.90);user-select:none;';
      simHead.appendChild(simChevron);
      simHead.appendChild(sh);

      const simBody = makeEl('div');
      (simBody as HTMLElement).style.display = poiUi.simOpen ? 'block' : 'none';
      simChevron.textContent = poiUi.simOpen ? '▴' : '▾';
      simHead.addEventListener('click', () => setSectionOpen('simOpen', !poiUi.simOpen, simChevron as HTMLElement, simBody as HTMLElement, 'block'));

      const simForm = makeEl('div');
      (simForm as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;';

      const simTypeLbl = makeEl('div');
      simTypeLbl.textContent = 'Type:';
      (simTypeLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';

      const simTypeSwatch = makeEl('div');
      (simTypeSwatch as HTMLElement).style.cssText =
        'width:28px;height:28px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.10);';

      const simTypeSelect = makeEl('select') as HTMLSelectElement;
      simTypeSelect.style.cssText =
        'flex:1 1 220px;min-width:200px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const simRankLbl = makeEl('div');
      simRankLbl.textContent = 'Assumed rank (selected type):';
      (simRankLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';
      const simRankInput = makeEl('input', { type: 'number', min: '1', step: '1' }) as HTMLInputElement;
      simRankInput.placeholder = '(current)';
      simRankInput.style.cssText =
        'width:170px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const simLevelLbl = makeEl('div');
      simLevelLbl.textContent = 'Capture level:';
      (simLevelLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';
      const simLevelSelect = makeEl('select') as HTMLSelectElement;
      simLevelSelect.style.cssText =
        'width:170px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const simAddBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      simAddBtn.textContent = 'Add';
      simAddBtn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

      const simResetBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      simResetBtn.textContent = 'Reset';

      simForm.appendChild(simTypeLbl);
      simForm.appendChild(simTypeSwatch);
      simForm.appendChild(simTypeSelect);
      simForm.appendChild(simRankLbl);
      simForm.appendChild(simRankInput);
      simForm.appendChild(simLevelLbl);
      simForm.appendChild(simLevelSelect);
      simForm.appendChild(simAddBtn);
      simForm.appendChild(simResetBtn);

      const simSummary = makeEl('div');
      (simSummary as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px;';

      const simList = makeEl('div');
      (simList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;';

      const simObj = makeEl('div');
      (simObj as HTMLElement).style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px;';

      simBody.appendChild(simForm);
      simBody.appendChild(simSummary);
      simBody.appendChild(simList);
      simBody.appendChild(simObj);
      simCard.appendChild(simHead);
      simCard.appendChild(simBody);

      const overviewCard = makeEl('div', { class: 'cad-card' });
      (overviewCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const overviewHead = makeEl('div');
      (overviewHead as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 8px 0;';
      (overviewHead as HTMLElement).style.cursor = 'pointer';
      const oh = makeEl('h3');
      oh.textContent = 'Alliance POI overview';
      (oh as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';
      const overviewChevron = makeEl('div');
      (overviewChevron as HTMLElement).style.cssText =
        'width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;color:rgba(233,238,247,.90);user-select:none;';
      overviewHead.appendChild(overviewChevron);
      overviewHead.appendChild(oh);
      const overviewList = makeEl('div');
      (overviewList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      (overviewList as HTMLElement).style.display = poiUi.overviewOpen ? 'flex' : 'none';
      overviewChevron.textContent = poiUi.overviewOpen ? '▴' : '▾';
      overviewHead.addEventListener('click', () =>
        setSectionOpen('overviewOpen', !poiUi.overviewOpen, overviewChevron as HTMLElement, overviewList as HTMLElement, 'flex')
      );
      overviewCard.appendChild(overviewHead);
      overviewCard.appendChild(overviewList);

      const ownedCard = makeEl('div', { class: 'cad-card' });
      (ownedCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const ownedHead = makeEl('div');
      (ownedHead as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 8px 0;';
      (ownedHead as HTMLElement).style.cursor = 'pointer';
      const lh = makeEl('h3');
      lh.textContent = 'Owned POIs';
      (lh as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';
      const ownedChevron = makeEl('div');
      (ownedChevron as HTMLElement).style.cssText =
        'width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;color:rgba(233,238,247,.90);user-select:none;';
      ownedHead.appendChild(ownedChevron);
      ownedHead.appendChild(lh);

      const filterRow = makeEl('div');
      (filterRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;';
      const filterLbl = makeEl('div');
      filterLbl.textContent = 'Type:';
      (filterLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';
      const typeSelect = makeEl('select') as HTMLSelectElement;
      typeSelect.style.cssText =
        'flex:0 0 auto;min-width:240px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const ownedBody = makeEl('div');
      (ownedBody as HTMLElement).style.display = poiUi.ownedOpen ? 'block' : 'none';
      ownedChevron.textContent = poiUi.ownedOpen ? '▴' : '▾';
      ownedHead.addEventListener('click', () => setSectionOpen('ownedOpen', !poiUi.ownedOpen, ownedChevron as HTMLElement, ownedBody as HTMLElement, 'block'));

      const ownedList = makeEl('div');
      (ownedList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      filterRow.appendChild(filterLbl);
      filterRow.appendChild(typeSelect);

      ownedBody.appendChild(filterRow);
      ownedBody.appendChild(ownedList);
      ownedCard.appendChild(ownedHead);
      ownedCard.appendChild(ownedBody);

      wrap.appendChild(simCard);
      wrap.appendChild(overviewCard);
      wrap.appendChild(ownedCard);
      container.appendChild(wrap);

      const simState: { typeId: number | null; captures: any[]; assumedRankByType: Record<string, number | null> } = {
        typeId: null,
        captures: [],
        assumedRankByType: Object.create(null)
      };

      function renderSimulator(): void {
        (simSummary as HTMLElement).innerHTML = '';
        (simList as HTMLElement).innerHTML = '';
        (simObj as HTMLElement).innerHTML = '';

        const types = listPoiTypes();
        if (!types.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'POI simulator unavailable (POI types not found yet).' });
          (msg as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          simSummary.appendChild(msg);
          return;
        }

        const prevType = String(simTypeSelect.value || '');
        simTypeSelect.innerHTML = '';
        types.forEach((t) => {
          const opt = makeEl('option') as HTMLOptionElement;
          opt.value = String(t.typeId);
          opt.textContent = t.name;
          simTypeSelect.appendChild(opt);
        });

        if (simState.typeId === null) simState.typeId = types[0].typeId;
        if (prevType) simState.typeId = Number(prevType);
        simTypeSelect.value = String(simState.typeId);

        try {
          const c = getPoiTypeColor(simState.typeId);
          (simTypeSwatch as HTMLElement).style.background = c ? c : 'rgba(255,255,255,.20)';
        } catch {
          // ignore
        }

        const cur = getCurrentRankScoreForPoiType(simState.typeId);
        const baseScore = cur && cur.score !== null && isFinite(cur.score) ? Number(cur.score) : 0;
        const curRank = cur && cur.rank !== null && isFinite(cur.rank) ? Math.max(1, Math.floor(Number(cur.rank))) : null;

        try {
          const key = String(simState.typeId);
          const saved = Object.prototype.hasOwnProperty.call(simState.assumedRankByType, key) ? simState.assumedRankByType[key] : null;
          simRankInput.value = saved !== null && saved !== undefined && isFinite(Number(saved)) ? String(Math.max(1, Math.floor(Number(saved)))) : '';
          simRankInput.placeholder = curRank !== null ? '(current: ' + String(curRank) + ')' : '(current)';
        } catch {
          // ignore
        }

        simLevelSelect.innerHTML = '';
        const maxLvl = getMaxPoiLevel();
        for (let lv = 12; lv <= maxLvl; lv++) {
          const opt = makeEl('option') as HTMLOptionElement;
          opt.value = String(lv);
          opt.textContent = 'Level ' + String(lv);
          simLevelSelect.appendChild(opt);
        }

        const w: any = window as any;
        const ClientLib = w.ClientLib;
        const poiUtil = ClientLib && ClientLib.Base && ClientLib.Base.PointOfInterestTypes ? ClientLib.Base.PointOfInterestTypes : null;
        const scoreByLevel = poiUtil && poiUtil.GetScoreByLevel ? poiUtil.GetScoreByLevel : null;
        const multiplier = getServerMultiplier();
        const tiers = buildTiers();

        const addedByType: Record<string, number> = Object.create(null);
        simState.captures.forEach((c) => {
          try {
            const tid = c && c.typeId !== undefined && c.typeId !== null && isFinite(Number(c.typeId)) ? Number(c.typeId) : null;
            const sc = c && c.score !== undefined && c.score !== null && isFinite(Number(c.score)) ? Number(c.score) : 0;
            if (tid === null) return;
            addedByType[String(tid)] = (addedByType[String(tid)] || 0) + sc;
          } catch {
            // ignore
          }
        });

        const summaryGrid = makeEl('div');
        (summaryGrid as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        types.forEach((t) => {
          const pt = Number(t.typeId);
          const curT = getCurrentRankScoreForPoiType(pt);
          const baseT = curT && curT.score !== null && isFinite(curT.score) ? Number(curT.score) : 0;
          const rankT = curT && curT.rank !== null && isFinite(curT.rank) ? Math.max(1, Math.floor(Number(curT.rank))) : null;
          const addT = addedByType[String(pt)] || 0;
          const simT = baseT + addT;
          const tierT = getTierFromScore(simT, tiers);

          const rankedTypeId = getRankedTypeIdFromPoiType(pt);
          let rowRank = rankT;
          try {
            const key = String(pt);
            const over = Object.prototype.hasOwnProperty.call(simState.assumedRankByType, key) ? simState.assumedRankByType[key] : null;
            if (over !== null && over !== undefined && isFinite(Number(over))) rowRank = Math.max(1, Math.floor(Number(over)));
          } catch {
            // ignore
          }

          let rankBoost: number | null = null;
          try {
            if (poiUtil && poiUtil.GetBoostModifierByRank && rowRank !== null) {
              const rb = poiUtil.GetBoostModifierByRank(rowRank);
              if (rb !== null && rb !== undefined && isFinite(Number(rb))) rankBoost = Number(rb);
            }
          } catch {
            // ignore
          }

          let bonusT: any = null;
          let totalBonusT: any = null;
          try {
            if (poiUtil && poiUtil.GetBonusByType && rankedTypeId !== null) bonusT = poiUtil.GetBonusByType(rankedTypeId, simT, multiplier);
          } catch {
            // ignore
          }
          try {
            if (poiUtil && poiUtil.GetTotalBonusByType && rankedTypeId !== null && rowRank !== null) {
              totalBonusT = poiUtil.GetTotalBonusByType(rankedTypeId, rowRank, simT, multiplier);
            }
          } catch {
            // ignore
          }

          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:4px;';
          try {
            const c = getPoiTypeColor(pt);
            if (c) (row as HTMLElement).style.borderLeft = '4px solid ' + c;
          } catch {
            // ignore
          }

          const l1 = makeEl('div');
          l1.textContent = t.name;
          (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

          const l2 = makeEl('div');
          l2.textContent = 'Base: ' + formatNumber(baseT) + ' • +' + formatNumber(addT) + ' = ' + formatNumber(simT);
          (l2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:normal;word-break:break-word;';

          const l3 = makeEl('div');
          let bonusTxt = '-';
          let totalTxt = '-';
          try {
            bonusTxt = bonusT !== null && bonusT !== undefined ? formatPoiBonusByType(pt, bonusT) : '-';
          } catch {
            bonusTxt = '-';
          }
          try {
            totalTxt = totalBonusT !== null && totalBonusT !== undefined ? formatPoiBonusByType(pt, totalBonusT) : '-';
          } catch {
            totalTxt = '-';
          }

          const rankBoostTxt =
            rankBoost !== null && rowRank !== null
              ? 'Alliance ranking multiplier: +' + String(rankBoost) + '% (Ranking: ' + String(rowRank) + ')'
              : 'Alliance ranking multiplier: -';

          (l3 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.92);white-space:normal;word-break:break-word;';
          l3.appendChild(document.createTextNode('Tier: ' + String(tierT) + ' • '));
          l3.appendChild(document.createTextNode('Bonus: ' + String(bonusTxt) + ' • '));
          l3.appendChild(document.createTextNode(rankBoostTxt + ' • '));
          const sTotal = makeEl('span');
          sTotal.textContent = 'Total: ' + String(totalTxt);
          (sTotal as HTMLElement).style.cssText = 'font-weight:900;font-size:12px;color:var(--cad-text);';
          l3.appendChild(sTotal);

          row.appendChild(l1);
          row.appendChild(l2);
          row.appendChild(l3);
          summaryGrid.appendChild(row);
        });

        simSummary.appendChild(summaryGrid);

        if (!simState.captures.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'Add simulated captures to see the effect.' });
          (msg as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          simList.appendChild(msg);
        } else {
          simState.captures.forEach((c, idx) => {
            const row = makeEl('div');
            (row as HTMLElement).style.cssText =
              'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;gap:10px;align-items:center;';
            try {
              const tid = c && c.typeId !== undefined && c.typeId !== null && isFinite(Number(c.typeId)) ? Number(c.typeId) : null;
              const col = tid !== null ? getPoiTypeColor(tid) : null;
              if (col) (row as HTMLElement).style.borderLeft = '4px solid ' + col;
            } catch {
              // ignore
            }
            const t = makeEl('div');
            (t as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';
            const l1 = makeEl('div');
            let capType = '';
            try {
              const tid = c && c.typeId !== undefined && c.typeId !== null && isFinite(Number(c.typeId)) ? Number(c.typeId) : null;
              if (tid !== null) capType = ' • ' + (getPoiTypeName(tid) || 'TypeId ' + String(tid));
            } catch {
              // ignore
            }
            l1.textContent = 'Capture #' + String(idx + 1) + capType + ' • Level ' + String(c.level);
            (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            const l2 = makeEl('div');
            l2.textContent = 'Score: ' + formatNumber(c.score);
            (l2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';
            t.appendChild(l1);
            t.appendChild(l2);

            const del = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            del.textContent = '×';
            del.title = 'Remove';
            del.style.cssText =
              'border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;';
            del.addEventListener('click', () => {
              try {
                if (idx >= 0 && idx < simState.captures.length) simState.captures.splice(idx, 1);
              } catch {
                // ignore
              }
              renderAll();
            });

            row.appendChild(t);
            row.appendChild(del);
            simList.appendChild(row);
          });
        }

        // --- Simulate from team objectives ---
        try {
          const objHead = makeEl('div');
          objHead.textContent = 'Simulate from team objectives';
          (objHead as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;color:#e9eef7;';
          simObj.appendChild(objHead);

          const hint = makeEl('div');
          hint.textContent = 'If an objective is placed on a POI, you can add it as a simulated capture.';
          (hint as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';
          simObj.appendChild(hint);

          const objList = makeEl('div');
          (objList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';
          simObj.appendChild(objList);

          const simulatedObjectiveKeys: Record<string, boolean> = Object.create(null);
          try {
            simState.captures.forEach((c) => {
              const k = c && c.sourceKey ? String(c.sourceKey) : '';
              if (k && k.indexOf('obj:') === 0) simulatedObjectiveKeys[k] = true;
            });
          } catch {
            // ignore
          }

          const teams: any[] = loadTeams() as any;
          let anyObj = false;

          teams.forEach((tm) => {
            const objs = tm && Array.isArray(tm.objectives) ? tm.objectives : [];
            objs.forEach((o: any) => {
              const x = o && o.x !== undefined ? Number(o.x) : null;
              const y = o && o.y !== undefined ? Number(o.y) : null;
              if (x === null || y === null || !isFinite(x) || !isFinite(y)) return;
              anyObj = true;

              const objKey = 'obj:' + String(x) + ':' + String(y);
              if (simulatedObjectiveKeys[objKey]) return;

              const row = makeEl('div');
              (row as HTMLElement).style.cssText =
                'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;gap:10px;align-items:center;';

              const left = makeEl('div');
              (left as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';
              const l1 = makeEl('div');
              const teamName = tm && tm.name ? String(tm.name) : 'Team';
              l1.textContent = teamName;
              (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

              const coordsTxt = String(x) + ':' + String(y);
              const l2 = makeEl('div');
              l2.textContent = coordsTxt;
              (l2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

              const l3 = makeEl('div');
              (l3 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:normal;word-break:break-word;';

              let poiMeta: { level: number; typeId: number | null } | null = null;
              try {
                if (o && o.poiLevel !== undefined && o.poiLevel !== null && isFinite(Number(o.poiLevel))) {
                  poiMeta = {
                    level: Number(o.poiLevel),
                    typeId: o.poiTypeId !== undefined && o.poiTypeId !== null && isFinite(Number(o.poiTypeId)) ? Number(o.poiTypeId) : null
                  };
                } else {
                  const visObj = getVisObjAt(x, y);
                  const worldObj = getWorldObjAt(x, y);
                  poiMeta = tryExtractPoiMeta(visObj || worldObj);
                }

                if (poiMeta && poiMeta.level !== null && isFinite(Number(poiMeta.level))) {
                  let typeLabel = '';
                  try {
                    if (poiMeta.typeId !== null && poiMeta.typeId !== undefined && isFinite(Number(poiMeta.typeId))) {
                      const tid = Number(poiMeta.typeId);
                      const nm = getPoiTypeName(tid);
                      const shown = nm ? nm : 'TypeId ' + String(tid);
                      typeLabel = '[' + shown + ' ' + String(poiMeta.level) + ']';
                    }
                  } catch {
                    // ignore
                  }
                  l1.textContent = teamName + (typeLabel ? ' • ' + typeLabel : '');
                  l3.textContent = '';
                } else {
                  l1.textContent = teamName + ' • [Not a POI]';
                  l3.textContent = 'POI not detected at this tile';
                }
              } catch {
                // ignore
              }

              try {
                const tid = poiMeta && poiMeta.typeId !== null && poiMeta.typeId !== undefined && isFinite(Number(poiMeta.typeId)) ? Number(poiMeta.typeId) : null;
                const c = tid !== null ? getPoiTypeColor(tid) : null;
                if (c) (row as HTMLElement).style.borderLeft = '4px solid ' + c;
              } catch {
                // ignore
              }

              left.appendChild(l1);
              left.appendChild(l2);
              try {
                if ((l3 as HTMLElement).textContent) left.appendChild(l3);
              } catch {
                // ignore
              }

              const btnCenter = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
              btnCenter.textContent = 'Center';
              btnCenter.addEventListener('click', () => {
                try {
                  centerMapTo(x, y);
                } catch {
                  // ignore
                }
              });

              const btnSim = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
              btnSim.textContent = 'Simulate';
              btnSim.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

              const hasPoi = !!(poiMeta && poiMeta.level !== null && isFinite(Number(poiMeta.level)));
              const poiTypeId = poiMeta && poiMeta.typeId !== null && poiMeta.typeId !== undefined && isFinite(Number(poiMeta.typeId)) ? Number(poiMeta.typeId) : null;
              btnSim.disabled = !hasPoi;
              btnSim.addEventListener('click', () => {
                try {
                  if (!poiMeta || poiMeta.level === null || !isFinite(Number(poiMeta.level))) return;
                  const lv = Number(poiMeta.level);
                  const sc = scoreByLevel ? scoreByLevel(lv) : null;
                  if (sc === null || !isFinite(Number(sc))) return;
                  const tid = poiTypeId !== null ? poiTypeId : simState.typeId;
                  const key = 'obj:' + String(x) + ':' + String(y);
                  try {
                    const exists = simState.captures.some((cc) => cc && String(cc.sourceKey || '') === key);
                    if (exists) return;
                  } catch {
                    // ignore
                  }
                  simState.captures.push({ sourceKey: key, typeId: tid, level: lv, score: Number(sc) });
                } catch {
                  // ignore
                }
                renderAll();
              });

              row.appendChild(left);
              row.appendChild(btnCenter);
              row.appendChild(btnSim);
              objList.appendChild(row);
            });
          });

          if (!anyObj) {
            const msg = makeEl('div', { class: 'cad-empty', text: 'No team objectives found.' });
            (msg as HTMLElement).style.cssText =
              'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
            objList.appendChild(msg);
          }
        } catch {
          // ignore
        }
      }

      function computeOverviewRows(): any[] {
        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          if (!ClientLib || !ClientLib.Data || !ClientLib.Data.MainData) return [];
          const md = ClientLib.Data.MainData.GetInstance();
          if (!md) return [];
          const a = md.get_Alliance && md.get_Alliance();
          if (!a || !a.get_Exists || !a.get_Exists()) return [];

          const ranks = a.get_POIRankScore && a.get_POIRankScore();
          if (!ranks || !ranks.length) return [];

          const srv = md.get_Server && md.get_Server();
          const multiplier = srv && srv.get_POIGlobalBonusFactor ? Number(srv.get_POIGlobalBonusFactor()) : 0;

          const poiUtil = ClientLib.Base && ClientLib.Base.PointOfInterestTypes ? ClientLib.Base.PointOfInterestTypes : null;
          if (!poiUtil) return [];

          const tiers = buildTiers();

          const rows: any[] = [];
          for (let i = 0; i < ranks.length; i++) {
            const poiType = i + 1;
            const rankedTypeId = getRankedTypeIdFromPoiType(poiType);
            const typeName = getPoiTypeName(poiType) || 'TypeId ' + String(poiType);
            const rank = ranks[i] && ranks[i].r !== undefined ? Number(ranks[i].r) : null;
            const score = ranks[i] && ranks[i].s !== undefined ? Number(ranks[i].s) : null;
            const tier = score !== null && isFinite(score) ? getTierFromScore(score, tiers) : 0;

            let bonus: any = null;
            let totalBonus: any = null;
            let nextTier: any = null;
            let rankBoost: any = null;
            try {
              if (score !== null && isFinite(score)) {
                bonus = poiUtil.GetBonusByType && rankedTypeId !== null ? poiUtil.GetBonusByType(rankedTypeId, score, multiplier) : null;
                const nextScore = poiUtil.GetNextScore ? poiUtil.GetNextScore(score) : null;
                if (nextScore !== null && isFinite(nextScore)) nextTier = nextScore - score;
              }
            } catch {
              // ignore
            }
            try {
              if (rank !== null && isFinite(rank) && poiUtil.GetBoostModifierByRank) {
                const rb = poiUtil.GetBoostModifierByRank(rank);
                if (rb !== null && rb !== undefined && isFinite(Number(rb))) rankBoost = Number(rb);
              }
            } catch {
              // ignore
            }
            try {
              if (rank !== null && isFinite(rank) && score !== null && isFinite(score) && poiUtil.GetTotalBonusByType && rankedTypeId !== null) {
                totalBonus = poiUtil.GetTotalBonusByType(rankedTypeId, rank, score, multiplier);
              }
            } catch {
              // ignore
            }

            rows.push({ poiType, typeName, tier, rank, rankBoost, score, multiplier, bonus, totalBonus, nextTier });
          }
          return rows;
        } catch {
          return [];
        }
      }

      function renderAll(): void {
        (overviewList as HTMLElement).innerHTML = '';
        (ownedList as HTMLElement).innerHTML = '';

        renderSimulator();

        const overviewRows = computeOverviewRows();
        if (!overviewRows.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No alliance POI data available.' });
          (msg as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          overviewList.appendChild(msg);
        } else {
          overviewRows.forEach((r) => {
            const row = makeEl('div');
            (row as HTMLElement).style.cssText =
              'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:4px;';
            try {
              const c = getPoiTypeColor(r.poiType);
              if (c) (row as HTMLElement).style.borderLeft = '4px solid ' + c;
            } catch {
              // ignore
            }

            const l1 = makeEl('div');
            l1.textContent = r.typeName;
            (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            try {
              const c = getPoiTypeColor(r.poiType);
              if (c) (l1 as HTMLElement).style.color = c;
            } catch {
              // ignore
            }

            const l2 = makeEl('div');
            const rankTxt = r.rank !== null && isFinite(r.rank) ? 'Rank: ' + String(r.rank) : 'Rank: -';
            const scoreTxt = r.score !== null && isFinite(r.score) ? 'Score: ' + formatNumber(r.score) : 'Score: -';
            l2.textContent = rankTxt + ' • ' + scoreTxt;
            (l2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:normal;word-break:break-word;';

            const l3 = makeEl('div');
            let bonusTxt = '-';
            let totalTxt = '-';
            let rankBoostTxt = 'Alliance ranking multiplier: -';
            try {
              if (r.bonus !== null && r.bonus !== undefined && isFinite(Number(r.bonus))) {
                bonusTxt = formatPoiBonusByType(r.poiType, r.bonus);
              }
            } catch {
              // ignore
            }
            try {
              if (r.totalBonus !== null && r.totalBonus !== undefined && isFinite(Number(r.totalBonus))) {
                totalTxt = formatPoiBonusByType(r.poiType, r.totalBonus);
              }
            } catch {
              // ignore
            }
            try {
              if (r.rankBoost !== null && r.rankBoost !== undefined && isFinite(Number(r.rankBoost)) && r.rank !== null && isFinite(Number(r.rank))) {
                rankBoostTxt = 'Alliance ranking multiplier: +' + String(r.rankBoost) + '% (Ranking: ' + String(r.rank) + ')';
              }
            } catch {
              // ignore
            }
            (l3 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.92);white-space:normal;word-break:break-word;';
            l3.appendChild(document.createTextNode('Bonus: ' + String(bonusTxt) + ' • '));
            l3.appendChild(document.createTextNode(rankBoostTxt + ' • '));
            const sTotal = makeEl('span');
            sTotal.textContent = 'Total: ' + String(totalTxt);
            (sTotal as HTMLElement).style.cssText = 'font-weight:900;font-size:12px;color:var(--cad-text);';
            l3.appendChild(sTotal);

            row.appendChild(l1);
            row.appendChild(l2);
            row.appendChild(l3);
            overviewList.appendChild(row);
          });
        }

        const ownedPois = getOwnedPois();
        const grouped: Record<string, any[]> = {};
        ownedPois.forEach((poi) => {
          try {
            const rawT = poi && poi.t !== undefined ? Number(poi.t) : null;
            const poiType = rawT !== null && isFinite(rawT) ? getPoiTypeFromRankedTypeId(rawT) || rawT : null;
            const key = poiType !== null && isFinite(poiType) ? String(Math.floor(Number(poiType))) : 'unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(poi);
          } catch {
            // ignore
          }
        });

        const typeKeys = Object.keys(grouped)
          .filter((k) => k !== 'unknown')
          .map((k) => Number(k))
          .filter((n) => isFinite(n))
          .sort((a, b) => a - b);

        const prevType = String(typeSelect.value || '');
        typeSelect.innerHTML = '';
        const optAll = makeEl('option') as HTMLOptionElement;
        optAll.value = '';
        optAll.textContent = 'All types (' + String(ownedPois.length) + ')';
        typeSelect.appendChild(optAll);
        typeKeys.forEach((pt) => {
          const opt = makeEl('option') as HTMLOptionElement;
          opt.value = String(pt);
          opt.textContent = (getPoiTypeName(pt) || 'TypeId ' + String(pt)) + ' (' + String((grouped[String(pt)] || []).length) + ')';
          typeSelect.appendChild(opt);
        });
        if (prevType && (prevType === '' || grouped[prevType])) typeSelect.value = prevType;

        if (!ownedPois.length) {
          const msg2 = makeEl('div', { class: 'cad-empty', text: 'No owned POIs found.' });
          (msg2 as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          ownedList.appendChild(msg2);
          return;
        }

        const w: any = window as any;
        const ClientLib = w.ClientLib;
        const poiUtil = ClientLib && ClientLib.Base && ClientLib.Base.PointOfInterestTypes ? ClientLib.Base.PointOfInterestTypes : null;
        const scoreByLevel = poiUtil && poiUtil.GetScoreByLevel ? poiUtil.GetScoreByLevel : null;

        const selectedType = String(typeSelect.value || '');
        const renderTypeKeys = selectedType ? [Number(selectedType)] : typeKeys.slice();

        renderTypeKeys.forEach((pt) => {
          const arr = grouped[String(pt)] || [];
          if (!arr.length) return;

          const group = makeEl('div');
          (group as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.06);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;';
          try {
            const c = getPoiTypeColor(pt);
            if (c) (group as HTMLElement).style.borderLeft = '4px solid ' + c;
          } catch {
            // ignore
          }

          const head = makeEl('div');
          (head as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;';
          const title = makeEl('div');
          (title as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;flex:1;';
          title.textContent = (getPoiTypeName(pt) || 'TypeId ' + String(pt)) + ' (' + String(arr.length) + ')';
          try {
            const c = getPoiTypeColor(pt);
            if (c) (title as HTMLElement).style.color = c;
          } catch {
            // ignore
          }

          const toggle = makeEl('div');
          (toggle as HTMLElement).style.cssText =
            'width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;color:rgba(233,238,247,.90);user-select:none;';
          const open = isOwnedGroupOpen(poiUi, pt);
          toggle.textContent = open ? '▴' : '▾';
          const body = makeEl('div');
          (body as HTMLElement).style.cssText = 'display:' + (open ? 'flex' : 'none') + ';flex-direction:column;gap:6px;';

          head.addEventListener('click', () => {
            const next = !isOwnedGroupOpen(poiUi, pt);
            setOwnedGroupOpen(poiUi, pt, next);
            toggle.textContent = next ? '▴' : '▾';
            (body as HTMLElement).style.display = next ? 'flex' : 'none';
          });

          head.appendChild(toggle);
          head.appendChild(title);
          group.appendChild(head);

          arr
            .slice()
            .sort((a: any, b: any) => {
              const ax = a && a.x !== undefined ? Number(a.x) : 0;
              const bx = b && b.x !== undefined ? Number(b.x) : 0;
              const ay = a && a.y !== undefined ? Number(a.y) : 0;
              const by = b && b.y !== undefined ? Number(b.y) : 0;
              return ax !== bx ? ax - bx : ay - by;
            })
            .forEach((poi: any) => {
              const x = poi && poi.x !== undefined ? Number(poi.x) : null;
              const y = poi && poi.y !== undefined ? Number(poi.y) : null;
              const lvl = poi && poi.l !== undefined ? Number(poi.l) : null;
              let score: number | null = null;
              try {
                if (scoreByLevel && lvl !== null && isFinite(lvl)) score = scoreByLevel(lvl);
              } catch {
                // ignore
              }

              const line = makeEl('div');
              (line as HTMLElement).style.cssText =
                'display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:12px;padding:8px 10px;';

              const levelBadge = makeEl('div');
              (levelBadge as HTMLElement).style.cssText =
                'width:34px;min-width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;line-height:1;color:#0b0f14;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.10);';
              try {
                const c = getPoiTypeColor(pt);
                if (c) {
                  (levelBadge as HTMLElement).style.background = c;
                  (levelBadge as HTMLElement).style.borderColor = c;
                }
              } catch {
                // ignore
              }
              levelBadge.textContent = lvl !== null && isFinite(lvl) ? String(Math.floor(lvl)) : '-';

              const left = makeEl('div');
              (left as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';
              const l1 = makeEl('div');
              l1.textContent = x !== null && y !== null ? String(x) + ':' + String(y) : 'Unknown coords';
              (l1 as HTMLElement).style.cssText =
                'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
              const l2 = makeEl('div');
              const scTxt = score !== null && isFinite(score) ? formatNumber(score) : '-';
              l2.textContent = 'Score: ' + scTxt;
              (l2 as HTMLElement).style.cssText =
                'font-size:11px;color:rgba(233,238,247,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
              left.appendChild(l1);
              left.appendChild(l2);

              const btn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
              btn.textContent = 'Center';
              btn.addEventListener('click', () => {
                if (x === null || y === null || !isFinite(x) || !isFinite(y)) return;
                centerMapTo(x, y);
              });

              line.appendChild(levelBadge);
              line.appendChild(left);
              line.appendChild(btn);
              body.appendChild(line);
            });

          group.appendChild(body);
          ownedList.appendChild(group);
        });
      }

      typeSelect.addEventListener('change', () => {
        try {
          renderAll();
        } catch {
          // ignore
        }
      });

      simTypeSelect.addEventListener('change', () => {
        try {
          simState.typeId = Number(simTypeSelect.value);
          simState.captures = [];
        } catch {
          // ignore
        }
        renderAll();
      });

      simRankInput.addEventListener('input', () => {
        try {
          const tid = simState.typeId !== null && isFinite(Number(simState.typeId)) ? Number(simState.typeId) : null;
          if (tid === null) return;
          const raw = String(simRankInput.value || '').trim();
          const key = String(tid);
          if (!raw) {
            simState.assumedRankByType[key] = null;
          } else {
            const n = Number(raw);
            simState.assumedRankByType[key] = isFinite(n) ? Math.max(1, Math.floor(n)) : null;
          }
        } catch {
          // ignore
        }
        renderAll();
      });

      simAddBtn.addEventListener('click', () => {
        try {
          const lv = Number(simLevelSelect.value);
          if (!isFinite(lv)) return;
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const poiUtil = ClientLib && ClientLib.Base && ClientLib.Base.PointOfInterestTypes ? ClientLib.Base.PointOfInterestTypes : null;
          const scoreByLevel = poiUtil && poiUtil.GetScoreByLevel ? poiUtil.GetScoreByLevel : null;
          const sc = scoreByLevel ? scoreByLevel(lv) : null;
          if (sc === null || !isFinite(Number(sc))) return;
          simState.captures.push({ typeId: simState.typeId, level: lv, score: Number(sc) });
        } catch {
          // ignore
        }
        renderAll();
      });

      simResetBtn.addEventListener('click', () => {
        try {
          simState.captures = [];
        } catch {
          // ignore
        }
        renderAll();
      });

      const unsubscribe = store.subscribe(() => {
        try {
          renderAll();
        } catch {
          // ignore
        }
      });

      renderAll();
      container.addEventListener(
        'ad:cleanup',
        () => {
          try {
            unsubscribe();
          } catch {
            // ignore
          }
        },
        { once: true }
      );
    }
  });
}
