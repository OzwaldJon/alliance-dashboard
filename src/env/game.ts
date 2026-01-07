export type ClientLibGlobal = unknown;
export type QxGlobal = unknown;

export function getClientLib(): ClientLibGlobal | null {
  const w = window as unknown as { ClientLib?: ClientLibGlobal };
  return w.ClientLib ?? null;
}

export function getQx(): QxGlobal | null {
  const w = window as unknown as { qx?: QxGlobal };
  return w.qx ?? null;
}
