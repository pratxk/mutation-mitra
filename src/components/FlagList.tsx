import { useTranslations } from 'next-intl';

const SEV = { high: 'bg-red-100 text-red-900', medium: 'bg-amber-100 text-amber-900', low: 'bg-stone-200 text-stone-800' } as const;

export function FlagList({ flags }: { flags: { code: string; severity: keyof typeof SEV; detail: string }[] }) {
  const t = useTranslations();
  if (!flags.length) return <p className="text-emerald-800">✔ {t('step1.noFlags')}</p>;
  return (
    <ul className="space-y-2">
      {flags.map((f, i) => (
        <li key={i} className={`rounded-lg px-3 py-2 ${SEV[f.severity]}`}>
          <p className="font-semibold">{t(`flag.${f.code}`)}</p>
          <p className="break-words text-sm">{f.code === 'missing_doc' ? t(`doc.${f.detail}`) : f.detail}</p>
        </li>
      ))}
    </ul>
  );
}
