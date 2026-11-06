import { ok } from '@/lib/api';
import { guardCase } from '@/lib/guard';
import { admin } from '@/lib/supabase/server';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const g = await guardCase(params.id);
  if ('err' in g) return g.err;
  const db = admin();
  const [{ data: events }, { data: suggestions }] = await Promise.all([
    db.from('application_events').select('*, profiles:actor(name,name_hi)').eq('application_id', params.id).order('at', { ascending: false }),
    db.from('ai_suggestions').select('*').eq('application_id', params.id).order('created_at', { ascending: false }),
  ]);
  return ok({ ...g.bundle, events: events ?? [], suggestions: suggestions ?? [], me: g.me });
}
