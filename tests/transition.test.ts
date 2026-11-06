import { describe, expect, it } from 'vitest';
import { planTransition } from '@/lib/workflow/transition';
import { groundExtract } from '@/lib/ai/service';
import { complete } from '@/lib/ai/llm';
import { extractSchema } from '@/lib/ai/schemas';
import { maskIds } from '@/lib/ai/mask';

describe('planTransition', () => {
  it('complete needs valid step data', () => {
    expect(planTransition('lekhpal', 'step1_intake', false, { action: 'complete' }, undefined).ok).toBe(false);
    const r = planTransition('lekhpal', 'step1_intake', false, { action: 'complete' }, { confirmed: true, fields: {} });
    expect(r.ok && r.plan.to).toBe('step2_field');
  });
  it('return goes to previous step and needs reason', () => {
    expect(planTransition('kanungo', 'step3_review', false, { action: 'return' }, null).ok).toBe(false);
    const r = planTransition('tehsildar', 'step4_decision', false, { action: 'return', reason: 'x' }, null);
    expect(r.ok && r.plan.to).toBe('step3_review');
  });
  it('lekhpal steps back 2 -> 1 without reason', () => {
    const r = planTransition('lekhpal', 'step2_field', false, { action: 'step_back' }, null);
    expect(r.ok && r.plan.to).toBe('step1_intake');
  });
  it('approve needs order text; reject needs reason too; wrong role refused; terminal refused', () => {
    expect(planTransition('tehsildar', 'step4_decision', false, { action: 'approve' }, null).ok).toBe(false);
    expect(planTransition('tehsildar', 'step4_decision', false, { action: 'reject', finalText: 'o' }, null).ok).toBe(false);
    const ok = planTransition('tehsildar', 'step4_decision', false, { action: 'approve', finalText: 'o' }, null);
    expect(ok.ok && ok.plan.outcome).toBe('approved');
    expect(planTransition('kanungo', 'step4_decision', false, { action: 'approve', finalText: 'o' }, null).ok).toBe(false);
    expect(planTransition('tehsildar', 'step4_decision', true, { action: 'approve', finalText: 'o' }, null).ok).toBe(false);
  });
});

describe('AI contract', () => {
  it('drops fields whose quote is not in the source', () => {
    const out = groundExtract(
      { fields: { gata_no: { value: '12', source_quote: 'गाटा 12', confidence: 0.9 }, area_sqm: { value: '5', source_quote: 'invented', confidence: 0.9 } }, discrepancies: [], missing_items_hi: [] },
      'यह गाटा 12 है',
    );
    expect(out.fields.gata_no.unverified).toBeUndefined();
    expect(out.fields.area_sqm.unverified).toBe(true);
    expect(out.fields.area_sqm.source_quote).toBeNull();
  });
  it('rejects malformed model output via schema', () => {
    expect(extractSchema.safeParse({ fields: 1 }).success).toBe(false);
  });
  it('complete() throws without a key so callers use the fallback', async () => {
    const prev = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = '';
    await expect(complete({ system: 's', user: 'u', schema: extractSchema })).rejects.toThrow();
    process.env.LLM_API_KEY = prev;
  });
  it('masks long id numbers', () => {
    expect(maskIds('आधार 1234 5678 9012 है')).not.toContain('1234 5678');
  });
});
