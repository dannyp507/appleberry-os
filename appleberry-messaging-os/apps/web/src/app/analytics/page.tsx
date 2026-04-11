import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { DashboardShell } from '../../components/layout/dashboard-shell';

export default function AnalyticsPage() {
  return (
    <DashboardShell title="Analytics Center" eyebrow="Performance">
      <div className="space-y-6">
        <PageHeader
          title="Performance Intelligence"
          description="Measure sends, delivery ratios, response rates, inbox workload, and provider health by workspace and time."
          badge="Executive view"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['281,992', '30-day sends'],
            ['97.8%', 'Delivery'],
            ['22.4%', 'Reply rate'],
            ['99.2%', 'Account uptime'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <DataTableCard
          title="KPI Summary"
          columns={['Metric', 'Today', '7 Days', '30 Days']}
          rows={[
            ['Messages Sent', '12,883', '72,420', '281,992'],
            ['Delivery Rate', '98.4%', '98.1%', '97.8%'],
            ['Reply Rate', '24.1%', '23.6%', '22.4%'],
          ]}
        />
      </div>
    </DashboardShell>
  );
}
