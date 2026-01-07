import { getAppContext } from '../../app/global';
import { loadAssignments, loadTeams, saveAssignments } from '../teams/model';
import { formatNumber } from '../../services/format';
import { centerMapTo } from '../../services/map';
import { ensurePickHook, startPickMode } from '../../services/pickMode';
import { addChatLog } from '../../services/chatLogs';
import { computeTierForPlayer } from '../../services/targetsTier';
import {
  filterPlayers,
  getBaseCoords,
  getBaseName,
  getBaseScore,
  getBaseXY,
  getPlayerNote,
  setPlayerNote,
  type Player,
  type UiFilters
} from './model';

export function registerPlayersTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'players',
    title: 'Players',
    icon: 'mdi:account-group-outline',
    render: (container) => {
      const split = makeEl('div', { class: 'cad-split' });
      const left = makeEl('div', { class: 'cad-left' });
      const right = makeEl('div', { class: 'cad-right' });

      (split as HTMLElement).style.cssText =
        'flex:1 1 auto;min-height:0;min-width:0;display:grid;grid-template-columns: 360px 1fr;width:100%;height:100%;';
      (left as HTMLElement).style.cssText =
        'min-width:0;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;min-height:0;background:rgba(0,0,0,.12);height:100%;';
      (right as HTMLElement).style.cssText =
        'min-width:0;display:flex;flex-direction:column;min-height:0;background:rgba(0,0,0,.06);height:100%;';

      const searchWrap = makeEl('div', { class: 'cad-search' });
      (searchWrap as HTMLElement).style.cssText = 'padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);';

      const search = makeEl('input', { type: 'text', placeholder: 'Search players...', id: 'cad-player-search' }) as HTMLInputElement;
      search.style.cssText =
        'width:100%;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';
      search.value = (store.getState() as any).ui?.search || '';
      search.addEventListener('input', (e) => {
        const v = (e.target as HTMLInputElement).value;
        const ui = (store.getState() as any).ui;
        store.setState({ ui: { ...ui, search: v } });
      });
      searchWrap.appendChild(search);

      const filtersRow = makeEl('div');
      (filtersRow as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px;justify-content:space-between;';

      const filtersLeft = makeEl('div');
      (filtersLeft as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0;';

      function makeToggleBtn(label: string): HTMLButtonElement {
        const b = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
        b.textContent = label;
        b.style.cssText += ';padding:6px 10px;border-radius:999px;';
        return b;
      }

      const btnOnline = makeToggleBtn('Online');
      const btnHub = makeToggleBtn('Has hub');

      const teamSelect = makeEl('select') as HTMLSelectElement;
      teamSelect.style.cssText =
        'min-width:180px;max-width:100%;box-sizing:border-box;border-radius:999px;padding:6px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const countEl = makeEl('div');
      (countEl as HTMLElement).style.cssText =
        'flex:0 0 auto;font-size:11px;font-weight:800;color:rgba(233,238,247,.86);border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.20);padding:6px 10px;border-radius:999px;white-space:nowrap;';

      function setBtnActive(btn: HTMLButtonElement, active: boolean): void {
        try {
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
          if (active) {
            btn.style.borderColor = 'var(--cad-accent-40)';
            btn.style.background = 'var(--cad-accent-14)';
            btn.style.color = 'var(--cad-text)';
          } else {
            btn.style.borderColor = 'rgba(255,255,255,.10)';
            btn.style.background = 'rgba(255,255,255,.06)';
            btn.style.color = 'var(--cad-text)';
          }
        } catch {
          // ignore
        }
      }

      btnOnline.addEventListener('click', () => {
        const ui: any = (store.getState() as any).ui;
        const f: UiFilters = ui?.filters || { onlineOnly: false, hasHubOnly: false, teamId: '' };
        store.setState({ ui: { ...ui, filters: { ...f, onlineOnly: !f.onlineOnly } } });
      });

      btnHub.addEventListener('click', () => {
        const ui: any = (store.getState() as any).ui;
        const f: UiFilters = ui?.filters || { onlineOnly: false, hasHubOnly: false, teamId: '' };
        store.setState({ ui: { ...ui, filters: { ...f, hasHubOnly: !f.hasHubOnly } } });
      });

      teamSelect.addEventListener('change', () => {
        const ui: any = (store.getState() as any).ui;
        const f: UiFilters = ui?.filters || { onlineOnly: false, hasHubOnly: false, teamId: '' };
        store.setState({ ui: { ...ui, filters: { ...f, teamId: String(teamSelect.value || '') } } });
      });

      filtersLeft.appendChild(btnOnline);
      filtersLeft.appendChild(btnHub);
      filtersLeft.appendChild(teamSelect);
      filtersRow.appendChild(filtersLeft);
      filtersRow.appendChild(countEl);
      searchWrap.appendChild(filtersRow);

      const list = makeEl('div', { class: 'cad-list', id: 'cad-player-list' });
      const details = makeEl('div', { class: 'cad-details' });
      (list as HTMLElement).style.cssText = 'flex:1;min-height:0;overflow:auto;padding:8px;';
      (details as HTMLElement).style.cssText = 'flex:1;min-height:0;overflow:auto;padding:14px;';

      left.appendChild(searchWrap);
      left.appendChild(list);
      right.appendChild(details);

      split.appendChild(left);
      split.appendChild(right);
      container.appendChild(split);

      const render = () => {
        const s: any = store.getState();
        const ui = s?.ui || {};
        const data = s?.data || {};

        const f: UiFilters = ui.filters || { onlineOnly: false, hasHubOnly: false, teamId: '' };
        const teamsNow: any[] = loadTeams() as any;
        const assignNow: Record<string, string> = loadAssignments();

        // Team filter dropdown
        try {
          if (!teamsNow || teamsNow.length === 0) {
            teamSelect.style.display = 'none';
            if (f.teamId) {
              store.setState({ ui: { ...ui, filters: { ...f, teamId: '' } } });
            }
          } else {
            teamSelect.style.display = '';
            teamSelect.innerHTML = '';
            const oAll = makeEl('option') as HTMLOptionElement;
            oAll.value = '';
            oAll.textContent = 'All teams';
            teamSelect.appendChild(oAll);
            teamsNow.forEach((t) => {
              const o = makeEl('option') as HTMLOptionElement;
              o.value = String(t.id);
              o.textContent = String(t.name);
              teamSelect.appendChild(o);
            });
            const tid = String(f.teamId || '');
            const exists = !tid || !!teamsNow.find((tt) => tt && String(tt.id) === tid);
            if (!exists) {
              store.setState({ ui: { ...ui, filters: { ...f, teamId: '' } } });
            }
            teamSelect.value = exists ? tid : '';
          }
        } catch {
          // ignore
        }

        setBtnActive(btnOnline, !!f.onlineOnly);
        setBtnActive(btnHub, !!f.hasHubOnly);

        const allPlayers: Player[] = Array.isArray(data.players) ? data.players : [];
        const players = filterPlayers(allPlayers, ui.search || '', f, assignNow);

        try {
          (countEl as HTMLElement).textContent = players.length + ' / ' + allPlayers.length;
        } catch {
          // ignore
        }

        (list as HTMLElement).innerHTML = '';
        if (data.loading) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'Loading players...' });
          (msg as HTMLElement).style.cssText = 'padding:18px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(msg);
        } else if (data.error) {
          const msg = makeEl('div', { class: 'cad-empty', text: String(data.error) });
          (msg as HTMLElement).style.cssText = 'padding:18px;text-align:center;color:rgba(255,180,180,.92);font-size:12px;';
          list.appendChild(msg);
        } else if (players.length === 0) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No players loaded yet. Use the Refresh button in the header.' });
          (msg as HTMLElement).style.cssText = 'padding:18px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(msg);
        } else {
          players.forEach((p) => {
            const item = makeEl('div', { class: 'cad-item', role: 'button' });
            (item as HTMLElement).style.cssText =
              'display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:14px;cursor:pointer;border:1px solid transparent;user-select:none;';

            const selected = p.id === data.selectedPlayerId;
            item.setAttribute('aria-selected', selected ? 'true' : 'false');
            if (selected) {
              (item as HTMLElement).style.background = 'var(--cad-accent-12)';
              (item as HTMLElement).style.borderColor = 'var(--cad-accent-24)';
            }

            const rankText = typeof p.rank === 'number' && isFinite(p.rank) && p.rank > 0 ? String(p.rank) : null;
            const initials = String(p.name || '?').trim().slice(0, 2).toUpperCase();
            const avatar = makeEl('div', { class: 'cad-avatar', text: rankText || initials });

            let avatarBg = 'linear-gradient(135deg,rgba(44,255,116,.78),rgba(0,184,74,.70))';
            try {
              if (p && (p.presence === 'Online' || p.presence === 'Away')) {
                avatarBg = 'linear-gradient(135deg,rgba(44,255,116,.78),rgba(0,184,74,.70))';
              } else {
                const msAgo = typeof p.lastSeenMsAgo === 'number' && isFinite(p.lastSeenMsAgo) ? p.lastSeenMsAgo : null;
                const day = 24 * 60 * 60 * 1000;
                if (msAgo !== null) {
                  if (msAgo > 4 * day) avatarBg = 'linear-gradient(135deg,rgba(255,80,80,.86),rgba(210,40,40,.78))';
                  else if (msAgo > day) avatarBg = 'linear-gradient(135deg,rgba(255,215,80,.88),rgba(235,180,40,.80))';
                }
              }
            } catch {
              // ignore
            }

            (avatar as HTMLElement).style.cssText =
              'width:34px;height:34px;border-radius:12px;background:' +
              avatarBg +
              ';display:flex;align-items:center;justify-content:center;color:#06110a;font-weight:900;font-size:12px;flex:0 0 auto;';

            const main = makeEl('div', { class: 'cad-item-main' });
            (main as HTMLElement).style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:2px;';

            const p1 = makeEl('div', { class: 'p1' });
            (p1 as HTMLElement).style.cssText =
              'display:flex;align-items:center;gap:8px;font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            const dot = makeEl('span');
            (dot as HTMLElement).style.cssText =
              'width:8px;height:8px;border-radius:999px;flex:0 0 auto;background:rgba(160,170,185,.75);box-shadow:0 0 0 1px rgba(0,0,0,.28);';
            try {
              const day = 24 * 60 * 60 * 1000;
              if (p.presence === 'Online') {
                (dot as HTMLElement).style.background = 'rgba(44,255,116,.95)';
                (dot as HTMLElement).title = 'Online';
              } else if (p.presence === 'Away') {
                (dot as HTMLElement).style.background = 'rgba(44,255,116,.45)';
                (dot as HTMLElement).title = 'Away';
              } else {
                const msAgo = typeof p.lastSeenMsAgo === 'number' && isFinite(p.lastSeenMsAgo) ? p.lastSeenMsAgo : null;
                if (msAgo !== null && msAgo > 4 * day) {
                  (dot as HTMLElement).style.background = 'rgba(255,80,80,.90)';
                  (dot as HTMLElement).title = 'Offline (>4d)';
                } else {
                  (dot as HTMLElement).style.background = 'rgba(160,170,185,.75)';
                  (dot as HTMLElement).title = 'Offline';
                }
              }
            } catch {
              // ignore
            }

            const hubDot = makeEl('span');
            (hubDot as HTMLElement).style.cssText =
              'width:8px;height:8px;border-radius:999px;flex:0 0 auto;background:rgba(0,212,255,.92);box-shadow:0 0 0 1px rgba(0,0,0,.28);display:none;';
            if (p.hasHub) {
              (hubDot as HTMLElement).style.display = 'inline-block';
              (hubDot as HTMLElement).title = 'Has hub';
            }

            const nameEl = makeEl('span', { text: p.name || 'Unknown' });
            (nameEl as HTMLElement).style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;';

            p1.appendChild(dot);
            p1.appendChild(hubDot);
            p1.appendChild(nameEl);

            // Tier badge
            try {
              const tier = computeTierForPlayer(p);
              if (tier) {
                const tp = makeEl('span');
                tp.textContent = tier;
                (tp as HTMLElement).style.cssText =
                  'margin-left:6px;font-size:10px;font-weight:900;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);padding:2px 6px;border-radius:999px;color:rgba(233,238,247,.92);';
                if (tier === 'Gold') (tp as HTMLElement).style.cssText += 'border-color:rgba(255,214,90,.35);background:rgba(255,214,90,.10);';
                if (tier === 'Silver') (tp as HTMLElement).style.cssText += 'border-color:rgba(200,210,225,.25);background:rgba(200,210,225,.08);';
                if (tier === 'Bronze') (tp as HTMLElement).style.cssText += 'border-color:rgba(205,140,90,.25);background:rgba(205,140,90,.10);';
                p1.appendChild(tp);
              }
            } catch {
              // ignore
            }

            // Team tag
            try {
              const teamId = assignNow && assignNow[String(p.id)] ? String(assignNow[String(p.id)]) : '';
              if (teamId) {
                const team = teamsNow.find((tt) => tt && String(tt.id) === teamId) || null;
                const teamName = team && (team as any).name ? String((team as any).name) : '';
                if (teamName) {
                  const tag = makeEl('span');
                  tag.textContent = teamName;
                  (tag as HTMLElement).style.cssText =
                    'font-weight:700;font-size:11px;color:rgba(233,238,247,.45);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:2px 6px;border-radius:999px;flex:0 0 auto;';
                  (tag as HTMLElement).title = 'Team: ' + teamName;
                  p1.appendChild(tag);
                }
              }
            } catch {
              // ignore
            }

            const scoreText = p.score !== undefined && p.score !== null ? ' • ' + formatNumber(p.score) : '';
            const presenceText = p && (p.presence === 'Online' || p.presence === 'Away') ? String(p.presence) : p.lastSeen ? String(p.lastSeen) : '';
            const p2 = makeEl('div', { class: 'p2', text: (p.role ? p.role : 'Member') + scoreText + (presenceText ? ' • ' + presenceText : '') });
            (p2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            main.appendChild(p1);
            main.appendChild(p2);

            item.appendChild(avatar);
            item.appendChild(main);

            item.addEventListener('click', () => {
              const prev = (store.getState() as any).data;
              store.setState({ data: { ...prev, selectedPlayerId: p.id } });
            });

            list.appendChild(item);
          });
        }

        const selected: Player | null = (allPlayers || []).find((p: any) => p && p.id === data.selectedPlayerId) || null;
        (details as HTMLElement).innerHTML = '';

        if (!selected) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'Select a player to see details.' });
          (msg as HTMLElement).style.cssText = 'padding:18px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          details.appendChild(msg);
          return;
        }

        const card = makeEl('div', { class: 'cad-card' });
        (card as HTMLElement).style.cssText =
          'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';

        const headerRow = makeEl('div');
        (headerRow as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;min-width:0;';

        const h = makeEl('h3');
        h.textContent = selected.name;
        (h as HTMLElement).style.cssText = 'margin:0;font-size:13px;';

        const statusPill = makeEl('div');
        const isOnline = selected.presence === 'Online';
        const isAway = selected.presence === 'Away';
        const txt = isOnline ? 'Online' : isAway ? 'Away' : 'Offline';
        const tone = isOnline || isAway ? 'green' : null;
        const bg = tone === 'green' ? 'rgba(44,255,116,.14)' : 'rgba(255,255,255,.08)';
        const bd = tone === 'green' ? 'rgba(44,255,116,.28)' : 'rgba(255,255,255,.10)';
        statusPill.textContent = txt;
        (statusPill as HTMLElement).style.cssText =
          'border:1px solid ' + bd + ';background:' + bg + ';border-radius:999px;padding:4px 8px;font-size:11px;color:#e9eef7;flex:0 0 auto;';

        headerRow.appendChild(h);
        headerRow.appendChild(statusPill);

        if (selected.hasHub) {
          const hubPill = makeEl('div');
          hubPill.textContent = 'Has hub';
          (hubPill as HTMLElement).style.cssText =
            'border:1px solid rgba(0,212,255,.26);background:rgba(0,212,255,.14);border-radius:999px;padding:4px 8px;font-size:11px;color:#e9eef7;flex:0 0 auto;';
          headerRow.appendChild(hubPill);
        }

        const statsCard = makeEl('div');
        (statsCard as HTMLElement).style.cssText =
          'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;margin-bottom:10px;';

        const kv = makeEl('div', { class: 'cad-kv' });
        (kv as HTMLElement).style.cssText = 'display:grid;grid-template-columns: 150px 1fr;gap:8px 12px;font-size:12px;';

        function kvRow(k: string, v: string): void {
          const kk = makeEl('div', { class: 'k', text: k });
          (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.65);';
          const vv = makeEl('div', { text: v });
          kv.appendChild(kk);
          kv.appendChild(vv);
        }

        function kvRowNode(k: string, node: HTMLElement): void {
          const kk = makeEl('div', { class: 'k', text: k });
          (kk as HTMLElement).style.cssText = 'color:rgba(233,238,247,.65);';
          const vv = makeEl('div');
          (vv as HTMLElement).style.cssText = 'min-width:0;';
          vv.appendChild(node);
          kv.appendChild(kk);
          kv.appendChild(vv);
        }

        const member = selected.member || null;
        const points = member && member.Points !== undefined ? member.Points : selected.score;
        const rank = member && member.Rank !== undefined ? member.Rank : selected.rank;
        const basesCount = member && member.Bases !== undefined ? member.Bases : selected.bases;
        const roleName = (member && (member.RoleName || member.Role)) ? String(member.RoleName || member.Role) : selected.role || 'Member';

        kvRow('Role', roleName || '-');
        kvRow('Rank', rank !== undefined && rank !== null ? String(rank) : '-');
        kvRow('Points', points !== undefined && points !== null ? formatNumber(points) : '-');
        kvRow('Bases', basesCount !== undefined && basesCount !== null ? String(basesCount) : '-');
        kvRow('Last seen', selected.lastSeen || '-');

        // Team assignment editor
        try {
          if (teamsNow && teamsNow.length) {
            const assign = loadAssignments();
            const current = assign && (assign as any)[String(selected.id)] ? String((assign as any)[String(selected.id)]) : '';

            const wrapSel = makeEl('div');
            (wrapSel as HTMLElement).style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

            const sel = makeEl('select') as HTMLSelectElement;
            sel.style.cssText =
              'min-width:180px;max-width:100%;box-sizing:border-box;border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

            const optNone = makeEl('option') as HTMLOptionElement;
            optNone.value = '';
            optNone.textContent = '—';
            sel.appendChild(optNone);

            teamsNow.forEach((t) => {
              const o = makeEl('option') as HTMLOptionElement;
              o.value = String(t.id);
              o.textContent = String(t.name) + ' (' + String((t as any).type || '') + ')';
              sel.appendChild(o);
            });

            try {
              sel.value = current;
            } catch {
              // ignore
            }

            sel.addEventListener('change', () => {
              try {
                const next = loadAssignments();
                const v = String(sel.value || '');
                if (!v) delete (next as any)[String(selected.id)];
                else (next as any)[String(selected.id)] = v;
                saveAssignments(next);
              } catch {
                // ignore
              }
            });

            const clearBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', () => {
              try {
                const next = loadAssignments();
                delete (next as any)[String(selected.id)];
                saveAssignments(next);
              } catch {
                // ignore
              }
            });

            wrapSel.appendChild(sel);
            wrapSel.appendChild(clearBtn);
            kvRowNode('Team', wrapSel as HTMLElement);
          }
        } catch {
          // ignore
        }

        statsCard.appendChild(kv);

        const notesLabel = makeEl('div');
        notesLabel.textContent = 'Notes';
        (notesLabel as HTMLElement).style.cssText = 'margin-top:10px;margin-bottom:6px;font-weight:800;font-size:12px;';

        const notes = makeEl('textarea', { id: 'cad-player-notes', placeholder: 'Add notes for this player…' }) as HTMLTextAreaElement;
        notes.style.cssText =
          'width:100%;min-height:86px;resize:vertical;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;line-height:1.35;';
        notes.value = getPlayerNote(selected.id);
        notes.addEventListener('input', () => {
          setPlayerNote(selected.id, notes.value);
        });

        const basesTitle = makeEl('h3');
        basesTitle.textContent = 'Bases';
        (basesTitle as HTMLElement).style.cssText = 'margin:12px 0 8px 0;font-size:13px;';

        const bases = selected.raw && Array.isArray((selected.raw as any).c) ? (selected.raw as any).c : [];
        const basesWrap = makeEl('div');
        (basesWrap as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:10px;';

        if (!bases.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No base data in GetPublicPlayerInfo.' });
          (msg as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          basesWrap.appendChild(msg);
        } else {
          bases.forEach((b: any, idx: number) => {
            const baseCard = makeEl('div');
            (baseCard as HTMLElement).style.cssText =
              'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;';

            const top = makeEl('div');
            (top as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';

            const title = makeEl('div');
            (title as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;';

            const line1 = makeEl('div');
            line1.textContent = String(idx + 1) + '. ' + getBaseName(b);
            (line1 as HTMLElement).style.cssText =
              'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            const line2 = makeEl('div');
            line2.textContent = 'Score: ' + getBaseScore(null as any, b) + ' • Coords: ' + getBaseCoords(b);
            (line2 as HTMLElement).style.cssText =
              'font-size:11px;color:rgba(233,238,247,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            title.appendChild(line1);
            title.appendChild(line2);
            top.appendChild(title);
            baseCard.appendChild(top);

            const actions = makeEl('div');
            (actions as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

            const btnPick = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            btnPick.textContent = 'Give order to move base';
            btnPick.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';
            btnPick.addEventListener('click', () => {
              const playerName = selected.name;
              const baseName = getBaseName(b);
              const fromCoords = getBaseCoords(b);
              const msg =
                '/a [b]' + playerName + '[/b] move base [b]"' + baseName + '"[/b] from [coords]' + fromCoords + '[/coords] to [pick]';

              let logIndex = 0;
              try {
                const prev = (store.getState() as any).data;
                const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs : [];
                logIndex = logs.length;
              } catch {
                // ignore
              }

              addChatLog(msg, { forceQueue: true });
              try {
                ensurePickHook();
              } catch {
                // ignore
              }
              try {
                startPickMode({ logIndex, playerName, baseName, fromCoords });
              } catch {
                // ignore
              }
            });

            const btnCenter = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            btnCenter.textContent = 'Center map';
            btnCenter.addEventListener('click', () => {
              const xy = getBaseXY(b);
              if (!xy) return;
              centerMapTo(xy.x, xy.y);
            });

            actions.appendChild(btnPick);
            actions.appendChild(btnCenter);
            baseCard.appendChild(actions);
            basesWrap.appendChild(baseCard);
          });
        }

        card.appendChild(headerRow);
        card.appendChild(statsCard);
        card.appendChild(notesLabel);
        card.appendChild(notes);
        card.appendChild(basesTitle);
        card.appendChild(basesWrap);
        details.appendChild(card);
      };

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
    }
  });
}
