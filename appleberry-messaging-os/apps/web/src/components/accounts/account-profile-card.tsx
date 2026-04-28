'use client';

import Link from 'next/link';
import { MessageCircleMore, Power, PowerOff, Send, ShieldCheck } from 'lucide-react';

import { useWhatsappAccountActions } from '../../hooks/use-whatsapp-account-detail';

export function AccountProfileCard({ account }: { account: any }) {
  const actions = useWhatsappAccountActions(account.id);
  const isActive = account.status === 'ACTIVE';

  return (
    <article className="overflow-hidden rounded-[30px] border border-sky-200 bg-white shadow-sm">
      <div className="relative bg-[linear-gradient(135deg,#56b5ff_0%,#4e95ff_45%,#6cb8ff_100%)] px-6 pb-6 pt-5 text-white">
        <div className="absolute right-4 top-4 rounded-2xl bg-white/20 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white/85">
          {account.providerType === 'CLOUD_API' ? 'Cloud API' : 'WA Web'}
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-lg font-semibold backdrop-blur">
            {(account.name ?? 'A').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold">{account.name}</h3>
            <p className="mt-1 text-sm text-white/85">{account.phoneNumber || 'Phone not configured'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white px-5 py-4 text-slate-900 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-500">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Sent</span>
            </div>
            <p className="mt-3 text-4xl font-semibold">{account.dailySendCount ?? 0}</p>
            <p className="mt-1 text-sm text-slate-400">Today</p>
          </div>
          <div className="rounded-[24px] bg-white px-5 py-4 text-slate-900 shadow-sm">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Health</span>
            </div>
            <p className="mt-3 text-4xl font-semibold">{account.healthScore ?? 0}</p>
            <p className="mt-1 text-sm text-slate-400">Score</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div className="flex items-center justify-between rounded-[22px] border border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Status</p>
            <p className="text-xs text-slate-400">{isActive ? 'Ready to send and receive' : 'Paused for safe sending'}</p>
          </div>
          <button
            type="button"
            onClick={() => actions.mutate({ action: isActive ? 'pause' : 'activate' })}
            disabled={actions.isPending}
            className={`inline-flex h-8 w-14 items-center rounded-full px-1 transition ${
              isActive ? 'bg-sky-500 justify-end' : 'bg-slate-200 justify-start'
            }`}
          >
            <span className="block h-6 w-6 rounded-full bg-white shadow" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/flows"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <MessageCircleMore className="h-4 w-4" />
            Add item
          </Link>
          <Link
            href={`/accounts/${account.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            {isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            Item list
          </Link>
        </div>
      </div>
    </article>
  );
}
