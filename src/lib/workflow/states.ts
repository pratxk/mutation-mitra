export const ORDER = ['step1_intake', 'step2_field', 'step3_review', 'step4_decision'] as const;
export type Stage = (typeof ORDER)[number];
export type Role = 'lekhpal' | 'kanungo' | 'tehsildar' | 'admin';
export type Action = 'complete' | 'return' | 'approve' | 'reject';

// Role names are config: change here for other states/districts.
export const STEP_OWNER: Record<Stage, Role> = {
  step1_intake: 'lekhpal',
  step2_field: 'lekhpal',
  step3_review: 'kanungo',
  step4_decision: 'tehsildar',
};

export const prevStage = (s: Stage): Stage | null => ORDER[ORDER.indexOf(s) - 1] ?? null;
export const nextStage = (s: Stage): Stage | null => ORDER[ORDER.indexOf(s) + 1] ?? null;
