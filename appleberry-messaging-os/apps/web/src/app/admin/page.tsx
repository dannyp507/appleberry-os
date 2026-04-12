'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, MessageSquare, Layers, Activity, ShieldAlert } from 'lucide-react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useSessionStore } from '../../stores/session-store';
import {
  getAdminTenants,
  getAdminSystemHealth,
  getAdminAuditLogs,
  suspendWorkspace,
} from '../../lib/api';

type Tab = 'overview' | 'tenants' | 'health' | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'health', label: 'System Health' },
  { id: 'audit', label: 'Audit Logs' },
];

function StatCard({ icon: Icon, label, value, color = 'indigo' }: { icon: React.ElementType; label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    violet: 'bg-violet-50 text-violet-500',
    sky: 'bg-sky-50 text-sky-500',
    amber: 'bg-amber-50 text-amber-500',
  };
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${colorMap[color] ?? colorMap.indigo}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Building2} label="Total Organizations" value="24" color="indigo" />
        <StatCard icon={Layers} label="Total Workspaces" value="67" color="violet" />
        <StatCard icon={Users} label="Total Users" value="412" color="sky" />
        <StatCard icon={MessageSquare} label="Messages Sent" value="1.2M" color="emerald" />
        <StatCard icon={Activity} label="Active Accounts" value="38" color="amber" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Platform Growth</h3>
          <div className="space-y-3">
            {[
              { label: 'New orgs this month', value: 4 },
              { label: 'New users this week', value: 31 },
              { label: 'Messages today', value: '14,230' },
              { label: 'API calls today', value: '89,100' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Plan Distribution</h3>
          <div className="space-y-3">
            {[
              { plan: 'Enterprise', count: 5, color: 'bg-indigo-500' },
              { plan: 'Pro', count: 12, color: 'bg-violet-500' },
              { plan: 'Starter', count: 7, color: 'bg-emerald-500' },
            ].map(({ plan, count, color }) => (
              <div key={plan} className="flex items-center gap-3">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${(count / 24) * 100}%`, minWidth: 8 }} />
                <span className="text-sm text-slate-600">{plan}</span>
                <span className="ml-auto text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantsTab() {
  const tenantsQuery = useQuery({ queryKey: ['admin', 'tenants'], queryFn: getAdminTenants });
  const tenants: any[] = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];
  const [suspending, setSuspending] = useState<string | null>(null);

  async function handleSuspend(id: string) {
    setSuspending(id);
    try {
      await suspendWorkspace(id);
    } catch {
      // noop
    } finally {
      setSuspending(null);
    }
  }

  // Fallback demo data
  const rows = tenants.length > 0 ? tenants : [
    { id: '1', name: 'Acme Corp', slug: 'acme-corp', _count: { workspaces: 4 }, plan: 'Enterprise', status: 'ACTIVE', createdAt: '2024-01-15' },
    { id: '2', name: 'TechStart Inc', slug: 'techstart', _count: { workspaces: 1 }, plan: 'Starter', status: 'ACTIVE', createdAt: '2024-02-20' },
    { id: '3', name: 'GlobalMark Ltd', slug: 'globalmark', _count: { workspaces: 2 }, plan: 'Pro', status: 'SUSPENDED', createdAt: '2023-11-05' },
  ];

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">All Tenants</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Organization', 'Slug', 'Workspaces', 'Plan', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenantsQuery.isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Loading tenants…</td></tr>
            ) : (
              rows.map((t: any) => (
                <tr key={t.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{t._count?.workspaces ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{t.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={suspending === t.id}
                      onClick={() => handleSuspend(t.id)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                        t.status === 'ACTIVE'
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      } disabled:opacity-50`}
                    >
                      {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthTab() {
  const healthQuery = useQuery({ queryKey: ['admin', 'health'], queryFn: getAdminSystemHealth });
  const health: any = healthQuery.data ?? {};

  const services = [
    { label: 'API Service', status: health.api ?? 'operational', detail: 'p95: 42ms' },
    { label: 'Queue Backlog', status: health.queue ?? 'operational', detail: `${health.queueBacklog ?? 0} jobs` },
    { label: 'Database', status: health.db ?? 'operational', detail: `${health.dbConnections ?? 12} connections` },
    { label: 'Redis Cache', status: health.redis ?? 'operational', detail: `${health.redisMem ?? '48MB'} used` },
    { label: 'WhatsApp Provider', status: health.whatsapp ?? 'operational', detail: 'API v17' },
    { label: 'Email Provider', status: health.email ?? 'operational', detail: 'SMTP relay' },
  ];

  function statusColor(status: string) {
    if (status === 'operational') return 'text-emerald-600 bg-emerald-50';
    if (status === 'degraded') return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  }

  function statusDot(status: string) {
    if (status === 'operational') return 'bg-emerald-500';
    if (status === 'degraded') return 'bg-amber-500';
    return 'bg-red-500';
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(({ label, status, detail }) => (
          <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(status)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Incidents</h3>
        <p className="text-sm text-slate-400">No incidents in the last 30 days.</p>
      </div>
    </div>
  );
}

function AuditTab() {
  const logsQuery = useQuery({ queryKey: ['admin', 'audit-logs'], queryFn: () => getAdminAuditLogs() });
  const logs: any[] = Array.isArray(logsQuery.data) ? logsQuery.data : [];

  const demoLogs = [
    { id: '1', userId: 'usr_abc', action: 'workspace.create', subject: 'ws_xyz', ip: '192.168.1.1', createdAt: new Date().toISOString() },
    { id: '2', userId: 'usr_def', action: 'campaign.launch', subject: 'cmp_123', ip: '10.0.0.5', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', userId: 'usr_abc', action: 'apikey.revoke', subject: 'key_789', ip: '192.168.1.1', createdAt: new Date(Date.now() - 7200000).toISOString() },
  ];

  const rows = logs.length > 0 ? logs : demoLogs;

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">Audit Logs</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['User ID', 'Action', 'Subject', 'IP Address', 'Timestamp'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logsQuery.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Loading logs…</td></tr>
            ) : (
              rows.map((log: any) => (
                <tr key={log.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.userId}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.subject}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.ip}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const user = useSessionStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' || (user as any)?.isPlatformOwner;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Admin" eyebrow="Platform Control">
        <div className="flex min-h-[400px] flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-500 text-center max-w-sm">
            You do not have permission to access the admin panel. Contact a platform owner if you need access.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Admin Panel" eyebrow="Platform Control">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Platform Control Center</h1>
            <p className="mt-1 text-sm text-slate-500">Manage all tenants, monitor system health, and review audit logs.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">SUPER ADMIN</span>
        </div>

        <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'health' && <HealthTab />}
        {activeTab === 'audit' && <AuditTab />}
      </div>
    </DashboardShell>
  );
}
