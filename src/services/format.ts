export function formatNumber(v: unknown): string {
  try {
    if (v === null || v === undefined) return '-';
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return '-';
    if (typeof Intl !== 'undefined' && (Intl as any).NumberFormat) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
    }
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch {
    return '-';
  }
}
