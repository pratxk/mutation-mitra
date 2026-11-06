import { admin } from './supabase/server';
import { runRules, type Flag } from './rules';
import type { Stage } from './workflow/states';

export interface CaseRow {
  id: string; ref_no: string; case_type: 'sale' | 'inheritance'; tehsil: string; village: string;
  applicant_name: string; transferor_name: string; land_record_id: string | null;
  claimed_gata_no: string | null; claimed_area_sqm: number | null;
  stage: Stage; outcome: 'approved' | 'rejected' | null; return_count: number;
  submitted_at: string; sla_days: number; decided_at: string | null;
}
export interface DocRow { id: string; doc_type: string; file_path: string | null; extracted_text: string | null }
export interface RecordRow { id: string; village: string; khata_no: string; gata_no: string; area_sqm: number; owner_name: string }
export type StepMap = Partial<Record<Stage, Record<string, unknown>>>;

export interface CaseBundle {
  app: CaseRow; docs: DocRow[]; record: RecordRow | null; steps: StepMap; flags: Flag[];
}

export async function loadCase(id: string): Promise<CaseBundle | null> {
  const db = admin();
  const { data: app } = await db.from('applications').select('*').eq('id', id).maybeSingle();
  if (!app) return null;
  const [{ data: docs }, { data: rec }, { data: steps }] = await Promise.all([
    db.from('documents').select('*').eq('application_id', id),
    app.land_record_id
      ? db.from('land_records').select('*').eq('id', app.land_record_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('step_data').select('stage,data').eq('application_id', id),
  ]);
  const stepMap: StepMap = {};
  (steps ?? []).forEach((s) => { stepMap[s.stage as Stage] = s.data as Record<string, unknown>; });
  const confirmed = (stepMap.step1_intake?.fields ?? {}) as Record<string, string | undefined>;
  const flags = runRules({
    caseType: app.case_type,
    presentDocs: (docs ?? []).map((d) => d.doc_type),
    claimedGata: app.claimed_gata_no,
    claimedArea: app.claimed_area_sqm,
    transferorName: app.transferor_name,
    applicantName: app.applicant_name,
    deedBuyerName: confirmed.buyer_name ?? null,
    record: rec ?? null,
    submittedAt: app.submitted_at,
    slaDays: app.sla_days,
  });
  return { app: app as CaseRow, docs: (docs ?? []) as DocRow[], record: (rec ?? null) as RecordRow | null, steps: stepMap, flags };
}
