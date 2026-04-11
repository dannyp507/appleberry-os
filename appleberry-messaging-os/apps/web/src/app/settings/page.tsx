import { PageHeader } from '../../components/blocks/page-header';
import { DashboardShell } from '../../components/layout/dashboard-shell';

export default function SettingsPage() {
  return (
    <DashboardShell title="Settings" eyebrow="Configuration">
      <div className="space-y-6">
        <PageHeader
          title="Workspace Settings"
          description="Manage branding, API keys, sending policies, compliance defaults, and member permissions."
          badge="Admin controls"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {['Branding', 'API Keys', 'Compliance', 'Notifications'].map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
