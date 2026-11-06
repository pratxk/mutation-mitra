export type Bucket = 'urgent' | 'soon' | 'normal';

export interface PriorityInput {
  submittedAt: string | Date;
  slaDays: number;
  highFlags: number;
  returnCount: number;
  objection: boolean;
  now?: Date;
}

export const daysInQueue = (submittedAt: string | Date, now = new Date()) =>
  Math.max(0, Math.floor((now.getTime() - new Date(submittedAt).getTime()) / 86_400_000));

export function priorityScore(i: PriorityInput): number {
  const d = daysInQueue(i.submittedAt, i.now);
  return 100 * (d / i.slaDays) + 15 * i.highFlags + 5 * i.returnCount + (i.objection ? 10 : 0);
}

export function bucketOf(score: number, overdue: boolean): Bucket {
  if (overdue || score >= 100) return 'urgent';
  return score >= 60 ? 'soon' : 'normal';
}
