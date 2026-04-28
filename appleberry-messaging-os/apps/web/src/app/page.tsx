'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  MessageSquarePlus,
  Send,
  Upload,
  Users2,
  Wifi,
  Zap,
  TrendingUp,
} from 'lucide-react';

import { DashboardShell } from '../components/layout/dashboard-shell';
import { useCampaigns, useContacts, useWhatsappAccounts } from '../hooks/use-workspace-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelRow = {
  name: string;
  phone: string;
  provider: string;
  sentToday: number;
  failed: number;
  deliveryPct: number;
  status: 'connected' | 'degraded' | 'offline';
  healthScore: number;
};

type ActivityEvent = {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  timestamp: string;
};

type FlowRow = {
  name: string;
  triggersToday: number;
  completionRate: number;
  aiEnabled: boolean;
};

// ─── Static mock data ─────────────────────────────────────────────────────────

const CHANNEL_ROWS: ChannelRow[] = [
  { name: 'Appleberry Care Centre', phone: '+27 82 886 1100', provider: 'Cloud API', sentToday: 4820, failed: 12, deliveryPct: 99.8, status: 'connected', healthScore: 98 },
  { name: 'NEW PHONE NUMBER', phone: '+27 83 345 7033', provider: 'WhatsApp Web', sentToday: 312, failed: 48, deliveryPct: 86.7, status: 'degraded', healthScore: 62 },
  { name: 'Vodacom Superstore Midlands', phone: '+27 76 914 4348', provider: 'Cloud API', sentToday: 1740, failed: 9, deliveryPct: 99.5, status: 'connected', healthScore: 91 },
];

const ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: '1',
    icon: Send,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    title: 'Campaign sent',
    description: '"Summer Promo" delivered to 12,883 contacts — 98.4% success',
    timestamp: '2 min ago',
  },
  {
    id: '2',
    icon: Wifi,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
    title: 'Account connected',
    description: 'Vodacom Superstore Midlands came online',
    timestamp: '18 min ago',
  },
  {
    id: '3',
    icon: Users2,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    title: 'Contacts imported',
    description: '4,200 contacts imported from CSV file',
    timestamp: '1 hr ago',
  },
  {
    id: '4',
    icon: Bot,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
    title: 'Chatbot triggered',
    description: 'Flow "Support Onboarding" triggered 341 times today',
    timestamp: '3 hr ago',
  },
  {
    id: '5',
    icon: BarChart3,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    title: 'Weekly report ready',
    description: 'Analytics report for week ending Apr 6 is available',
    timestamp: '5 hr ago',
  },
];

const FLOW_ROWS: FlowRow[] = [
  { name: 'Support Onboarding', triggersToday: 341, completionRate: 78, aiEnabled: true },
  { name: 'Order Tracking', triggersToday: 215, completionRate: 91, aiEnabled: false },
  { name: 'Promotional Upsell', triggersToday: 89, completionRate: 54, aiEnabled: true },
  { name: 'FAQ Autoresponder', triggersToday: 512, completionRate: 95, aiEnabled: false },
];

