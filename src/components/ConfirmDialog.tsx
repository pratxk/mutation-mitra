'use client';
export function ConfirmDialog({ title, text, confirmLabel, cancelLabel, onConfirm, onCancel, busy }: {
  title: string; text: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-30 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full overflow-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl">
        <h2 className="mb-2 text-lg font-bold">{title}</h2>
        <p className="mb-4 whitespace-pre-wrap rounded bg-stone-100 p-3">{text}</p>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-primary flex-1" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
