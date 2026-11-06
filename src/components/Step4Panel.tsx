'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiBadge } from './AiBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { FlagList } from './FlagList';
import { ReportView } from './Step2Panel';
import { useCaseActions } from './useCaseActions';
import type { AiResult, CaseView } from './types';
import type { DraftOrderOutput } from '@/lib/ai/schemas';

type Act = 'approve' | 'reject' | 'return';

export function Step4Panel({ v }: { v: CaseView }) {
  const t = useTranslations();
  const a = useCaseActions(v.app.id);
  const k = v.steps.step3_review as { recommendation?: Act; note?: string } | undefined;
  const [ai, setAi] = useState<AiResult<DraftOrderOutput> | null>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Act | null>(null);

  async function draft(action: Act) {
    const r = await a.ai<DraftOrderOutput>('draft-order', { action });
    if (r.ok && r.data) { setAi(r.data); setText(r.data.output.text_hi); }
  }

  async function decide(action: Act) {
    const body = action === 'return' ? { action, reason: reason || text } : { action, reason: reason || undefined, finalText: text };
    await a.transit(body, async () => {
      if (ai) await a.resolve(ai.suggestionId, ai.output.text_hi === text ? 'accepted' : 'edited');
    });
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-2"><h2 className="font-bold">{t('step1.flags')}</h2><FlagList flags={v.flags as never} /></section>
      <ReportView r={(v.steps.step2_field as { report?: never } | undefined)?.report} />
      <section className="card">
        <h2 className="font-bold">{t('step4.kanungo')}</h2>
        {k ? <p>{k.recommendation && t(`step3.${k.recommendation}`)} — {k.note}</p> : <p>—</p>}
      </section>
      {!v.readOnly && (
        <section className="card space-y-3">
          <p className="text-sm text-stone-600">{t('step4.hint')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['approve', 'reject', 'return'] as const).map((x) => (
              <button key={x} className="btn-ghost text-sm" disabled={a.busy} onClick={() => draft(x)}>✨ {t(`step3.${x}`)}</button>
            ))}
          </div>
          {ai && <AiBadge fallback={ai.usedFallback} label={t('step1.fallback')} />}
          <label className="block"><span className="font-medium">{t('step4.draft')}</span>
            <textarea className="input min-h-[180px]" value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label className="block"><span className="text-sm">{t('step4.reason')}</span>
            <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          {a.error && <p role="alert" className="text-red-700">{a.error}</p>}
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-primary" disabled={!text.trim() || a.busy} onClick={() => setPending('approve')}>{t('step3.approve')}</button>
            <button className="btn-danger" disabled={!text.trim() || !reason.trim() || a.busy} onClick={() => setPending('reject')}>{t('step3.reject')}</button>
            <button className="btn-ghost" disabled={!(reason.trim() || text.trim()) || a.busy} onClick={() => setPending('return')}>{t('step3.return')}</button>
          </div>
        </section>
      )}
      {pending && (
        <ConfirmDialog title={`${t('step4.confirmTitle')} — ${t(`step3.${pending}`)}`} text={pending === 'return' ? reason || text : text}
          confirmLabel={t('common.confirm')} cancelLabel={t('common.cancel')} busy={a.busy}
          onCancel={() => setPending(null)} onConfirm={() => decide(pending)} />
      )}
    </div>
  );
}
