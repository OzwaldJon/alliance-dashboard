import { getAppContext } from '../app/global';
import { getGameApi } from './gameApi';
import { addChatLog } from './chatLogs';
import { loadTeams, saveTeams } from '../tabs/teams/model';
import { getObjectiveMetaFromVisObject } from './poiMeta';

export type StopPickOptions = { restoreUi?: boolean; removePendingLog?: boolean; switchToChat?: boolean };

type PickCtxBaseMove = {
  kind: 'baseMove';
  logIndex: number;
  playerName: string;
  baseName: string;
  fromCoords: string;
  prevUi: { open: boolean; activeTabId: string };
};

type PickCtxTeamObjective = {
  kind: 'teamObjective';
  teamId: string;
  prevUi: { open: boolean; activeTabId: string };
};

type PickCtx = PickCtxBaseMove | PickCtxTeamObjective;

let pickHookInstalled = false;
let pickCtx: PickCtx | null = null;
let pickBannerEl: HTMLElement | null = null;
let pickHoverOverlayEl: HTMLElement | null = null;
let pickHover: { x: number; y: number } | null = null;
let pickHoverRaf: number | null = null;
let pickDomMoveInstalled = false;

function getClientLib(): any {
  try {
    return getGameApi().ClientLib || null;
  } catch {
    return null;
  }
}

function ensurePickBanner(): HTMLElement | null {
  try {
    if (pickBannerEl && pickBannerEl.parentNode) return pickBannerEl;
    const el = document.createElement('div');
    el.id = 'cad-pick-banner';
    el.style.cssText =
      'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;display:none;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid rgba(44,255,116,.35);background:rgba(0,0,0,.72);color:#e9eef7;font:800 12px Segoe UI,system-ui,-apple-system,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:none;max-width:min(900px,calc(100vw - 24px));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    el.textContent = 'CLICK ON THE MAP — press ESC to cancel';
    document.body.appendChild(el);
    pickBannerEl = el;
    return el;
  } catch {
    return null;
  }
}

function setPickBannerText(text: string): void {
  try {
    const el = ensurePickBanner();
    if (!el) return;
    el.textContent = String(text || 'CLICK ON THE MAP — press ESC to cancel');
  } catch {
    // ignore
  }
}

function setPickBannerVisible(visible: boolean): void {
  try {
    const el = ensurePickBanner();
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
  } catch {
    // ignore
  }
}

function ensurePickHoverOverlay(): HTMLElement | null {
  try {
    if (pickHoverOverlayEl && pickHoverOverlayEl.parentNode) return pickHoverOverlayEl;

    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    const parent = canvas && canvas.parentElement ? canvas.parentElement : null;
    if (!parent) return null;

    const el = document.createElement('div');
    el.id = 'cad-pick-hover';
    el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:11;';
    parent.appendChild(el);
    pickHoverOverlayEl = el;
    return el;
  } catch {
    return null;
  }
}

function clearPickHoverOverlay(): void {
  try {
    if (pickHoverOverlayEl) pickHoverOverlayEl.innerHTML = '';
  } catch {
    // ignore
  }
}

function schedulePickHoverRender(): void {
  try {
    if (pickHoverRaf !== null) return;
    pickHoverRaf = window.requestAnimationFrame(() => {
      pickHoverRaf = null;
      renderPickHoverOverlay();
    });
  } catch {
    // ignore
  }
}

function updatePickHover(x: number, y: number): void {
  try {
    if (!isFinite(x) || !isFinite(y)) return;
    const xx = Math.floor(Number(x));
    const yy = Math.floor(Number(y));
    if (!isFinite(xx) || !isFinite(yy)) return;
    if (pickHover && pickHover.x === xx && pickHover.y === yy) return;
    pickHover = { x: xx, y: yy };
    schedulePickHoverRender();
  } catch {
    // ignore
  }
}

