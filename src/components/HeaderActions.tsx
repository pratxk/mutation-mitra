'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { browserClient } from '@/lib/supabase/client';

export function LangToggle({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <button className="min-h-[48px] px-2 underline" onClick={() => router.replace(pathname, { locale: locale === 'hi' ? 'en' : 'hi' })}>
      {label}
    </button>
  );
}

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      className="min-h-[48px] px-2 underline"
      onClick={async () => { await browserClient().auth.signOut(); router.replace('/login'); router.refresh(); }}
    >
      {label}
    </button>
  );
}
