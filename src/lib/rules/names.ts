import type { Flag } from './flags';

// Common Devanagari spelling variants -> canonical form.
const VARIANTS: [RegExp, string][] = [
  [/मुहम्मद|मोहम्मद/g, 'मोहम्मद'],
  [/[ंँ]/g, 'न्'],
  [/ऩ|ण/g, 'न'],
  [/श|ष/g, 'स'],
  [/[ी]/g, 'ि'],
  [/[ू]/g, 'ु'],
  [/़/g, ''],
];

export const normName = (s: string) =>
  VARIANTS.reduce((acc, [re, to]) => acc.replace(re, to), s.normalize('NFC').replace(/\s+/g, ' ').trim());

/** Token-set Jaccard similarity on normalised names, order-insensitive. */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(normName(a).split(' '));
  const B = new Set(normName(b).split(' '));
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / new Set([...A, ...B]).size;
}

export function checkName(a: string, b: string, code: 'name_variant' | 'owner_mismatch'): Flag | null {
  const sim = nameSimilarity(a, b);
  if (sim >= 0.85) return null;
  // Totally different owner is high; near-miss spelling is medium.
  return { code, severity: code === 'owner_mismatch' && sim < 0.4 ? 'high' : 'medium', detail: `${a} | ${b} (${sim.toFixed(2)})` };
}
