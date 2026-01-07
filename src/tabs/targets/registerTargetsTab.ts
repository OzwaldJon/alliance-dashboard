import { getAppContext } from '../../app/global';
import { loadTeams } from '../teams/model';
import { addChatLog } from '../../services/chatLogs';
import { computeTierFromTiers, getEffectiveTargetsForPlayer } from '../../services/targetsTier';
import {
  addGlobalMilestone,
  addTeamMilestone,
  deleteGlobalMilestone,
  deleteTeamMilestone,
  loadGlobalTargets,
  loadTargetsForTeamScope,
  saveGlobalTier,
  saveTeamTier,
  setTeamOverrideEnabled,
  type TierKey,
  type TargetTier
} from './model';

export function registerTargetsTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'targets',
    title: 'Targets',
    icon: 'mdi:target',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const scopeCard = makeEl('div', { class: 'cad-card' });
      (scopeCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const scopeH = makeEl('h3');
      scopeH.textContent = 'Scope';
      scopeCard.appendChild(scopeH);

      const scopeRow = makeEl('div');
      (scopeRow as HTMLElement).style.cssText =
        'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';
      const scopeSelect = makeEl('select') as HTMLSelectElement;
      scopeSelect.style.cssText =
        'border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
      const scopeLbl = makeEl('div', { text: 'Edit targets for:' });
      (scopeLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.80);font-weight:800;';
      scopeRow.appendChild(scopeLbl);
      scopeRow.appendChild(scopeSelect);
      scopeCard.appendChild(scopeRow);

      const scopeOverrideRow = makeEl('div') as HTMLDivElement;
      scopeOverrideRow.style.cssText = 'display:none;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';
      const scopeEnableLabel = makeEl('label') as HTMLLabelElement;
      scopeEnableLabel.style.cssText =
        'display:inline-flex;align-items:center;gap:8px;font-size:12px;color:rgba(233,238,247,.80);user-select:none;';
      const scopeEnableCb = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      scopeEnableLabel.appendChild(scopeEnableCb);
      scopeEnableLabel.appendChild(makeEl('span', { text: 'Enable team override (otherwise inherits Everyone)' }));
      scopeOverrideRow.appendChild(scopeEnableLabel);
      scopeCard.appendChild(scopeOverrideRow);

      const state: { initialized: boolean; scope: 'everyone' | 'team'; teamId: string } = {
        initialized: false,
        scope: 'everyone',
        teamId: ''
      };

      scopeSelect.addEventListener('change', () => {
        try {
          const v = String(scopeSelect.value || 'everyone');
          if (v.indexOf('team:') === 0) {
            state.scope = 'team';
            state.teamId = v.slice('team:'.length);
          } else {
            state.scope = 'everyone';
            state.teamId = '';
          }
          const data = (store.getState() as any).data;
          store.setState({ data: { ...data, _targetsTick: (data?._targetsTick || 0) + 1 } });
        } catch {
          // ignore
        }
      });

      scopeEnableCb.addEventListener('change', () => {
        try {
          if (state.scope !== 'team' || !state.teamId) return;
          setTeamOverrideEnabled(state.teamId, !!scopeEnableCb.checked);
        } catch {
          // ignore
        }
      });

      function parseDeadlineMs(s: unknown): number | null {
        try {
          const txt = String(s || '').trim();
          if (!txt) return null;
          const ms = Date.parse(txt);
          if (!isFinite(ms)) return null;
          return ms;
        } catch {
          return null;
        }
      }

      function parseDatetimeLocalAsUtcIso(value: unknown): string {
        try {
          const v = String(value || '').trim();
          const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
          if (!m) return '';
          const y = Number(m[1]);
          const mo = Number(m[2]);
          const d = Number(m[3]);
          const hh = Number(m[4]);
          const mm = Number(m[5]);
          if (!isFinite(y) || !isFinite(mo) || !isFinite(d) || !isFinite(hh) || !isFinite(mm)) return '';
          const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
          return dt.toISOString();
        } catch {
          return '';
        }
      }

      function formatDeadlineUtc(s: unknown): string {
        try {
          const ms = parseDeadlineMs(s);
          if (ms === null) return String(s || '');
          const iso = new Date(ms).toISOString();
          return iso.slice(0, 16).replace('T', ' ') + ' UTC';
        } catch {
          return String(s || '');
        }
      }

      function getPlayerBases(p: any): number {
        try {
          const m = p && p.member ? p.member : null;
          const v = m && m.Bases !== undefined ? m.Bases : p && p.bases !== undefined ? p.bases : null;
          const n = Number(v);
          return isFinite(n) ? n : 0;
        } catch {
          return 0;
        }
      }

      function milestoneStatus(pBases: number, ms: any): { state: string; label: string } {
        try {
          const deadlineMs = parseDeadlineMs(ms.deadline);
          if (deadlineMs === null) {
            return { state: 'pending', label: ms.bases + ' bases by ' + String(ms.deadline || '-') };
          }
          const now = Date.now();
          const diff = deadlineMs - now;
          if (pBases >= ms.bases) return { state: 'met', label: ms.bases + ' bases by ' + String(ms.deadline || '-') };
          if (diff < 0) return { state: 'missed', label: ms.bases + ' bases by ' + String(ms.deadline || '-') };
          if (diff <= 48 * 3600 * 1000) return { state: 'due', label: ms.bases + ' bases by ' + String(ms.deadline || '-') };
          return { state: 'pending', label: ms.bases + ' bases by ' + String(ms.deadline || '-') };
        } catch {
          return { state: 'pending', label: ms?.bases + ' bases by ' + String(ms?.deadline || '-') };
        }
      }

      const tiersCard = makeEl('div', { class: 'cad-card' });
      (tiersCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const tiersH = makeEl('h3');
      tiersH.textContent = 'Stat targets (tiers)';
      tiersCard.appendChild(tiersH);

      function tiersHeaderRow(): HTMLElement {
        const row = makeEl('div');
        (row as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';

        const c0 = makeEl('div');
        c0.textContent = 'Tier';
        (c0 as HTMLElement).style.cssText = 'min-width:70px;font-weight:800;font-size:11px;color:rgba(233,238,247,.70);';

        function hdr(text: string): HTMLElement {
          const d = makeEl('div');
          d.textContent = text;
          (d as HTMLElement).style.cssText =
            'width:120px;font-weight:800;font-size:11px;color:rgba(233,238,247,.70);padding:0 2px;box-sizing:border-box;';
          return d;
        }

        row.appendChild(c0);
        row.appendChild(hdr('Max off'));
        row.appendChild(hdr('Max def'));
        row.appendChild(hdr('Avg def'));
        return row;
      }

      function tierRow(label: string, key: TierKey, tiersNow: any): HTMLElement {
        const row = makeEl('div') as any;
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';

        const tLabel = makeEl('div', { text: label });
        (tLabel as HTMLElement).style.cssText = 'min-width:70px;font-weight:800;font-size:12px;';

        function makeNum(placeholder: string, value: unknown): HTMLInputElement {
          const inp = makeEl('input', { type: 'number', placeholder }) as HTMLInputElement;
          inp.style.cssText =
            'width:120px;box-sizing:border-box;border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
          inp.value = String(value || 0);
          return inp;
        }

        const t = tiersNow[key];
        const iOff = makeNum('Max off', t.minBestOff);
        const iDef = makeNum('Max def', t.minBestDef);
        const iAvgDef = makeNum('Avg def', t.minAvgDef);

        function setDisabled(disabled: boolean): void {
          try {
            iOff.disabled = !!disabled;
          } catch {}
          try {
            iDef.disabled = !!disabled;
          } catch {}
          try {
            iAvgDef.disabled = !!disabled;
          } catch {}
          const dim = disabled ? 'opacity:.55;' : 'opacity:1;';
          iOff.style.cssText += ';' + dim;
          iDef.style.cssText += ';' + dim;
          iAvgDef.style.cssText += ';' + dim;
        }

        function commit(): void {
          try {
            const nextTier: TargetTier = {
              minBestOff: Number(iOff.value || 0),
              minBestDef: Number(iDef.value || 0),
              minAvgDef: Number(iAvgDef.value || 0)
            };

            if (state.scope === 'everyone') saveGlobalTier(key, nextTier);
            else saveTeamTier(state.teamId, key, nextTier);
          } catch {
            // ignore
          }
        }

        iOff.addEventListener('change', commit);
        iDef.addEventListener('change', commit);
        iAvgDef.addEventListener('change', commit);

        row.appendChild(tLabel);
        row.appendChild(iOff);
        row.appendChild(iDef);
        row.appendChild(iAvgDef);
        row._setDisabled = setDisabled;
        return row;
      }

      const milestonesCard = makeEl('div', { class: 'cad-card' });
      (milestonesCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const milesH = makeEl('h3');
      milesH.textContent = 'Base milestones';
      milestonesCard.appendChild(milesH);

      const milesList = makeEl('div');
      (milesList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:8px;';

      const addRow = makeEl('div');
      (addRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';
      const addBases = makeEl('input', { type: 'number', placeholder: 'Bases…' }) as HTMLInputElement;
      addBases.style.cssText =
        'width:120px;box-sizing:border-box;border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const deadlineLbl = makeEl('div', { text: 'Deadline (UTC)' });
      (deadlineLbl as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.70);font-weight:800;';

      const addDeadline = makeEl('input', { type: 'datetime-local' }) as HTMLInputElement;
      addDeadline.style.cssText =
        'flex:1 1 240px;min-width:200px;box-sizing:border-box;border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
      addDeadline.title = 'UTC';

      const addBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      addBtn.textContent = 'Add milestone';
      addBtn.addEventListener('click', () => {
        try {
          const b = Number(addBases.value || 0);
          const dUtc = parseDatetimeLocalAsUtcIso(addDeadline.value);
          if (!isFinite(b) || b <= 0) return;
          if (!dUtc) return;
          if (state.scope === 'everyone') addGlobalMilestone(b, dUtc);
          else addTeamMilestone(state.teamId, b, dUtc);
          addBases.value = '';
          addDeadline.value = '';
        } catch {
          // ignore
        }
      });

      addRow.appendChild(addBases);
      addRow.appendChild(deadlineLbl);
      addRow.appendChild(addDeadline);
      addRow.appendChild(addBtn);
      milestonesCard.appendChild(addRow);
      milestonesCard.appendChild(milesList);

      const actionsCard = makeEl('div', { class: 'cad-card' });
      (actionsCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const actionsH = makeEl('h3');
      actionsH.textContent = 'Actions';
      actionsCard.appendChild(actionsH);

      const actionsRow = makeEl('div');
      (actionsRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;';
      const btnSendGold = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnSendGold.textContent = 'Send Gold players';
      const btnSendSilver = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnSendSilver.textContent = 'Send Silver players';
      const btnSendBronze = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnSendBronze.textContent = 'Send Bronze players';
      const btnSendMissedBases = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnSendMissedBases.textContent = 'Send missing bases';
      actionsRow.appendChild(btnSendGold);
      actionsRow.appendChild(btnSendSilver);
      actionsRow.appendChild(btnSendBronze);
      actionsRow.appendChild(btnSendMissedBases);
      actionsCard.appendChild(actionsRow);

      function renderAll(): void {
        const global = loadGlobalTargets();

        const teams = loadTeams();
        scopeSelect.innerHTML = '';
        scopeSelect.appendChild(makeEl('option', { value: 'everyone', text: 'Everyone (global)' }));
        teams.forEach((t) => {
          try {
            const opt = makeEl('option') as HTMLOptionElement;
            opt.value = 'team:' + String(t.id);
            opt.textContent = 'Team: ' + String(t.name || t.id);
            scopeSelect.appendChild(opt);
          } catch {
            // ignore
          }
        });

        try {
          const desired = state.scope === 'team' && state.teamId ? 'team:' + state.teamId : 'everyone';
          const opts = Array.prototype.slice.call(scopeSelect.options || []) as HTMLOptionElement[];
          const hasDesired = !!opts.find((o) => o && String(o.value) === desired);
          scopeSelect.value = hasDesired ? desired : 'everyone';
          if (!hasDesired) {
            state.scope = 'everyone';
            state.teamId = '';
          }
          if (!state.initialized) state.initialized = true;
        } catch {
          // ignore
        }

        let tiers = global.tiers;
        let miles = global.milestones;
        let editable = true;
        if (state.scope === 'team') {
          scopeOverrideRow.style.display = 'flex';
          const team = loadTargetsForTeamScope(state.teamId, global);
          try { scopeEnableCb.checked = team.enabled; } catch {}
          tiers = team.tiers;
          miles = team.milestones;
          editable = team.editable;
        } else {
          scopeOverrideRow.style.display = 'none';
        }

        tiersCard.innerHTML = '';
        tiersCard.appendChild(tiersH);
        tiersCard.appendChild(tiersHeaderRow());
        const rGold = tierRow('Gold', 'gold', tiers) as any;
        const rSilver = tierRow('Silver', 'silver', tiers) as any;
        const rBronze = tierRow('Bronze', 'bronze', tiers) as any;
        try {
          if (rGold && rGold._setDisabled) rGold._setDisabled(!editable);
        } catch {}
        try {
          if (rSilver && rSilver._setDisabled) rSilver._setDisabled(!editable);
        } catch {}
        try {
          if (rBronze && rBronze._setDisabled) rBronze._setDisabled(!editable);
        } catch {}
        tiersCard.appendChild(rGold);
        tiersCard.appendChild(rSilver);
        tiersCard.appendChild(rBronze);

        (milesList as HTMLElement).innerHTML = '';
        if (!miles.length) {
          const empty = makeEl('div', { class: 'cad-empty', text: 'No milestones yet.' });
          (empty as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          milesList.appendChild(empty);
        } else {
          miles.forEach((m: any, idx: number) => {
            const row = makeEl('div');
            (row as HTMLElement).style.cssText =
              'display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:12px;padding:8px 10px;';
            const txt = makeEl('div');
            txt.textContent = m.bases + ' bases by ' + formatDeadlineUtc(m.deadline);
            (txt as HTMLElement).style.cssText =
              'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;';
            const del = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            del.textContent = 'Delete';
            del.addEventListener('click', () => {
              try {
                if (state.scope === 'everyone') deleteGlobalMilestone(idx);
                else deleteTeamMilestone(state.teamId, idx);
              } catch {
                // ignore
              }
            });
            try {
              del.disabled = !editable;
            } catch {}
            try {
              del.style.opacity = editable ? '1' : '.55';
            } catch {}
            row.appendChild(txt);
            row.appendChild(del);
            milesList.appendChild(row);
          });
        }

        try {
          addBases.disabled = !editable;
        } catch {}
        try {
          addDeadline.disabled = !editable;
        } catch {}
        try {
          addBtn.disabled = !editable;
        } catch {}
        try {
          const o = editable ? 'opacity:1;' : 'opacity:.55;';
          addBases.style.cssText += ';' + o;
          addDeadline.style.cssText += ';' + o;
          addBtn.style.cssText += ';' + o;
        } catch {}

        function sendTier(which: string): void {
          try {
            const playersNow = (store.getState() as any).data && Array.isArray((store.getState() as any).data.players)
              ? (store.getState() as any).data.players
              : [];
            const list = playersNow
              .filter((p: any) => {
                const eff = getEffectiveTargetsForPlayer(p);
                return computeTierFromTiers(p, eff.tiers) === which;
              })
              .map((p: any) => '[player]' + String(p.name || '') + '[/player]');
            const msg = '/a [b]' + which + '[/b] targets met: ' + (list.length ? list.join(', ') : '(none)');
            addChatLog(msg);
            const ui = (store.getState() as any).ui;
            if (!ui?.bypassChatLogs) store.setState({ ui: { ...ui, open: true, activeTabId: 'chatlogs' } });
          } catch {
            // ignore
          }
        }

        btnSendGold.onclick = () => sendTier('Gold');
        btnSendSilver.onclick = () => sendTier('Silver');
        btnSendBronze.onclick = () => sendTier('Bronze');

        btnSendMissedBases.onclick = () => {
          try {
            const playersNow = (store.getState() as any).data && Array.isArray((store.getState() as any).data.players)
              ? (store.getState() as any).data.players
              : [];
            const missed: string[] = [];
            playersNow.forEach((p: any) => {
              const bases = getPlayerBases(p);
              const eff = getEffectiveTargetsForPlayer(p);
              const milesNow = eff && Array.isArray(eff.milestones) ? eff.milestones : [];
              for (let i = 0; i < milesNow.length; i++) {
                const st = milestoneStatus(bases, milesNow[i]);
                if (st.state !== 'ok') {
                  missed.push('[player]' + String(p.name || '') + '[/player] (' + st.label + ')');
                  break;
                }
              }
            });
            const msg = '/a [b]Missing base milestones[/b]: ' + (missed.length ? missed.join(', ') : '(none)');
            addChatLog(msg);
            const ui = (store.getState() as any).ui;
            if (!ui?.bypassChatLogs) store.setState({ ui: { ...ui, open: true, activeTabId: 'chatlogs' } });
          } catch {
            // ignore
          }
        };
      }

      const unsubscribe = store.subscribe(renderAll);
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

      wrap.appendChild(scopeCard);
      wrap.appendChild(tiersCard);
      wrap.appendChild(milestonesCard);
      wrap.appendChild(actionsCard);
      container.appendChild(wrap);
    }
  });
}
