import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/routing';
import { Header } from '@/components/Header';
import { Stepper } from '@/components/Stepper';
import { Timeline, type EventItem } from '@/components/Timeline';
import { Step1Panel } from '@/components/Step1Panel';
import { Step2Panel } from '@/components/Step2Panel';
import { Step3Panel } from '@/components/Step3Panel';
import { Step4Panel } from '@/components/Step4Panel';
import type { CaseView } from '@/components/types';
import { currentProfile } from '@/lib/api';
import { loadCase } from '@/lib/case';
import { admin } from '@/lib/supabase/server';
import { canStepBack } from '@/lib/workflow/permissions';
import { STEP_OWNER } from '@/lib/workflow/states';

export const dynamic = 'force-dynamic';

export default async function CasePage({ params, searchParams }: { params: { locale: string; id: string }; searchParams: { tab?: string } }) {
  setRequestLocale(params.locale);
  const me = await currentProfile();
  if (!me) return redirect({ href: '/login', locale: params.locale });
  const b = await loadCase(params.id);
  if (!b || b.app.tehsil !== me.tehsil) notFound();
  const t = await getTranslations();

  const done = !!b.app.outcome;
  const view: CaseView = {
    ...b,
    readOnly: done || STEP_OWNER[b.app.stage] !== me.role,
    canStepBack: !done && canStepBack(me.role, b.app.stage),
  };
  const tab = searchParams.tab === 'docs' || searchParams.tab === 'history' ? searchParams.tab : 'work';
  const { data: events } = await admin().from('application_events').select('*, profiles:actor(name,name_hi)')
    .eq('application_id', b.app.id).order('at', { ascending: false }).order('id', { ascending: false });

  const Panel = { step1_intake: Step1Panel, step2_field: Step2Panel, step3_review: Step3Panel, step4_decision: Step4Panel }[b.app.stage];

  return (
    <>
      <Header me={me} />
      <Stepper stage={b.app.stage} done={done} />
      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <div className="card">
          <p className="text-lg font-bold">{b.app.applicant_name}</p>
          <p className="text-sm text-stone-600">{b.app.ref_no} · {b.app.village} · {t(`caseType.${b.app.case_type}`)}</p>
          {done && <p className={`mt-2 font-bold ${b.app.outcome === 'approved' ? 'text-emerald-800' : 'text-red-700'}`}>{t(`outcome.${b.app.outcome}`)}</p>}
          {!done && view.readOnly && <p className="mt-2 text-sm text-amber-800">{t('case.readonly')}</p>}
        </div>

        <nav className="flex gap-2" aria-label="tabs">
          {(['work', 'docs', 'history'] as const).map((k) => (
            <Link key={k} href={{ pathname: `/cases/${b.app.id}`, query: k === 'work' ? {} : { tab: k } }} className={tab === k ? 'btn-primary flex-1' : 'btn-ghost flex-1'}>
              {t(`case.tabs.${k}`)}
            </Link>
          ))}
        </nav>

        {tab === 'work' && <Panel v={view} />}
        {tab === 'docs' && (
          <ul className="space-y-2">
            {b.docs.map((d) => (
              <li key={d.id} className="card"><p className="font-semibold">{t(`doc.${d.doc_type}`)}</p>
                {d.extracted_text && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{d.extracted_text}</p>}</li>
            ))}
          </ul>
        )}
        {tab === 'history' && <Timeline events={(events ?? []) as EventItem[]} />}
      </main>
    </>
  );
}
