'use client';

import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { CreateTemplateForm } from '../../components/forms/create-template-form';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useTemplates } from '../../hooks/use-workspace-data';

export default function TemplatesPage() {
  const templatesQuery = useTemplates();
  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  return (
    <DashboardShell title="Template Manager" eyebrow="Reusable Content">
      <div className="space-y-6">
        <PageHeader
          title="Interactive Templates"
          description="Manage reusable text, media, button, and list templates with provider compatibility awareness."
          badge="Draft and publish"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['24', 'Published templates'],
            ['6', 'Drafts'],
            ['555', 'Total uses this week'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <CreateTemplateForm />
        <DataTableCard
          title="Library"
          columns={['Template', 'Type', 'Status', 'Usage', 'Last Updated']}
          rows={
            templates.length
              ? templates.map((template: any) => [
                  template.name,
                  template.type,
                  template.status,
                  String(template.usageCount ?? 0),
                  new Date(template.updatedAt).toLocaleString(),
                ])
              : [['No templates yet', '-', '-', '-', '-']]
          }
        />
      </div>
    </DashboardShell>
  );
}
