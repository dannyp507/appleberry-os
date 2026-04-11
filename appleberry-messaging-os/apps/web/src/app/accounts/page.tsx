'use client';

import Link from 'next/link';

import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { AccountProfileCard } from '../../components/accounts/account-profile-card';
import { CreateAccountForm } from '../../components/forms/create-account-form';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useWhatsappAccounts } from '../../hooks/use-workspace-data';

export default function AccountsPage() {
  const accountsQuery = useWhatsappAccounts();
  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
  const activeAccounts = accounts.filter((account: any) => account.status === 'ACTIVE').length;
  const averageHealth = accounts.length
    ? Math.round(accounts.reduce((sum: number, account: any) => sum + (account.healthScore ?? 0), 0) / accounts.length)
    : 0;
  const totalDailySends = accounts.reduce((sum: number, account: any) => sum + (account.dailySendCount ?? 0), 0);

  return (
    <DashboardShell title="WhatsApp Profiles" eyebrow="Channel Operations">
      <div className="space-y-6">
        <PageHeader
          title="WhatsApp Profiles"
          description="Manage connected business numbers, monitor health, and jump straight into each profile's sending workspace."
          badge="Profile cards"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [String(activeAccounts), 'Active profiles'],
            [String(totalDailySends), 'Messages sent today'],
            [`${averageHealth}%`, 'Average health'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <CreateAccountForm />
        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-2">
          {accounts.length ? (
            accounts.map((account: any) => <AccountProfileCard key={account.id} account={account} />)
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm lg:col-span-2">
              Create your first WhatsApp profile to start sending, attach chatbot flows, and monitor live health.
            </div>
          )}
        </section>
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Open a profile workspace</h2>
            <span className="text-sm text-slate-400">Diagnostics and actions</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {accounts.length ? (
              accounts.map((account: any) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  {account.name}
                </Link>
              ))
            ) : (
              <span className="text-sm text-slate-500">Create an account to access diagnostics.</span>
            )}
          </div>
        </section>
        <DataTableCard
          title="Connected Accounts"
          columns={['Name', 'Provider', 'Status', 'Health', 'Daily Sends', 'Last Sync']}
          rows={
            accounts.length
              ? accounts.map((account: any) => [
                  account.name,
                  account.providerType,
                  account.status,
                  String(account.healthScore ?? 0),
                  String(account.dailySendCount ?? 0),
                  account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : 'Never',
                ])
              : [['No accounts yet', '-', '-', '-', '-', '-']]
          }
        />
      </div>
    </DashboardShell>
  );
}
