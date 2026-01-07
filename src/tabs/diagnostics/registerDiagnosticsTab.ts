import { getAppContext } from '../../app/global';
import {
  buildPlayersCsv,
  buildPlayersTsv,
  clearAllDashboardData,
  copyText,
  downloadFile,
  exportLocalStorageSnapshot,
  restoreFromSnapshot
} from './model';

export function registerDiagnosticsTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'diagnostics',
    title: 'Diagnostics',
    icon: 'mdi:wrench-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      const card = makeEl('div', { class: 'cad-card' });
      const h = makeEl('h3');
      h.textContent = 'Diagnostics';

      const kv = makeEl('div', { class: 'cad-kv' });
      function row(k: string, v: string): void {
        kv.appendChild(makeEl('div', { class: 'k', text: k }));
        kv.appendChild(makeEl('div', { text: v }));
      }

      const s: any = store.getState();
      row('Last refresh', s?.data?.lastRefreshAt ? new Date(s.data.lastRefreshAt).toLocaleTimeString() : '-');
      row('Last refresh status', s?.data?.lastRefreshStatus || '-');

      const settingsTitle = makeEl('h3');
      settingsTitle.textContent = 'Settings';
      (settingsTitle as HTMLElement).style.marginTop = '12px';

      const settingsCard = makeEl('div');
      (settingsCard as HTMLElement).style.cssText =
        'border:1px solid var(--cad-border);background:var(--cad-card-strong);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:10px;';

      const themeRow = makeEl('div');
      (themeRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;';

      const themeLabel = makeEl('div');
      themeLabel.textContent = 'Theme color:';
      (themeLabel as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;min-width:110px;';

      const palette = makeEl('div');
      (palette as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const colors = [
        { id: 'green', hex: '#2cff74' },
        { id: 'blue', hex: '#3b82f6' },
        { id: 'cyan', hex: '#06b6d4' },
        { id: 'teal', hex: '#14b8a6' },
        { id: 'purple', hex: '#a855f7' },
        { id: 'pink', hex: '#ec4899' },
        { id: 'red', hex: '#ef4444' },
        { id: 'orange', hex: '#f97316' },
        { id: 'yellow', hex: '#eab308' }
      ];

      function setAccent(hex: string): void {
        try {
          const st: any = store.getState();
          const ui = st && st.ui ? st.ui : {};
          store.setState({ ui: { ...ui, themeAccent: String(hex || '#2cff74') } });
        } catch {
          // ignore
        }
      }

      function renderSettings(): void {
        try {
          const st: any = store.getState();
          const ui = st && st.ui ? st.ui : {};
          const current = typeof ui.themeAccent === 'string' ? String(ui.themeAccent) : '#2cff74';

          Array.from(palette.childNodes).forEach((n) => {
            try {
              (palette as HTMLElement).removeChild(n);
            } catch {
              // ignore
            }
          });

          colors.forEach((c) => {
            const b = makeEl('button', { type: 'button' }) as HTMLButtonElement;
            b.title = c.id;
            b.style.cssText =
              'width:22px;height:22px;border-radius:999px;border:1px solid var(--cad-btn-border);background:' +
              c.hex +
              ';cursor:pointer;padding:0;';
            const active = String(current).toLowerCase() === String(c.hex).toLowerCase();
            if (active) {
              b.style.outline = 'none';
              b.style.boxShadow = '0 0 0 3px var(--cad-accent-12)';
              b.style.borderColor = 'var(--cad-accent-55)';
            }
            b.addEventListener('click', () => setAccent(c.hex));
            palette.appendChild(b);
          });
        } catch {
          // ignore
        }
      }

      themeRow.appendChild(themeLabel);
      themeRow.appendChild(palette);
      settingsCard.appendChild(themeRow);

      const toolsTitle = makeEl('h3');
      toolsTitle.textContent = 'Tools';
      (toolsTitle as HTMLElement).style.marginTop = '12px';

      const toolsRow = makeEl('div');
      (toolsRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0 0;';

      const btnCsv = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnCsv.textContent = 'Export players CSV';
      btnCsv.addEventListener('click', () => {
        try {
          const { filename, content } = buildPlayersCsv();
          downloadFile(filename, content, 'text/csv;charset=utf-8');
        } catch {
          // ignore
        }
      });

      const btnTsv = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnTsv.textContent = 'Export players TSV';
      btnTsv.addEventListener('click', () => {
        try {
          const { filename, content } = buildPlayersTsv();
          downloadFile(filename, content, 'text/tab-separated-values;charset=utf-8');
        } catch {
          // ignore
        }
      });

      toolsRow.appendChild(btnCsv);
      toolsRow.appendChild(btnTsv);

      const backupTitle = makeEl('h3');
      backupTitle.textContent = 'Save / Restore (localStorage)';
      (backupTitle as HTMLElement).style.marginTop = '12px';

      const backupCard = makeEl('div');
      (backupCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:10px;';

      const backupBtns = makeEl('div');
      (backupBtns as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const btnCopyBackup = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnCopyBackup.textContent = 'Copy backup JSON';
      btnCopyBackup.addEventListener('click', async () => {
        try {
          const snap = exportLocalStorageSnapshot();
          const txt = JSON.stringify(snap, null, 2);
          await copyText(txt);
        } catch {
          // ignore
        }
      });

      const btnDownloadBackup = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnDownloadBackup.textContent = 'Download backup';
      btnDownloadBackup.addEventListener('click', () => {
        try {
          const snap = exportLocalStorageSnapshot();
          const txt = JSON.stringify(snap, null, 2);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          downloadFile('AllianceDashboard_backup_' + stamp + '.json', txt, 'application/json;charset=utf-8');
        } catch {
          // ignore
        }
      });

      const btnClearAll = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnClearAll.textContent = 'Clear ALL dashboard data';
      btnClearAll.addEventListener('click', () => {
        try {
          const ok = window.confirm('Clear ALL Alliance Dashboard localStorage data?');
          if (!ok) return;
          clearAllDashboardData();
        } catch {
          // ignore
        }
      });

      backupBtns.appendChild(btnCopyBackup);
      backupBtns.appendChild(btnDownloadBackup);
      backupBtns.appendChild(btnClearAll);

      const restoreLabel = makeEl('div');
      restoreLabel.textContent = 'Restore from backup JSON:';
      (restoreLabel as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;';

      const restoreInput = makeEl('textarea', { placeholder: 'Paste backup JSON here…' }) as HTMLTextAreaElement;
      restoreInput.style.cssText =
        'width:100%;min-height:110px;resize:vertical;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:11px;line-height:1.35;font-family:Consolas, ui-monospace, Menlo, monospace;';

      const restoreRow = makeEl('div');
      (restoreRow as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const clearBefore = makeEl('label') as HTMLLabelElement;
      clearBefore.style.cssText =
        'display:inline-flex;align-items:center;gap:8px;font-size:12px;color:rgba(233,238,247,.75);user-select:none;';
      const clearBeforeCb = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      try {
        clearBeforeCb.checked = true;
      } catch {
        // ignore
      }
      clearBefore.appendChild(clearBeforeCb);
      clearBefore.appendChild(makeEl('span', { text: 'Clear existing dashboard data before restore' }));

      const btnRestore = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnRestore.textContent = 'Restore backup';
      btnRestore.addEventListener('click', () => {
        try {
          const raw = String(restoreInput.value || '').trim();
          if (!raw) return;
          const obj = JSON.parse(raw);
          const ok = window.confirm('Restore dashboard localStorage from JSON? This will overwrite keys.');
          if (!ok) return;
          restoreFromSnapshot(obj, !!clearBeforeCb.checked);
        } catch {
          // ignore
        }
      });

      restoreRow.appendChild(clearBefore);
      restoreRow.appendChild(btnRestore);

      backupCard.appendChild(backupBtns);
      backupCard.appendChild(restoreLabel);
      backupCard.appendChild(restoreInput);
      backupCard.appendChild(restoreRow);

      const logTitle = makeEl('h3');
      logTitle.textContent = 'Log';
      (logTitle as HTMLElement).style.marginTop = '12px';

      const pre = makeEl('div', { class: 'cad-dbg' });
      pre.textContent = 'No log lines yet.';

      function renderLog(): void {
        try {
          const lines = ctx.log.buffer
            .slice(-120)
            .map((l) => {
              const t = new Date(l.ts).toLocaleTimeString();
              return '[' + t + '] ' + String(l.level || '').toUpperCase() + ' ' + String(l.msg || '');
            })
            .join('\n');
          pre.textContent = lines || 'No log lines yet.';
        } catch {
          pre.textContent = 'No log lines yet.';
        }
      }

      const unsubscribe = store.subscribe(renderLog);
      const unsubscribeSettings = store.subscribe(renderSettings);
      renderLog();
      renderSettings();
      container.addEventListener(
        'ad:cleanup',
        () => {
          try {
            unsubscribe();
          } catch {
            // ignore
          }
          try {
            unsubscribeSettings();
          } catch {
            // ignore
          }
        },
        { once: true }
      );

      card.appendChild(h);
      card.appendChild(kv);
      card.appendChild(settingsTitle);
      card.appendChild(settingsCard);
      card.appendChild(toolsTitle);
      card.appendChild(toolsRow);
      card.appendChild(backupTitle);
      card.appendChild(backupCard);
      card.appendChild(logTitle);
      card.appendChild(pre);
      wrap.appendChild(card);
      container.appendChild(wrap);
    }
  });
}