function renderPickHoverOverlay(): void {
  try {
    const ctx = getAppContext();
    const s: any = ctx.store.getState();
    if (!s?.ui?.pickActive || !pickCtx || !pickHover) {
      clearPickHoverOverlay();
      return;
    }

    const api = getGameApi({ refresh: true });
    const ClientLib = api.ClientLib;
    const visMain = api.visMain;
    const region = api.region || (visMain && visMain.get_Region ? visMain.get_Region() : null);
    if (!ClientLib || !visMain || !region) {
      clearPickHoverOverlay();
      return;
    }

    if (ClientLib.Vis && ClientLib.Vis.Mode && typeof visMain.get_Mode === 'function') {
      if (visMain.get_Mode() !== ClientLib.Vis.Mode.Region) {
        clearPickHoverOverlay();
        return;
      }
    }

    if (typeof (visMain as any).ScreenPosFromWorldPosX !== 'function' || typeof (visMain as any).ScreenPosFromWorldPosY !== 'function') {
      clearPickHoverOverlay();
      return;
    }

    const gw = region && region.get_GridWidth ? Number(region.get_GridWidth()) : NaN;
    const gh = region && region.get_GridHeight ? Number(region.get_GridHeight()) : NaN;
    const vw = region && region.get_ViewWidth ? Number(region.get_ViewWidth()) : NaN;
    const vh = region && region.get_ViewHeight ? Number(region.get_ViewHeight()) : NaN;
    if (![gw, gh, vw, vh].every((n) => isFinite(n)) || gw <= 0 || gh <= 0) {
      clearPickHoverOverlay();
      return;
    }

    const root = ensurePickHoverOverlay();
    if (!root) return;
    root.innerHTML = '';

    const x = pickHover.x;
    const y = pickHover.y;
    const cx = (visMain as any).ScreenPosFromWorldPosX((x + 0.5) * gw);
    const cy = (visMain as any).ScreenPosFromWorldPosY((y + 0.5) * gh);
    if (!isFinite(cx) || !isFinite(cy)) return;
    if (cx < -60 || cy < -60 || cx > vw + 60 || cy > vh + 60) return;

    const size = 34;

    const box = document.createElement('div');
    box.id = 'cad-pick-hover-box';
    box.style.cssText =
      'position:absolute;left:' +
      String(Math.round(cx - size / 2)) +
      'px;top:' +
      String(Math.round(cy - size / 2)) +
      'px;width:' +
      String(size) +
      'px;height:' +
      String(size) +
      'px;border-radius:10px;' +
      'background:rgba(0,0,0,.15);' +
      'box-shadow:inset 0 0 0 2px rgba(44,255,116,.95), 0 10px 26px rgba(0,0,0,.55);';

    const cross = document.createElement('div');
    cross.style.cssText =
      'position:absolute;left:50%;top:50%;width:2px;height:18px;transform:translate(-50%,-50%);background:rgba(44,255,116,.95);' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.55);';

    const cross2 = document.createElement('div');
    cross2.style.cssText =
      'position:absolute;left:50%;top:50%;width:18px;height:2px;transform:translate(-50%,-50%);background:rgba(44,255,116,.95);' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.55);';

    box.appendChild(cross);
    box.appendChild(cross2);
    root.appendChild(box);

    try {
      setPickBannerText(
        (pickCtx.kind === 'teamObjective' ? 'CLICK OBJECTIVE POSITION' : 'CLICK THE NEW BASE POSITION') +
          ' — hover: ' +
          x +
          ':' +
          y +
          ' — press ESC to cancel'
      );
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function setPickActive(active: boolean): void {
  try {
    const ctx = getAppContext();
    ctx.store.setState({ ui: { ...ctx.store.getState().ui, pickActive: !!active } });
  } catch {
    // ignore
  }
}

export function updateChatLogAt(index: number, newText: string): void {
  try {
    const ctx = getAppContext();
    const prev: any = ctx.store.getState().data;
    const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs.slice() : [];
    if (index < 0 || index >= logs.length) return;
    logs[index] = { ...(logs[index] || {}), text: String(newText || '') };
    ctx.store.setState({ data: { ...(prev || {}), chatLogs: logs } });
  } catch {
    // ignore
  }
}

export function stopPickMode(opts?: StopPickOptions): void {
  const options = opts || {};
  try {
    const ctx = getAppContext();
    const prevUi = pickCtx && (pickCtx as any).prevUi ? (pickCtx as any).prevUi : null;
    const logIndex = pickCtx && (pickCtx as any).logIndex !== undefined ? Number((pickCtx as any).logIndex) : -1;

    pickCtx = null;
    pickHover = null;
    setPickActive(false);
    setPickBannerVisible(false);
    clearPickHoverOverlay();

    if (options.removePendingLog && logIndex >= 0) {
      try {
        const prev: any = ctx.store.getState().data;
        const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs.slice() : [];
        const entry = logs[logIndex];
        const txt = entry && entry.text ? String(entry.text) : '';
        if (txt.indexOf('[pick]') >= 0) {
          logs.splice(logIndex, 1);
          ctx.store.setState({ data: { ...(prev || {}), chatLogs: logs } });
        }
      } catch {
        // ignore
      }
    }

    if (prevUi && options.restoreUi) {
      ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: !!prevUi.open, activeTabId: String(prevUi.activeTabId || 'players') } });
    }

    if (options.switchToChat) {
      ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: true, activeTabId: 'chatlogs' } });
    }
  } catch {
    // ignore
  }

  try {
    const ClientLib = getClientLib();
    const api = getGameApi();
    api.visMain?.SetMouseTool?.(ClientLib?.Vis?.MouseTool?.EMouseTool?.SelectRegion, null);
  } catch {
    // ignore
  }
}

