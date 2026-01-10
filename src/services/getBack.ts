export type GetBackCreateResponse = { id: string };

export type GetBackEncryption = {
  readPassphrase?: string;
  writePassphrase?: string;
};

function normalizeBaseUrl(baseUrl: string): string {
  const b = String(baseUrl || '').trim();
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

function makeHeaders(opts: { contentType: string; enc?: GetBackEncryption; mode: 'create' | 'read' | 'write' }): Headers {
  const h = new Headers();
  h.set('Content-Type', opts.contentType);

  const rp = opts.enc?.readPassphrase ? String(opts.enc.readPassphrase) : '';
  const wp = opts.enc?.writePassphrase ? String(opts.enc.writePassphrase) : '';

  if (opts.mode === 'create') {
    if ((rp && !wp) || (!rp && wp)) {
      throw new Error('GetBack: both read and write passphrases must be provided for encrypted create');
    }
    if (rp && wp) {
      h.set('X-Read-Passphrase', rp);
      h.set('X-Write-Passphrase', wp);
    }
  }

  if (opts.mode === 'read') {
    if (rp) h.set('X-Read-Passphrase', rp);
  }

  if (opts.mode === 'write') {
    if (wp) h.set('X-Write-Passphrase', wp);
    if ((rp && !wp) || (!rp && wp)) {
      // For write, API supports plaintext updates with no passphrases, or encrypted update with X-Write-Passphrase,
      // or conversion-to-encrypted with both.
      // We only reject the conversion-to-encrypted half-state.
      if (rp && !wp) {
        throw new Error('GetBack: write mode with read passphrase requires write passphrase too');
      }
    }
    if (rp && wp) h.set('X-Read-Passphrase', rp);
  }

  return h;
}

async function readResponseText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export async function createItem(opts: {
  baseUrl: string;
  payload: unknown;
  encrypt?: GetBackEncryption;
}): Promise<string> {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  if (!baseUrl) throw new Error('GetBack: baseUrl is required');

  const res = await fetch(baseUrl + '/', {
    method: 'POST',
    headers: makeHeaders({ contentType: 'application/json', enc: opts.encrypt, mode: 'create' }),
    body: JSON.stringify(opts.payload ?? null)
  });

  if (!res.ok) {
    const t = await readResponseText(res);
    throw new Error('GetBack create failed: ' + res.status + (t ? ' ' + t : ''));
  }

  const data = (await res.json()) as GetBackCreateResponse;
  const id = data && typeof data.id === 'string' ? data.id : '';
  if (!id) throw new Error('GetBack: missing id in create response');
  return id;
}

export async function updateItem(opts: {
  baseUrl: string;
  id: string;
  payload: unknown;
  encrypt?: GetBackEncryption;
}): Promise<void> {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const id = String(opts.id || '').trim();
  if (!baseUrl) throw new Error('GetBack: baseUrl is required');
  if (!id) throw new Error('GetBack: id is required');

  const res = await fetch(baseUrl + '/' + encodeURIComponent(id), {
    method: 'POST',
    headers: makeHeaders({ contentType: 'application/json', enc: opts.encrypt, mode: 'write' }),
    body: JSON.stringify(opts.payload ?? null)
  });

  if (!res.ok) {
    const t = await readResponseText(res);
    throw new Error('GetBack update failed: ' + res.status + (t ? ' ' + t : ''));
  }
}

export async function readItemJson<T>(opts: { baseUrl: string; id: string; encrypt?: GetBackEncryption }): Promise<T> {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const id = String(opts.id || '').trim();
  if (!baseUrl) throw new Error('GetBack: baseUrl is required');
  if (!id) throw new Error('GetBack: id is required');

  const res = await fetch(baseUrl + '/' + encodeURIComponent(id), {
    method: 'GET',
    headers: makeHeaders({ contentType: 'application/json', enc: opts.encrypt, mode: 'read' })
  });

  if (!res.ok) {
    const t = await readResponseText(res);
    throw new Error('GetBack read failed: ' + res.status + (t ? ' ' + t : ''));
  }

  return (await res.json()) as T;
}
