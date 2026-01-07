import { createStore, type Store } from './store';
import { createRegistry, type Registry } from './registry';
import { createInitialState, type AppState } from './state';
import { makeEl } from './dom';
import { createStorageApi, type StorageApi } from './persistence';
import { injectStyles } from './styles';
import { createLogBuffer } from './log';
import { makeTabIcon } from './icons';

export type UiIds = { ROOT_ID: string; FAB_ID: string };

export type MountUiOptions = {
  onRefresh?: () => void;
};

export type AppContext = {
  registry: Registry;
  store: Store<AppState>;
  storage: StorageApi;
  makeEl: typeof makeEl;
  SCRIPT_VERSION: string;
  log: ReturnType<typeof createLogBuffer>;
};

function setImportant(el: HTMLElement, prop: string, value: string): void {
  try {
    if (!el || !(el as any).style) return;
    (el as any).style.setProperty(prop, String(value), 'important');
  } catch {
    // ignore
  }
}

function clamp(n: unknown, a: number, b: number): number {
  try {
    const nn = typeof n === 'number' ? n : Number(n);
    if (!isFinite(nn)) return a;
    return Math.max(a, Math.min(b, nn));
  } catch {
    return a;
  }
}

export function createAppContext(opts?: { scriptVersion?: string }): AppContext {
  const SCRIPT_VERSION = (opts?.scriptVersion ? String(opts.scriptVersion) : '0.1.0') || '0.1.0';
  const storage = createStorageApi();
  const log = createLogBuffer(200);
  try {
    storage.migrateLegacyLocalStorageToWorldPrefix();
  } catch {
    // ignore
  }

  const store = createStore<AppState>(createInitialState());
  const registry = createRegistry();

  try {
    const savedOpen = storage.load<boolean>(storage.LS_PREFIX + 'open', false);
    store.setState({ ui: { ...store.getState().ui, open: !!savedOpen } });
  } catch {
    // ignore
  }

  try {
    const saved = storage.load<boolean>(storage.LS_PREFIX + 'bypass_chatlogs', false);
    store.setState({ ui: { ...store.getState().ui, bypassChatLogs: !!saved } });
  } catch {
    // ignore
  }

  try {
    const raw = storage.load<any>(storage.LS_PREFIX + 'settings_v1', null);
    const obj = raw && typeof raw === 'object' ? raw : null;
    const accent = obj && typeof obj.themeAccent === 'string' ? String(obj.themeAccent) : null;
    store.setState({
      ui: {
        ...store.getState().ui,
        themeAccent: accent || store.getState().ui.themeAccent
      }
    });
  } catch {
    // ignore
  }

  store.subscribe((s) => {
    try {
      storage.save(storage.LS_PREFIX + 'open', !!s.ui.open);
    } catch {
      // ignore
    }

    try {
      storage.save(storage.LS_PREFIX + 'bypass_chatlogs', !!(s.ui && s.ui.bypassChatLogs));
    } catch {
      // ignore
    }

    try {
      storage.save(storage.LS_PREFIX + 'settings_v1', {
        themeAccent: s.ui && s.ui.themeAccent ? String(s.ui.themeAccent) : '#2cff74'
      });
    } catch {
      // ignore
    }
  });

  return { registry, store, storage, makeEl, SCRIPT_VERSION, log };
}

