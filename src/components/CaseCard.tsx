import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export interface CaseListItem {
  id: string; ref_no: string; case_type: string; village: string; applicant_name: string; stage: string;
  outcome: string | null; days: number; sla_days: number; overdue: boolean; return_count: number;
  bucket: 'urgent' | 'soon' | 'normal'; flags: { code: string; severity: string }[]; mine: boolean;
}

const TONE = { urgent: 'border-l-red-600', soon: 'border-l-amber-500', normal: 'border-l-emerald-600' } as const;

export async function CaseCard({ c }: { c: CaseListItem }) {
  const t = await getTranslations();
  return (
    <Link href={`/cases/${c.id}`} className={`card block border-l-8 ${TONE[c.bucket]} active:bg-stone-50`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{c.applicant_name}</p>
          <p className="text-sm text-stone-600">{c.ref_no} · {c.village} · {t(`caseType.${c.case_type}`)}</p>
        </div>
        <span className="shrink-0 rounded bg-stone-200 px-2 py-1 text-xs font-semibold">
          {c.outcome ? t(`outcome.${c.outcome}`) : t(`stage.${c.stage}`)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className={c.overdue ? 'font-bold text-red-700' : ''}>{c.days} / {c.sla_days} {t('common.days')}</span>
        {c.overdue && <span className="rounded bg-red-100 px-2 text-red-800">{t('case.overdue')}</span>}
        {c.return_count > 0 && <span className="rounded bg-amber-100 px-2 text-amber-900">{t('case.returned', { n: c.return_count })}</span>}
        {c.flags.filter((f) => f.severity === 'high').length > 0 && <span aria-hidden>⚠ {c.flags.filter((f) => f.severity === 'high').length}</span>}
      </div>
    </Link>
  );
}
