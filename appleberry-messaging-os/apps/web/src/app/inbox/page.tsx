import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { DashboardShell } from '../../components/layout/dashboard-shell';

export default function InboxPage() {
  return (
    <DashboardShell title="Inbox" eyebrow="Live Operations">
      <div className="space-y-6">
        <PageHeader
          title="Team Inbox"
          description="Track live conversations, hand off from bot to human, and manage internal notes and assignments."
          badge="Realtime-ready"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['94', 'Open threads'],
            ['18', 'Unassigned'],
            ['6', 'Bot active'],
            ['3m 20s', 'Avg first response'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <DataTableCard
          title="Open Threads"
          columns={['Contact', 'Channel', 'Status', 'Assigned', 'Unread', 'Updated']}
          rows={[
            ['Nandi from Meta Ads', 'Sales ZA', 'Bot Active', 'Bot', '3', '2 min ago'],
            ['Sipho Support', 'Support Desk', 'Open', 'Aphiwe', '1', '7 min ago'],
            ['Lebo Wholesale', 'Sales ZA', 'Pending', 'Lindiwe', '0', '14 min ago'],
          ]}
        />
      </div>
    </DashboardShell>
  );
}
