export function PageHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {badge ? (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
