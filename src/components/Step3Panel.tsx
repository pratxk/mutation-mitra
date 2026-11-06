'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiBadge } from './AiBadge';
import { FlagList } from './FlagList';
import { ReportView } from './Step2Panel';
import { useCaseActions } from './useCaseActions';
import type { AiResult, CaseView } from './types';
import type { SummarizeOutput } from '@/lib/ai/schemas';

const SEV = { high: 'bg-red-100', medium: 'bg-amber-100', low: 'bg-stone-200' } as const;
const ORDER = { high: 0, medium: 1, low: 2 } as const;
type Rec = 'approve' | 'reject' | 'return';

export function Step3Panel({ v }: { v: CaseView }) {
  const t = useTranslations();
  const a = useCaseActions(v.app.id);
  const [ai, setAi] = useState<AiResult<SummarizeOutput> | null>(null);
  const [rec, setRec] = useState<Rec>('approve');
  const [note, setNote] = useState('');

  async function summarize() {
    const r = await a.ai<SummarizeOutput>('summarize');
    if (r.ok && r.data) setAi(r.data);
  }

  async function submit() {
    if (ai) a.resolve(ai.suggestionId, 'accepted');
    if (rec === 'return') return a.transit({ action: 'return', reason: note });
    await a.transit({ action: 'complete' }, () => a.save({ recommendation: rec, note }));
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-2"><h2 className="font-bold">{t('step1.flags')}</h2><FlagList flags={v.flags as never} /></section>
      <ReportView r={(v.steps.step2_field as { report?: never } | undefined)?.report} />
      {!v.readOnly && (
        <>
          <section className="card space-y-3">
            <button className="btn-ghost w-full" disabled={a.busy} onClick={summarize}>✨ {t('step3.suggest')}</button>
            {ai && (
              <>
                <AiBadge fallback={ai.usedFallback} label={t('step1.fallback')} />
                <p className="whitespace-pre-wrap">{ai.output.summary_hi}</p>
                <h3 className="font-semibold">{t('step3.risks')}</h3>
                <ul className="space-y-2">
                  {[...ai.output.risks].sort((x, y) => ORDER[x.severity] - ORDER[y.severity]).map((r, i) => (
                    <li key={i} className={`rounded px-3 py-2 ${SEV[r.severity]}`}><b>{r.title_hi}</b><p className="text-sm">{r.evidence}</p></li>
                  ))}
                </ul>
                <p className="text-sm text-stone-700">{ai.output.suggested_next_hi}</p>
              </>
            )}
          </section>
          <section className="card space-y-3">
            <h2 className="font-bold">{t('step3.recommend')}</h2>
            <div className="grid gap-2">
              {(['approve', 'reject', 'return'] as const).map((r) => (
                <label key={r} className={`flex min-h-[48px] items-center gap-3 rounded-lg border px-3 ${rec === r ? 'border-emerald-700 bg-emerald-50' : 'border-stone-300'}`}>
                  <input type="radio" name="rec" className="h-5 w-5" checked={rec === r} onChange={() => setRec(r)} />{t(`step3.${r}`)}
                </label>
              ))}
            </div>
            <label className="block"><span className="text-sm">{t('step3.note')}</span>
              <textarea className="input min-h-[96px]" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {a.error && <p role="alert" className="text-red-700">{a.error}</p>}
            <button className="btn-primary w-full" disabled={!note.trim() || a.busy} onClick={submit}>{t('step3.submit')}</button>
          </section>
        </>
      )}
    </div>
  );
}
