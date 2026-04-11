'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';

import { AccountTestSendForm } from '../../../components/forms/account-test-send-form';
import { AccountFlowAssignmentForm } from '../../../components/forms/account-flow-assignment-form';
import { CloudApiConfigForm } from '../../../components/forms/cloud-api-config-form';
import { WhatsappWebConfigForm } from '../../../components/forms/whatsapp-web-config-form';
import { PageHeader } from '../../../components/blocks/page-header';
import { DashboardShell } from '../../../components/layout/dashboard-shell';
import { ActionButtonRow } from '../../../components/blocks/action-button-row';
import { useWhatsappAccountActions, useWhatsappAccountDetail } from '../../../hooks/use-whatsapp-account-detail';

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const detailQuery = useWhatsappAccountDetail(accountId);
  const actionMutation = useWhatsappAccountActions(accountId);

  const account = detailQuery.data;

  const cards = useMemo(
    () =>
      account
        ? [
            ['Status', account.status],
            ['Session', account.sessionStatus],
            ['Health Score', String(account.healthScore ?? 0)],
            ['Daily Sends', String(account.dailySendCount ?? 0)],
            ['Monthly Sends', String(account.monthlySendCount ?? 0)],
            ['Webhook', account.webhookStatus ?? 'Not configured'],
          ]
        : [],
    [account],
  );

  return (
    <DashboardShell title="Account Detail" eyebrow="Diagnostics">
      <div className="space-y-6">
        <PageHeader
          title={account?.name ?? 'Loading account...'}
          description="Inspect provider health, session state, rate limits, and operator actions."
          badge={account?.providerType ?? 'Account'}
        />

        <ActionButtonRow
          actions={[
            { label: 'Pause', onClick: () => actionMutation.mutateAsync({ action: 'pause' }) },
            { label: 'Activate', onClick: () => actionMutation.mutateAsync({ action: 'activate' }) },
            { label: 'Reconnect', onClick: () => actionMutation.mutateAsync({ action: 'reconnect' }) },
            { label: 'Reset Session', onClick: () => actionMutation.mutateAsync({ action: 'reset-session' }) },
            { label: 'Test Send', onClick: () => actionMutation.mutateAsync({ action: 'test-send' }) },
            { label: 'Archive', onClick: () => actionMutation.mutateAsync({ action: 'archive' }), variant: 'danger' },
          ]}
        />

        <section className="grid gap-4 md:grid-cols-3">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Connection Profile</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Phone</dt>
                <dd className="mt-1 text-sm text-slate-700">{account?.phoneNumber ?? 'Pending'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Reconnect Status</dt>
                <dd className="mt-1 text-sm text-slate-700">{account?.reconnectStatus ?? 'Idle'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Last Sync</dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {account?.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Quality Rating</dt>
                <dd className="mt-1 text-sm text-slate-700">{account?.qualityRating ?? 'Unknown'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
            <div className="mt-4 space-y-3">
              {account?.sessions?.length ? (
                account.sessions.map((session: any) => (
                  <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{session.status}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt).toLocaleString() : 'No heartbeat yet'}
                    </p>
                    {session.lastError ? <p className="mt-2 text-xs text-rose-500">{session.lastError}</p> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No sessions recorded yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {account?.providerType === 'CLOUD_API' ? (
              <CloudApiConfigForm accountId={accountId} phoneNumber={account.phoneNumber} />
            ) : (
              <WhatsappWebConfigForm accountId={accountId} />
            )}
            <AccountFlowAssignmentForm
              accountId={accountId}
              assignedFlowId={account?.defaultFlowAssignment?.id}
              chatbotEnabled={account?.chatbotEnabled}
            />
            <AccountTestSendForm accountId={accountId} />
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Provider capabilities</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <dt>QR Login</dt>
                <dd>{account?.capabilities?.supportsQrLogin ? 'Supported' : 'Not supported'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Media</dt>
                <dd>{account?.capabilities?.supportsMedia ? 'Supported' : 'Not supported'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Interactive templates</dt>
                <dd>{account?.capabilities?.supportsInteractiveTemplates ? 'Supported' : 'Not supported'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Groups</dt>
                <dd>{account?.capabilities?.supportsGroups ? 'Supported' : 'Not supported'}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-700">Connection summary</p>
              <p className="mt-2 text-sm text-slate-500">
                Mode: {account?.connectionSummary?.mode ?? 'unknown'}
                <br />
                Configured: {account?.connectionSummary?.configured ? 'Yes' : 'No'}
                <br />
                QR ready: {account?.connectionSummary?.qrReady ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
