import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { guardCase } from '@/lib/guard';
import { admin } from '@/lib/supabase/server';
import { planTransition } from '@/lib/workflow/transition';

const body = z.object({
  action: z.enum(['complete', 'return', 'approve', 'reject', 'step_back']),
  reason: z.string().max(2000).optional(),
  finalText: z.string().max(10000).optional(),
});

const MSG: Record<string, string> = {
  stale_stage: 'प्रकरण का चरण बदल चुका है, पृष्ठ ताज़ा करें।',
  terminal: 'यह प्रकरण निर्णीत हो चुका है।',
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardCase(params.id);
  if ('err' in g) return g.err;
  const { me, bundle } = g;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_body', 'अमान्य अनुरोध।');

  const stage = bundle.app.stage;
  const plan = planTransition(me.role, stage, !!bundle.app.outcome, parsed.data, bundle.steps[stage]);
  if (!plan.ok) return fail(plan.error === 'forbidden' ? 403 : 422, plan.error, plan.message_hi);

  const p = plan.plan;
  const { error } = await admin().rpc('apply_transition', {
    p_app: params.id, p_actor: me.id, p_role: me.role, p_action: p.dbAction,
    p_expected: stage, p_to: p.to, p_outcome: p.outcome, p_reason: p.reason, p_final: p.finalText,
  });
  if (error) {
    const key = Object.keys(MSG).find((k) => error.message.includes(k));
    return fail(key ? 409 : 500, key ?? error.message, key ? MSG[key] : 'कार्य पूर्ण नहीं हो सका।');
  }
  return ok({ stage: p.to ?? stage, outcome: p.outcome });
}
