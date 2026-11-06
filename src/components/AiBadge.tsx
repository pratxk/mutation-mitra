export function AiBadge({ fallback, label }: { fallback: boolean; label: string }) {
  return fallback ? <p role="status" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">{label}</p> : null;
}
