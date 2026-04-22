import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { getDocs } from 'firebase/firestore';
import { DollarSign, TrendingUp, ShoppingCart, CreditCard } from 'lucide-react';
import { subDays } from 'date-fns';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Profile } from '../types';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';

type SaleRecord = {
  id: string;
  company_id?: string | null;
  total_amount?: number;
  profit?: number;
  created_at?: string;
  staff_id?: string;
  staff_name?: string;
  payments?: { method?: string; amount?: number }[];
  payment_method?: string;
};

const PAYMENT_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];

export default function SalesReports() {
  const { companyId } = useTenant();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [companyId]);

  async function fetchReportData() {
    setLoading(true);
    try {
      const [salesSnapshot, profilesSnapshot] = await Promise.all([
        getDocs(companyQuery('sales', companyId)),
        getDocs(companyQuery('profiles', companyId)),
      ]);

      setSales(salesSnapshot.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as SaleRecord)));
      setStaffMap(
        new Map(
          profilesSnapshot.docs.map((profileDoc) => ({ id: profileDoc.id, ...profileDoc.data() } as Profile)).map((profile) => {
            return [profile.id, profile.full_name || 'Staff Member'];
          })
        )
      );
    } catch (error) {
      console.error('Error fetching sales report data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSales = useMemo(() => {
    const cutoff = subDays(new Date(), period - 1);
    return sales.filter((sale) => {
      const createdAt = sale.created_at ? new Date(sale.created_at) : null;
      return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
    });
  }, [period, sales]);

  const metrics = useMemo(() => {
    const revenue = filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const profit = filteredSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
    const tickets = filteredSales.length;
    const averageTicket = tickets > 0 ? revenue / tickets : 0;
    return { revenue, profit, tickets, averageTicket };
  }, [filteredSales]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { day: string; sales: number; profit: number }>();
    filteredSales.forEach((sale) => {
      const day = safeFormatDate(sale.created_at, 'dd MMM', 'Unknown');
      const entry = map.get(day) || { day, sales: 0, profit: 0 };
      entry.sales += Number(sale.total_amount || 0);
      entry.profit += Number(sale.profit || 0);
      map.set(day, entry);
    });
    return Array.from(map.values());
  }, [filteredSales]);

  const paymentBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((sale) => {
      if (Array.isArray(sale.payments) && sale.payments.length > 0) {
        sale.payments.forEach((payment) => {
          const key = (payment.method || 'Unknown').toUpperCase();
          totals.set(key, (totals.get(key) || 0) + Number(payment.amount || 0));
        });
      } else if (sale.payment_method) {
        const key = sale.payment_method.toUpperCase();
        totals.set(key, (totals.get(key) || 0) + Number(sale.total_amount || 0));
      }
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  const staffPerformance = useMemo(() => {
    const totals = new Map<string, { name: string; sales: number; revenue: number; profit: number }>();
    filteredSales.forEach((sale) => {
      const staffId = sale.staff_id || 'unassigned';
      const entry = totals.get(staffId) || {
        name: staffMap.get(staffId) || sale.staff_name || 'Unassigned',
        sales: 0,
        revenue: 0,
        profit: 0,
      };
      entry.sales += 1;
      entry.revenue += Number(sale.total_amount || 0);
      entry.profit += Number(sale.profit || 0);
      totals.set(staffId, entry);
    });
    return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, staffMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-gray-500">Measure revenue, profit, payment mix, and staff performance.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Revenue" value={formatCurrency(metrics.revenue)} icon={DollarSign} tone="blue" />
        <MetricCard title="Profit" value={formatCurrency(metrics.profit)} icon={TrendingUp} tone="green" />
        <MetricCard title="Transactions" value={metrics.tickets.toString()} icon={ShoppingCart} tone="amber" />
        <MetricCard title="Average Ticket" value={formatCurrency(metrics.averageTicket)} icon={CreditCard} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales vs Profit</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R${value}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Mix</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={4}>
                  {paymentBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {paymentBreakdown.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                  <span className="text-gray-600">{entry.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">Loading report...</td></tr>
              ) : staffPerformance.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No sales found for this period.</td></tr>
              ) : (
                staffPerformance.map((entry) => (
                  <tr key={entry.name} className="border-b border-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-900">{entry.name}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{entry.sales}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(entry.revenue)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-green-600">{formatCurrency(entry.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
