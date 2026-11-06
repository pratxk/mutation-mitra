import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { guardCase } from '@/lib/guard';
import { admin } from '@/lib/supabase/server';
import { STEP_OWNER } from '@/lib/workflow/states';

const body = z.object({ data: z.record(z.string(), z.unknown()) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardCase(params.id);
  if ('err' in g) return g.err;
  const { me, bundle } = g;
  if (bundle.app.outcome || STEP_OWNER[bundle.app.stage] !== me.role)
    return fail(403, 'forbidden', 'इस चरण को सहेजने की अनुमति नहीं है।');
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_body', 'अमान्य डेटा।');
  const { error } = await admin().from('step_data').upsert(
    { application_id: params.id, stage: bundle.app.stage, data: parsed.data.data, saved_by: me.id, saved_at: new Date().toISOString() },
    { onConflict: 'application_id,stage' },
  );
  return error ? fail(500, error.message, 'सहेजा नहीं जा सका।') : ok({ saved: true });
}
