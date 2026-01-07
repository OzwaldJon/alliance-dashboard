export function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, any>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((k) => {
      if (k === 'text') el.textContent = String(attrs[k]);
      else if (k === 'html') el.innerHTML = String(attrs[k]);
      else if (k === 'class') (el as any).className = String(attrs[k]);
      else el.setAttribute(k, String(attrs[k]));
    });
  }
  return el;
}
