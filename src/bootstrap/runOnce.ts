export function runOnce(flag: string): boolean {
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return false;
  w[flag] = true;
  return true;
}