export function startPickMode(opts: { logIndex: number; playerName: string; baseName: string; fromCoords: string }): void {
  try {
    if (!opts || typeof opts.logIndex !== 'number') return;
    const ctx = getAppContext();
    const s: any = ctx.store.getState();
    const prevUi = s && s.ui ? { open: !!s.ui.open, activeTabId: String(s.ui.activeTabId || 'players') } : { open: false, activeTabId: 'players' };

    pickCtx = {
      kind: 'baseMove',
      logIndex: opts.logIndex,
      playerName: String(opts.playerName || ''),
      baseName: String(opts.baseName || ''),
      fromCoords: String(opts.fromCoords || ''),
      prevUi
    };

    setPickActive(true);
    setPickBannerVisible(true);
    setPickBannerText('CLICK THE NEW BASE POSITION — press ESC to cancel');

    ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: false } });
  } catch {
    // ignore
  }

  try {
    const ClientLib = getClientLib();
    const api = getGameApi();
    api.visMain?.SetMouseTool?.(ClientLib?.Vis?.MouseTool?.EMouseTool?.SelectRegion, null);
  } catch {
    // ignore
  }
}

export function startTeamObjectivePick(teamId: string): void {
  try {
    const ctx = getAppContext();
    const s: any = ctx.store.getState();
    const prevUi = s && s.ui ? { open: !!s.ui.open, activeTabId: String(s.ui.activeTabId || 'players') } : { open: false, activeTabId: 'players' };

    pickCtx = {
      kind: 'teamObjective',
      teamId: String(teamId || ''),
      prevUi
    };

    setPickActive(true);
    setPickBannerVisible(true);
    setPickBannerText('CLICK OBJECTIVE POSITION — press ESC to cancel');

    ctx.store.setState({ ui: { ...ctx.store.getState().ui, open: false } });
  } catch {
    // ignore
  }

  try {
    const ClientLib = getClientLib();
    const api = getGameApi();
    api.visMain?.SetMouseTool?.(ClientLib?.Vis?.MouseTool?.EMouseTool?.SelectRegion, null);
  } catch {
    // ignore
  }
}

