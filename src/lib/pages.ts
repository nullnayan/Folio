/**
 * "2, 4, 6-8" -> sorted unique 1-based page numbers within [1, total].
 * Throws if nothing valid was found. Pure — safe to unit test.
 */
export function parsePageSpec(spec: string, total: number): number[] {
  const out = new Set<number>();
  const parts = spec.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      let a = parseInt(range[1], 10);
      let b = parseInt(range[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i);
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n >= 1 && n <= total) out.add(n);
    }
  }
  const sorted = [...out].sort((x, y) => x - y);
  if (sorted.length === 0) throw new Error(`No valid page numbers (PDF has ${total} pages)`);
  return sorted;
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
