import { getAppContext } from '../app/global';
import { sendToChat } from './chat';

export type AddChatLogOptions = {
  forceQueue?: boolean;
};

export function addChatLog(text: string, opts?: AddChatLogOptions): void {
  try {
    const ctx = getAppContext();
    const s: any = ctx.store.getState();

    const bypass = !!(s?.ui && s.ui.bypassChatLogs);
    const forceQueue = !!(opts && opts.forceQueue);
    if (bypass && !forceQueue) {
      try {
        sendToChat(String(text || ''));
      } catch {
        // ignore
      }
      return;
    }

    const prev = s?.data;
    const logs = prev && Array.isArray(prev.chatLogs) ? prev.chatLogs.slice() : [];
    logs.push({ ts: Date.now(), text: String(text || '') });
    ctx.store.setState({ data: { ...(prev ?? {}), chatLogs: logs } });
  } catch {
    // ignore
  }
}
