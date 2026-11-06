import { currentProfile, fail, ok } from '@/lib/api';
import { listCases } from '@/lib/list';

export async function GET(req: Request) {
  const me = await currentProfile();
  if (!me) return fail(401, 'unauthenticated', 'कृपया लॉगिन करें।');
  try {
    return ok(await listCases(me, new URL(req.url).searchParams));
  } catch {
    return fail(500, 'list_failed', 'सूची लोड नहीं हो सकी।');
  }
}