export function ensurePickHook(): void {
  if (pickHookInstalled) return;
  pickHookInstalled = true;

  try {
    window.addEventListener(
      'keydown',
      (ev: KeyboardEvent) => {
        try {
          const ctx = getAppContext();
          const s: any = ctx.store.getState();
          if (!s || !s.ui) return;
          if (ev && (ev.key === 'Escape' || ev.key === 'Esc')) {
            if (s.ui.pickActive) stopPickMode({ restoreUi: true, removePendingLog: true });
          }
        } catch {
          // ignore
        }
      },
      true
    );
  } catch {
    // ignore
  }

  try {
    const ClientLib = getClientLib();
    const api = getGameApi();
    const visMain = api.visMain;
    const mouseTool = visMain?.GetMouseTool?.(ClientLib?.Vis?.MouseTool?.EMouseTool?.SelectRegion);

    const w: any = window as any;
    const attach =
      w.phe && w.phe.cnc && w.phe.cnc.Util && typeof w.phe.cnc.Util.attachNetEvent === 'function'
        ? w.phe.cnc.Util.attachNetEvent
        : w.webfrontend && w.webfrontend.phe && w.webfrontend.phe.cnc && w.webfrontend.phe.cnc.Util && typeof w.webfrontend.phe.cnc.Util.attachNetEvent === 'function'
          ? w.webfrontend.phe.cnc.Util.attachNetEvent
          : null;

    if (!attach) return;

    try {
      attach(mouseTool, 'OnMouseMove', ClientLib.Vis.MouseTool.OnMouseMove, null, (visX: any, visY: any) => {
        try {
          const ctx = getAppContext();
          const s: any = ctx.store.getState();
          if (!s?.ui?.pickActive || !pickCtx) return;

          const region = visMain.get_Region?.();
          const gw = region && region.get_GridWidth ? Number(region.get_GridWidth()) : null;
          const gh = region && region.get_GridHeight ? Number(region.get_GridHeight()) : null;
          const xFromPixels = gw && isFinite(gw) && gw > 0 ? Math.floor(Number(visX) / gw) : null;
          const yFromPixels = gh && isFinite(gh) && gh > 0 ? Math.floor(Number(visY) / gh) : null;
          const xFromGrid = Math.floor(Number(visX));
          const yFromGrid = Math.floor(Number(visY));
          const x = xFromPixels !== null && isFinite(xFromPixels) ? xFromPixels : xFromGrid;
          const y = yFromPixels !== null && isFinite(yFromPixels) ? yFromPixels : yFromGrid;
          updatePickHover(x, y);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    attach(mouseTool, 'OnMouseUp', ClientLib.Vis.MouseTool.OnMouseUp, null, (visX: any, visY: any, mouseButton: any) => {
      try {
        const ctx = getAppContext();
        const s: any = ctx.store.getState();
        if (!s || !s.ui) return;
        if (mouseButton === 'right') return;
        if (!s.ui.pickActive) return;

        const region = visMain.get_Region?.();
        const gw = region && region.get_GridWidth ? Number(region.get_GridWidth()) : null;
        const gh = region && region.get_GridHeight ? Number(region.get_GridHeight()) : null;
        const xFromPixels = gw && isFinite(gw) && gw > 0 ? Math.floor(Number(visX) / gw) : null;
        const yFromPixels = gh && isFinite(gh) && gh > 0 ? Math.floor(Number(visY) / gh) : null;
        const xFromGrid = Math.floor(Number(visX));
        const yFromGrid = Math.floor(Number(visY));
        const x = xFromPixels !== null && isFinite(xFromPixels) ? xFromPixels : xFromGrid;
        const y = yFromPixels !== null && isFinite(yFromPixels) ? yFromPixels : yFromGrid;

        try {
          updatePickHover(x, y);
        } catch {
          // ignore
        }

        if (!pickCtx) {
          stopPickMode({ restoreUi: true, removePendingLog: true });
          return;
        }

        if (pickCtx.kind === 'teamObjective') {
          try {
            const tid = String(pickCtx.teamId || '');
            if (tid) {
              const teams = loadTeams();
              const idx = teams.findIndex((t: any) => t && String(t.id) === tid);
              if (idx >= 0) {
                const t = teams[idx];
                const objs = t && Array.isArray((t as any).objectives) ? (t as any).objectives.slice() : [];

                const vobj = region && region.GetObjectFromPosition ? region.GetObjectFromPosition(visX, visY) : null;
                const meta = getObjectiveMetaFromVisObject(vobj, { x, y });

                objs.push({
                  id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
                  x,
                  y,
                  poiLevel: meta.poiLevel,
                  poiTypeId: meta.poiTypeId,
                  objectiveKind: meta.objectiveKind,
                  objectiveLevel: meta.objectiveLevel
                });

                teams[idx] = { ...(t as any), objectives: objs };
                saveTeams(teams);
              }
            }
          } catch {
            // ignore
          }

          stopPickMode({ restoreUi: true });
          return;
        }

        try {
          const prev: any = ctx.store.getState().data;
          const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs : [];
          const oldEntry = logs[(pickCtx as any).logIndex];
          const oldText = oldEntry && oldEntry.text ? String(oldEntry.text) : '';
          const newCoords = '[coords]' + x + ':' + y + '[/coords]';
          const updated = oldText.indexOf('[pick]') >= 0 ? oldText.replace('[pick]', newCoords) : oldText + ' ' + newCoords;
          updateChatLogAt((pickCtx as any).logIndex, updated);
        } catch {
          // ignore
        }

        stopPickMode({ switchToChat: true });
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  // Fallback: DOM mousemove over canvas parent (in case OnMouseMove hook fails)
  try {
    if (pickDomMoveInstalled) return;
    pickDomMoveInstalled = true;
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    const parent = canvas && canvas.parentElement ? canvas.parentElement : null;
    if (!parent) return;

    parent.addEventListener(
      'mousemove',
      () => {
        try {
          const ctx = getAppContext();
          const s: any = ctx.store.getState();
          if (!s?.ui?.pickActive || !pickCtx) return;

          const api = getGameApi({ refresh: true });
          const visMain = api.visMain;
          const region = api.region || (visMain && visMain.get_Region ? visMain.get_Region() : null);
          if (!visMain || !region) return;

          const mx = typeof (visMain as any).get_MousePosX === 'function' ? Number((visMain as any).get_MousePosX()) : NaN;
          const my = typeof (visMain as any).get_MousePosY === 'function' ? Number((visMain as any).get_MousePosY()) : NaN;
          const gw = region && region.get_GridWidth ? Number(region.get_GridWidth()) : NaN;
          const gh = region && region.get_GridHeight ? Number(region.get_GridHeight()) : NaN;
          if (![mx, my, gw, gh].every((n) => isFinite(n)) || gw <= 0 || gh <= 0) return;

          const x = Math.floor(mx / gw);
          const y = Math.floor(my / gh);
          updatePickHover(x, y);
        } catch {
          // ignore
        }
      },
      true
    );
  } catch {
    // ignore
  }
}
