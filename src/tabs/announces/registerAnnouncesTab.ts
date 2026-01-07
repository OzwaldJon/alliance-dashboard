import { getAppContext } from '../../app/global';

type ForumPost = {
  ai?: number;
  an?: string;
  m?: string;
  pn?: string;
  t?: number;
};

type ForumThread = {
  i?: number;
  fi?: number;
  t?: string;
  fp?: ForumPost;
  lp?: ForumPost;
  pc?: number;
  vc?: number;
  sub?: boolean;
  lv?: number;
};

function formatDate(ts: any): string {
  try {
    const n = Number(ts);
    if (!isFinite(n) || n <= 0) return '-';
    return new Date(n).toLocaleString();
  } catch {
    return '-';
  }
}

function normalizeThreads(data: any): ForumThread[] {
  try {
    const arr = Array.isArray(data) ? data : [];
    return arr.filter(Boolean) as any;
  } catch {
    return [];
  }
}

function fetchForumThreadsViaClientLib(opts: { forumId: number; skip: number; take: number }): Promise<ForumThread[]> {
  return new Promise((resolve, reject) => {
    try {
      const w: any = window as any;
      const ClientLib = w.ClientLib;
      const cm = ClientLib?.Net?.CommunicationManager?.GetInstance ? ClientLib.Net.CommunicationManager.GetInstance() : null;
      const phe = w.webfrontend?.phe || w.phe;
      const makeDelegate = phe?.cnc?.Util && typeof phe.cnc.Util.createEventDelegate === 'function' ? phe.cnc.Util.createEventDelegate : null;

      if (!ClientLib || !cm || !makeDelegate) {
        reject(new Error('Game API not available'));
        return;
      }

      const payload = {
        forumId: opts.forumId,
        skip: opts.skip,
        take: opts.take
      };

      const onResult = (_ctx: any, data: any) => {
        try {
          resolve(normalizeThreads(data));
        } catch (e) {
          reject(e);
        }
      };

      const onError = (e: any) => {
        reject(e || new Error('GetForumThreads failed'));
      };

      cm.SendSimpleCommand('GetForumThreads', payload, makeDelegate(ClientLib.Net.CommandResult, null, onResult), onError);
    } catch (e) {
      reject(e);
    }
  });
}

