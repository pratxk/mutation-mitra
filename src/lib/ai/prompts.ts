import type { CaseBundle } from '../case';
import { maskIds } from './mask';
import type { AiKind } from './schemas';

export interface Prompt { system: string; user: string }

const json = (v: unknown) => JSON.stringify(v, null, 1);

const factsOf = (b: CaseBundle) => ({
  ref_no: b.app.ref_no, case_type: b.app.case_type, village: b.app.village,
  applicant: b.app.applicant_name, transferor: b.app.transferor_name,
  claimed_gata: b.app.claimed_gata_no, claimed_area_sqm: b.app.claimed_area_sqm,
  record: b.record && { gata: b.record.gata_no, area_sqm: b.record.area_sqm, owner: b.record.owner_name },
});

export function buildPrompt(kind: AiKind, b: CaseBundle, opts: { action?: string } = {}): Prompt {
  switch (kind) {
    case 'extract':
      return {
        system:
          'You assist a revenue officer. Extract only what is written in the document. Return null if not present. For every value provide the exact quote from the text in source_quote. Do not guess. Respond ONLY with JSON: {"fields":{seller_name,buyer_name,gata_no,khata_no,village,area_sqm,sale_date: {value,source_quote,confidence 0-1}},"discrepancies":[{field,deed_value,record_value,note_hi}],"missing_items_hi":[]}. Notes in simple Hindi.',
        user: `DOCUMENT TEXT:\n${maskIds(b.docs.map((d) => d.extracted_text ?? '').join('\n---\n'))}\n\nEXISTING RECORD:\n${json(factsOf(b).record)}`,
      };
    case 'structure-note':
      return {
        system:
          'Reorganise the officer\'s field note. Do not add facts. If something is missing leave it empty and list it in unclear_points_hi. Respond ONLY with JSON: {"possession","boundaries","structures","objections":[],"persons_met":[],"conclusion","unclear_points_hi":[]}. Keep the original language.',
        user: maskIds(String(b.steps.step2_field?.raw_note ?? '')),
      };
    case 'summarize':
      return {
        system:
          'Summarise the case for a Kanungo in simple Hindi, max 120 words. Every risk must cite evidence from the provided data; do not invent. Respond ONLY with JSON: {"summary_hi","risks":[{"title_hi","severity":"high|medium|low","evidence"}],"suggested_next_hi"}.',
        user: json({ facts: factsOf(b), step1: b.steps.step1_intake, rule_flags: b.flags, step2: b.steps.step2_field }),
      };
    case 'draft-order':
      return {
        system:
          'Write only the reasoning and facts paragraph of a mutation order in formal simple Hindi, for the chosen action. No legal boilerplate (added separately). Respond ONLY with JSON: {"text_hi"}.',
        user: json({ action: opts.action ?? 'approve', facts: factsOf(b), step3: b.steps.step3_review, rule_flags: b.flags }),
      };
  }
}
