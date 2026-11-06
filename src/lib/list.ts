import type { Profile } from './api';
import { admin } from './supabase/server';
import { bucketOf, daysInQueue, priorityScore } from './priority';
import { STEP_OWNER } from './workflow/states';
import { runRules } from './rules';

export async function listCases(me: Profile, q: URLSearchParams) {
  const db = admin();
  let query = db.from('applications').select('*').eq('tehsil', me.tehsil);
  if (q.get('stage')) query = query.eq('stage', q.get('stage')!);
  if (q.get('case_type')) query = query.eq('case_type', q.get('case_type')!);
  const { data, error } = await query;
  if (error) throw error;

  const ids = (data ?? []).map((a) => a.id);
  const { data: steps } = await db.from('step_data').select('application_id,stage,data').in('application_id', ids);
  const { data: docs } = await db.from('documents').select('application_id,doc_type').in('application_id', ids);

  const { data: recs } = await db.from('land_records').select('*').eq('tehsil', me.tehsil);
  const rows = (data ?? []).map((a) => {
    const objection = (steps ?? []).some(
      (s) => s.application_id === a.id && s.stage === 'step2_field' && ((s.data as { report?: { objections?: unknown[] } })?.report?.objections?.length ?? 0) > 0,
    );
    const rec = (recs ?? []).find((r) => r.id === a.land_record_id) ?? null;
    const flags = runRules({
      caseType: a.case_type, presentDocs: (docs ?? []).filter((d) => d.application_id === a.id).map((d) => d.doc_type),
      claimedGata: a.claimed_gata_no, claimedArea: a.claimed_area_sqm, transferorName: a.transferor_name,
      applicantName: a.applicant_name, record: rec, submittedAt: a.submitted_at, slaDays: a.sla_days,
    });
    const highFlags = flags.filter((f) => f.severity === 'high').length;
    const days = daysInQueue(a.submitted_at);
    const score = priorityScore({ submittedAt: a.submitted_at, slaDays: a.sla_days, highFlags, returnCount: a.return_count, objection });
    const overdue = !a.outcome && days > a.sla_days;
    return {
      ...a, flags, days, score, overdue, objection, highFlags,
      docCount: (docs ?? []).filter((d) => d.application_id === a.id).length,
      bucket: a.outcome ? 'normal' : bucketOf(score, overdue),
      mine: !a.outcome && STEP_OWNER[a.stage as keyof typeof STEP_OWNER] === me.role,
    };
  });
  const bucket = q.get('bucket');
  const out = rows.filter((r) => !bucket || r.bucket === bucket).sort((x, y) => y.score - x.score);
  return out;
}
