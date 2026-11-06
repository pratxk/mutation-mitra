'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiBadge } from './AiBadge';
import { FlagList } from './FlagList';
import { useCaseActions } from './useCaseActions';
import { REQUIRED_DOCS } from '@/lib/rules/documents';
import type { AiResult, CaseView } from './types';
import type { ExtractOutput } from '@/lib/ai/schemas';

export function Step1Panel({ v }: { v: CaseView }) {
  const t = useTranslations();
  const a = useCaseActions(v.app.id);
  const [ai, setAi] = useState<AiResult<ExtractOutput> | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const present = v.docs.map((d) => d.doc_type);
  const rec = v.record;

  async function runAi() {
    const r = await a.ai<ExtractOutput>('extract');
    if (!r.ok || !r.data) return;
    setAi(r.data);
    setFields(Object.fromEntries(Object.entries(r.data.output.fields).map(([k, f]) => [k, f.value ?? ''])));
  }

  async function complete() {
    await a.transit({ action: 'complete' }, async () => {
      await a.save({ confirmed: true, fields });
      if (ai) {
        const changed = Object.entries(ai.output.fields).some(([k, f]) => (f.value ?? '') !== (fields[k] ?? ''));
        await a.resolve(ai.suggestionId, changed ? 'edited' : 'accepted');
      }
    });
  }

  const rows: [string, string | number | null, string | number | undefined][] = [
    [t('step1.gata'), v.app.claimed_gata_no, rec?.gata_no],
    [t('step1.area'), v.app.claimed_area_sqm, rec?.area_sqm],
    [t('step1.owner'), v.app.transferor_name, rec?.owner_name],
  ];

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-2 font-bold">{t('step1.checklist')}</h2>
        <ul className="space-y-1">
          {REQUIRED_DOCS[v.app.case_type].map((d) => (
            <li key={d} className={present.includes(d) ? 'text-emerald-800' : 'font-semibold text-red-700'}>
              {present.includes(d) ? '✔' : '✖'} {t(`doc.${d}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-bold">{t('step1.compare')}</h2>
        <table className="w-full text-left text-sm">
          <thead><tr><th /><th>{t('step1.deed')}</th><th>{t('step1.record')}</th></tr></thead>
          <tbody>
            {rows.map(([label, x, y]) => {
              const bad = v.flags.some((f) => (label === t('step1.gata') && f.code === 'gata_mismatch') || (label === t('step1.area') && f.code === 'area_diff') || (label === t('step1.owner') && f.code === 'owner_mismatch'));
              return (
                <tr key={label} className={bad ? 'bg-red-50' : ''}>
                  <th className="py-2 pr-2 font-medium">{label}</th><td className="py-2">{x ?? '—'}</td><td className="py-2">{y ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">{t('step1.flags')}</h2>
        <FlagList flags={v.flags as never} />
      </section>

      {!v.readOnly && (
        <section className="card space-y-3">
          <button className="btn-ghost w-full" onClick={runAi} disabled={a.busy}>✨ {a.busy ? t('step1.aiRunning') : t('step1.ai')}</button>
          {ai && <AiBadge fallback={ai.usedFallback} label={t('step1.fallback')} />}
          {ai && Object.entries(ai.output.fields).map(([k, f]) => (
            <label key={k} className="block">
              <span className="flex items-center gap-2 text-sm font-medium">{k}
                {(f.unverified || f.confidence < 0.6) && <span className="rounded bg-amber-100 px-2 text-xs text-amber-900">{f.unverified ? t('step1.unverified') : t('step1.check')}</span>}
              </span>
              <input className="input" value={fields[k] ?? ''} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
              {f.source_quote && <details className="text-sm text-stone-600"><summary>{t('step1.quote')}</summary><q>{f.source_quote}</q></details>}
            </label>
          ))}
          {ai?.output.discrepancies.map((d, i) => <p key={i} className="rounded bg-red-50 p-2 text-sm">{d.note_hi}</p>)}
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {t('step1.confirm')}
          </label>
          {a.error && <p role="alert" className="text-red-700">{a.error}</p>}
          <button className="btn-primary w-full" disabled={!confirmed || a.busy} onClick={complete}>{t('step1.complete')}</button>
        </section>
      )}
    </div>
  );
}
