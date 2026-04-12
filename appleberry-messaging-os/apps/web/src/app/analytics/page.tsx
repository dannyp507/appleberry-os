'use client';

import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useAnalyticsAccounts, useAnalyticsCampaigns, useAnalyticsOverview } from '../../hooks/use-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePreset = 'today' | '7d' | '30d' | '90d';

type HeatmapCell = {
  hour: number;
  day: number;
  value: number;
};

// ─── Static mock data (shown while API loads or unavailable) ─────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DELIVERY_TIMELINE = [
  { date: 'Apr 6', label: '6', value: 8240 },
  { date: 'Apr 7', label: '7', value: 11300 },
  { date: 'Apr 8', label: '8', value: 9800 },
  { date: 'Apr 9', label: '9', value: 14200 },
  { date: 'Apr 10', label: '10', value: 12883 },
  { date: 'Apr 11', label: '11', value: 10100 },
  { date: 'Apr 12', label: '12', value: 6200 },
];

const FAILURE_BREAKDOWN = [
  { code: 'ERR_TIMEOUT', count: 312, pct: '41.2%', lastOccurrence: '2 min ago' },
  { code: 'INVALID_NUMBER', count: 198, pct: '26.2%', lastOccurrence: '9 min ago' },
  { code: 'BLOCKED_BY_USER', count: 142, pct: '18.8%', lastOccurrence: '22 min ago' },
  { code: 'RATE_LIMITED', count: 104, pct: '13.8%', lastOccurrence: '1 hr ago' },
];

function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const isBusinessHour = hour >= 8 && hour <= 18;
      const isWeekday = day < 5;
      const base = isBusinessHour && isWeekday ? 60 : 15;
      cells.push({ hour, day, value: Math.round(base + Math.random() * 40) });
    }
  }
  return cells;
}

const HEATMAP_DATA = generateHeatmap();

