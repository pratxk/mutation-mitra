'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { get, set, del } from 'idb-keyval';
import { AiBadge } from './AiBadge';
import { VoiceButton } from './VoiceButton';
import { useCaseActions } from './useCaseActions';
import type { AiResult, CaseView } from './types';
import type { StructureNoteOutput } from '@/lib/ai/schemas';

const EMPTY: StructureNoteOutput = { possession: '', boundaries: '', structures: '', objections: [], persons_met: [], conclusion: '', unclear_points_hi: [] };
type Report = StructureNoteOutput;

export function Step2Panel({ v }: { v: CaseView }) {
  const t = useTranslations();
  const a = useCaseActions(v.app.id);
  const draftKey = `note:${v.app.id}`;
  const saved = v.steps.step2_field as { raw_note?: string; report?: Report } | undefined;
  const [note, setNote] = useState(saved?.raw_note ?? '');
  const [report, setReport] = useState<Report | null>(saved?.report ?? null);
  const [ai, setAi] = useState<AiResult<Report> | null>(null);
  const [status, setStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const dirty = useRef(false);

  // Restore an unsent local draft (bad network earlier) if it is newer than the server copy.
  useEffect(() => { get<string>(draftKey).then((d) => { if (d && d !== saved?.raw_note) { setNote(d); dirty.current = true; } }).catch(() => {}); }, []); // eslint-disable-line

  // Autosave: local immediately, server debounced.
  useEffect(() => {
    if (!dirty.current || v.readOnly) return;
    set(draftKey, note).catch(() => {});
    setStatus('saving');
    const h = setTimeout(async () => {
      const r = await a.save({ raw_note: note, report });
      if (r.ok) { setStatus('saved'); del(draftKey).catch(() => {}); } else setStatus('offline');
    }, 800);
    return () => clearTimeout(h);
  }, [note]); // eslint-disable-line

  const edit = (x: string) => { dirty.current = true; setNote(x); };
  const patch = (p: Partial<Report>) => setReport({ ...(report ?? EMPTY), ...p });
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  async function structure() {
    await a.save({ raw_note: note, report });
    const r = await a.ai<Report>('structure-note');
    if (r.ok && r.data) { setAi(r.data); setReport(r.data.output); }
  }

  async function complete() {
    await a.transit({ action: 'complete' }, async () => {
      await a.save({ raw_note: note, report });
      if (ai) await a.resolve(ai.suggestionId, JSON.stringify(ai.output) === JSON.stringify(report) ? 'accepted' : 'edited');
      del(draftKey).catch(() => {});
    });
  }

  if (v.readOnly) return <ReportView r={saved?.report} />;
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <VoiceButton onText={(x) => edit(`${note}${note ? ' ' : ''}${x}`)} />
        <label className="block">
          <span className="font-medium">{t('step2.note')}</span>
          <textarea className="input min-h-[160px]" value={note} onChange={(e) => edit(e.target.value)} />
        </label>
        <p role="status" className="text-sm text-stone-600">
          {status === 'saved' ? `✔ ${t('common.saved')}` : status === 'saving' ? t('common.saving') : t('common.offlineDraft')}
        </p>
        <button className="btn-ghost w-full" disabled={!note.trim() || a.busy} onClick={structure}>✨ {t('step2.structure')}</button>
        {ai && <AiBadge fallback={ai.usedFallback} label={t('step1.fallback')} />}
      </section>

      {report && (
        <section className="card space-y-3">
          {([['possession'], ['boundaries'], ['structures'], ['conclusion']] as const).map(([k]) => (
            <label key={k} className="block"><span className="text-sm font-medium">{t(`step2.${k}`)}</span>
              <textarea className="input" value={report[k]} onChange={(e) => patch({ [k]: e.target.value })} /></label>
          ))}
          <label className="block"><span className="text-sm font-medium">{t('step2.persons')}</span>
            <textarea className="input" value={report.persons_met.join('\n')} onChange={(e) => patch({ persons_met: lines(e.target.value) })} /></label>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6" checked={report.objections.length > 0}
              onChange={(e) => patch({ objections: e.target.checked ? [report.objections[0] ?? '—'] : [] })} />
            {t('step2.objectionToggle')}
          </label>
          {report.objections.length > 0 && (
            <textarea className="input" aria-label={t('step2.objections')} value={report.objections.join('\n')} onChange={(e) => patch({ objections: lines(e.target.value) })} />
          )}
          {report.unclear_points_hi.length > 0 && (
            <div className="rounded bg-amber-50 p-2 text-sm"><b>{t('step2.unclear')}</b><ul className="list-disc pl-5">{report.unclear_points_hi.map((u, i) => <li key={i}>{u}</li>)}</ul></div>
          )}
        </section>
      )}

      {a.error && <p role="alert" className="text-red-700">{a.error}</p>}
      <div className="flex gap-2">
        {v.canStepBack && <button className="btn-ghost flex-1" disabled={a.busy} onClick={() => a.transit({ action: 'step_back' })}>{t('step2.back')}</button>}
        <button className="btn-primary flex-1" disabled={!report?.conclusion.trim() || a.busy} onClick={complete}>{t('step2.complete')}</button>
      </div>
    </div>
  );
}

export function ReportView({ r }: { r?: Report }) {
  const t = useTranslations('step2');
  if (!r) return null;
  return (
    <section className="card space-y-2 text-sm">
      {(['possession', 'boundaries', 'structures', 'conclusion'] as const).map((k) => <p key={k}><b>{t(k)}:</b> {r[k] || '—'}</p>)}
      <p><b>{t('persons')}:</b> {r.persons_met?.join(', ') || '—'}</p>
      <p className={r.objections?.length ? 'font-semibold text-red-700' : ''}><b>{t('objections')}:</b> {r.objections?.join('; ') || '—'}</p>
    </section>
  );
}
