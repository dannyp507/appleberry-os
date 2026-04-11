'use client';

import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { CreateCampaignForm } from '../../components/forms/create-campaign-form';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useCampaigns } from '../../hooks/use-workspace-data';

export default function CampaignsPage() {
  const campaignsQuery = useCampaigns();
  const campaigns = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];

  return (
    <DashboardShell title="Campaign Manager" eyebrow="Growth Engine">
      <div className="space-y-6">
        <PageHeader
          title="Campaign Control Center"
          description="Schedule broadcasts, control throughput, rotate accounts, and track delivery performance."
          badge="Bulk sending"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['8', 'Running'],
            ['3', 'Scheduled'],
            ['41', 'Failed today'],
            ['98.4%', 'Delivery rate'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <CreateCampaignForm />
        <DataTableCard
          title="Recent Campaigns"
          columns={['Campaign', 'Status', 'Audience', 'Account Mode', 'Sent', 'Failures']}
          rows={
            campaigns.length
              ? campaigns.map((campaign: any) => [
                  campaign.name,
                  campaign.status,
                  String(campaign._count?.recipients ?? 0),
                  campaign.accountRotation ? 'Rotation' : 'Pinned',
                  String(campaign._count?.events ?? 0),
                  campaign.status === 'FAILED' ? '1+' : '0',
                ])
              : [['No campaigns yet', '-', '-', '-', '-', '-']]
          }
        />
      </div>
    </DashboardShell>
  );
}
