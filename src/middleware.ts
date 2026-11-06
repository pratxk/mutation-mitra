import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

export async function middleware(req: NextRequest) {
  const res = intl(req);
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser(); // refreshes session cookies
  const m = req.nextUrl.pathname.match(/^\/(hi|en)(\/.*)?$/);
  const locale = m?.[1] ?? routing.defaultLocale;
  const isLogin = req.nextUrl.pathname.endsWith('/login');
  if (!data.user && !isLogin) return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  if (data.user && isLogin) return NextResponse.redirect(new URL(`/${locale}`, req.url));
  return res;
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
