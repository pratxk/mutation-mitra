import type { Flag } from './flags';

export const REQUIRED_DOCS = {
  sale: ['sale_deed', 'khatauni_copy', 'id_proof'],
  inheritance: ['death_cert', 'vanshavali', 'affidavit', 'id_proof'],
} as const;

export function checkDocuments(caseType: keyof typeof REQUIRED_DOCS, present: string[]): { missing: string[]; flags: Flag[] } {
  const missing = REQUIRED_DOCS[caseType].filter((d) => !present.includes(d));
  return { missing, flags: missing.map((d) => ({ code: 'missing_doc', severity: 'high', detail: d })) };
}
