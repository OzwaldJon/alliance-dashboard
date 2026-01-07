import { getAppContext } from '../../app/global';
import { formatNumber } from '../../services/format';
import { addChatLog } from '../../services/chatLogs';

export function registerEndgameTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  const LS_ATTACKED = ctx.storage.LS_PREFIX + 'endgame_attacked_v1';

  registry.registerTab({
    id: 'endgame',
    title: 'Endgame',
    icon: 'mdi:rocket-launch-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const card = makeEl('div', { class: 'cad-card' });
      (card as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;';

      const head = makeEl('div');
      (head as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;';

      const h = makeEl('h3');
      h.textContent = 'Endgame calls';
      (h as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';

      const countEl = makeEl('div');
      (countEl as HTMLElement).style.cssText =
        'flex:0 0 auto;font-size:11px;font-weight:800;color:rgba(233,238,247,.86);border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.20);padding:6px 10px;border-radius:999px;white-space:nowrap;';

      head.appendChild(h);
      head.appendChild(countEl);

      const quickCard = makeEl('div');
      (quickCard as HTMLElement).style.cssText =
        'margin-top:10px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;';

      const quickTitle = makeEl('div');
      quickTitle.textContent = 'Quick orders';
      (quickTitle as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;color:#e9eef7;';

      const quickRow = makeEl('div');
      (quickRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      let latestPendingNames: string[] = [];

      let virusOwners: string[] = [];
      let virusMissing: string[] = [];
      let virusInjected: string[] = [];
      let virusLoading = false;
      let virusError: string | null = null;
      let virusLastUpdatedAt: number | null = null;

      function addQuickBtn(label: string, msg: string): void {
        const b = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
        b.textContent = label;
        b.addEventListener('click', () => {
          try {
            addChatLog(msg);
          } catch {
            // ignore
          }
        });
        quickRow.appendChild(b);
      }

      const callNext3Btn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      callNext3Btn.textContent = 'Call next 3 attacks';
      callNext3Btn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';
      callNext3Btn.addEventListener('click', () => {
        try {
          const names = Array.isArray(latestPendingNames) ? latestPendingNames.filter(Boolean) : [];
          if (!names.length) return;
          const picked = names.slice(0, 3);
          const msg = '[b]NEXT 3 ATTACKS:[/b] ' + picked.join(', ');
          addChatLog(msg);
        } catch {
          // ignore
        }
      });

      addQuickBtn('Be ready (virus)', '[b]ALL PLAYERS BE READY FOR INJECTING VIRUS WHEN ASKED[/b]');
      addQuickBtn('Inject virus NOW', '[b]ALL PLAYERS INJECT VIRUS NOW!!![/b]');
      addQuickBtn('Be ready (attack)', '[b]BE READY TO ATTACK WHEN YOUR TURN IS CALLED[/b]');
      quickRow.appendChild(callNext3Btn);

      quickCard.appendChild(quickTitle);
      quickCard.appendChild(quickRow);

      const virusCard = makeEl('div');
      (virusCard as HTMLElement).style.cssText =
        'margin-top:10px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;';

      const virusTitle = makeEl('div');
      virusTitle.textContent = 'Virus injections (last 8h)';
      (virusTitle as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;color:#e9eef7;';

      const virusRow = makeEl('div');
      (virusRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const virusRefreshBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      virusRefreshBtn.textContent = 'Refresh virus status';

      const virusCallBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      virusCallBtn.textContent = 'Call missing injections';
      virusCallBtn.disabled = true;
      virusCallBtn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

      virusRow.appendChild(virusRefreshBtn);
      virusRow.appendChild(virusCallBtn);

      const virusMeta = makeEl('div');
      (virusMeta as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:normal;word-break:break-word;';

      let virusListOpen = false;

      const virusListHead = makeEl('div');
      (virusListHead as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;';
      const virusListChevron = makeEl('div');
      (virusListChevron as HTMLElement).style.cssText =
        'width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;color:rgba(233,238,247,.90);';
      const virusListTitle = makeEl('div');
      virusListTitle.textContent = 'Players';
      (virusListTitle as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;color:rgba(233,238,247,.92);flex:1;';
      virusListChevron.textContent = virusListOpen ? '▴' : '▾';
      virusListHead.appendChild(virusListChevron);
      virusListHead.appendChild(virusListTitle);

      const virusList = makeEl('div');
      (virusList as HTMLElement).style.cssText =
        'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.86);font-size:12px;white-space:pre-wrap;word-break:break-word;display:none;';

      function setVirusListOpen(next: boolean): void {
        virusListOpen = !!next;
        try {
          virusListChevron.textContent = virusListOpen ? '▴' : '▾';
          (virusList as HTMLElement).style.display = virusListOpen ? 'block' : 'none';
        } catch {
          // ignore
        }
      }

      virusListHead.addEventListener('click', () => setVirusListOpen(!virusListOpen));

      function setVirusUi(): void {
        try {
          virusRefreshBtn.disabled = virusLoading;
          virusRefreshBtn.textContent = virusLoading ? 'Refreshing…' : 'Refresh virus status';
        } catch {
          // ignore
        }
        try {
          const missing = Array.isArray(virusMissing) ? virusMissing.filter(Boolean) : [];
          virusCallBtn.disabled = virusLoading || missing.length === 0;
        } catch {
          // ignore
        }
        try {
          const owners = Array.isArray(virusOwners) ? virusOwners.length : 0;
          const injected = Array.isArray(virusInjected) ? virusInjected.length : 0;
          const missing = Array.isArray(virusMissing) ? virusMissing.length : 0;
          const updated = virusLastUpdatedAt ? new Date(virusLastUpdatedAt).toLocaleTimeString() : 'never';
          const err = virusError ? ' • Error: ' + virusError : '';
          (virusMeta as HTMLElement).textContent =
            'Owners: ' + String(owners) + ' • Injected: ' + String(injected) + ' • Missing: ' + String(missing) + ' • Updated: ' + updated + err;
        } catch {
          // ignore
        }
        try {
          if (virusError) {
            (virusList as HTMLElement).textContent = String(virusError);
            (virusList as HTMLElement).style.color = 'rgba(255,180,180,.92)';
            return;
          }
        } catch {
          // ignore
        }
        try {
          const missing = Array.isArray(virusMissing) ? virusMissing.filter(Boolean) : [];
          (virusList as HTMLElement).style.color = 'rgba(233,238,247,.86)';
          (virusList as HTMLElement).textContent = missing.length ? missing.join('\n') : 'Everyone injected (or no code owners detected).';

          try {
            const autoOpen = virusListOpen || missing.length <= 12;
            setVirusListOpen(autoOpen);
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      }

      function callMissingVirus(): void {
        try {
          const missing = Array.isArray(virusMissing) ? virusMissing.filter(Boolean) : [];
          if (!missing.length) return;
          const msg = '[b]INJECT VIRUS NOW:[/b] ' + missing.join(', ');
          addChatLog(msg);
        } catch {
          // ignore
        }
      }

      function computeMissing(owners: string[], injected: string[]): string[] {
        const o = Array.isArray(owners) ? owners.map((n) => String(n || '').trim()).filter(Boolean) : [];
        const inj = new Set((Array.isArray(injected) ? injected : []).map((n) => String(n || '').trim()).filter(Boolean));
        return o.filter((n) => !inj.has(n));
      }

      function refreshVirusStatus(): void {
        virusLoading = true;
        virusError = null;
        setVirusUi();

        try {
          const w: any = window as any;
          const ClientLib = w.ClientLib;
          const phe = w.phe;
          const cm = ClientLib && ClientLib.Net && ClientLib.Net.CommunicationManager ? ClientLib.Net.CommunicationManager.GetInstance() : null;
          const makeDelegate = phe && phe.cnc && phe.cnc.Util && typeof phe.cnc.Util.createEventDelegate === 'function' ? phe.cnc.Util.createEventDelegate : null;

          if (!ClientLib || !cm || !makeDelegate) {
            virusLoading = false;
            virusError = 'Game API not available';
            setVirusUi();
            return;
          }

          const ENot = ClientLib.Data && ClientLib.Data.ENotificationId ? ClientLib.Data.ENotificationId : null;
          const viralId = ENot ? ENot.EndgameAllianceViralAttack : null;
          if (viralId === null || viralId === undefined) {
            virusLoading = false;
            virusError = 'Missing EndgameAllianceViralAttack id';
            setVirusUi();
            return;
          }

          const cutoff = Date.now() - 8 * 3600000;

          const onVirusInjections = (_ctx: any, data: any) => {
            try {
              const injected: string[] = [];
              const arr: any[] = Array.isArray(data) ? data : data && Array.isArray(data.d) ? data.d : [];
              for (const i in arr) {
                const it: any = arr[i];
                if (!it) continue;
                if (it.mdb !== viralId) continue;
                const ts = it.t !== undefined ? Number(it.t) : 0;
                if (!isFinite(ts) || ts < cutoff) continue;
                try {
                  const name = it.p && it.p[0] && it.p[0].v !== undefined ? String(it.p[0].v || '').trim() : '';
                  if (name) injected.push(name);
                } catch {
                  // ignore
                }
              }
              virusInjected = injected;
              virusMissing = computeMissing(virusOwners, virusInjected);
              virusLastUpdatedAt = Date.now();
            } catch {
              virusError = 'Failed to parse notifications';
            }
            virusLoading = false;
            setVirusUi();
          };

          const onOwners = (_ctx: any, data: any) => {
            try {
              const owners: string[] = [];
              const arr: any[] = Array.isArray(data) ? data : data && Array.isArray(data.d) ? data.d : [];
              for (const i in arr) {
                const it: any = arr[i];
                if (!it) continue;
                if (it.hc === true) {
                  const name = it.n !== undefined ? String(it.n || '').trim() : '';
                  if (name) owners.push(name);
                }
              }
              virusOwners = owners;
            } catch {
              virusOwners = [];
            }

            try {
              cm.SendSimpleCommand(
                'NotificationGetRange',
                {
                  category: 0,
                  skip: 0,
                  take: 300,
                  sortOrder: 1,
                  ascending: !1
                },
                makeDelegate(ClientLib.Net.CommandResult, ctx, onVirusInjections),
                null
              );
              return;
            } catch {
              virusLoading = false;
              virusError = 'Failed to fetch notifications';
              setVirusUi();
            }
          };

          cm.SendSimpleCommand('AllianceGetMemberData', {}, makeDelegate(ClientLib.Net.CommandResult, ctx, onOwners), null);
        } catch {
          virusLoading = false;
          virusError = 'Failed to refresh';
          setVirusUi();
        }
      }

      virusRefreshBtn.addEventListener('click', refreshVirusStatus);
      virusCallBtn.addEventListener('click', callMissingVirus);
      setVirusUi();

      virusCard.appendChild(virusTitle);
      virusCard.appendChild(virusRow);
      virusCard.appendChild(virusMeta);
      virusCard.appendChild(virusListHead);
      virusCard.appendChild(virusList);

      const filtersRow = makeEl('div');
      (filtersRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;';

      function makeToggleBtn(label: string): HTMLButtonElement {
        const b = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
        b.textContent = label;
        b.style.cssText += ';padding:6px 10px;border-radius:999px;';
        return b;
      }

      const btnOnline = makeToggleBtn('Online');
      const btnHub = makeToggleBtn('Has hub');

      let onlineOnly = true;
      let hasHubOnly = false;

      const attacked = new Set<string>();
      try {
        const saved = ctx.storage.load<any>(LS_ATTACKED, '[]');
        const arr = Array.isArray(saved) ? saved : typeof saved === 'string' ? JSON.parse(saved) : [];
        if (Array.isArray(arr)) {
          arr.forEach((v) => {
            const id = String(v ?? '').trim();
            if (id) attacked.add(id);
          });
        }
      } catch {
        // ignore
      }

      function saveAttacked(): void {
        try {
          ctx.storage.save(LS_ATTACKED, Array.from(attacked.values()));
        } catch {
          // ignore
        }
      }

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

      filtersRow.appendChild(btnOnline);
      filtersRow.appendChild(btnHub);

      const list = makeEl('div');
      (list as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;';

      const attackedHead = makeEl('div');
      (attackedHead as HTMLElement).style.cssText = 'margin-top:14px;font-weight:800;font-size:12px;color:#e9eef7;';
      attackedHead.textContent = 'Already attacked';

      const attackedList = makeEl('div');
      (attackedList as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;';

      function getBestOff(p: any): number {
        try {
          const m = p && p.member ? p.member : null;
          const v = m && m.BestOffenseLvl !== undefined && m.BestOffenseLvl !== null ? Number(m.BestOffenseLvl) : 0;
          return isFinite(v) ? v : 0;
        } catch {
          return 0;
        }
      }

      function formatAttackLevel(v: number): string {
        try {
          const n = Number(v);
          if (!isFinite(n)) return '0.00';
          return n.toFixed(2);
        } catch {
          return '0.00';
        }
      }

      function isOnline(p: any): boolean {
        try {
          const pr = p && p.presence ? String(p.presence) : '';
          return pr === 'Online' || pr === 'Away';
        } catch {
          return false;
        }
      }

      function render(): void {
        setBtnActive(btnOnline, !!onlineOnly);
        setBtnActive(btnHub, !!hasHubOnly);

        const s: any = store.getState();
        const data = s?.data || {};
        const allPlayers: any[] = Array.isArray(data.players) ? data.players : [];

        const filtered = allPlayers
          .filter((p) => {
            if (onlineOnly && !isOnline(p)) return false;
            if (hasHubOnly && !(p && p.hasHub)) return false;
            return true;
          })
          .slice()
          .sort((a, b) => {
            const ao = getBestOff(a);
            const bo = getBestOff(b);
            if (ao !== bo) return bo - ao;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
          });

        const pending = filtered.filter((p) => !attacked.has(String(p?.id ?? '').trim()));
        try {
          latestPendingNames = pending.map((p) => String(p?.name || '').trim()).filter(Boolean);
          callNext3Btn.disabled = latestPendingNames.length === 0;
          callNext3Btn.title = latestPendingNames.length === 0 ? 'No players match your filters' : '';
        } catch {
          // ignore
        }
        const attackedPlayers = allPlayers
          .filter((p) => attacked.has(String(p?.id ?? '').trim()))
          .slice()
          .sort((a, b) => {
            const ao = getBestOff(a);
            const bo = getBestOff(b);
            if (ao !== bo) return bo - ao;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
          });

        try {
          (countEl as HTMLElement).textContent = pending.length + ' / ' + allPlayers.length;
        } catch {
          // ignore
        }

        (list as HTMLElement).innerHTML = '';
        (attackedList as HTMLElement).innerHTML = '';

        if (data.loading) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'Loading players...' });
          (msg as HTMLElement).style.cssText = 'padding:12px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(msg);
          try {
            (attackedHead as HTMLElement).style.display = 'none';
          } catch {
            // ignore
          }
          return;
        }

        if (data.error) {
          const msg = makeEl('div', { class: 'cad-empty', text: String(data.error) });
          (msg as HTMLElement).style.cssText = 'padding:12px;text-align:center;color:rgba(255,180,180,.92);font-size:12px;';
          list.appendChild(msg);
          try {
            (attackedHead as HTMLElement).style.display = 'none';
          } catch {
            // ignore
          }
          return;
        }

        if (!allPlayers.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No players loaded yet. Use Refresh.' });
          (msg as HTMLElement).style.cssText = 'padding:12px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(msg);
          try {
            (attackedHead as HTMLElement).style.display = 'none';
          } catch {
            // ignore
          }
          return;
        }

        if (!pending.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No players match your filters.' });
          (msg as HTMLElement).style.cssText = 'padding:12px;text-align:center;color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(msg);
        }

        try {
          (attackedHead as HTMLElement).style.display = '';
          attackedHead.textContent = 'Already attacked (' + String(attackedPlayers.length) + ')';
        } catch {
          // ignore
        }

        pending.forEach((p) => {
          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;gap:10px;align-items:center;';

          const left = makeEl('div');
          (left as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';

          const l1 = makeEl('div');
          l1.textContent = String(p?.name || 'Unknown');
          (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

          const l2 = makeEl('div');
          const off = getBestOff(p);
          const pr = p && p.presence ? String(p.presence) : '';
          const hubTxt = p && p.hasHub ? ' • Hub' : '';
          (l2 as HTMLElement).style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:rgba(233,238,247,.62);';

          const l2a = makeEl('span');
          (l2a as HTMLElement).textContent = 'Max off:';

          const l2b = makeEl('span');
          (l2b as HTMLElement).textContent = formatAttackLevel(off);
          (l2b as HTMLElement).style.cssText =
            'padding:1px 7px;border-radius:999px;background:var(--cad-accent-14);border:1px solid var(--cad-accent-32);color:var(--cad-accent-95);font-weight:900;font-size:12px;line-height:16px;';

          const l2c = makeEl('span');
          (l2c as HTMLElement).textContent = (pr ? ' • ' + pr : '') + hubTxt;

          l2.appendChild(l2a);
          l2.appendChild(l2b);
          if ((l2c as HTMLElement).textContent) l2.appendChild(l2c);

          left.appendChild(l1);
          left.appendChild(l2);

          const btn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          btn.textContent = 'Call for next attack';
          btn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';
          btn.addEventListener('click', () => {
            try {
              const name = String(p?.name || '').trim();
              if (!name) return;
              const msg = '[b]NEXT ATTACK:[/b] ' + name;
              addChatLog(msg);
            } catch {
              // ignore
            }
          });

          const btnDone = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          btnDone.textContent = 'Attack done';
          btnDone.addEventListener('click', () => {
            try {
              const id = String(p?.id ?? '').trim();
              if (!id) return;
              attacked.add(id);
              saveAttacked();
            } catch {
              // ignore
            }
            render();
          });

          const actions = makeEl('div');
          (actions as HTMLElement).style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
          actions.appendChild(btn);
          actions.appendChild(btnDone);

          row.appendChild(left);
          row.appendChild(actions);
          list.appendChild(row);
        });

        if (!attackedPlayers.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No players marked as attacked yet.' });
          (msg as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;text-align:center;';
          attackedList.appendChild(msg);
          return;
        }

        attackedPlayers.forEach((p) => {
          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.06);border-radius:14px;padding:10px;display:flex;gap:10px;align-items:center;';

          const left = makeEl('div');
          (left as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;';

          const l1 = makeEl('div');
          l1.textContent = String(p?.name || 'Unknown');
          (l1 as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

          const l2 = makeEl('div');
          const off = getBestOff(p);
          const pr = p && p.presence ? String(p.presence) : '';
          const hubTxt = p && p.hasHub ? ' • Hub' : '';
          (l2 as HTMLElement).style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:rgba(233,238,247,.62);';

          const l2a = makeEl('span');
          (l2a as HTMLElement).textContent = 'Max off:';

          const l2b = makeEl('span');
          (l2b as HTMLElement).textContent = formatAttackLevel(off);
          (l2b as HTMLElement).style.cssText =
            'padding:1px 7px;border-radius:999px;background:var(--cad-accent-14);border:1px solid var(--cad-accent-32);color:var(--cad-accent-95);font-weight:900;font-size:12px;line-height:16px;';

          const l2c = makeEl('span');
          (l2c as HTMLElement).textContent = (pr ? ' • ' + pr : '') + hubTxt;

          l2.appendChild(l2a);
          l2.appendChild(l2b);
          if ((l2c as HTMLElement).textContent) l2.appendChild(l2c);

          left.appendChild(l1);
          left.appendChild(l2);

          const btnUndo = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          btnUndo.textContent = 'Undo';
          btnUndo.addEventListener('click', () => {
            try {
              const id = String(p?.id ?? '').trim();
              if (!id) return;
              attacked.delete(id);
              saveAttacked();
            } catch {
              // ignore
            }
            render();
          });

          row.appendChild(left);
          row.appendChild(btnUndo);
          attackedList.appendChild(row);
        });
      }

      btnOnline.addEventListener('click', () => {
        onlineOnly = !onlineOnly;
        render();
      });

      btnHub.addEventListener('click', () => {
        hasHubOnly = !hasHubOnly;
        render();
      });

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

      card.appendChild(head);
      card.appendChild(quickCard);
      card.appendChild(virusCard);
      card.appendChild(filtersRow);
      card.appendChild(list);
      card.appendChild(attackedHead);
      card.appendChild(attackedList);
      wrap.appendChild(card);
      container.appendChild(wrap);
    }
  });
}
