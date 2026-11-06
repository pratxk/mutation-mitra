import { admin } from '../supabase/server';
import { loadCase } from '../case';
import { complete } from './llm';
import { buildPrompt } from './prompts';
import { fallbackExtract, fallbackOrder, fallbackStructure, fallbackSummary } from './fallbacks';
import { draftOrderSchema, extractSchema, structureNoteSchema, summarizeSchema, type AiKind, type ExtractOutput } from './schemas';
import type { Stage } from '../workflow/states';

export const KIND_STAGE: Record<AiKind, Stage> = {
  extract: 'step1_intake', 'structure-note': 'step2_field', summarize: 'step3_review', 'draft-order': 'step4_decision',
};
const DB_KIND: Record<AiKind, string> = { extract: 'extract', 'structure-note': 'structure_note', summarize: 'summary', 'draft-order': 'draft_order' };

/** Drop fields whose quote is not in the source; mark them unverified. */
export function groundExtract(out: ExtractOutput, source: string): ExtractOutput {
  const fields = Object.fromEntries(
    Object.entries(out.fields).map(([k, f]) => {
      const ok = f.value === null || (f.source_quote !== null && source.includes(f.source_quote));
      return [k, ok ? f : { value: f.value, source_quote: null, confidence: 0, unverified: true }];
    }),
  );
  return { ...out, fields };
}

export async function runAi(kind: AiKind, applicationId: string, actor: { id: string; role: string }, opts: { action?: string } = {}) {
  const b = await loadCase(applicationId);
  if (!b) return null;
  const t0 = Date.now();
  let output: unknown;
  let usedFallback = false;
  try {
    const p = buildPrompt(kind, b, opts);
    if (kind === 'extract') {
      const src = b.docs.map((d) => d.extracted_text ?? '').join('\n---\n');
      output = groundExtract(await complete({ ...p, schema: extractSchema }), src);
    } else if (kind === 'structure-note') output = await complete({ ...p, schema: structureNoteSchema });
    else if (kind === 'summarize') output = await complete({ ...p, schema: summarizeSchema });
    else output = await complete({ ...p, schema: draftOrderSchema });
  } catch {
    usedFallback = true;
    output = kind === 'extract' ? fallbackExtract(b) : kind === 'structure-note' ? fallbackStructure(b)
      : kind === 'summarize' ? fallbackSummary(b) : fallbackOrder(b, opts.action);
  }
  const latency = Date.now() - t0;
  const db = admin();
  const { data: row, error } = await db.from('ai_suggestions').insert({
    application_id: applicationId, stage: b.app.stage, kind: DB_KIND[kind], output, used_fallback: usedFallback, latency_ms: latency,
  }).select('id').single();
  if (error) throw error;
  await db.from('application_events').insert({
    application_id: applicationId, actor: actor.id, actor_role: actor.role, action: 'ai_suggested',
    meta: { suggestionId: row.id, kind, usedFallback },
  });
  return { suggestionId: row.id as string, output, usedFallback };
}
