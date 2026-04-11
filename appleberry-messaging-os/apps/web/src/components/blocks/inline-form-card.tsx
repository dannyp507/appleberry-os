'use client';

import { PropsWithChildren } from 'react';

export function InlineFormCard({
  title,
  description,
  children,
}: PropsWithChildren<{
  title: string;
  description: string;
}>) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
