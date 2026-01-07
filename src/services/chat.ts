import { getGameApi } from './gameApi';

function copyText(text: unknown): void {
  try {
    const t = String(text ?? '');
    const nav: any = navigator as any;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      nav.clipboard.writeText(t);
      return;
    }
  } catch {
    // ignore
  }

  try {
    window.prompt('Copy to clipboard:', String(text || ''));
  } catch {
    // ignore
  }
}

export function sendToChat(text: string): boolean {
  try {
    let msg = String(text || '').trim();
    if (!msg) return false;

    if (msg[0] !== '/') {
      msg = '/a ' + msg;
    }

    const chat = getGameApi().chat;

    if (chat) {
      if (typeof chat.AddMsg === 'function') {
        chat.AddMsg(msg);
        return true;
      }
      if (typeof chat.SendMsg === 'function') {
        chat.SendMsg(msg);
        return true;
      }
    }

    try {
      const qxAny: any = (window as any).qx;
      const app = qxAny && qxAny.core && qxAny.core.Init && qxAny.core.Init.getApplication ? qxAny.core.Init.getApplication() : null;
      const qxChat = app && (app.getChat ? app.getChat() : null);
      const widget = qxChat && (qxChat.getChatWidget ? qxChat.getChatWidget() : null);
      if (widget && typeof widget.sendChatMessage === 'function') {
        widget.sendChatMessage(msg);
        return true;
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  try {
    copyText(text);
  } catch {
    // ignore
  }
  return false;
}
