import { useTranslations } from 'next-intl';
import { ORDER, type Stage } from '@/lib/workflow/states';

export function Stepper({ stage, done }: { stage: Stage; done: boolean }) {
  const t = useTranslations();
  const cur = ORDER.indexOf(stage);
  return (
    <div className="sticky top-[57px] z-10 border-b border-stone-300 bg-white px-4 py-2">
      <p className="mb-1 text-sm font-semibold">{t('case.step', { n: cur + 1 })}</p>
      <ol className="flex gap-1">
        {ORDER.map((s, i) => (
          <li key={s} className={`flex-1 rounded px-1 py-1 text-center text-xs ${i < cur || done ? 'bg-emerald-100 text-emerald-900' : i === cur ? 'bg-emerald-800 font-bold text-white' : 'bg-stone-200 text-stone-600'}`}>
            {(i < cur || done) && '✓ '}{t(`stage.${s}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}
