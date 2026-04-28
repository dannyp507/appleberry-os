import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getDocs } from 'firebase/firestore';
import { Clock, Wrench, TrendingUp, UserCircle2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Profile, RepairStatus } from '../types';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';

type RepairRecord = {
  id: string;
  company_id?: string | null;
  device_name?: string;
  customer_id?: string;
  technician_id?: string | null;
  status_id?: string;
  problem_id?: string | null;
  cost?: number;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
};

type RepairProblem = { id: string; name: string; };

const STATUS_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function RepairsReports() {
  const { companyId } = useTenant();
  const [repairs, setRepairs] = useState<RepairRecord[]>([]);
  const [statuses, setStatuses] = useState<Map<string, RepairStatus>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  const [problemMap, setProblemMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepairsData();
  }, [companyId]);

  async function fetchRepairsData() {
    setLoading(true);
    try {
      const [repairsSnapshot, statusesSnapshot, profilesSnapshot, problemsSnapshot] = await Promise.all([
        getDocs(companyQuery('repairs', companyId)),
        getDocs(companyQuery('repair_status_options', companyId)),
        getDocs(companyQuery('profiles', companyId)),
        getDocs(companyQuery('repair_problems', companyId)),
      ]);

      setRepairs(repairsSnapshot.docs.map((repairDoc) => ({ id: repairDoc.id, ...repairDoc.data() } as RepairRecord)));
      setStatuses(new Map(statusesSnapshot.docs.map((statusDoc) => ({ id: statusDoc.id, ...statusDoc.data() } as RepairStatus)).map((status) => {
        return [status.id, status];
      })));
      setStaffMap(new Map(profilesSnapshot.docs.map((profileDoc) => ({ id: profileDoc.id, ...profileDoc.data() } as Profile)).map((profile) => {
        return [profile.id, profile.full_name || 'Staff Member'];
      })));
      setProblemMap(new Map(problemsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RepairProblem)).map((p) => [p.id, p.name])));
    } catch (error) {
      console.error('Error fetching repair report data:', error);
    } finally {
      setLoading(false);
    }
  }

  const closedKeywords = ['done', 'complete', 'completed', 'closed', 'collected', 'finished'];

  const enrichedRepairs = useMemo(() => {
    return repairs.map((repair) => {
      const status = repair.status_id ? statuses.get(repair.status_id) : undefined;
      const statusName = status?.name || 'Unknown';
      const isClosed = closedKeywords.some((keyword) => statusName.toLowerCase().includes(keyword));
      const createdAt = repair.created_at ? new Date(repair.created_at) : null;
      const updatedAt = repair.updated_at ? new Date(repair.updated_at) : null;
      const turnaroundDays = createdAt && updatedAt && !Number.isNaN(createdAt.getTime()) && !Number.isNaN(updatedAt.getTime())
        ? Math.max(0, differenceInCalendarDays(updatedAt, createdAt))
        : null;
      return {
        ...repair,
        statusName,
        isClosed,
        turnaroundDays,
        technicianName: repair.technician_id ? staffMap.get(repair.technician_id) || 'Unassigned' : 'Unassigned',
      };
    });
  }, [repairs, statuses, staffMap]);

  const metrics = useMemo(() => {
    const total = enrichedRepairs.length;
    const open = enrichedRepairs.filter((repair) => !repair.isClosed).length;
    const closed = enrichedRepairs.filter((repair) => repair.isClosed).length;
    const averageTurnaround = (() => {
      const closedRepairs = enrichedRepairs.filter((repair) => repair.isClosed && repair.turnaroundDays !== null);
      if (closedRepairs.length === 0) return 0;
      return closedRepairs.reduce((sum, repair) => sum + Number(repair.turnaroundDays || 0), 0) / closedRepairs.length;
    })();
    const pipelineValue = enrichedRepairs.filter((repair) => !repair.isClosed).reduce((sum, repair) => sum + Number(repair.total_amount || repair.cost || 0), 0);
    return { total, open, closed, averageTurnaround, pipelineValue };
  }, [enrichedRepairs]);

  const statusBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    enrichedRepairs.forEach((repair) => {
      totals.set(repair.statusName, (totals.get(repair.statusName) || 0) + 1);
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [enrichedRepairs]);

  const technicianBreakdown = useMemo(() => {
    const totals = new Map<string, { name: string; jobs: number; open: number; closed: number }>();
    enrichedRepairs.forEach((repair) => {
      const key = repair.technicianName;
      const entry = totals.get(key) || { name: key, jobs: 0, open: 0, closed: 0 };
      entry.jobs += 1;
      if (repair.isClosed) entry.closed += 1;
      else entry.open += 1;
      totals.set(key, entry);
    });
    return Array.from(totals.values()).sort((a, b) => b.jobs - a.jobs);
  }, [enrichedRepairs]);

  const byProblem = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    enrichedRepairs.forEach((r) => {
      const name = r.problem_id ? (problemMap.get(r.problem_id) || 'Unknown') : 'No Problem Listed';
      const entry = map.get(name) || { name, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += Number(r.total_amount || r.cost || 0);
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [enrichedRepairs, problemMap]);

  const agingBuckets = useMemo(() => {
    const buckets = [
      { name: '0-2 days', value: 0 },
      { name: '3-7 days', value: 0 },
      { name: '8-14 days', value: 0 },
      { name: '15+ days', value: 0 },
    ];

    enrichedRepairs.filter((repair) => !repair.isClosed).forEach((repair) => {
      const createdAt = repair.created_at ? new Date(repair.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const age = differenceInCalendarDays(new Date(), createdAt);
      if (age <= 2) buckets[0].value += 1;
      else if (age <= 7) buckets[1].value += 1;
      else if (age <= 14) buckets[2].value += 1;
      else buckets[3].value += 1;
    });

    return buckets;
  }, [enrichedRepairs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Repairs Reports</h1>
        <p className="text-gray-500">Monitor job flow, technician capacity, turnaround time, and repair backlog.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Repairs" value={metrics.total.toString()} icon={Wrench} tone="blue" />
        <MetricCard title="Open Repairs" value={metrics.open.toString()} icon={Clock} tone="amber" />
        <MetricCard title="Closed Repairs" value={metrics.closed.toString()} icon={TrendingUp} tone="green" />
        <MetricCard title="Pipeline Value" value={formatCurrency(metrics.pipelineValue)} icon={UserCircle2} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={4}>
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Repair Aging</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingBuckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Technician Workload</h3>
            <span className="text-sm text-gray-500">Avg turnaround {metrics.averageTurnaround.toFixed(1)} days</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3 text-right">Jobs</th>
                  <th className="px-4 py-3 text-right">Open</th>
                  <th className="px-4 py-3 text-right">Closed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">Loading report...</td></tr>
                ) : technicianBreakdown.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No repairs found.</td></tr>
                ) : (
                  technicianBreakdown.map((entry) => (
                    <tr key={entry.name} className="border-b border-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">{entry.name}</td>
                      <td className="px-4 py-4 text-right text-gray-600">{entry.jobs}</td>
                      <td className="px-4 py-4 text-right text-amber-600 font-semibold">{entry.open}</td>
                      <td className="px-4 py-4 text-right text-green-600 font-semibold">{entry.closed}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Repairs Needing Attention</h3>
          <div className="space-y-3">
            {enrichedRepairs
              .filter((repair) => !repair.isClosed)
              .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
              .slice(0, 8)
              .map((repair) => (
                <div key={repair.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900">{repair.device_name || 'Unknown device'}</p>
                    <p className="text-xs text-gray-500">{repair.statusName} • {repair.technicianName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(repair.total_amount || repair.cost || 0))}</p>
                    <p className="text-xs text-gray-500">Opened {safeFormatDate(repair.created_at, 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            {!loading && enrichedRepairs.filter((repair) => !repair.isClosed).length === 0 && (
              <div className="p-10 text-center text-gray-400">No open repairs right now.</div>
            )}
          </div>
        </div>
      </div>

      {/* By Problem */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Repairs by Problem Type</h3>
          {byProblem.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data available.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProblem.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Jobs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Problem Revenue Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-3">Problem</th>
                  <th className="px-4 py-3 text-right">Jobs</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : byProblem.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">No problems recorded.</td></tr>
                ) : byProblem.map((row) => (
                  <tr key={row.name} className="border-b border-gray-50">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{row.count}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'blue' | 'green' | 'amber' | 'purple' }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
