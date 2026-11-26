/**
 * A computed CSS length resolved to px against `basis` (the box side a percentage refers to).
 * Browsers serialize a corner such as `calc(25% + 1px)` as a sum of percentage and px terms
 * (the concentric avatar boxes), so the sum is resolved term by term; anything else is a bug.
 */
export function resolveCssLength(value: string, basis: number): number {
  const trimmed = value.trim();
  const body =
    trimmed.startsWith('calc(') && trimmed.endsWith(')') ? trimmed.slice(5, -1) : trimmed;
  const terms = /^\s*([+-]?)\s*(\d*\.?\d+(?:e[+-]?\d+)?)(%|px)?\s*/i;
  let rest = body;
  let total = 0;
  let first = true;
  while (rest.length > 0) {
    const match = terms.exec(rest);
    if (!match || (!first && match[1] === '')) {
      throw new Error(`Unsupported CSS length: ${value}`);
    }
    const magnitude = Number.parseFloat(match[2] ?? '');
    const amount = match[3] === '%' ? (magnitude / 100) * basis : magnitude;
    if (match[3] === undefined && magnitude !== 0) {
      throw new Error(`Unsupported CSS length: ${value}`);
    }
    total += match[1] === '-' ? -amount : amount;
    rest = rest.slice(match[0].length);
    first = false;
  }
  if (first) throw new Error(`Unsupported CSS length: ${value}`);
  return total;
}
