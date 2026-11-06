import { checkArea } from './area';
import { checkDocuments, REQUIRED_DOCS } from './documents';
import type { Flag } from './flags';
import { checkGata } from './match';
import { checkName } from './names';
import { daysInQueue } from '../priority';

export interface CaseFacts {
  caseType: keyof typeof REQUIRED_DOCS;
  presentDocs: string[];
  claimedGata: string | null;
  claimedArea: number | null;
  transferorName: string;
  deedBuyerName?: string | null;
  applicantName: string;
  record: { gata_no: string; area_sqm: number; owner_name: string } | null;
  submittedAt: string;
  slaDays: number;
}

export function runRules(f: CaseFacts, now = new Date()): Flag[] {
  const flags: Flag[] = checkDocuments(f.caseType, f.presentDocs).flags;
  if (f.record) {
    const add = (x: Flag | null) => x && flags.push(x);
    add(checkGata(f.claimedGata, f.record.gata_no));
    add(checkArea(f.claimedArea, f.record.area_sqm));
    add(checkName(f.transferorName, f.record.owner_name, 'owner_mismatch'));
  }
  if (f.deedBuyerName) {
    const n = checkName(f.applicantName, f.deedBuyerName, 'name_variant');
    if (n) flags.push(n);
  }
  const d = daysInQueue(f.submittedAt, now);
  if (d > f.slaDays) flags.push({ code: 'sla_overdue', severity: 'high', detail: `${d}/${f.slaDays}` });
  return flags;
}
export * from './flags';