export function registerAnnouncesTabTs(): void {
  const ctx = getAppContext();
  const { registry, makeEl } = ctx;

  registry.registerTab({
    id: 'announces',
    title: 'Announces',
    icon: 'mdi:bullhorn-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const head = makeEl('div');
      (head as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:10px;';

      const title = makeEl('h3');
      title.textContent = 'Forum announces';
      (title as HTMLElement).style.cssText = 'margin:0;font-size:13px;flex:1;';

      const status = makeEl('div');
      (status as HTMLElement).style.cssText =
        'flex:0 0 auto;font-size:11px;font-weight:800;color:rgba(233,238,247,.86);border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.20);padding:6px 10px;border-radius:999px;white-space:nowrap;';
      status.textContent = 'Idle';

      const refreshBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      refreshBtn.textContent = 'Refresh';

      head.appendChild(title);
      head.appendChild(status);
      head.appendChild(refreshBtn);

      const list = makeEl('div');
      (list as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      const loadMoreBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      loadMoreBtn.textContent = 'Load more';
      loadMoreBtn.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

      let loading = false;
      let nextSkip = 0;
      const take = 15;
      let hasMore = true;
      let all: ForumThread[] = [];
      const idSeen: Record<string, boolean> = Object.create(null);

      function setStatus(t: string): void {
        try {
          status.textContent = t;
        } catch {
          // ignore
        }
      }

      function updateButtons(): void {
        try {
          refreshBtn.disabled = loading;
        } catch {
          // ignore
        }
        try {
          loadMoreBtn.disabled = loading || !hasMore;
          loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
          loadMoreBtn.textContent = loading ? 'Loading…' : 'Load more';
        } catch {
          // ignore
        }
      }

      function renderThreads(): void {
        list.innerHTML = '';

        if (!all.length) {
          const empty = makeEl('div', { class: 'cad-empty', text: 'No announces found.' });
          (empty as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;';
          list.appendChild(empty);
          return;
        }

        all.forEach((th) => {
          const card = makeEl('div');
          (card as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px;';

          const row1 = makeEl('div');
          (row1 as HTMLElement).style.cssText = 'display:flex;align-items:flex-start;gap:10px;';

          const t = makeEl('div');
          t.textContent = String(th?.t || '');
          (t as HTMLElement).style.cssText = 'font-weight:900;font-size:12px;flex:1;min-width:0;';

          const meta = makeEl('div');
          const author = String(th?.fp?.pn || th?.lp?.pn || '');
          const when = formatDate(th?.fp?.t || th?.lv || th?.lp?.t);
          meta.textContent = (author ? author + ' • ' : '') + when;
          (meta as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);white-space:nowrap;';

          row1.appendChild(t);
          row1.appendChild(meta);

          const msg = makeEl('div');
          const raw = String(th?.fp?.m || '');
          msg.textContent = raw.length > 280 ? raw.slice(0, 280) + '…' : raw;
          (msg as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.86);white-space:pre-wrap;word-break:break-word;';

          const row2 = makeEl('div');
          const pc = isFinite(Number(th?.pc)) ? String(Math.floor(Number(th?.pc))) : '-';
          const vc = isFinite(Number(th?.vc)) ? String(Math.floor(Number(th?.vc))) : '-';
          row2.textContent = 'Replies: ' + pc + ' • Views: ' + vc;
          (row2 as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.55);';

          card.appendChild(row1);
          if (msg.textContent) card.appendChild(msg);
          card.appendChild(row2);
          list.appendChild(card);
        });
      }

      function merge(next: ForumThread[]): void {
        const arr = Array.isArray(next) ? next : [];
        const out = all.slice();
        for (let i = 0; i < arr.length; i++) {
          const th = arr[i];
          const id = String(th?.i ?? th?.t ?? '') || '';
          if (!id) continue;
          if (idSeen[id]) continue;
          idSeen[id] = true;
          out.push(th);
        }
        all = out;
      }

      async function loadPage(append: boolean): Promise<void> {
        if (loading) return;
        loading = true;
        updateButtons();
        setStatus('Loading…');

        try {
          const forumId = 14;
          const threads = await fetchForumThreadsViaClientLib({ forumId, skip: append ? nextSkip : 0, take });
          if (!append) {
            all = [];
            nextSkip = 0;
            for (const k of Object.keys(idSeen)) delete idSeen[k];
          }

          merge(threads);
          nextSkip = (append ? nextSkip : 0) + (Array.isArray(threads) ? threads.length : 0);
          hasMore = Array.isArray(threads) ? threads.length >= take : false;

          renderThreads();
          setStatus('OK • ' + String(all.length));
        } catch (e: any) {
          setStatus('Error');
          const err = makeEl('div', { class: 'cad-empty', text: String(e?.message || e || 'Failed') });
          (err as HTMLElement).style.cssText =
            'padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(255,180,180,.92);font-size:12px;';
          list.innerHTML = '';
          list.appendChild(err);
        }

        loading = false;
        updateButtons();
      }

      refreshBtn.addEventListener('click', () => {
        void loadPage(false);
      });

      loadMoreBtn.addEventListener('click', () => {
        void loadPage(true);
      });

      wrap.addEventListener('scroll', () => {
        try {
          const el = wrap as HTMLElement;
          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 250;
          if (!nearBottom) return;
          if (loading || !hasMore) return;
          void loadPage(true);
        } catch {
          // ignore
        }
      });

      container.appendChild(head);
      container.appendChild(list);
      container.appendChild(loadMoreBtn);

      updateButtons();
      try {
        setTimeout(() => {
          void loadPage(false);
        }, 0);
      } catch {
        // ignore
      }
    }
  });
}