const QUICK_ACTIONS = [
  {
    icon: Send,
    label: 'New Campaign',
    description: 'Schedule a bulk broadcast to your contacts',
    href: '/campaigns',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Upload,
    label: 'Import Contacts',
    description: 'Bulk import contacts from a CSV file',
    href: '/contacts',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: Wifi,
    label: 'Connect Account',
    description: 'Link a new WhatsApp number or Cloud API',
    href: '/accounts',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    icon: BarChart3,
    label: 'View Reports',
    description: 'Open the full analytics dashboard',
    href: '/analytics',
    color: 'bg-amber-50 text-amber-600',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChannelRow['status'] }) {
  const map: Record<ChannelRow['status'], string> = {
    connected: 'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    offline: 'bg-rose-100 text-rose-700',
  };
  const labels: Record<ChannelRow['status'], string> = {
    connected: 'Connected',
    degraded: 'Degraded',
    offline: 'Offline',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 rounded-full bg-slate-100 h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-300`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-7">{score}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const accountsQuery = useWhatsappAccounts();
  const campaignsQuery = useCampaigns();
  const contactsQuery = useContacts();

  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
  const campaigns = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];
  const contacts = Array.isArray(contactsQuery.data) ? contactsQuery.data : [];

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'RUNNING').length;
  const activeAccounts = accounts.filter((a: any) => a.status === 'CONNECTED').length;

  // System alerts: accounts with health < 80 or degraded
  const degradedAccounts = CHANNEL_ROWS.filter((r) => r.healthScore < 80);
  const failedCampaigns = campaigns.filter((c: any) => c.status === 'FAILED');

  const hasAlerts = degradedAccounts.length > 0 || failedCampaigns.length > 0;

  return (
    <DashboardShell title="Dashboard" eyebrow="Executive Overview">
      <div className="space-y-6 max-w-7xl">

        {/* ── System Alerts ───────────────────────────────────────────────── */}
        {hasAlerts && (
          <div className="rounded-[14px] border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-50/50 px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">System Alerts</p>
                <ul className="mt-2 space-y-1">
                  {degradedAccounts.map((a) => (
                    <li key={a.name} className="text-sm text-amber-800">
                      <span className="font-medium">{a.name}</span> health is at <span className="font-semibold">{a.healthScore}%</span> — check connection.
                    </li>
                  ))}
                  {failedCampaigns.map((c: any) => (
                    <li key={c.id} className="text-sm text-amber-800">
                      Campaign <span className="font-medium">{c.name}</span> has failed — review logs.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!hasAlerts && (
          <div className="rounded-[14px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/50 px-5 py-3.5 shadow-sm flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">All systems operational — no alerts to show.</p>
          </div>
        )}

        {/* ── KPI Stats ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Messages Today',
              value: '6,872',
              sub: 'across all accounts',
              trend: '+12.5%',
              color: 'from-indigo-50 to-indigo-50/50',
              icon: MessageSquarePlus,
              accent: 'border-t-4 border-indigo-500',
            },
            {
              label: 'Active Campaigns',
              value: activeCampaigns > 0 ? String(activeCampaigns) : '8',
              sub: 'currently running',
              trend: '+2',
              color: 'from-emerald-50 to-emerald-50/50',
              icon: Send,
              accent: 'border-t-4 border-emerald-500',
            },
            {
              label: 'Active Accounts',
              value: activeAccounts > 0 ? String(activeAccounts) : String(accounts.length || 3),
              sub: 'WhatsApp numbers',
              trend: '3 online',
              color: 'from-sky-50 to-sky-50/50',
              icon: Wifi,
              accent: 'border-t-4 border-sky-500',
            },
            {
              label: 'Total Contacts',
              value: contacts.length > 0 ? contacts.length.toLocaleString() : '41,200',
              sub: 'in workspace',
              trend: '+8.2%',
              color: 'from-violet-50 to-violet-50/50',
              icon: Users2,
              accent: 'border-t-4 border-violet-500',
            },
          ].map(({ label, value, sub, trend, color, icon: Icon, accent }) => (
            <div key={label} className={`rounded-[14px] border border-slate-200 bg-gradient-to-br ${color} px-5 py-5 shadow-sm hover:shadow-md transition-all duration-200 ${accent}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-2">{label}</p>
                  <p className="text-3xl font-bold text-slate-900">{value}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-600">{sub}</p>
                    <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {trend}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Two-column: Channel Performance + Activity Feed ─────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* Channel Performance Table */}
          <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-sm font-bold text-slate-900">Channel Performance</h3>
              <p className="text-xs text-slate-500 mt-1">Live metrics by WhatsApp account</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Account', 'Provider', 'Sent Today', 'Failed', 'Dlv%', 'Status', 'Health'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CHANNEL_ROWS.map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">{row.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{row.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{row.provider}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.sentToday.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-rose-600">{row.failed}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">{row.deliveryPct}%</td>
                      <td className="px-6 py-4"><StatusBadge status={row.status} /></td>
                      <td className="px-6 py-4"><HealthBar score={row.healthScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {ACTIVITY_EVENTS.map((event) => {
                const Icon = event.icon;
                return (
                  <div key={event.id} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${event.iconBg} ${event.iconColor} flex-shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">{event.description}</p>
                      <p className="mt-2 text-xs text-slate-400 font-medium">{event.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────────── */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
            <p className="text-xs text-slate-500 mt-1">Jump to common tasks</p>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map(({ icon: Icon, label, description, href, color }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-[14px] border border-slate-200 bg-white px-5 py-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{label}</p>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Top Chatbot Flows ────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <h3 className="text-sm font-bold text-slate-900">Top Chatbot Flows</h3>
            <p className="text-xs text-slate-500 mt-1">Most active automation flows today</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Flow Name', 'Triggers Today', 'Completion Rate', 'AI Enabled'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FLOW_ROWS.map((flow) => (
                  <tr key={flow.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
                          <Bot className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{flow.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{flow.triggersToday.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 rounded-full bg-slate-100 h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              flow.completionRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${flow.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-8">{flow.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`relative h-6 w-10 rounded-full transition-colors ${
                            flow.aiEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              flow.aiEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                        <span className={`text-xs font-bold ${flow.aiEnabled ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {flow.aiEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}

