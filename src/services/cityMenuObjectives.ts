import { loadTeams, saveTeams } from '../tabs/teams/model';
import { getObjectiveMetaFromVisObject, normalizeToTileCoord, type ObjectiveMeta } from './poiMeta';

function removeObjectiveFromAllTeams(x: number, y: number): boolean {
  try {
    const xx = Number(x);
    const yy = Number(y);
    if (!isFinite(xx) || !isFinite(yy)) return false;

    const teams = loadTeams();
    let changed = false;

    for (let ti = 0; ti < teams.length; ti++) {
      const t: any = teams[ti];
      const objs: any[] = t && Array.isArray(t.objectives) ? t.objectives : [];
      if (!objs.length) continue;
      const next = objs.filter((o) => !(Number(o?.x) === Math.floor(xx) && Number(o?.y) === Math.floor(yy)));
      if (next.length !== objs.length) {
        teams[ti] = { ...(t || {}), objectives: next };
        changed = true;
      }
    }

    if (changed) saveTeams(teams);
    return changed;
  } catch {
    return false;
  }
}

function hasObjectiveAt(x: number, y: number): boolean {
  try {
    const xx = Math.floor(Number(x));
    const yy = Math.floor(Number(y));
    if (!isFinite(xx) || !isFinite(yy)) return false;
    const teams = loadTeams();
    for (let ti = 0; ti < teams.length; ti++) {
      const t: any = teams[ti];
      const objs: any[] = t && Array.isArray(t.objectives) ? t.objectives : [];
      for (let oi = 0; oi < objs.length; oi++) {
        const o: any = objs[oi];
        if (Number(o?.x) === xx && Number(o?.y) === yy) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function addObjectiveToTeam(
  teamId: string,
  x: number,
  y: number,
  meta?: ObjectiveMeta
): boolean {
  try {
    const tid = String(teamId || '').trim();
    if (!tid) return false;

    const xx = Number(x);
    const yy = Number(y);
    if (!isFinite(xx) || !isFinite(yy)) return false;

    const teams = loadTeams();
    const idx = teams.findIndex((t) => t && String(t.id) === tid);
    if (idx < 0) return false;

    const t: any = teams[idx];
    const prevObjs = t && Array.isArray(t.objectives) ? t.objectives : [];
    const nextObjs = prevObjs.slice();

    let poiLevel: number | null = null;
    let poiTypeId: number | null = null;
    let objectiveKind: string | undefined = undefined;
    let objectiveLevel: number | null | undefined = undefined;
    try {
      const pl = meta && meta.poiLevel !== undefined ? meta.poiLevel : null;
      const pt = meta && meta.poiTypeId !== undefined ? meta.poiTypeId : null;
      poiLevel = pl !== null && isFinite(Number(pl)) ? Number(pl) : null;
      poiTypeId = pt !== null && isFinite(Number(pt)) ? Number(pt) : null;
      try {
        const k = meta && meta.objectiveKind !== undefined ? String(meta.objectiveKind || '').trim() : '';
        if (k) objectiveKind = k;
      } catch {
        // ignore
      }
      try {
        const lvRaw = meta && meta.objectiveLevel !== undefined ? meta.objectiveLevel : undefined;
        if (lvRaw === undefined || lvRaw === null) {
          objectiveLevel = lvRaw;
        } else {
          const lv = Number(lvRaw);
          objectiveLevel = isFinite(lv) ? lv : null;
        }
      } catch {
        // ignore
      }
    } catch {
      poiLevel = null;
      poiTypeId = null;
      objectiveKind = undefined;
      objectiveLevel = undefined;
    }

    nextObjs.push({
      id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
      x: Math.floor(xx),
      y: Math.floor(yy),
      poiLevel,
      poiTypeId,
      objectiveKind,
      objectiveLevel
    });

    teams[idx] = { ...(t || {}), objectives: nextObjs };
    saveTeams(teams);
    return true;
  } catch {
    return false;
  }
}

function createTeamMenuButton(
  w: any,
  getSelectedBase: () => any
): any /* qx.ui.form.Button | qx.ui.form.MenuButton */ {
  try {
    const qxAny: any = w.qx;
    const canMenu = !!(qxAny?.ui?.menu?.Menu && qxAny?.ui?.menu?.Button && qxAny?.ui?.form?.MenuButton);
    if (!canMenu) throw new Error('qx menu not available');

    const isMenuButtonBroken = (): boolean => {
      try {
        return 'PointerEvent' in window && !qxAny?.bom?.client?.Event?.getMsPointer?.();
      } catch {
        return false;
      }
    };

    const wrap = new qxAny.ui.container.Composite(new qxAny.ui.layout.HBox(6));

    const menu = new qxAny.ui.menu.Menu().set({ position: 'right-top' });
    const addBtn = new qxAny.ui.form.MenuButton().set({ appearance: 'button', menu });
    addBtn.set({ label: 'Add objective \u00BB', paddingLeft: -1, paddingRight: -1 });

    const removeBtn = new qxAny.ui.form.Button('Remove objective');
    removeBtn.setVisibility('excluded');

    wrap.add(addBtn);
    wrap.add(removeBtn);

    try {
      if (isMenuButtonBroken()) {
        addBtn.addListener('pointerdown', (addBtn as any).open, addBtn);
      }
    } catch {
      // ignore
    }

    const rebuild = () => {
      try {
        menu.removeAll();
      } catch {
        // ignore
      }

      const teams = loadTeams();
      if (!teams.length) {
        const none = new qxAny.ui.menu.Button('No teams (create one in Teams tab)');
        none.setEnabled(false);
        menu.add(none);
        return;
      }

      teams.forEach((t: any) => {
        const item = new qxAny.ui.menu.Button(String(t?.name || t?.id || 'Team'));
        item.addListener('execute', () => {
          try {
            const base = getSelectedBase();
            const xy = tryGetSelectedXY(base);
            if (!xy) {
              window.alert('Could not read coordinates for this selection.');
              return;
            }
            const meta = getObjectiveMetaFromVisObject(base, { x: xy.x, y: xy.y });
            addObjectiveToTeam(String(t.id), xy.x, xy.y, meta);
          } catch {
            // ignore
          }
        });
        menu.add(item);
      });
    };

    addBtn.addListener('execute', () => {
      try {
        rebuild();
      } catch {
        // ignore
      }
      try {
        if (typeof (addBtn as any).open === 'function') {
          (addBtn as any).open();
        }
      } catch {
        // ignore
      }
    });

    removeBtn.addListener('execute', () => {
      try {
        const base = getSelectedBase();
        const xy = tryGetSelectedXY(base);
        if (!xy) {
          window.alert('Could not read coordinates for this selection.');
          return;
        }
        removeObjectiveFromAllTeams(xy.x, xy.y);
      } catch {
        // ignore
      }
    });

    (wrap as any).__ad_setObjectiveMode = (mode: 'add' | 'remove') => {
      try {
        if (mode === 'remove') {
          addBtn.setVisibility('excluded');
          removeBtn.setVisibility('visible');
        } else {
          removeBtn.setVisibility('excluded');
          addBtn.setVisibility('visible');
        }
      } catch {
        // ignore
      }
    };

    return wrap;
  } catch {
    // Fallback: plain button (no prompt; user wants in-menu selection).
    const btn = new w.qx.ui.form.Button('Add objective');
    btn.addListener('execute', () => {
      try {
        window.alert('Team menu is not available yet. Please reload the game (qx UI not ready).');
      } catch {
        // ignore
      }
    });
    return btn;
  }
}

// normalizeToTileCoord and POI meta detection are shared in src/services/poiMeta.ts

function tryGetSelectedXY(selectedBase: any): { x: number; y: number } | null {
  try {
    if (!selectedBase) return null;

    let gw: number | null = null;
    let gh: number | null = null;
    try {
      const ClientLib: any = (window as any).ClientLib;
      const visMain = ClientLib?.Vis?.VisMain?.GetInstance?.() ?? null;
      const region = visMain?.get_Region?.() ?? null;
      if (region && typeof region.get_GridWidth === 'function') {
        const v = Number(region.get_GridWidth());
        if (isFinite(v) && v > 0) gw = v;
      }
      if (region && typeof region.get_GridHeight === 'function') {
        const v = Number(region.get_GridHeight());
        if (isFinite(v) && v > 0) gh = v;
      }
    } catch {
      // ignore
    }

    try {
      if (typeof selectedBase.get_X === 'function' && typeof selectedBase.get_Y === 'function') {
        const x = normalizeToTileCoord(selectedBase.get_X(), gw);
        const y = normalizeToTileCoord(selectedBase.get_Y(), gh);
        if (x !== null && y !== null) return { x, y };
      }
    } catch {
      // ignore
    }

    try {
      if (typeof selectedBase.get_CoordX === 'function' && typeof selectedBase.get_CoordY === 'function') {
        const x = normalizeToTileCoord(selectedBase.get_CoordX(), gw);
        const y = normalizeToTileCoord(selectedBase.get_CoordY(), gh);
        if (x !== null && y !== null) return { x, y };
      }
    } catch {
      // ignore
    }

    try {
      if (typeof selectedBase.get_PosX === 'function' && typeof selectedBase.get_PosY === 'function') {
        const x = normalizeToTileCoord(selectedBase.get_PosX(), gw);
        const y = normalizeToTileCoord(selectedBase.get_PosY(), gh);
        if (x !== null && y !== null) return { x, y };
      }
    } catch {
      // ignore
    }

    try {
      if (typeof selectedBase.get_Id === 'function') {
        const cityId = selectedBase.get_Id();
        const ClientLib: any = (window as any).ClientLib;
        const md = ClientLib?.Data?.MainData?.GetInstance?.();
        const city = md?.get_Cities?.()?.GetCity?.(cityId) ?? null;
        if (city && typeof city.get_X === 'function' && typeof city.get_Y === 'function') {
          const x = normalizeToTileCoord(city.get_X(), gw);
          const y = normalizeToTileCoord(city.get_Y(), gh);
          if (x !== null && y !== null) return { x, y };
        }
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  return null;
}

let installed = false;

export function ensureCityMenuObjectivesHook(): void {
  if (installed) return;

  const tryInstall = (): void => {
    try {
      const w: any = window as any;
      const menus: Array<{ name: string; ctor: any }> = [
        { name: 'RegionCityMenu', ctor: w.webfrontend?.gui?.region?.RegionCityMenu },
        { name: 'RegionPointOfInterestMenu', ctor: w.webfrontend?.gui?.region?.RegionPointOfInterestMenu }
      ];

      let hookedAny = false;

      const hookMenu = (MenuCtor: any) => {
        try {
          if (!MenuCtor || !MenuCtor.prototype || typeof MenuCtor.prototype.showMenu !== 'function') return;

          if (!MenuCtor.prototype.__ad_real_showMenu) {
            MenuCtor.prototype.__ad_real_showMenu = MenuCtor.prototype.showMenu;
          }

          if (MenuCtor.prototype.__ad_wrapped_showMenu) {
            hookedAny = true;
            return;
          }
          MenuCtor.prototype.__ad_wrapped_showMenu = true;

          MenuCtor.prototype.showMenu = function (selectedObj: any) {
            try {
              const self: any = this as any;
              self.__ad_selectedBase = selectedObj;

              if (self.__ad_objectives_initialized !== 1) {
                self.__ad_objectives_initialized = 1;
                self.__ad_objective_links = [];

                for (const k in self) {
                  try {
                    if (self[k] && self[k].basename === 'Composite') {
                      const btn = createTeamMenuButton(w, () => self.__ad_selectedBase);
                      self[k].add(btn);
                      self.__ad_objective_links.push(btn);
                    }
                  } catch {
                    // ignore
                  }
                }
              }

              let enable = false;
              let exists = false;
              let xy: { x: number; y: number } | null = null;
              try {
                const ClientLib: any = (window as any).ClientLib;
                const t = selectedObj?.get_VisObjectType?.();
                const VT = ClientLib?.Vis?.VisObject?.EObjectType;
                if (VT) {
                  if (
                    t === VT.RegionCityType ||
                    t === VT.RegionNPCBase ||
                    t === VT.RegionNPCCamp ||
                    t === VT.RegionPointOfInterest
                  ) {
                    enable = true;
                  }
                } else {
                  enable = !!selectedObj;
                }
              } catch {
                enable = !!selectedObj;
              }

              try {
                xy = tryGetSelectedXY(selectedObj);
                if (xy) exists = hasObjectiveAt(xy.x, xy.y);
              } catch {
                // ignore
              }

              try {
                const links: any[] = Array.isArray((this as any).__ad_objective_links) ? (this as any).__ad_objective_links : [];
                for (let i = 0; i < links.length; i++) {
                  try {
                    links[i].setEnabled(enable);
                  } catch {
                    // ignore
                  }
                  try {
                    if (typeof links[i].__ad_setObjectiveMode === 'function') {
                      links[i].__ad_setObjectiveMode(exists ? 'remove' : 'add');
                    }
                  } catch {
                    // ignore
                  }
                }
              } catch {
                // ignore
              }
            } catch {
              // ignore
            }

            return (this as any).__ad_real_showMenu(selectedObj);
          };

          hookedAny = true;
        } catch {
          // ignore
        }
      };

      menus.forEach((m) => hookMenu(m.ctor));

      if (!hookedAny) {
        setTimeout(tryInstall, 1000);
        return;
      }

      installed = true;
    } catch {
      setTimeout(tryInstall, 1000);
    }
  };

  tryInstall();
}
