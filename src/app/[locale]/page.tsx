import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/Header';
import { CaseCard, type CaseListItem } from '@/components/CaseCard';
import { currentProfile } from '@/lib/api';
import { listCases } from '@/lib/list';

export const dynamic = 'force-dynamic';
type SP = { tab?: string; bucket?: string };

export default async function Dashboard({ params, searchParams }: { params: { locale: string }; searchParams: SP }) {
  setRequestLocale(params.locale);
  const me = await currentProfile();
  if (!me) return redirect({ href: '/login', locale: params.locale });
  const t = await getTranslations();
  const all = (await listCases(me, new URLSearchParams())) as unknown as CaseListItem[];

  const open = all.filter((c) => !c.outcome);
  const mine = open.filter((c) => c.mine);
  const showAll = searchParams.tab === 'all';
  const pool = showAll ? all : mine;
  const rows = pool.filter((c) => !searchParams.bucket || c.bucket === searchParams.bucket);
  const count = (b: string) => pool.filter((c) => !c.outcome && c.bucket === b).length;
  const href = (q: SP) => ({ pathname: '/', query: { ...(q.tab ? { tab: q.tab } : {}), ...(q.bucket ? { bucket: q.bucket } : {}) } });

  return (
    <>
      <Header me={me} />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {(['urgent', 'soon', 'normal'] as const).map((b) => (
            <Link key={b} href={href({ tab: searchParams.tab, bucket: searchParams.bucket === b ? undefined : b })}
              className={`card text-center ${searchParams.bucket === b ? 'ring-2 ring-emerald-700' : ''}`}>
              <p className="text-2xl font-bold">{count(b)}</p>
              <p className="text-sm">{t(`bucket.${b}`)}</p>
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href={href({ bucket: searchParams.bucket })} className={showAll ? 'btn-ghost' : 'btn-primary'}>{t('common.mine')} ({mine.length})</Link>
          <Link href={href({ tab: 'all', bucket: searchParams.bucket })} className={showAll ? 'btn-primary' : 'btn-ghost'}>{t('common.all')} ({all.length})</Link>
        </div>
        {rows.length === 0 && <p className="card text-center text-stone-600">{t('common.empty')}</p>}
        <div className="space-y-3">{rows.map((c) => <CaseCard key={c.id} c={c} />)}</div>
      </main>
    </>
  );
}
