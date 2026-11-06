'use client';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { post } from './api-client';

export function useCaseActions(caseId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<{ ok: boolean; data?: T; message_hi?: string }>) {
    setBusy(true); setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.message_hi ?? 'error');
    return r;
  }

  return {
    busy, error, setError,
    save: (data: Record<string, unknown>) => post(`/api/cases/${caseId}/save-step`, { data }),
    ai: <T,>(kind: string, extra: object = {}) =>
      run(() => post<{ suggestionId: string; output: T; usedFallback: boolean }>(`/api/ai/${kind}`, { applicationId: caseId, ...extra })),
    resolve: (suggestionId: string, status: 'accepted' | 'edited' | 'ignored') => post('/api/ai/resolve', { suggestionId, status }),
    /** Runs the whole sequence; refreshes the page only if the transition succeeds. */
    transit: async (body: object, before?: () => Promise<unknown>) => {
      const r = await run(async () => { await before?.(); return post(`/api/cases/${caseId}/transition`, body); });
      if (r.ok) router.refresh();
      return r;
    },
  };
}