export function mountUi(ctx: AppContext, ids?: Partial<UiIds>, opts?: MountUiOptions): void {
  const UI: UiIds = {
    ROOT_ID: ids?.ROOT_ID || 'cad-root',
    FAB_ID: ids?.FAB_ID || 'cad-fab'
  };

  const existing = document.getElementById(UI.ROOT_ID);
  if (existing) {
    try {
      const hasFab = existing.querySelector && existing.querySelector('#' + UI.FAB_ID);
      const hasShell = existing.querySelector && existing.querySelector('.cad-shell');
      if (hasFab && hasShell) return;
    } catch {
      // ignore
    }
    try {
      existing.remove();
    } catch {
      // ignore
    }
  }

  const host = document.createElement('div');
  host.id = UI.ROOT_ID;
  document.body.appendChild(host);

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    try {
      const h = String(hex || '').trim().replace(/^#/, '');
      const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
      if (full.length !== 6) return null;
      const n = parseInt(full, 16);
      if (!isFinite(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    } catch {
      return null;
    }
  }

  function applyThemeVars(): void {
    try {
      const s: any = ctx.store.getState();
      const ui = s && s.ui ? s.ui : {};
      const accent = typeof ui.themeAccent === 'string' ? String(ui.themeAccent) : '#2cff74';
      const rgb = hexToRgb(accent) || { r: 44, g: 255, b: 116 };

      host.style.setProperty('--cad-accent', accent);
      host.style.setProperty('--cad-accent-rgb', rgb.r + ',' + rgb.g + ',' + rgb.b);
      host.style.setProperty('--cad-accent-08', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.08)');
      host.style.setProperty('--cad-accent-10', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.10)');
      host.style.setProperty('--cad-accent-12', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.12)');
      host.style.setProperty('--cad-accent-14', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.14)');
      host.style.setProperty('--cad-accent-20', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.20)');
      host.style.setProperty('--cad-accent-24', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.24)');
      host.style.setProperty('--cad-accent-28', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.28)');
      host.style.setProperty('--cad-accent-32', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.32)');
      host.style.setProperty('--cad-accent-40', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.40)');
      host.style.setProperty('--cad-accent-55', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.55)');
      host.style.setProperty('--cad-accent-95', 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',.95)');
    } catch {
      // ignore
    }
  }

  injectStyles(UI.ROOT_ID, UI.FAB_ID);
  applyThemeVars();
  ctx.store.subscribe(() => applyThemeVars());

  const fab = makeEl('div', { class: 'cad-fab', id: UI.FAB_ID, role: 'button', tabindex: '0' });
  fab.innerHTML = `
      <div class="dot"></div>
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
        <div class="t1">Alliance Dashboard</div>
        <div class="t2">v${ctx.SCRIPT_VERSION}</div>
      </div>
    `;

  const overlay = makeEl('div', { class: 'cad-overlay' });
  (overlay as HTMLElement).style.display = 'none';
  (overlay as HTMLElement).style.cssText +=
    ';background:transparent;position:fixed;inset:0;z-index:2147483000;pointer-events:none;';

  const shell = makeEl('div', { class: 'cad-shell' });
  (shell as HTMLElement).style.display = 'none';
  (shell as HTMLElement).style.cssText +=
    ';position:fixed;right:16px;bottom:72px;width:calc(100vw - 32px);height:calc(100vh - 120px);z-index:2147483001;border-radius:18px;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,.55);display:flex;flex-direction:column;min-height:0;visibility:visible;opacity:1;filter:none;transform:none;';

  setImportant(shell as HTMLElement, 'display', 'none');
  setImportant(shell as HTMLElement, 'visibility', 'visible');
  setImportant(shell as HTMLElement, 'opacity', '1');

  const live = makeEl('div', { class: 'cad-pill', id: 'cad-live', text: 'loading…' });
  (live as HTMLElement).style.cssText =
    'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;pointer-events:none;max-width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

  const header = makeEl('div', { class: 'cad-header', id: 'cad-header' });
  (header as HTMLElement).style.cssText =
    'display:flex;align-items:center;gap:10px;padding:12px 14px;position:relative;z-index:1;visibility:visible;opacity:1;min-height:56px;box-sizing:border-box;flex:0 0 auto;';
  setImportant(header as HTMLElement, 'display', 'flex');
  setImportant(header as HTMLElement, 'visibility', 'visible');
  setImportant(header as HTMLElement, 'opacity', '1');
  try {
    (header as HTMLElement).style.cursor = 'move';
  } catch {
    // ignore
  }

  const title = makeEl('div', { class: 'cad-title' });
  (title as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';
  const titleName = makeEl('div', { text: 'Alliance Dashboard' });
  (titleName as HTMLElement).style.cssText =
    'font-weight:800;font-size:13px;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  const titleMeta = makeEl('div', { text: 'Players • Diagnostics • v' + ctx.SCRIPT_VERSION });
  (titleMeta as HTMLElement).style.cssText =
    'font-size:11px;color:var(--cad-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  title.appendChild(titleName);
  title.appendChild(titleMeta);

  const refreshBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
  refreshBtn.textContent = 'Refresh';
  refreshBtn.style.cssText =
    'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);color:var(--cad-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;';
  refreshBtn.addEventListener('click', () => {
    try {
      if (opts && typeof opts.onRefresh === 'function') opts.onRefresh();
    } catch {
      // ignore
    }
  });

  const closeBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText =
    'border:1px solid var(--cad-btn-border);background:var(--cad-btn-bg);color:var(--cad-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;';

  const bypassBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
  bypassBtn.textContent = 'Bypass chat logs';
  bypassBtn.style.cssText += ';padding:6px 10px;border-radius:999px;';

  try {
    const wrap = (btn: HTMLButtonElement, iconName: string, label: string) => {
      (btn as HTMLElement).innerHTML = '';
      const ico = makeTabIcon(iconName, 16);
      if (ico) btn.appendChild(ico);
      const t = makeEl('span');
      t.textContent = label;
      btn.appendChild(t);
    };
    wrap(bypassBtn, 'mdi:message-off-outline', 'Bypass chat logs');
    wrap(refreshBtn, 'mdi:refresh', 'Refresh');
    wrap(closeBtn, 'mdi:close', 'Close');
  } catch {
    // ignore
  }

  function setBypassBtnActive(active: boolean): void {
    try {
      bypassBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    } catch {
      // ignore
    }
    try {
      if (active) {
        bypassBtn.style.borderColor = 'var(--cad-accent-40)';
        bypassBtn.style.background = 'var(--cad-accent-14)';
        bypassBtn.style.color = 'var(--cad-text)';
      } else {
        bypassBtn.style.borderColor = 'var(--cad-btn-border)';
        bypassBtn.style.background = 'var(--cad-btn-bg)';
        bypassBtn.style.color = 'var(--cad-text)';
      }
    } catch {
      // ignore
    }
  }

  bypassBtn.addEventListener('click', () => {
    try {
      const s: any = ctx.store.getState();
      const ui = s && s.ui ? s.ui : {};
      const next = !ui.bypassChatLogs;
      ctx.store.setState({ ui: { ...ui, bypassChatLogs: next } });
    } catch {
      // ignore
    }
  });

  ctx.store.subscribe((s) => {
    try {
      setBypassBtnActive(!!(s.ui && s.ui.bypassChatLogs));
    } catch {
      // ignore
    }
  });
  try {
    setBypassBtnActive(!!((ctx.store.getState() as any).ui && (ctx.store.getState() as any).ui.bypassChatLogs));
  } catch {
    // ignore
  }

  header.appendChild(title);
  header.appendChild(live);
  header.appendChild(makeEl('div', { class: 'cad-spacer' }));
  header.appendChild(bypassBtn);
  header.appendChild(refreshBtn);
  header.appendChild(closeBtn);

  const tabsBar = makeEl('div', { class: 'cad-tabs', id: 'cad-tabs' });
  const content = makeEl('div', { class: 'cad-content', id: 'cad-content' });
  (tabsBar as HTMLElement).style.cssText =
    'display:flex;gap:8px;padding:10px 12px;position:relative;z-index:1;visibility:visible;opacity:1;min-height:48px;box-sizing:border-box;flex:0 0 auto;';
  (content as HTMLElement).style.cssText =
    'flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:stretch;justify-content:stretch;position:relative;z-index:1;visibility:visible;opacity:1;overflow:hidden;';
  setImportant(tabsBar as HTMLElement, 'display', 'flex');
  setImportant(tabsBar as HTMLElement, 'visibility', 'visible');
  setImportant(tabsBar as HTMLElement, 'opacity', '1');
  setImportant(content as HTMLElement, 'display', 'flex');
  setImportant(content as HTMLElement, 'visibility', 'visible');
  setImportant(content as HTMLElement, 'opacity', '1');

  const fallback = makeEl('div', { class: 'cad-fallback' });
  (fallback as HTMLElement).style.cssText =
    'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px;color:var(--cad-text-muted);';

  shell.appendChild(header);
  shell.appendChild(tabsBar);
  shell.appendChild(content);
  shell.appendChild(fallback);

  host.appendChild(overlay);
  host.appendChild(shell);
  host.appendChild(fab);

  const LS_FAB_POS = ctx.storage.LS_PREFIX + 'fab_pos';
  const LS_SHELL_SIZE = ctx.storage.LS_PREFIX + 'shell_size';
  const LS_SHELL_POS = ctx.storage.LS_PREFIX + 'shell_pos';

  let shellSize: { w: number; h: number } | null = null;
  let shellPos: { left: number; top: number } | null = null;

  function getDefaultShellSize(): { w: number; h: number } {
    try {
      // Aim for a comfortably-sized default that fits smaller screens.
      const maxW = Math.max(320, window.innerWidth - 32);
      const maxH = Math.max(240, window.innerHeight - 120);
      const w = clamp(Math.min(820, maxW), 320, maxW);
      const h = clamp(Math.min(560, maxH), 240, maxH);
      return { w, h };
    } catch {
      return { w: 820, h: 560 };
    }
  }

  function clampShellSize(next: { w: number; h: number }): { w: number; h: number } {
    try {
      const maxW = Math.max(320, window.innerWidth - 32);
      const maxH = Math.max(240, window.innerHeight - 120);
      const w = clamp(next.w, 320, maxW);
      const h = clamp(next.h, 240, maxH);
      return { w, h };
    } catch {
      return { w: 980, h: 640 };
    }
  }

  function getShellSize(): { w: number; h: number } {
    if (shellSize) return clampShellSize(shellSize);
    return clampShellSize(getDefaultShellSize());
  }

  function applyShellSize(next: { w: number; h: number }, persist: boolean): void {
    try {
      shellSize = clampShellSize(next);
      (shell as HTMLElement).style.width = shellSize.w + 'px';
      (shell as HTMLElement).style.height = shellSize.h + 'px';
    } catch {
      // ignore
    }

    if (persist) {
      try {
        ctx.storage.save(LS_SHELL_SIZE, { w: shellSize?.w, h: shellSize?.h });
      } catch {
        // ignore
      }
    }

    try {
      if (shellPos) applyShellPos(shellPos, false);
    } catch {
      // ignore
    }
  }

  function clampShellPos(next: { left: number; top: number }): { left: number; top: number } {
    try {
      const ssz = getShellSize();
      const margin = 16;
      const maxLeft = Math.max(margin, window.innerWidth - ssz.w - margin);
      const maxTop = Math.max(margin, window.innerHeight - ssz.h - margin);
      const left = clamp(next.left, margin, maxLeft);
      const top = clamp(next.top, margin, maxTop);
      return { left, top };
    } catch {
      return { left: 16, top: 16 };
    }
  }

  function applyShellPos(pos: { left: number; top: number }, persist: boolean): void {
    try {
      shellPos = clampShellPos(pos);
      (shell as HTMLElement).style.right = 'auto';
      (shell as HTMLElement).style.bottom = 'auto';
      (shell as HTMLElement).style.left = shellPos.left + 'px';
      (shell as HTMLElement).style.top = shellPos.top + 'px';
    } catch {
      // ignore
    }

    if (persist) {
      try {
        ctx.storage.save(LS_SHELL_POS, { left: shellPos?.left, top: shellPos?.top });
      } catch {
        // ignore
      }
    }
  }

  function positionShellFromFab(): void {
    try {
      const fr = (fab as HTMLElement).getBoundingClientRect();
      const ssz = getShellSize();
      const margin = 16;
      const gap = 56;

      let left = fr.left + fr.width - ssz.w;
      let top = fr.top + fr.height - ssz.h - gap;

      left = clamp(left, margin, Math.max(margin, window.innerWidth - ssz.w - margin));
      top = clamp(top, margin, Math.max(margin, window.innerHeight - ssz.h - margin));

      (shell as HTMLElement).style.right = 'auto';
      (shell as HTMLElement).style.bottom = 'auto';
      (shell as HTMLElement).style.left = left + 'px';
      (shell as HTMLElement).style.top = top + 'px';

      // Only use this as a default position (before user drags the shell).
      if (!shellPos) shellPos = { left, top };
    } catch {
      // ignore
    }
  }

  function applyFabPos(pos: any): void {
    try {
      const margin = 16;
      const fr = (fab as HTMLElement).getBoundingClientRect();
      const w = fr && fr.width ? fr.width : 180;
      const h = fr && fr.height ? fr.height : 44;

      const maxLeft = Math.max(margin, window.innerWidth - w - margin);
      const maxTop = Math.max(margin, window.innerHeight - h - margin);

      const left = clamp(pos && pos.left, margin, maxLeft);
      const top = clamp(pos && pos.top, margin, maxTop);

      (fab as HTMLElement).style.right = 'auto';
      (fab as HTMLElement).style.bottom = 'auto';
      (fab as HTMLElement).style.left = left + 'px';
      (fab as HTMLElement).style.top = top + 'px';
    } catch {
      // ignore
    }
  }

  try {
    const saved = ctx.storage.load<any>(LS_FAB_POS, null);
    if (saved && typeof saved === 'object' && saved.left !== undefined && saved.top !== undefined) {
      applyFabPos(saved);
    }
  } catch {
    // ignore
  }

  try {
    const saved = ctx.storage.load<any>(LS_SHELL_SIZE, null);
    if (saved && typeof saved === 'object' && saved.w !== undefined && saved.h !== undefined) {
      const w = Number(saved.w);
      const h = Number(saved.h);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        applyShellSize({ w, h }, false);
      }
    }
  } catch {
    // ignore
  }

  // Always apply a reasonable default size on mount (even when no saved size exists)
  // so the initial inline CSS sizing can't render the shell too large.
  try {
    applyShellSize(getShellSize(), false);
  } catch {
    // ignore
  }

  try {
    const saved = ctx.storage.load<any>(LS_SHELL_POS, null);
    if (saved && typeof saved === 'object' && saved.left !== undefined && saved.top !== undefined) {
      const left = Number(saved.left);
      const top = Number(saved.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        applyShellPos({ left, top }, false);
      }
    }
  } catch {
    // ignore
  }

  try {
    if (!shellPos) positionShellFromFab();
  } catch {
    // ignore
  }

  window.addEventListener('resize', () => {
    try {
      if (shellSize) applyShellSize(shellSize, false);
      const saved = ctx.storage.load<any>(LS_FAB_POS, null);
      if (saved && typeof saved === 'object' && saved.left !== undefined && saved.top !== undefined) {
        applyFabPos(saved);
      }
      if (shellPos) applyShellPos(shellPos, false);
      else positionShellFromFab();
    } catch {
      // ignore
    }
  });

  const resizeGrip = makeEl('div', { class: 'cad-resize', role: 'button', tabindex: '0' });
  (resizeGrip as HTMLElement).style.cssText =
    'width:16px;height:16px;border-radius:6px;align-self:flex-start;transform:rotate(180deg);cursor:nwse-resize;flex:0 0 auto;opacity:.75;display:flex;align-items:center;justify-content:center;';
  try {
    (resizeGrip as HTMLElement).setAttribute('aria-label', 'Resize');
  } catch {
    // ignore
  }
  try {
    const ico = makeTabIcon('mdi:resize-bottom-right', 12);
    if (ico) resizeGrip.appendChild(ico);
  } catch {
    // ignore
  }
  try {
    header.insertBefore(resizeGrip, (header as HTMLElement).firstChild);
  } catch {
    header.appendChild(resizeGrip);
  }

  let resizeDrag: any = null;
  resizeGrip.addEventListener('pointerdown', (ev: PointerEvent) => {
    try {
      const ssz = getShellSize();
      const sr = (shell as HTMLElement).getBoundingClientRect();
      resizeDrag = {
        pid: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        startW: ssz.w,
        startH: ssz.h,
        startLeft: sr.left,
        startTop: sr.top
      };
      (resizeGrip as HTMLElement).setPointerCapture(ev.pointerId);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
  });

  resizeGrip.addEventListener('pointermove', (ev: PointerEvent) => {
    try {
      if (!resizeDrag || resizeDrag.pid !== ev.pointerId) return;
      const dx = ev.clientX - resizeDrag.startX;
      const dy = ev.clientY - resizeDrag.startY;
      const rawW = resizeDrag.startW - dx;
      const rawH = resizeDrag.startH - dy;

      const clamped = clampShellSize({ w: rawW, h: rawH });

      // Top-left resize grip: keep bottom-right anchored.
      const anchorRight = resizeDrag.startLeft + resizeDrag.startW;
      const anchorBottom = resizeDrag.startTop + resizeDrag.startH;
      const nextLeft = anchorRight - clamped.w;
      const nextTop = anchorBottom - clamped.h;

      applyShellSize({ w: clamped.w, h: clamped.h }, false);
      applyShellPos({ left: nextLeft, top: nextTop }, false);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
  });

  function endResize(ev: PointerEvent): void {
    try {
      if (!resizeDrag || resizeDrag.pid !== ev.pointerId) return;
      const ssz = getShellSize();
      const sr = (shell as HTMLElement).getBoundingClientRect();
      applyShellSize(ssz, true);
      applyShellPos({ left: sr.left, top: sr.top }, true);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
    resizeDrag = null;
  }

  resizeGrip.addEventListener('pointerup', endResize);
  resizeGrip.addEventListener('pointercancel', endResize);

  let drag: any = null;
  let didDrag = false;
  fab.addEventListener('pointerdown', (ev: PointerEvent) => {
    try {
      didDrag = false;
      const fr = (fab as HTMLElement).getBoundingClientRect();
      drag = {
        pid: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        startLeft: fr.left,
        startTop: fr.top
      };
      (fab as HTMLElement).setPointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  });

  fab.addEventListener('pointermove', (ev: PointerEvent) => {
    try {
      if (!drag || drag.pid !== ev.pointerId) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!didDrag && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) didDrag = true;
      if (!didDrag) return;
      applyFabPos({ left: drag.startLeft + dx, top: drag.startTop + dy });
    } catch {
      // ignore
    }
  });

  fab.addEventListener('pointerup', (ev: PointerEvent) => {
    try {
      if (!drag || drag.pid !== ev.pointerId) return;
      const fr = (fab as HTMLElement).getBoundingClientRect();
      if (didDrag) {
        ctx.storage.save(LS_FAB_POS, { left: fr.left, top: fr.top });
      }
    } catch {
      // ignore
    }
    drag = null;
  });

  let shellDrag: any = null;
  header.addEventListener('pointerdown', (ev: PointerEvent) => {
    try {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (target.closest && target.closest('.cad-btn')) return;
      if (target.closest && target.closest('.cad-resize')) return;

      const sr = (shell as HTMLElement).getBoundingClientRect();
      shellDrag = {
        pid: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        startLeft: sr.left,
        startTop: sr.top
      };
      (header as HTMLElement).setPointerCapture(ev.pointerId);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
  });

  header.addEventListener('pointermove', (ev: PointerEvent) => {
    try {
      if (!shellDrag || shellDrag.pid !== ev.pointerId) return;
      const dx = ev.clientX - shellDrag.startX;
      const dy = ev.clientY - shellDrag.startY;
      applyShellPos({ left: shellDrag.startLeft + dx, top: shellDrag.startTop + dy }, false);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
  });

  function endShellDrag(ev: PointerEvent): void {
    try {
      if (!shellDrag || shellDrag.pid !== ev.pointerId) return;
      const sr = (shell as HTMLElement).getBoundingClientRect();
      applyShellPos({ left: sr.left, top: sr.top }, true);
      ev.preventDefault();
      ev.stopPropagation();
    } catch {
      // ignore
    }
    shellDrag = null;
  }

  header.addEventListener('pointerup', endShellDrag);
  header.addEventListener('pointercancel', endShellDrag);

  fab.addEventListener('pointercancel', (ev: PointerEvent) => {
    try {
      if (!drag || drag.pid !== ev.pointerId) return;
    } catch {
      // ignore
    }
    drag = null;
  });

  function setOpen(open: boolean): void {
    ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: !!open } });
  }

  function onToggle(): void {
    try {
      if (didDrag) return;
    } catch {
      // ignore
    }
    const s = ctx.store.getState();
    setOpen(!s.ui.open);
  }

  fab.addEventListener('click', onToggle);
  fab.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  let lastRenderedTabId: string | null = null;
  let lastTabsCount = 0;

  function renderTabs(): void {
    const s = ctx.store.getState();
    const tabs = ctx.registry.getTabs();
    const orderedTabs = tabs.slice();
    try {
      const idx = orderedTabs.findIndex((t) => t && t.id === 'chatlogs');
      if (idx >= 0 && idx !== orderedTabs.length - 1) {
        const [t] = orderedTabs.splice(idx, 1);
        orderedTabs.push(t);
      }
    } catch {
      // ignore
    }

    (tabsBar as HTMLElement).innerHTML = '';

    orderedTabs.forEach((tab, idx) => {
      const btn = makeEl('div', { class: 'cad-tab', role: 'tab' });
      (btn as HTMLElement).style.cssText = 'user-select:none;';
      btn.setAttribute('aria-selected', tab.id === s.ui.activeTabId ? 'true' : 'false');

      if (tab.id === 'chatlogs') {
        try {
          if (idx === orderedTabs.length - 1) {
            (btn as HTMLElement).style.marginLeft = 'auto';
          } else {
            (btn as HTMLElement).style.marginLeft = '';
          }
        } catch {
          // ignore
        }
      }
      // Selected styling is handled by CSS via [aria-selected="true"] using theme variables.

      (btn as HTMLElement).innerHTML = '';

      try {
        if (tab && tab.icon) {
          const ico = makeTabIcon(String(tab.icon), 16);
          if (ico) btn.appendChild(ico);
        }
      } catch {
        // ignore
      }

      const t = makeEl('span');
      t.textContent = tab.title;
      btn.appendChild(t);

      try {
        if (tab.id === 'chatlogs') {
          const cnt = s.data && Array.isArray((s.data as any).chatLogs) ? (s.data as any).chatLogs.length : 0;
          if (cnt > 0) {
            const badge = makeEl('span');
            badge.textContent = String(cnt);
            (badge as HTMLElement).style.cssText =
              'display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;border-radius:999px;border:1px solid var(--cad-accent-40);background:var(--cad-accent-14);color:var(--cad-text);font-size:11px;font-weight:800;line-height:18px;';
            btn.appendChild(badge);
          }
        }
      } catch {
        // ignore
      }

      btn.addEventListener('click', () => {
        ctx.store.setState({ ui: { ...ctx.store.getState().ui, activeTabId: tab.id } });
      });
      (tabsBar as HTMLElement).appendChild(btn);
    });
  }

  function renderActiveTab(): void {
    const s = ctx.store.getState();
    const tab = ctx.registry.getTabs().find((t) => t.id === s.ui.activeTabId);

    let focusRestore: any = null;
    let scrollRestore: any = null;

    try {
      const ae = document.activeElement as any;
      if (ae && (ae.id === 'cad-player-search' || ae.id === 'cad-player-notes')) {
        focusRestore = {
          id: ae.id,
          start: typeof ae.selectionStart === 'number' ? ae.selectionStart : null,
          end: typeof ae.selectionEnd === 'number' ? ae.selectionEnd : null
        };
      }
    } catch {
      // ignore
    }

    try {
      const oldList = document.getElementById('cad-player-list') as any;
      if (oldList && typeof oldList.scrollTop === 'number') {
        scrollRestore = { id: 'cad-player-list', top: oldList.scrollTop };
      }
    } catch {
      // ignore
    }

    (content as HTMLElement).innerHTML = '';
    if (!tab) {
      (content as HTMLElement).appendChild(makeEl('div', { class: 'cad-empty', text: 'No tabs registered.' }));
      return;
    }

    try {
      tab.render(content as HTMLElement);

      if (focusRestore) {
        setTimeout(() => {
          try {
            const el = document.getElementById(focusRestore.id) as any;
            if (el && typeof el.focus === 'function') {
              el.focus();
              if (typeof el.setSelectionRange === 'function' && focusRestore.start !== null && focusRestore.end !== null) {
                el.setSelectionRange(focusRestore.start, focusRestore.end);
              }
            }
          } catch {
            // ignore
          }
        }, 0);
      }

      if (scrollRestore) {
        setTimeout(() => {
          try {
            const el = document.getElementById(scrollRestore.id) as any;
            if (el && typeof el.scrollTop === 'number') {
              el.scrollTop = scrollRestore.top;
            }
          } catch {
            // ignore
          }
        }, 0);
      }
    } catch {
      const wrap = makeEl('div', { class: 'cad-details' });
      const card = makeEl('div', { class: 'cad-card' });
      const h = makeEl('h3');
      h.textContent = 'Tab failed to render';
      const pre = makeEl('div', { class: 'cad-dbg' });
      pre.textContent = 'Tab failed to render';
      card.appendChild(h);
      card.appendChild(pre);
      wrap.appendChild(card);
      (content as HTMLElement).appendChild(wrap);
    }
  }

  ctx.store.subscribe((s) => {
    (overlay as HTMLElement).style.display = 'none';

    setImportant(shell as HTMLElement, 'display', s.ui.open ? 'flex' : 'none');
    setImportant(header as HTMLElement, 'display', 'flex');
    setImportant(tabsBar as HTMLElement, 'display', 'flex');
    setImportant(content as HTMLElement, 'display', 'flex');

    try {
      if (s.ui && s.ui.open) {
        requestAnimationFrame(() => {
          try {
            if (shellPos) applyShellPos(shellPos, false);
            else positionShellFromFab();
          } catch {
            // ignore
          }
        });
      }
    } catch {
      // ignore
    }

    try {
      const playersCount = s.data && (s.data as any).players && (s.data as any).players.length ? (s.data as any).players.length : 0;
      const status = s.data && (s.data as any).lastRefreshStatus ? String((s.data as any).lastRefreshStatus) : '';
      (live as HTMLElement).textContent = 'Players: ' + playersCount + (status ? ' • ' + status : '');
    } catch {
      // ignore
    }

    renderTabs();

    try {
      const tabsNow = ctx.registry.getTabs();
      const tabsCountNow = tabsNow.length;
      if (tabsCountNow > 0) {
        const activeTabIdNow = s.ui && s.ui.activeTabId ? s.ui.activeTabId : null;
        const hasActive = !!tabsNow.find((t) => t.id === activeTabIdNow);
        if (!hasActive) {
          ctx.store.setState({ ui: { ...ctx.store.getState().ui, activeTabId: 'players' } });
          return;
        }
      }
    } catch {
      // ignore
    }

    try {
      const activeTabId = s.ui && s.ui.activeTabId ? s.ui.activeTabId : null;
      const hasContent = !!(content && (content as HTMLElement).childNodes && (content as HTMLElement).childNodes.length > 0);
      const tabsCount = ctx.registry.getTabs().length;
      if (tabsCount !== lastTabsCount) {
        lastRenderedTabId = null;
        lastTabsCount = tabsCount;
      }
      if (activeTabId !== lastRenderedTabId || !hasContent) {
        renderActiveTab();
        lastRenderedTabId = activeTabId;
      }
    } catch {
      renderActiveTab();
    }

    try {
      const hasTabs = tabsBar && (tabsBar as HTMLElement).children && (tabsBar as HTMLElement).children.length > 0;
      const hasContent = content && (content as HTMLElement).childNodes && (content as HTMLElement).childNodes.length > 0;
      (fallback as HTMLElement).style.display = hasTabs && hasContent ? 'none' : 'flex';
    } catch {
      (fallback as HTMLElement).style.display = 'flex';
    }
  });

  ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: false } });
}
