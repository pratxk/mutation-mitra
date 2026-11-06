import { STEP_OWNER, type Action, type Role, type Stage } from './states';

export function canAct(role: Role, stage: Stage, action: Action): boolean {
  if (action === 'complete') return STEP_OWNER[stage] === role && stage !== 'step4_decision';
  if (action === 'return')
    return (role === 'kanungo' && stage === 'step3_review') || (role === 'tehsildar' && stage === 'step4_decision');
  if (action === 'approve' || action === 'reject') return role === 'tehsildar' && stage === 'step4_decision';
  return false;
}

/** Lekhpal's own "go to previous step" (Step 2 -> Step 1), no reason needed. */
export const canStepBack = (role: Role, stage: Stage) => role === 'lekhpal' && stage === 'step2_field';

export const canRequestAi = (role: Role, stage: Stage) => STEP_OWNER[stage] === role;
