import { z } from 'zod';
import { currentProfile, fail, ok } from '@/lib/api';
import { admin } from '@/lib/supabase/server';

const body = z.object({ suggestionId: z.string().uuid(), status: z.enum(['accepted', 'edited', 'ignored']) });

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return fail(401, 'unauthenticated', 'कृपया लॉगिन करें।');
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_body', 'अमान्य अनुरोध।');
  const db = admin();
  const { data: s } = await db.from('ai_suggestions').select('id,application_id,stage,status, applications(tehsil)').eq('id', parsed.data.suggestionId).maybeSingle();
  const tehsil = (s as { applications?: { tehsil: string } } | null)?.applications?.tehsil;
  if (!s || tehsil !== me.tehsil) return fail(404, 'not_found', 'सुझाव नहीं मिला।');
  if (s.status !== 'shown') return ok({ status: s.status });
  await db.from('ai_suggestions').update({ status: parsed.data.status, resolved_at: new Date().toISOString() }).eq('id', s.id);
  await db.from('application_events').insert({
    application_id: s.application_id, actor: me.id, actor_role: me.role, action: `ai_${parsed.data.status}`, meta: { suggestionId: s.id },
  });
  return ok({ status: parsed.data.status });
}
