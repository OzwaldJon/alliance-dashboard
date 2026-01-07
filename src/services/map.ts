import { getGameApi } from './gameApi';

export function centerMapTo(x: number, y: number): boolean {
  try {
    const api = getGameApi();
    const ClientLib: any = api.ClientLib;
    const visMain = api.visMain;
    if (!visMain) return false;

    try {
      if (
        ClientLib.Vis &&
        ClientLib.Vis.Mode &&
        visMain.get_Mode &&
        visMain.get_Mode() !== ClientLib.Vis.Mode.Region &&
        visMain.set_Mode
      ) {
        visMain.set_Mode(ClientLib.Vis.Mode.Region);
      }
    } catch {
      // ignore
    }

    const region = api.region || (visMain.get_Region && visMain.get_Region());
    if (!region) return false;

    if (typeof region.CenterGridPosition === 'function') {
      region.CenterGridPosition(Number(x), Number(y));
      return true;
    }

    if (
      typeof region.SetPosition === 'function' &&
      typeof region.get_GridWidth === 'function' &&
      typeof region.get_GridHeight === 'function'
    ) {
      region.SetPosition(Number(x) * region.get_GridWidth(), Number(y) * region.get_GridHeight());
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}
