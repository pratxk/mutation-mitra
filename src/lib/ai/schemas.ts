import { z } from 'zod';

const field = z.object({
  value: z.string().nullable(),
  source_quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  unverified: z.boolean().optional(),
});

export const extractSchema = z.object({
  fields: z.record(z.string(), field),
  discrepancies: z.array(
    z.object({ field: z.string(), deed_value: z.string(), record_value: z.string(), note_hi: z.string() }),
  ),
  missing_items_hi: z.array(z.string()),
});
export type ExtractOutput = z.infer<typeof extractSchema>;

export const structureNoteSchema = z.object({
  possession: z.string(),
  boundaries: z.string(),
  structures: z.string(),
  objections: z.array(z.string()),
  persons_met: z.array(z.string()),
  conclusion: z.string(),
  unclear_points_hi: z.array(z.string()),
});
export type StructureNoteOutput = z.infer<typeof structureNoteSchema>;

export const summarizeSchema = z.object({
  summary_hi: z.string(),
  risks: z.array(
    z.object({ title_hi: z.string(), severity: z.enum(['high', 'medium', 'low']), evidence: z.string() }),
  ),
  suggested_next_hi: z.string(),
});
export type SummarizeOutput = z.infer<typeof summarizeSchema>;

export const draftOrderSchema = z.object({ text_hi: z.string() });
export type DraftOrderOutput = z.infer<typeof draftOrderSchema>;

export const KINDS = ['extract', 'structure-note', 'summarize', 'draft-order'] as const;
export type AiKind = (typeof KINDS)[number];
