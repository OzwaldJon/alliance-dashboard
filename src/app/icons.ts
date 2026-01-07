import mdi from '@iconify-json/mdi/icons.json';

type IconifyIcon = {
  body: string;
  width?: number;
  height?: number;
};

type IconifyCollection = {
  prefix?: string;
  icons?: Record<string, IconifyIcon>;
};

function getMdiIcon(name: string): IconifyIcon | null {
  try {
    const data = mdi as unknown as IconifyCollection;
    const icons = data && data.icons ? data.icons : null;
    if (!icons) return null;

    const raw = String(name || '').trim();
    if (!raw) return null;

    const parts = raw.split(':');
    const iconName = parts.length === 2 ? parts[1] : parts[0];
    if (!iconName) return null;

    const icon = icons[iconName];
    return icon ? icon : null;
  } catch {
    return null;
  }
}

export function makeTabIcon(icon: string, sizePx: number = 16): HTMLElement | null {
  try {
    const raw = String(icon || '').trim();
    if (!raw) return null;

    const parts = raw.split(':');
    const prefix = parts.length === 2 ? parts[0] : 'mdi';
    if (prefix !== 'mdi') return null;

    const ico = getMdiIcon(raw);
    if (!ico) return null;

    const w = ico.width && isFinite(Number(ico.width)) ? Number(ico.width) : 24;
    const h = ico.height && isFinite(Number(ico.height)) ? Number(ico.height) : 24;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + String(w) + ' ' + String(h));
    svg.setAttribute('width', String(sizePx));
    svg.setAttribute('height', String(sizePx));
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('fill', 'currentColor');
    g.innerHTML = ico.body;
    svg.appendChild(g);

    const wrap = document.createElement('span');
    wrap.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;width:' +
      String(sizePx) +
      'px;height:' +
      String(sizePx) +
      'px;opacity:.92;flex:0 0 auto;';
    wrap.appendChild(svg);

    return wrap;
  } catch {
    return null;
  }
}
