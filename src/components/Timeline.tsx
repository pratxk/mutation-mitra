import { useFormatter, useTranslations } from 'next-intl';

export interface EventItem {
  id: number; at: string; actor_role: string | null; action: string; reason: string | null;
  meta: { final_text?: string; kind?: string; usedFallback?: boolean } | null; profiles: { name: string; name_hi: string | null } | null;
}

export function Timeline({ events }: { events: EventItem[] }) {
  const t = useTranslations();
  const fmt = useFormatter();
  return (
    <ol className="space-y-3 border-l-2 border-stone-300 pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-emerald-700" />
          <p className="font-semibold">
            {t.has(`timeline.${e.action}`) ? t(`timeline.${e.action}`) : e.action}
            {e.action.startsWith('ai_') && <span className="ml-2 rounded bg-sky-100 px-2 text-xs text-sky-900">AI</span>}
          </p>
          <p className="text-sm text-stone-600">
            {e.profiles ? (e.profiles.name_hi ?? e.profiles.name) : t('timeline.system')}
            {e.actor_role && ` · ${t(`role.${e.actor_role}`)}`} · {fmt.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {e.reason && <p className="mt-1 rounded bg-stone-100 p-2 text-sm">{e.reason}</p>}
          {e.meta?.final_text && <p className="mt-1 whitespace-pre-wrap rounded bg-stone-100 p-2 text-sm">{e.meta.final_text}</p>}
        </li>
      ))}
    </ol>
  );
}
