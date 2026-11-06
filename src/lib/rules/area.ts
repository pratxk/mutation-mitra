import type { Flag } from './flags';

export function checkArea(claimed: number | null, record: number): Flag | null {
  if (claimed == null || !record) return null;
  const diff = Math.abs(claimed - record) / record;
  if (diff > 0.1) return { code: 'area_diff', severity: 'high', detail: `${claimed} vs ${record}` };
  if (diff > 0.02) return { code: 'area_diff', severity: 'medium', detail: `${claimed} vs ${record}` };
  return null;
}
