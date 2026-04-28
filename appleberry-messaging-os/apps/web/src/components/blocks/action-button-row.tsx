'use client';

export function ActionButtonRow({
  actions,
}: {
  actions: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: 'default' | 'danger';
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => void action.onClick()}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
            action.variant === 'danger'
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
