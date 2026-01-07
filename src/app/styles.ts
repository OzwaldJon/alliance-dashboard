export function addStyle(rootId: string, cssText: string): void {
  try {
    const id = rootId + '-style';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.type = 'text/css';
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = String(cssText);
  } catch {
    // ignore
  }
}

export function injectStyles(rootId: string, fabId: string): void {
  const prefix = '#' + rootId + ' ';
  addStyle(
    rootId,
    `
      #${rootId}{
        --cad-accent:#2cff74;
        --cad-accent-rgb:44,255,116;
        --cad-accent-08:rgba(44,255,116,.08);
        --cad-accent-10:rgba(44,255,116,.10);
        --cad-accent-12:rgba(44,255,116,.12);
        --cad-accent-14:rgba(44,255,116,.14);
        --cad-accent-20:rgba(44,255,116,.20);
        --cad-accent-24:rgba(44,255,116,.24);
        --cad-accent-28:rgba(44,255,116,.28);
        --cad-accent-32:rgba(44,255,116,.32);
        --cad-accent-40:rgba(44,255,116,.40);
        --cad-accent-55:rgba(44,255,116,.55);
        --cad-accent-95:rgba(44,255,116,.95);

        --cad-text:#e9eef7;
        --cad-text-muted:rgba(233,238,247,.66);
        --cad-border:rgba(255,255,255,.08);
        --cad-panel:rgba(14,16,20,.92);
        --cad-card:rgba(255,255,255,.05);
        --cad-card-strong:rgba(0,0,0,.10);
        --cad-btn-bg:rgba(255,255,255,.06);
        --cad-btn-border:rgba(255,255,255,.10);
        --cad-hover:rgba(255,255,255,.10);
      }

      #${rootId}{position:relative; z-index:999999;}
      ${prefix}.cad-fab{position:fixed;right:16px;bottom:16px;z-index:999999;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;cursor:pointer;user-select:none;background:rgba(20,22,26,.92);border:1px solid var(--cad-border);box-shadow:0 12px 30px rgba(0,0,0,.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;color:var(--cad-text);transition:background 120ms ease,border-color 120ms ease}
      ${prefix}.cad-fab:hover{background:rgba(28,31,37,.92);border-color:rgba(255,255,255,.12)}
      ${prefix}.cad-fab .dot{width:10px;height:10px;border-radius:50%;background:var(--cad-accent)}
      ${prefix}.cad-fab .t1{font-weight:700;font-size:13px;letter-spacing:.2px;line-height:1}
      ${prefix}.cad-fab .t2{font-size:11px;color:var(--cad-text-muted);line-height:1}

      ${prefix}.cad-overlay{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.28);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}

      ${prefix}.cad-shell{position:fixed;right:16px;bottom:72px;width:min(980px,calc(100vw - 32px));height:min(640px,calc(100vh - 120px));z-index:999999;border-radius:18px;overflow:hidden;background:var(--cad-panel);border:1px solid var(--cad-border);box-shadow:0 16px 50px rgba(0,0,0,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;color:var(--cad-text);display:flex;flex-direction:column}

      ${prefix}.cad-header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--cad-border)}
      ${prefix}.cad-title{display:flex;flex-direction:column;gap:2px;min-width:0}
      ${prefix}.cad-title .name{font-weight:800;font-size:13px;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      ${prefix}.cad-title .meta{font-size:11px;color:var(--cad-text-muted)}
      ${prefix}.cad-spacer{flex:1}
      ${prefix}.cad-btn{display:inline-flex;gap:6px;align-items:center;justify-content:center;border:1px solid var(--cad-btn-border);background:var(--cad-btn-bg);color:var(--cad-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer}
      ${prefix}.cad-btn:hover{background:var(--cad-hover)}
      ${prefix}.cad-btn:focus{outline:none}
      ${prefix}.cad-btn:focus-visible{outline:none;border-color:var(--cad-accent-55);box-shadow:0 0 0 3px var(--cad-accent-12)}

      ${prefix}.cad-tabs{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--cad-border)}
      ${prefix}.cad-tab{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:8px 10px;border:1px solid var(--cad-border);background:var(--cad-btn-bg);color:var(--cad-text);cursor:pointer;font-size:12px}
      ${prefix}.cad-tab[aria-selected="true"]{background:var(--cad-accent-14);border-color:var(--cad-accent-40);color:var(--cad-text)}
      ${prefix}.cad-tab:focus{outline:none}
      ${prefix}.cad-tab:focus-visible{outline:none;border-color:var(--cad-accent-55);box-shadow:0 0 0 3px var(--cad-accent-12)}

      ${prefix}.cad-content{flex:1;min-height:0;display:flex}
      ${prefix}.cad-split{flex:1;min-height:0;display:grid;grid-template-columns: 360px 1fr}
      ${prefix}.cad-left{min-width:0;border-right:1px solid var(--cad-border);display:flex;flex-direction:column;min-height:0}
      ${prefix}.cad-right{min-width:0;display:flex;flex-direction:column;min-height:0}

      ${prefix}.cad-search{padding:10px 12px;border-bottom:1px solid var(--cad-border)}
      ${prefix}.cad-search input{width:100%;box-sizing:border-box;border-radius:12px;padding:10px 10px;border:1px solid var(--cad-btn-border);background:var(--cad-btn-bg);color:var(--cad-text);outline:none;font-size:12px}
      ${prefix}.cad-search input:focus{border-color:var(--cad-accent-55);box-shadow:0 0 0 3px var(--cad-accent-12)}

      ${prefix} select{color-scheme:dark;background:var(--cad-btn-bg);color:var(--cad-text);border:1px solid var(--cad-btn-border)}
      ${prefix} select:focus{outline:none;border-color:var(--cad-accent-55);box-shadow:0 0 0 3px var(--cad-accent-12)}
      ${prefix} select option{background:var(--cad-panel);color:var(--cad-text)}

      ${prefix}.cad-list{flex:1;min-height:0;overflow:auto;padding:8px}
      ${prefix}.cad-item{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:14px;cursor:pointer;border:1px solid transparent}
      ${prefix}.cad-item:hover{background:var(--cad-hover)}
      ${prefix}.cad-item[aria-selected="true"]{background:var(--cad-accent-12);border-color:var(--cad-accent-24)}
      ${prefix}.cad-avatar{width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,rgba(var(--cad-accent-rgb),.78),rgba(var(--cad-accent-rgb),.70));display:flex;align-items:center;justify-content:center;color:#06110a;font-weight:900;font-size:12px;flex:0 0 auto}
      ${prefix}.cad-item-main{min-width:0;display:flex;flex-direction:column;gap:2px}
      ${prefix}.cad-item-main .p1{font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      ${prefix}.cad-item-main .p2{font-size:11px;color:var(--cad-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      ${prefix}.cad-details{flex:1;min-height:0;overflow:auto;padding:14px}
      ${prefix}.cad-card{border:1px solid var(--cad-border);background:var(--cad-card);border-radius:16px;padding:12px}
      ${prefix}.cad-card h3{margin:0 0 8px 0;font-size:13px}
      ${prefix}.cad-kv{display:grid;grid-template-columns: 140px 1fr;gap:8px 12px;font-size:12px}
      ${prefix}.cad-kv .k{color:var(--cad-text-muted)}
      ${prefix}.cad-empty{height:100%;display:flex;align-items:center;justify-content:center;color:var(--cad-text-muted);font-size:12px;padding:20px;text-align:center}
      ${prefix}.cad-fallback{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px;color:var(--cad-text-muted)}
      ${prefix}.cad-fallback .box{max-width:520px;width:100%;border:1px dashed var(--cad-border);border-radius:16px;padding:14px;background:var(--cad-card)}
      ${prefix}.cad-fallback .h{font-weight:800;font-size:13px;color:var(--cad-text);margin-bottom:6px}
      ${prefix}.cad-fallback .p{font-size:12px;line-height:1.45;color:var(--cad-text-muted)}

      ${prefix}.cad-dbg{font-family:Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;line-height:1.35;color:var(--cad-text)}
      ${prefix}.cad-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid var(--cad-btn-border);background:var(--cad-card-strong);font-size:11px;color:var(--cad-text)}

      @media (max-width: 900px){
        ${prefix}.cad-shell{right:10px;left:10px;width:auto}
        ${prefix}.cad-split{grid-template-columns: 1fr}
        ${prefix}.cad-left{border-right:none;border-bottom:1px solid var(--cad-border);max-height:44%}
      }
    `
  );

  try {
    const host = document.getElementById(rootId);
    if (host) {
      const fab = host.querySelector('#' + fabId) as HTMLElement | null;
      if (fab) fab.style.touchAction = 'none';
    }
  } catch {
    // ignore
  }
}
