import { z } from 'zod';
import { canAct, canStepBack } from './permissions';
import { nextStage, prevStage, type Action, type Role, type Stage } from './states';

export type TransitionRequest = { action: Action | 'step_back'; reason?: string; finalText?: string };

export interface Plan {
  dbAction: 'step_completed' | 'returned' | 'approved' | 'rejected' | 'stepped_back';
  to: Stage | null;
  outcome: 'approved' | 'rejected' | null;
  reason: string | null;
  finalText: string | null;
}
export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string; message_hi: string };

const bad = (error: string, message_hi: string): PlanResult => ({ ok: false, error, message_hi });

// Required, validated step_data per completable stage.
export const STEP_SCHEMAS: Partial<Record<Stage, z.ZodTypeAny>> = {
  step1_intake: z.object({ confirmed: z.literal(true), fields: z.record(z.string(), z.string().nullable()).default({}) }).passthrough(),
  step2_field: z.object({ report: z.object({ conclusion: z.string().min(1) }).passthrough() }).passthrough(),
  step3_review: z.object({
    recommendation: z.enum(['approve', 'reject', 'return']),
    note: z.string().min(1),
  }),
};

export function planTransition(
  role: Role, stage: Stage, terminal: boolean, req: TransitionRequest, stepData: unknown,
): PlanResult {
  if (terminal) return bad('terminal', 'यह प्रकरण निर्णीत हो चुका है।');
  const reason = req.reason?.trim() || null;

  if (req.action === 'step_back') {
    if (!canStepBack(role, stage)) return bad('forbidden', 'आप इस चरण से पीछे नहीं जा सकते।');
    return { ok: true, plan: { dbAction: 'stepped_back', to: prevStage(stage), outcome: null, reason, finalText: null } };
  }
  if (!canAct(role, stage, req.action)) return bad('forbidden', 'इस चरण पर यह कार्य आपके लिए अनुमत नहीं है।');

  if (req.action === 'complete') {
    const schema = STEP_SCHEMAS[stage];
    if (schema && !schema.safeParse(stepData).success) return bad('invalid_step', 'चरण की जानकारी अधूरी है।');
    return { ok: true, plan: { dbAction: 'step_completed', to: nextStage(stage), outcome: null, reason: null, finalText: null } };
  }
  if (req.action === 'return') {
    if (!reason) return bad('reason_required', 'वापस भेजने का कारण लिखना आवश्यक है।');
    return { ok: true, plan: { dbAction: 'returned', to: prevStage(stage), outcome: null, reason, finalText: null } };
  }
  const finalText = req.finalText?.trim();
  if (!finalText) return bad('order_required', 'आदेश का पाठ आवश्यक है।');
  if (req.action === 'reject' && !reason) return bad('reason_required', 'अस्वीकृति का कारण आवश्यक है।');
  const approved = req.action === 'approve';
  return {
    ok: true,
    plan: { dbAction: approved ? 'approved' : 'rejected', to: null, outcome: approved ? 'approved' : 'rejected', reason, finalText },
  };
}
