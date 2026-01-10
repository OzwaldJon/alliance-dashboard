import { getAppContext } from '../../app/global';
import { copyText } from '../diagnostics/model';
import { sendToChat } from '../../services/chat';
import { createItem, updateItem } from '../../services/getBack';
import { buildBulletinV1, GETBACK_BASE_URL, loadGetBackSettings, saveGetBackSettings } from './model';

function normalizeUuid(v: unknown): string {
  return String(v || '').trim();
}

export function registerSyncTabTs(): void {
  const ctx = getAppContext();
  const { registry, store, makeEl } = ctx;

  registry.registerTab({
    id: 'sync',
    title: 'Sync',
    icon: 'mdi:cloud-upload-outline',
    render: (container) => {
      const wrap = makeEl('div', { class: 'cad-details' });
      (wrap as HTMLElement).style.cssText =
        'flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;';

      const card = makeEl('div', { class: 'cad-card' });
      (card as HTMLElement).style.cssText =
        'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;';

      const h = makeEl('h3');
      h.textContent = 'Sync (GetBack)';
      (h as HTMLElement).style.cssText = 'margin:0;font-size:13px;';

      const status = makeEl('div');
      (status as HTMLElement).style.cssText =
        'font-size:11px;font-weight:800;color:rgba(233,238,247,.86);border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.20);padding:6px 10px;border-radius:999px;white-space:nowrap;align-self:flex-start;';
      status.textContent = 'Idle';

      function labeledInput(label: string, placeholder: string, type: string): { row: HTMLElement; input: HTMLInputElement } {
        const row = makeEl('div');
        (row as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

        const lbl = makeEl('div');
        lbl.textContent = label;
        (lbl as HTMLElement).style.cssText = 'min-width:120px;font-size:12px;font-weight:800;color:rgba(233,238,247,.80);';

        const input = makeEl('input', { type, placeholder }) as HTMLInputElement;
        input.style.cssText =
          'flex:1 1 260px;min-width:220px;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#e9eef7;outline:none;font-size:12px;';

        row.appendChild(lbl);
        row.appendChild(input);
        return { row, input };
      }

      const id = labeledInput('Bulletin UUID', '550e8400-e29b-41d4-a716-446655440000', 'text');
      const readP = labeledInput('Read passphrase', '(players need this)', 'password');
      const writeP = labeledInput('Write passphrase', '(leaders only)', 'password');

      function loadIntoForm(): void {
        const s = loadGetBackSettings();
        id.input.value = s.id;
        readP.input.value = s.readPassphrase;
        writeP.input.value = s.writePassphrase;
      }

      function saveFromForm(): void {
        saveGetBackSettings({
          id: id.input.value,
          readPassphrase: readP.input.value,
          writePassphrase: writeP.input.value
        });
      }

      id.input.addEventListener('change', saveFromForm);
      readP.input.addEventListener('change', saveFromForm);
      writeP.input.addEventListener('change', saveFromForm);

      const actions = makeEl('div');
      (actions as HTMLElement).style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';

      const btnCreate = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnCreate.textContent = 'Create new bulletin';

      const btnPublish = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnPublish.textContent = 'Publish (update UUID)';
      btnPublish.style.cssText = 'border:1px solid var(--cad-accent-28);background:var(--cad-accent-10);';

      const btnCopyMsg = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnCopyMsg.textContent = 'Copy chat ADID';

      const btnSendMsg = makeEl('button', { class: 'cad-btn', type: 'button' }) as HTMLButtonElement;
      btnSendMsg.textContent = 'Send ADID to alliance chat';

      actions.appendChild(btnCreate);
      actions.appendChild(btnPublish);
      actions.appendChild(btnCopyMsg);
      actions.appendChild(btnSendMsg);

      const hint = makeEl('div');
      hint.textContent = 'Broadcast format: ADID:<uuid> (do not share passphrases in chat)';
      (hint as HTMLElement).style.cssText = 'font-size:11px;color:rgba(233,238,247,.62);';

      async function withStatus<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
        try {
          status.textContent = label + '…';
        } catch {
          // ignore
        }
        try {
          const out = await fn();
          try {
            status.textContent = 'OK: ' + label;
          } catch {
            // ignore
          }
          return out;
        } catch (e: any) {
          try {
            status.textContent = 'Error: ' + String(e && e.message ? e.message : e);
          } catch {
            // ignore
          }
          return null;
        }
      }

      function getChatMsg(curId: string): string {
        const uuid = normalizeUuid(curId);
        return uuid ? 'ADID:' + uuid : 'ADID:';
      }

      btnCreate.addEventListener('click', async () => {
        await withStatus('Create', async () => {
          const st = loadGetBackSettings();
          const payload = buildBulletinV1();
          const newId = await createItem({
            baseUrl: GETBACK_BASE_URL,
            payload,
            encrypt: { readPassphrase: st.readPassphrase || undefined, writePassphrase: st.writePassphrase || undefined }
          });
          saveGetBackSettings({ id: newId });
          try {
            id.input.value = newId;
          } catch {
            // ignore
          }
          return true;
        });
      });

      btnPublish.addEventListener('click', async () => {
        await withStatus('Publish', async () => {
          const st = loadGetBackSettings();
          const payload = buildBulletinV1();
          await updateItem({
            baseUrl: GETBACK_BASE_URL,
            id: st.id,
            payload,
            encrypt: { readPassphrase: st.readPassphrase || undefined, writePassphrase: st.writePassphrase || undefined }
          });
          return true;
        });
      });

      btnCopyMsg.addEventListener('click', async () => {
        await withStatus('Copy ADID', async () => {
          const st = loadGetBackSettings();
          await copyText(getChatMsg(st.id));
          return true;
        });
      });

      btnSendMsg.addEventListener('click', async () => {
        await withStatus('Send ADID', async () => {
          const st = loadGetBackSettings();
          sendToChat(getChatMsg(st.id));
          return true;
        });
      });

      const unsub = store.subscribe(() => {
        try {
          const st: any = store.getState();
          void st;
        } catch {
          // ignore
        }
      });
      container.addEventListener(
        'ad:cleanup',
        () => {
          try {
            unsub();
          } catch {
            // ignore
          }
        },
        { once: true }
      );

      loadIntoForm();

      card.appendChild(h);
      card.appendChild(status);
      card.appendChild(id.row);
      card.appendChild(readP.row);
      card.appendChild(writeP.row);
      card.appendChild(actions);
      card.appendChild(hint);

      wrap.appendChild(card);
      container.appendChild(wrap);
    }
  });
}
