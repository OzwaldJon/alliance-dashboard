import { getAppContext } from '../../app/global';
import { sendToChat } from '../../services/chat';
import { stopPickMode, updateChatLogAt } from '../../services/pickMode';
import { addPreOrder, deletePreOrder, loadPreOrders, clearChatLogs, removeChatLogAt } from './model';

export function registerChatLogsTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'chatlogs',
    title: 'Chat logs',
    icon: 'mdi:chat-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const headerRow = makeEl('div');
      (headerRow as HTMLElement).style.cssText = 'display:flex;align-items:center;gap:8px;';

      const title = makeEl('div');
      title.textContent = 'Queued orders (not sent)';
      (title as HTMLElement).style.cssText = 'font-weight:800;font-size:13px;flex:1;';

      const clearBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        try {
          clearChatLogs();
        } catch {
          // ignore
        }
      });

      const cancelPickBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      cancelPickBtn.textContent = 'Cancel pick';
      cancelPickBtn.addEventListener('click', () => {
        try {
          stopPickMode({ restoreUi: true, removePendingLog: true });
        } catch {
          // ignore
        }
      });

      const preToggle = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      preToggle.textContent = 'Pre-record order';

      headerRow.appendChild(title);
      headerRow.appendChild(cancelPickBtn);
      headerRow.appendChild(clearBtn);
      headerRow.appendChild(preToggle);
      wrap.appendChild(headerRow);

      const preCard = makeEl('div');
      (preCard as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:10px;';

      const preTitle = makeEl('div');
      preTitle.textContent = 'Pre-recorded orders';
      (preTitle as HTMLElement).style.cssText = 'font-weight:800;font-size:12px;';
      preCard.appendChild(preTitle);

      const preForm = makeEl('div');
      (preForm as HTMLElement).style.cssText = 'display:none;flex-direction:column;gap:8px;';

      const preLabel = makeEl('input', {
        type: 'text',
        placeholder: 'Label (e.g. Move base)',
        id: 'cad-preorder-label'
      }) as HTMLInputElement;
      preLabel.style.cssText =
        'width:100%;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

      const preContent = makeEl('textarea', {
        placeholder: 'Order content (chat line)...',
        id: 'cad-preorder-content'
      }) as HTMLTextAreaElement;
      preContent.style.cssText =
        'width:100%;min-height:70px;resize:vertical;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;line-height:1.35;';

      const preActions = makeEl('div');
      (preActions as HTMLElement).style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

      const preSave = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      preSave.textContent = 'Save pre-record';
      preSave.addEventListener('click', () => {
        try {
          const label = String(preLabel.value || '').trim();
          const content = String(preContent.value || '').trim();
          if (!label || !content) return;
          addPreOrder(label, content);
          preLabel.value = '';
          preContent.value = '';
          (preForm as HTMLElement).style.display = 'none';
          preToggle.textContent = 'Pre-record order';
        } catch {
          // ignore
        }
      });

      preToggle.addEventListener('click', () => {
        try {
          const presetsNow = loadPreOrders();
          const isOpen = (preForm as HTMLElement).style.display !== 'none';
          if (isOpen) {
            (preForm as HTMLElement).style.display = 'none';
            preToggle.textContent = 'Pre-record order';
          } else {
            (preForm as HTMLElement).style.display = 'flex';
            preToggle.textContent = 'Hide pre-record';
          }
          (preCard as HTMLElement).style.display = 'flex';
        } catch {
          // ignore
        }
      });

      const preList = makeEl('div');
      (preList as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

      preActions.appendChild(preSave);
      preForm.appendChild(preLabel);
      preForm.appendChild(preContent);
      preForm.appendChild(preActions);
      preCard.appendChild(preForm);
      preCard.appendChild(preList);
      wrap.appendChild(preCard);

      const list = makeEl('div');
      (list as HTMLElement).style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      wrap.appendChild(list);

      const render = (): void => {
        const s: any = store.getState();
        const logs: any[] = s?.data && Array.isArray(s.data.chatLogs) ? s.data.chatLogs : [];

        try {
          cancelPickBtn.style.display = s?.ui && s.ui.pickActive ? 'inline-flex' : 'none';
        } catch {
          // ignore
        }

        // Pre-recorded orders
        try {
          const presets = loadPreOrders();
          const isFormOpen = (preForm as HTMLElement).style.display !== 'none';

          (preCard as HTMLElement).style.display = presets.length === 0 && !isFormOpen ? 'none' : 'flex';

          (preList as HTMLElement).innerHTML = '';
          presets.forEach((pItem, idx) => {
            const btn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            btn.textContent = pItem.label;
            btn.addEventListener('click', () => {
              sendToChat(pItem.content);
            });

            const del = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
            del.textContent = '×';
            del.style.cssText =
              'border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;';
            del.title = 'Delete';
            del.addEventListener('click', (ev) => {
              try {
                ev.preventDefault();
                ev.stopPropagation();
              } catch {
                // ignore
              }
              deletePreOrder(idx);
            });

            const group = makeEl('div');
            (group as HTMLElement).style.cssText = 'display:inline-flex;gap:6px;align-items:center;';
            group.appendChild(btn);
            group.appendChild(del);
            preList.appendChild(group);
          });
        } catch {
          // ignore
        }

        (list as HTMLElement).innerHTML = '';

        if (!logs.length) {
          const msg = makeEl('div', { class: 'cad-empty', text: 'No orders logged yet.' });
          (msg as HTMLElement).style.cssText =
            'padding:12px;border-radius:12px;background:rgba(0,0,0,.12);color:rgba(233,238,247,.70);font-size:12px;text-align:center;';
          list.appendChild(msg);
          return;
        }

        for (let i = 0; i < logs.length; i++) {
          const entry = logs[i];

          const row = makeEl('div');
          (row as HTMLElement).style.cssText =
            'border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10);border-radius:14px;padding:10px;display:flex;gap:8px;align-items:flex-start;';

          const body = makeEl('div');
          (body as HTMLElement).style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;';

          const ts = makeEl('div');
          (ts as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.55);';
          try {
            ts.textContent = new Date(entry.ts).toLocaleString();
          } catch {
            ts.textContent = '';
          }

          const textArea = makeEl('textarea') as HTMLTextAreaElement;
          textArea.value = String(entry.text || '');
          textArea.style.cssText =
            'width:100%;min-height:64px;resize:vertical;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;line-height:1.35;';
          textArea.addEventListener('change', () => {
            try {
              const idx = i;
              updateChatLogAt(idx, String(textArea.value || ''));
            } catch {
              // ignore
            }
          });

          const actions = makeEl('div');
          (actions as HTMLElement).style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

          const sendBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          sendBtn.textContent = 'Send';
          sendBtn.addEventListener('click', () => {
            sendToChat(textArea.value);
          });

          const copyBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          copyBtn.textContent = 'Copy';
          copyBtn.addEventListener('click', () => {
            try {
              navigator.clipboard.writeText(String(textArea.value || ''));
            } catch {
              // ignore
            }
          });

          const removeBtn = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
          removeBtn.textContent = 'Remove';
          removeBtn.addEventListener('click', () => {
            removeChatLogAt(i);
          });

          actions.appendChild(sendBtn);
          actions.appendChild(copyBtn);
          actions.appendChild(removeBtn);

          body.appendChild(ts);
          body.appendChild(textArea);
          body.appendChild(actions);
          row.appendChild(body);
          list.appendChild(row);
        }
      };

      const unsubscribe = store.subscribe(render);
      render();
      container.addEventListener(
        'ad:cleanup',
        () => {
          try {
            unsubscribe();
          } catch {
            // ignore
          }
        },
        { once: true }
      );

      container.appendChild(wrap);
    }
  });
}
