import { currentProfile, fail, type Profile } from './api';
import { loadCase, type CaseBundle } from './case';

/** Auth + tehsil scope. Returns profile+case or an error response. */
export async function guardCase(id: string) {
  const me = await currentProfile();
  if (!me) return { err: fail(401, 'unauthenticated', 'कृपया लॉगिन करें।') } as const;
  const bundle = await loadCase(id);
  if (!bundle || bundle.app.tehsil !== me.tehsil) return { err: fail(404, 'not_found', 'प्रकरण नहीं मिला।') } as const;
  return { me: me as Profile, bundle: bundle as CaseBundle } as const;
}

const hits = new Map<string, number[]>();
/** 10 AI calls / minute / user. In-memory: fine for a single-instance demo. */
export function aiRateLimited(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 10;
}
