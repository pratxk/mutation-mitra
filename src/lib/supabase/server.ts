import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Service-role client: bypasses RLS. Server routes only, after permission checks. */
export const admin = () =>
  createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Cookie-bound client for the signed-in user. */
export function userClient() {
  const store = cookies();
  return createServerClient(url(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component; middleware refreshes the session */
        }
      },
    },
  });
}
