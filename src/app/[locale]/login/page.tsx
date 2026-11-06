'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { browserClient } from '@/lib/supabase/client';

const DEMO = ['lekhpal', 'kanungo', 'tehsildar'] as const;

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(true);
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm p-4 pt-12">
      <h1 className="mb-1 text-2xl font-bold text-emerald-900">{t('app.name')}</h1>
      <p className="mb-6 text-stone-600">{t('app.tagline')}</p>
      <form onSubmit={submit} className="card space-y-3">
        <label className="block">
          <span className="text-sm">{t('login.email')}</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="block">
          <span className="text-sm">{t('login.password')}</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p role="alert" className="text-red-700">{t('login.fail')}</p>}
        <button className="btn-primary w-full" disabled={busy}>{t('login.submit')}</button>
      </form>
      <div className="mt-4">
        <p className="mb-2 text-sm text-stone-600">{t('login.demo')}</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((r) => (
            <button key={r} type="button" className="btn-ghost" onClick={() => { setEmail(`${r}@demo.in`); setPassword('demo1234'); }}>
              {t(`role.${r}`)}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
