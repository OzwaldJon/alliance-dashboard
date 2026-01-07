import { getAppContext } from '../../app/global';

export type PreOrder = {
  id: string;
  label: string;
  content: string;
};

export type ChatLogEntry = {
  ts: number;
  text: string;
};

function normalizeId(v: unknown): string {
  return String(v ?? '').trim();
}

export function normalizePreOrders(value: any): PreOrder[] {
  if (!Array.isArray(value)) return [];
  const out: PreOrder[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = normalizeId((item as any).id) || String(Date.now()) + '_' + Math.random().toString(16).slice(2);
    const label = normalizeId((item as any).label);
    const content = String((item as any).content ?? '').trim();
    if (!label || !content) continue;
    out.push({ id, label, content });
  }
  return out;
}

function bumpTplTick(): void {
  try {
    const ctx = getAppContext();
    const prev: any = ctx.store.getState().data;
    ctx.store.setState({ data: { ...(prev || {}), _tplTick: ((prev?._tplTick as number) || 0) + 1 } });
  } catch {
    // ignore
  }
}

export function loadPreOrders(): PreOrder[] {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'preorders_v1';
  try {
    const raw: any = ctx.storage.load<any>(key, '[]');
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizePreOrders(arr);
  } catch {
    return [];
  }
}

export function savePreOrders(orders: PreOrder[]): void {
  const ctx = getAppContext();
  const key = ctx.storage.LS_PREFIX + 'preorders_v1';
  try {
    ctx.storage.save(key, Array.isArray(orders) ? orders : []);
  } catch {
    // ignore
  }
  bumpTplTick();
}

export function addPreOrder(label: string, content: string): void {
  const l = String(label ?? '').trim();
  const c = String(content ?? '').trim();
  if (!l || !c) return;
  const arr = loadPreOrders();
  arr.push({ id: String(Date.now()) + '_' + Math.random().toString(16).slice(2), label: l, content: c });
  savePreOrders(arr);
}

export function deletePreOrder(index: number): void {
  const arr = loadPreOrders();
  if (index < 0 || index >= arr.length) return;
  arr.splice(index, 1);
  savePreOrders(arr);
}

export function clearChatLogs(): void {
  const ctx = getAppContext();
  const s: any = ctx.store.getState();
  ctx.store.setState({ data: { ...(s?.data ?? {}), chatLogs: [] } });
}

export function removeChatLogAt(index: number): void {
  const ctx = getAppContext();
  const s: any = ctx.store.getState();
  const prev = s?.data;
  const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs.slice() : [];
  if (index < 0 || index >= logs.length) return;
  logs.splice(index, 1);
  ctx.store.setState({ data: { ...(prev ?? {}), chatLogs: logs } });
}
