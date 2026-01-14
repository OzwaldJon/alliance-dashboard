import { getAppContext } from '../../app/global';
import { formatNumber } from '../../services/format';
import { centerMapTo } from '../../services/map';
import { ensurePickHook, startTeamObjectivePick } from '../../services/pickMode';
import { addChatLog } from '../../services/chatLogs';
import { formatObjectiveLabel } from '../../services/poiMeta';
import { makeTabIcon } from '../../app/icons';
import {
  addTeam,
  clearAssignments,
  deleteTeamAndUnassign,
  deleteTeamObjective,
  getCountsByTeamId,
  loadAssignments,
  loadTeams,
  renameTeam,
  type Team,
  type TeamType
} from './model';

export function registerTeamsTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'teams',
    title: 'Teams',
    icon: 'mdi:account-multiple-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const card = makeEl('div', { class: 'cad-card' });
      (card as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';
      const h = makeEl('h3');
      h.textContent = 'Teams';
      (h as HTMLElement).style.cssText = 'margin:0 0 8px 0;font-size:13px;';

      const formRow = makeEl('div');
      (formRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;';

      const nameInput = makeEl('input', { type: 'text', placeholder: 'Team name…' }) as HTMLInputElement;
      nameInput.style.cssText =
        'flex:1 1 220px;min-width:160px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const typeSelect = makeEl('select') as HTMLSelectElement;
      typeSelect.style.cssText =
        'flex:0 0 auto;min-width:110px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
      const optPvp = makeEl('option') as HTMLOptionElement;
      optPvp.value = 'PVP';
      optPvp.textContent = 'PVP';
      const optPve = makeEl('option') as HTMLOptionElement;
      optPve.value = 'PVE';
      optPve.textContent = 'PVE';
      typeSelect.appendChild(optPvp);
      typeSelect.appendChild(optPve);

      const addBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      addBtn.textContent = 'Add team';
      addBtn.addEventListener('click', () => {
        try {
          const nm = String(nameInput.value || '').trim();
          const ty = (String(typeSelect.value || 'PVP').toUpperCase() === 'PVE' ? 'PVE' : 'PVP') as TeamType;
          if (!nm) return;
          addTeam(nm, ty);
          nameInput.value = '';
        } catch {
          // ignore
        }
      });

      const clearAssignBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      clearAssignBtn.textContent = 'Clear assignments';
      clearAssignBtn.addEventListener('click', () => {
        try {
          clearAssignments();
        } catch {
          // ignore
        }
      });

      formRow.appendChild(nameInput);
      formRow.appendChild(typeSelect);
      formRow.appendChild(addBtn);
      formRow.appendChild(clearAssignBtn);

      const list = makeEl('div');
      (list as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      function fmtFloat(v: unknown, digits: number): string {
        try {
          if (v === null || v === undefined) return '-';
          const n = typeof v === 'number' ? v : Number(v);
          if (!isFinite(n)) return '-';
          const d = digits === undefined || digits === null ? 1 : Number(digits);
          if (!isFinite(d) || d < 0) return String(n);
          return n.toFixed(d);
        } catch {
          return '-';
        }
      }

      function render(): void {
        (list as HTMLElement).innerHTML = '';

        const teams = loadTeams();
        const assign = loadAssignments();
        const counts = getCountsByTeamId();
        const playersNow: any[] =
          (store.getState() as any).data && Array.isArray((store.getState() as any).data.players) ? (store.getState() as any).data.players : [];

        if (!teams.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No teams yet. Add one below.' });
          (msg as HTMLElement).style.cssText =
            'padding:12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;text-align:center;';
          list.appendChild(msg);
          return;
        }

        teams.forEach((t: Team, idx: number) => {
          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;gap:10px;align-items:flex-start;';

          const info = makeEl('div');
          (info as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';

          const line1 = makeEl('div');
          line1.textContent = t.name;
          (line1 as HTMLElement).style.cssText =
            'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

          const line2 = makeEl('div');
          const lineStats = makeEl('div');

          const cnt = counts[String(t.id)] || 0;
          let namesTxt = '';
          let totalsTxt = '';

          try {
            const ids: string[] = [];
            Object.keys(assign || {}).forEach((pid) => {
              if ((assign as any)[pid] === t.id) ids.push(String(pid));
            });

            const names = ids.map((pid) => {
              const p = playersNow.find((pp) => String(pp.id) === String(pid));
              return p && p.name ? String(p.name) : String(pid);
            });

            try {
              let scoreSum = 0;
              let scoreCount = 0;
              let offSum = 0;
              let offCount = 0;
              let bestDefSum = 0;
              let bestDefCount = 0;
              let avgDefSum = 0;
              let avgDefCount = 0;

              ids.forEach((pid) => {
                const p = playersNow.find((pp) => String(pp.id) === String(pid));
                if (!p) return;

                const sc = p && p.score !== undefined && p.score !== null ? Number(p.score) : null;
                if (sc !== null && isFinite(sc)) {
                  scoreSum += sc;
                  scoreCount += 1;
                }

                const m = p && p.member ? p.member : null;
                const bestOff = m && m.BestOffenseLvl !== undefined ? Number(m.BestOffenseLvl) : null;
                const bestDef = m && m.BestDefenseLvl !== undefined ? Number(m.BestDefenseLvl) : null;
                const avgDef = m && m.AvgDefenseLvl !== undefined ? Number(m.AvgDefenseLvl) : null;

                if (bestOff !== null && isFinite(bestOff)) {
                  offSum += bestOff;
                  offCount += 1;
                }
                if (bestDef !== null && isFinite(bestDef)) {
                  bestDefSum += bestDef;
                  bestDefCount += 1;
                }
                if (avgDef !== null && isFinite(avgDef)) {
                  avgDefSum += avgDef;
                  avgDefCount += 1;
                }
              });

              const totalScore = scoreCount ? formatNumber(scoreSum) : '-';
              const avgBestOff = offCount ? fmtFloat(offSum / offCount, 1) : '-';
              const avgBestDef = bestDefCount ? fmtFloat(bestDefSum / bestDefCount, 1) : '-';
              const avgAvgDef = avgDefCount ? fmtFloat(avgDefSum / avgDefCount, 1) : '-';

              totalsTxt =
                'Total Score: ' +
                totalScore +
                ' • Avg Max Off: ' +
                avgBestOff +
                ' • Avg Max Def: ' +
                avgBestDef +
                ' • Avg Avg Def: ' +
                avgAvgDef;
            } catch {
              // ignore
            }

            if (names.length) namesTxt = ' • ' + names.join(', ');
          } catch {
            // ignore
          }

          line2.textContent = t.type + ' • ' + cnt + ' players' + namesTxt;
          (line2 as HTMLElement).style.cssText =
            'font-size:11px;color:rgba(233,238,247,.62);white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;';

          lineStats.textContent = totalsTxt;
          (lineStats as HTMLElement).style.cssText =
            'font-size:11px;color:rgba(233,238,247,.92);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          try {
            (lineStats as HTMLElement).style.display = totalsTxt ? 'block' : 'none';
          } catch {
            // ignore
          }

          info.appendChild(line1);
          info.appendChild(line2);
          info.appendChild(lineStats);

          const objWrap = makeEl('div');
          (objWrap as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;';

          try {
            const objs = t.objectives || [];
            objs.forEach((o, oi) => {
              const pill = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;

              const baseTxt = o.x + ':' + o.y;
              const fmt = formatObjectiveLabel({
                poiLevel: o.poiLevel !== undefined ? (o.poiLevel as any) : null,
                poiTypeId: o.poiTypeId !== undefined ? (o.poiTypeId as any) : null,
                objectiveKind: (o as any).objectiveKind,
                objectiveLevel: (o as any).objectiveLevel
              });
              const labelTxt = baseTxt + fmt.text;
              const poiColor: string | null = fmt.color;

              (pill as HTMLElement).innerHTML = '';
              try {
                (pill as HTMLElement).style.display = 'inline-flex';
                (pill as HTMLElement).style.alignItems = 'center';
                (pill as HTMLElement).style.gap = '6px';
              } catch {
                // ignore
              }
              try {
                if (fmt.icon) {
                  const ico = makeTabIcon(fmt.icon, 16);
                  if (ico) pill.appendChild(ico);
                }
              } catch {
                // ignore
              }
              const tspan = makeEl('span');
              tspan.textContent = labelTxt;
              pill.appendChild(tspan);
              pill.style.cssText = 'border:1px solid var(--cad-accent-20);background:var(--cad-accent-08);';
              try {
                if (poiColor) {
                  pill.style.borderColor = poiColor;
                  pill.style.background = 'rgba(0,0,0,.10)';
                  pill.style.boxShadow = 'inset 0 0 0 1px ' + poiColor;
                }
              } catch {
                // ignore
              }

              pill.addEventListener('click', () => {
                centerMapTo(o.x, o.y);
              });

              const delObj = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
              delObj.textContent = '×';
              delObj.title = 'Delete objective';
              delObj.style.cssText =
                'border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;';
              delObj.addEventListener('click', (ev) => {
                try {
                  ev.preventDefault();
                  ev.stopPropagation();
                } catch {
                  // ignore
                }
                try {
                  deleteTeamObjective(t.id, oi);
                } catch {
                  // ignore
                }
              });

              const grp = makeEl('div');
              (grp as HTMLElement).style.cssText = 'display:inline-flex;gap:6px;align-items:center;';
              grp.appendChild(pill);
              grp.appendChild(delObj);
              objWrap.appendChild(grp);
            });
          } catch {
            // ignore
          }

          const objForm = makeEl('div');
          (objForm as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;';

          const objPick = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          objPick.textContent = 'Pick new objective';
          objPick.addEventListener('click', () => {
            try {
              ensurePickHook();
              startTeamObjectivePick(t.id);
            } catch {
              // ignore
            }
          });

          const sendObj = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          sendObj.textContent = 'Send objectives';
          sendObj.addEventListener('click', () => {
            try {
              const objs = t.objectives || [];
              const coords = objs.map((o) => '[coords]' + o.x + ':' + o.y + '[/coords]');
              const msg =
                '/a [b]' + String(t.name || 'Team') + '[/b], here are your objectives: ' + (coords.length ? coords.join(', ') : '(none)');
              addChatLog(msg);
              const ui = (store.getState() as any).ui;
              if (!ui?.bypassChatLogs) store.setState({ ui: { ...ui, open: true, activeTabId: 'chatlogs' } });
            } catch {
              // ignore
            }
          });

          const sendPlayers = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          sendPlayers.textContent = 'Send players';
          sendPlayers.addEventListener('click', () => {
            try {
              const ids: string[] = [];
              Object.keys(assign).forEach((pid) => {
                if (assign[pid] === t.id) ids.push(String(pid));
              });

              const names = ids.map((pid) => {
                try {
                  const p = playersNow.find((pp) => String(pp.id) === String(pid));
                  const nm = p && p.name ? String(p.name) : String(pid);
                  return '[player]' + nm + '[/player]';
                } catch {
                  return '[player]' + String(pid) + '[/player]';
                }
              });

              const msg = '/a [b]' + String(t.name || 'Team') + '[/b] players: ' + (names.length ? names.join(', ') : '(none)');
              addChatLog(msg);
              const ui = (store.getState() as any).ui;
              if (!ui?.bypassChatLogs) store.setState({ ui: { ...ui, open: true, activeTabId: 'chatlogs' } });
            } catch {
              // ignore
            }
          });

          objForm.appendChild(objPick);
          objForm.appendChild(sendObj);
          objForm.appendChild(sendPlayers);

          info.appendChild(objWrap);
          info.appendChild(objForm);

          const actions = makeEl('div');
          (actions as HTMLElement).style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-left:auto;';

          const renameBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          renameBtn.textContent = 'Rename';
          renameBtn.addEventListener('click', () => {
            try {
              const next = window.prompt('Rename team:', String(t.name || ''));
              if (next === null) return;
              const nm = String(next || '').trim();
              if (!nm) return;
              renameTeam(t.id, nm);
            } catch {
              // ignore
            }
          });

          const del = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          del.textContent = 'Delete team';
          del.addEventListener('click', () => {
            try {
              const ok = window.confirm(
                'Delete team "' + String(t.name || '') + '"? This will also remove its objectives and unassign its players.'
              );
              if (!ok) return;
            } catch {
              // ignore
            }
            try {
              deleteTeamAndUnassign(t.id);
            } catch {
              // ignore
            }
          });

          actions.appendChild(renameBtn);
          actions.appendChild(del);

          row.appendChild(info);
          row.appendChild(actions);
          list.appendChild(row);
        });
      }

      const unsubscribe = store.subscribe(render);
      render();
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

      card.appendChild(h);
      card.appendChild(list);
      card.appendChild(formRow);
      wrap.appendChild(card);
      container.appendChild(wrap);
    }
  });
}
