import type { AppContext } from './uiShell';

type AppWindow = Window & {
  __AllianceDashboardApp?: AppContext;
};

export function installAppContext(ctx: AppContext): void {
  try {
    (window as AppWindow).__AllianceDashboardApp = ctx;
  } catch {
    // ignore
  }
}

export function getAppContext(): AppContext {
  const w = window as AppWindow;
  if (!w.__AllianceDashboardApp) {
    throw new Error('AllianceDashboard app context not found on window.__AllianceDashboardApp');
  }
  return w.__AllianceDashboardApp;
}
