import type { Flag } from '@/lib/rules';
import type { CaseRow, DocRow, RecordRow, StepMap } from '@/lib/case';

export interface CaseView {
  app: CaseRow; docs: DocRow[]; record: RecordRow | null; steps: StepMap; flags: Flag[];
  readOnly: boolean; canStepBack: boolean;
}
export interface AiResult<T> { suggestionId: string; output: T; usedFallback: boolean }
