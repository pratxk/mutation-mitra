import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Profile } from '@/lib/api';
import { LangToggle, LogoutButton } from './HeaderActions';

export async function Header({ me }: { me: Profile }) {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-stone-300 bg-white px-4 py-2">
      <Link href="/" className="font-bold text-emerald-900">{t('app.name')}</Link>
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden sm:inline">{me.name_hi ?? me.name}</span>
        <span className="rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-900">{t(`role.${me.role}`)}</span>
        <LangToggle label={t('common.lang')} />
        <LogoutButton label={t('common.logout')} />
      </div>
    </header>
  );
}
