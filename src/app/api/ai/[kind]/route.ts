import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { aiRateLimited, guardCase } from '@/lib/guard';
import { runAi, KIND_STAGE } from '@/lib/ai/service';
import { KINDS, type AiKind } from '@/lib/ai/schemas';
import { canRequestAi } from '@/lib/workflow/permissions';

const body = z.object({ applicationId: z.string().uuid(), action: z.enum(['approve', 'reject', 'return']).optional() });

export async function POST(req: Request, { params }: { params: { kind: string } }) {
  if (!(KINDS as readonly string[]).includes(params.kind)) return fail(404, 'unknown_kind', 'अज्ञात अनुरोध।');
  const kind = params.kind as AiKind;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_body', 'अमान्य अनुरोध।');
  const g = await guardCase(parsed.data.applicationId);
  if ('err' in g) return g.err;
  const { me, bundle } = g;
  if (bundle.app.outcome || bundle.app.stage !== KIND_STAGE[kind] || !canRequestAi(me.role, bundle.app.stage))
    return fail(403, 'forbidden', 'इस चरण पर AI सहायता उपलब्ध नहीं है।');
  if (aiRateLimited(me.id)) return fail(429, 'rate_limited', 'कृपया थोड़ी देर बाद प्रयास करें।');
  const r = await runAi(kind, parsed.data.applicationId, me, { action: parsed.data.action });
  return r ? ok(r) : fail(404, 'not_found', 'प्रकरण नहीं मिला।');
}
