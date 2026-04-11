'use client';

import { DataTableCard } from '../../components/blocks/data-table-card';
import { PageHeader } from '../../components/blocks/page-header';
import { CreateContactForm } from '../../components/forms/create-contact-form';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useContacts } from '../../hooks/use-workspace-data';

export default function ContactsPage() {
  const contactsQuery = useContacts();
  const contacts = Array.isArray(contactsQuery.data) ? contactsQuery.data : [];

  return (
    <DashboardShell title="Contacts and CRM" eyebrow="Audience">
      <div className="space-y-6">
        <PageHeader
          title="Contact Graph"
          description="Segment audiences, control consent, suppress risky targets, and assign leads to agents."
          badge="CRM-ready"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['48,220', 'Total contacts'],
            ['3,142', 'New this month'],
            ['1.8%', 'Suppressed'],
            ['91%', 'Opted in'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <CreateContactForm />
        <DataTableCard
          title="Recent Contacts"
          columns={['Name', 'Phone', 'Stage', 'Opt-In', 'Assigned', 'Last Reply']}
          rows={
            contacts.length
              ? contacts.map((contact: any) => [
                  contact.fullName ?? 'Unnamed',
                  contact.phoneNumber,
                  contact.leadStage ?? 'New',
                  contact.optInStatus ? 'Yes' : 'No',
                  contact.assignedAgentId ? 'Assigned' : 'Unassigned',
                  contact.lastRepliedAt ? new Date(contact.lastRepliedAt).toLocaleString() : 'Never',
                ])
              : [['No contacts yet', '-', '-', '-', '-', '-']]
          }
        />
      </div>
    </DashboardShell>
  );
}
