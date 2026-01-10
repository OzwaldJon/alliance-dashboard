import { runOnce } from './bootstrap/runOnce';
import { getClientLib } from './env/game';
import { createAppContext, mountUi } from './app/uiShell';
import { installAppContext } from './app/global';
import { refreshPlayersTs } from './services/refreshPlayers';
import { computePlayerKey } from './app/storage';

function isClientLibReadyForDashboard(): boolean {
  try {
    const w: any = window as any;
    const ClientLib: any = w.ClientLib;
    return !!(ClientLib && ClientLib.Data && ClientLib.Data.MainData && typeof ClientLib.Data.MainData.GetInstance === 'function');
  } catch {
    return false;
  }
}

function isAllianceReadyForDashboard(): boolean {
  try {
    const w: any = window as any;
    const ClientLib: any = w.ClientLib;
    if (!ClientLib?.Data?.MainData?.GetInstance) return false;
    const md = ClientLib.Data.MainData.GetInstance();
    const alliance = md && typeof md.get_Alliance === 'function' ? md.get_Alliance() : null;
    if (!alliance) return false;
    if (typeof alliance.get_Exists === 'function' && !alliance.get_Exists()) return false;

    // Avoid false negatives during early boot: wait until member id list object is present.
    const idsWrap = typeof alliance.getMemberIds === 'function' ? alliance.getMemberIds() : null;
    const list = idsWrap && (idsWrap.l ?? null);
    if (!Array.isArray(list)) return false;

    return true;
  } catch {
    return false;
  }
}

function waitForClientLibReady(timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      try {
        const pk = computePlayerKey();
        if (isClientLibReadyForDashboard() && isAllianceReadyForDashboard() && pk && pk !== 'punknown') {
          resolve(true);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          resolve(false);
          return;
        }
      } catch {
        // ignore
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

(() => {
  if (!runOnce('__ALLIANCE_DASHBOARD_VITE__')) return;

  // If this ever logs, Tampermonkey may not be executing in page context.
  // In that case we switch to explicit page injection.
  if (!getClientLib()) {
    console.warn('[AllianceDashboard] ClientLib not found. Are you on the game page and fully loaded?');
  }

  waitForClientLibReady(30_000).then((ok) => {
    if (!ok) {
      console.warn('[AllianceDashboard] Game not fully ready (player id missing). Initializing anyway.');
    }

    const ctx = createAppContext({ scriptVersion: '0.2.3' });
    installAppContext(ctx);
    mountUi(ctx, undefined, {
      onRefresh: () => {
        try {
          refreshPlayersTs(ctx.store as any);
        } catch {
          // ignore
        }
      }
    });

    let endgameRegistered = false;
    const maybeRegisterEndgame = (): void => {
      try {
        if (endgameRegistered) return;
        const s: any = ctx.store.getState();
        const players: any[] = s?.data && Array.isArray(s.data.players) ? s.data.players : [];
        const hubCount = players.reduce((acc, p) => (p && p.hasHub ? acc + 1 : acc), 0);
        if (hubCount < 32) return;
        endgameRegistered = true;
        import('./tabs/endgame/registerEndgameTab')
          .then((m) => {
            m.registerEndgameTabTs();
          })
          .finally(() => {
            try {
              const cur: any = ctx.store.getState();
              const data = cur?.data || {};
              ctx.store.setState({ data: { ...(data || {}), _renderTick: ((data?._renderTick as number) || 0) + 1 } });
            } catch {
              // ignore
            }
          });
      } catch {
        // ignore
      }
    };

    import('./tabs/diagnostics/registerDiagnosticsTab')
      .then((m) => {
        m.registerDiagnosticsTabTs();
      })
      .then(() => {
        return import('./tabs/notifications/registerNotificationsTab').then((m) => {
          m.registerNotificationsTabTs();
        });
      })
      .then(() => {
        return import('./tabs/players/registerPlayersTab').then((m) => {
          m.registerPlayersTabTs();
        });
      })
      .then(() => {
        return import('./tabs/announces/registerAnnouncesTab').then((m) => {
          m.registerAnnouncesTabTs();
        });
      })
      .then(() => {
        return import('./tabs/teams/registerTeamsTab').then((m) => {
          m.registerTeamsTabTs();
        });
      })
      .then(() => {
        return import('./tabs/targets/registerTargetsTab').then((m) => {
          m.registerTargetsTabTs();
        });
      })
      .then(() => {
        return import('./tabs/sync/registerSyncTab').then((m) => {
          m.registerSyncTabTs();
        });
      })
      .then(() => {
        return import('./tabs/poi/registerPoiTab').then((m) => {
          m.registerPoiTabTs();
        });
      })
      .then(() => {
        return import('./tabs/chatlogs/registerChatLogsTab').then((m) => {
          m.registerChatLogsTabTs();
        });
      })
      .then(() => {
        if (!ok) return;
        try {
          refreshPlayersTs(ctx.store as any);
        } catch {
          // ignore
        }
      });

    try {
      const unsub = ctx.store.subscribe(() => {
        try {
          maybeRegisterEndgame();
        } catch {
          // ignore
        }
      });
      void unsub;
    } catch {
      // ignore
    }

    try {
      maybeRegisterEndgame();
    } catch {
      // ignore
    }
  });
})();
