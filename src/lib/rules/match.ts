import type { Flag } from './flags';
import { normGata } from './normalize';

export function checkGata(claimed: string | null, record: string): Flag | null {
  if (!claimed) return { code: 'gata_mismatch', severity: 'high', detail: `claimed:none record:${record}` };
  return normGata(claimed) === normGata(record)
    ? null
    : { code: 'gata_mismatch', severity: 'high', detail: `claimed:${claimed} record:${record}` };
}
