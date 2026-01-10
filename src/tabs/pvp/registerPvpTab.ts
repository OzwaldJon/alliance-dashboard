import { getAppContext } from '../../app/global';
import { getPvpOverlayStats } from '../../services/pvpOverlay';

export function registerPvpTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'pvp',
    title: 'PVP',
    icon: 'mdi:sword-cross',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const card = makeEl('div', { class: 'cad-card' });
      (card as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;';

      const h = makeEl('h3');
      h.textContent = 'PVP Tools';
      (h as HTMLElement).style.cssText = 'margin:0;font-size:13px;';
      card.appendChild(h);

      const row = makeEl('div');
      (row as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;';

      const toggleLabel = makeEl('label');
      (toggleLabel as HTMLElement).style.cssText =
        'display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);border-radius:999px;cursor:pointer;user-select:none;';

      const toggle = makeEl('input', { type: 'checkbox' }) as HTMLInputElement;
      const toggleText = makeEl('span');
      toggleText.textContent = 'Highlight high-score bases';
      (toggleText as HTMLElement).style.cssText = 'font-size:12px;font-weight:800;';
      toggleLabel.appendChild(toggle);
      toggleLabel.appendChild(toggleText);

      const thrWrap = makeEl('div');
      (thrWrap as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;';

      const thrLabel = makeEl('div');
      thrLabel.textContent = 'Score threshold';
      (thrLabel as HTMLElement).style.cssText = 'font-size:12px;color:rgba(233,238,247,.72);';

      const thr = makeEl('input', { type: 'number', placeholder: '100000' }) as HTMLInputElement;
      thr.min = '0';
      thr.step = '1000';
      thr.style.cssText =
        'width:160px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      thrWrap.appendChild(thrLabel);
      thrWrap.appendChild(thr);

      row.appendChild(toggleLabel);
      row.appendChild(thrWrap);
      card.appendChild(row);

      const status = makeEl('div');
      (status as HTMLElement).style.cssText =
        'margin-top:4px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.12);border:1px solid rgba(255,255,255,.08);color:rgba(233,238,247,.86);font-size:12px;';
      card.appendChild(status);

      const hint = makeEl('div');
      hint.textContent = 'Markers are small dots drawn on the map over bases whose score is >= the threshold.';
      (hint as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';
      card.appendChild(hint);

      function render(): void {
        try {
          const s: any = store.getState();
          const ui = s && s.ui ? s.ui : {};
          toggle.checked = !!ui.pvpHighlightEnabled;
          const v = Number(ui.pvpScoreThreshold);
          thr.value = Number.isFinite(v) && v >= 0 ? String(Math.floor(v)) : '';
          thr.disabled = !toggle.checked;

          const st = getPvpOverlayStats();
          status.textContent =
            'Overlay: ' +
            (toggle.checked ? 'ON' : 'OFF') +
            ' • threshold=' +
            String(thr.value || '-') +
            ' • scanned=' +
            String(st.scanned) +
            ' • hasXY=' +
            String((st as any).hasXY ?? 0) +
            ' • visible=' +
            String((st as any).visible ?? 0) +
            ' • drawn=' +
            String(st.drawn) +
            ' • nullScore=' +
            String((st as any).nullScore ?? 0) +
            ' • zeroScore=' +
            String((st as any).zeroScore ?? 0) +
            ' • rectMissing=' +
            String((st as any).rectMissing ?? 0) +
            ' • maxScoreSeen=' +
            String((st as any).maxScoreSeen ?? 0) +
            (((st as any).sampleScores && (st as any).sampleScores.length)
              ? ' • sample=' + String(((st as any).sampleScores as any[]).slice(0, 4).join(','))
              : '') +
            (((st as any).debug && String((st as any).debug).length)
              ? ' • debug=' + String((st as any).debug)
              : '') +
            (st.lastError ? ' • error=' + String(st.lastError) : '');
        } catch {
          // ignore
        }
      }

      toggle.addEventListener('change', () => {
        try {
          const s: any = store.getState();
          const ui = s && s.ui ? s.ui : {};
          store.setState({ ui: { ...ui, pvpHighlightEnabled: !!toggle.checked } });
        } catch {
          // ignore
        }
      });

      thr.addEventListener('change', () => {
        try {
          const s: any = store.getState();
          const ui = s && s.ui ? s.ui : {};
          const n = Number(thr.value);
          if (!isFinite(n) || n < 0) return;
          store.setState({ ui: { ...ui, pvpScoreThreshold: Math.floor(n) } });
        } catch {
          // ignore
        }
      });

      let t: number | null = null;
      try {
        t = window.setInterval(render, 800);
      } catch {
        t = null;
      }
      render();

      container.appendChild(wrap);
      wrap.appendChild(card);

      return () => {
        try {
          if (t !== null) window.clearInterval(t);
        } catch {
          // ignore
        }
      };
    }
  });
}