function heatmapOpacityClass(value: number): string {
  if (value >= 90) return 'bg-emerald-500';
  if (value >= 75) return 'bg-emerald-500/80';
  if (value >= 60) return 'bg-emerald-500/60';
  if (value >= 40) return 'bg-emerald-500/40';
  if (value >= 20) return 'bg-emerald-500/20';
  return 'bg-emerald-500/10';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? 'text-emerald-600' : 'text-rose-500'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(value)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RUNNING: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-slate-100 text-slate-600',
    FAILED: 'bg-rose-100 text-rose-700',
    SCHEDULED: 'bg-sky-100 text-sky-700',
    PAUSED: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function AccountHealthBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: 'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    offline: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');

  const params = fromDate && toDate ? { from: fromDate, to: toDate } : undefined;

  const overviewQuery = useAnalyticsOverview(params);
  const campaignsQuery = useAnalyticsCampaigns(params);
  const accountsQuery = useAnalyticsAccounts(params);

  const overview = overviewQuery.data;
  const campaigns = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];
  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];

  const PRESET_LABELS: Record<DatePreset, string> = {
    today: 'Today',
    '7d': '7D',
    '30d': '30D',
    '90d': '90D',
  };

  const maxDeliveryValue = Math.max(...DELIVERY_TIMELINE.map((d) => d.value));

  return (
    <DashboardShell title="Analytics Center" eyebrow="Performance Intelligence">
      <div className="space-y-6">

        {/* ── Filters ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  preset === p ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-slate-600 outline-none"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs text-slate-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-600 outline-none"
            >
              <option value="all">All accounts</option>
              <option value="acc1">Appleberry Care Centre</option>
              <option value="acc2">NEW PHONE NUMBER</option>
              <option value="acc3">Vodacom Superstore Midlands</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Sent',
              value: overview?.totalSent?.toLocaleString() ?? '281,992',
              trend: overview?.totalSentTrend ?? 8.4,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
            },
            {
              label: 'Delivery Rate',
              value: overview ? `${overview.deliveryRate}%` : '97.8%',
              trend: overview?.deliveryRateTrend ?? 1.2,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: 'Reply Rate',
              value: overview ? `${overview.replyRate}%` : '22.4%',
              trend: overview?.replyRateTrend ?? -0.8,
              color: 'text-sky-600',
              bg: 'bg-sky-50',
            },
            {
              label: 'Failed Messages',
              value: overview?.failedMessages?.toLocaleString() ?? '6,194',
              trend: overview?.failedMessagesTrend ?? -3.1,
              color: 'text-rose-600',
              bg: 'bg-rose-50',
            },
          ].map(({ label, value, trend, color, bg }) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl ${bg}`}>
                <span className={`text-xs font-bold ${color}`}>#</span>
              </div>
              <p className="text-2xl font-semibold text-slate-900">{value}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <TrendBadge value={trend} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Message Volume Heatmap ──────────────────────────────────────────── */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Message Volume Heatmap</h3>
          <p className="mb-5 text-xs text-slate-400">Activity pattern by hour × day of week</p>

          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day labels */}
              <div className="mb-1 flex pl-10">
                {DAYS.map((d) => (
                  <div key={d} className="flex-1 text-center text-[11px] font-medium text-slate-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid: rows = hours */}
              <div className="space-y-0.5">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="flex items-center gap-1">
                    <span className="w-9 shrink-0 text-right text-[10px] text-slate-400">
                      {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                    </span>
                    <div className="flex flex-1 gap-0.5">
                      {DAYS.map((_, dayIdx) => {
                        const cell = HEATMAP_DATA.find((c) => c.hour === hour && c.day === dayIdx);
                        return (
                          <div
                            key={dayIdx}
                            title={`${cell?.value ?? 0} msgs`}
                            className={`h-3.5 flex-1 rounded-sm ${heatmapOpacityClass(cell?.value ?? 0)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-3 flex items-center justify-end gap-1.5">
                <span className="text-[11px] text-slate-400">Less</span>
                {['bg-emerald-500/10', 'bg-emerald-500/20', 'bg-emerald-500/40', 'bg-emerald-500/60', 'bg-emerald-500/80', 'bg-emerald-500'].map((cls) => (
                  <div key={cls} className={`h-3 w-3 rounded-sm ${cls}`} />
                ))}
                <span className="text-[11px] text-slate-400">More</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Delivery Timeline ───────────────────────────────────────────────── */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Delivery Timeline</h3>
          <p className="mb-5 text-xs text-slate-400">Messages sent per day</p>
          <div className="flex items-end gap-1.5 h-36">
            {DELIVERY_TIMELINE.map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-slate-500">
                  {item.value.toLocaleString()}
                </span>
                <div
                  className="w-full rounded-t-sm bg-emerald-400 min-h-[4px] transition-all"
                  style={{ height: `${(item.value / maxDeliveryValue) * 100}%` }}
                />
                <span className="text-[10px] text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column: Campaigns + Account Health ─────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Top Campaigns Table */}
          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Top Campaigns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Campaign', 'Sent', 'Dlvd', 'Failed', 'Dlv%', 'Reply%', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length > 0
                    ? campaigns.map((c, i) => (
                        <tr key={c.id} className={i % 2 === 0 ? 'bg-slate-50/60' : ''}>
                          <td className="max-w-[120px] truncate px-4 py-3 text-xs font-medium text-slate-700">{c.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{c.sent.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{c.delivered.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-rose-500">{c.failed.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{c.deliveryRate}%</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{c.replyRate}%</td>
                          <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        </tr>
                      ))
                    : [
                        ['Summer Promo', '12,883', '12,680', '203', '98.4%', '24.1%', 'COMPLETED'],
                        ['Flash Sale ZA', '8,120', '7,963', '157', '98.1%', '21.8%', 'RUNNING'],
                        ['Onboard Wave', '5,440', '5,285', '155', '97.2%', '18.6%', 'COMPLETED'],
                        ['Win-Back Sept', '3,200', '3,008', '192', '94.0%', '11.2%', 'FAILED'],
                        ['Newsletter #12', '2,100', '2,087', '13', '99.4%', '9.7%', 'COMPLETED'],
                      ].map(([name, sent, dlvd, failed, dlvPct, rplPct, status], i) => (
                        <tr key={name} className={i % 2 === 0 ? 'bg-slate-50/60' : ''}>
                          <td className="max-w-[120px] truncate px-4 py-3 text-xs font-medium text-slate-700">{name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{sent}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{dlvd}</td>
                          <td className="px-4 py-3 text-xs text-rose-500">{failed}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{dlvPct}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{rplPct}</td>
                          <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Account Health */}
          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Account Health</h3>
            </div>
            <div className="divide-y divide-slate-100 p-4 space-y-1">
              {(accounts.length > 0
                ? accounts.map((a) => ({
                    name: a.name,
                    phone: a.phone,
                    healthScore: a.healthScore,
                    status: a.status,
                    dailySends: a.dailySends,
                  }))
                : [
                    { name: 'Appleberry Care Centre', phone: '+27 82 886 1100', healthScore: 98, status: 'healthy', dailySends: 4820 },
                    { name: 'NEW PHONE NUMBER', phone: '+27 83 345 7033', healthScore: 62, status: 'degraded', dailySends: 312 },
                    { name: 'Vodacom Superstore Midlands', phone: '+27 76 914 4348', healthScore: 91, status: 'healthy', dailySends: 1740 },
                  ]
              ).map((acct) => (
                <div key={acct.name} className="rounded-2xl px-3 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[180px]">{acct.name}</p>
                      <p className="text-xs text-slate-400">{acct.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{acct.dailySends.toLocaleString()} / day</span>
                      <AccountHealthBadge status={acct.status} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 rounded-full bg-slate-100 h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          acct.healthScore >= 80 ? 'bg-emerald-400' : acct.healthScore >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${acct.healthScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-8 text-right">{acct.healthScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Failure Breakdown ───────────────────────────────────────────────── */}
        <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Failure Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Error Code', 'Count', 'Percentage', 'Last Occurrence'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAILURE_BREAKDOWN.map((row, i) => (
                  <tr key={row.code} className={i % 2 === 0 ? 'bg-slate-50/60' : ''}>
                    <td className="px-5 py-3">
                      <code className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-mono font-medium text-rose-600">
                        {row.code}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{row.count.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 rounded-full bg-slate-100 h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-rose-400"
                            style={{ width: row.pct }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{row.pct}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{row.lastOccurrence}</td>
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
