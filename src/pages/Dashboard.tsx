import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Wrench,
  Wallet,
  Truck,
  LayoutDashboard,
  Moon,
  Users,
  PieChart,
  History,
  Database,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { startOfDay, startOfMonth, subDays } from 'date-fns';
import { Product, Profile } from '../types';
import { PermissionKey, hasPermission } from '../lib/permissions';
import { useTenant } from '../lib/tenant';
import { isCompanyScopedRecord } from '../lib/companyData';
import { companyQuery } from '../lib/db';

type TopProductRow = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

export default function Dashboard({ profile }: { profile: Profile | null }) {
  const { companyId } = useTenant();
  const [stats, setStats] = useState({
    dailySales: 0,
    monthlyProfit: 0,
    activeRepairs: 0,
    lowStock: 0,
    overdueRepairs: 0
  });
  const [chartData, setChartData] = useState<Array<{ date: string; amount: number }>>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [companyId]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const monthStart = startOfMonth(new Date());
      const sevenDaysAgo = startOfDay(subDays(new Date(), 6));

      const dailyQuery = companyQuery('sales', companyId, where('created_at', '>=', today.toISOString()));
      const monthlyQuery = companyQuery('sales', companyId, where('created_at', '>=', monthStart.toISOString()));
      const repairsQuery = companyQuery('repairs', companyId, orderBy('updated_at', 'desc'), limit(500));
      const repairStatusesQuery = companyQuery('repair_status_options', companyId);
      const productsQuery = companyQuery('products', companyId, limit(500));
      const chartQuery = companyQuery('sales', companyId, where('created_at', '>=', sevenDaysAgo.toISOString()));
      const topItemsQuery = companyQuery('sale_items', companyId, orderBy('created_at', 'desc'), limit(200));

      const [dailySnapshot, monthlySnapshot, repairsSnapshot, repairStatusesSnapshot, productsSnapshot, chartSnapshot, topItemsSnapshot] = await Promise.all([
        getDocs(dailyQuery),
        getDocs(monthlyQuery),
        getDocs(repairsQuery),
        getDocs(repairStatusesQuery),
        getDocs(productsQuery),
        getDocs(chartQuery),
        getDocs(topItemsQuery),
      ]);

      const dailyDocs = dailySnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));
      const monthlyDocs = monthlySnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));
      const repairDocs = repairsSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));
      const repairStatusDocs = repairStatusesSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));
      const productDocs = productsSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as Product));
      const chartDocs = chartSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));
      const topItemDocs = topItemsSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any));

      const dailyTotal = dailyDocs.reduce((acc, snapshotDoc: any) => acc + Number(snapshotDoc.total_amount || 0), 0);
      const monthlyProfitTotal = monthlyDocs.reduce((acc, snapshotDoc: any) => acc + Number(snapshotDoc.profit || 0), 0);
      const terminalStatusIds = new Set(
        repairStatusDocs
          .filter((status: any) => ['collected', 'closed', 'cancelled', 'void'].includes(String(status.name || '').toLowerCase()))
          .map((status: any) => status.id)
      );
      const activeRepairsCount = repairDocs.filter((repair: any) => {
        const statusName = String(repair.status_name || repair.status || '').toLowerCase();
        const statusId = String(repair.status_id || '');
        return !terminalStatusIds.has(statusId) && !['collected', 'closed', 'cancelled', 'void'].includes(statusName);
      }).length;
      const overdueRepairsCount = repairDocs.filter((repair: any) => {
        const statusName = String(repair.status_name || repair.status || '').toLowerCase();
        const statusId = String(repair.status_id || '');
        const isActive = !terminalStatusIds.has(statusId) && !['collected', 'closed', 'cancelled', 'void'].includes(statusName);
        const updatedAt = new Date(repair.updated_at || repair.created_at || Date.now()).getTime();
        const daysSinceUpdate = Number.isFinite(updatedAt) ? (Date.now() - updatedAt) / 86400000 : 0;
        return isActive && (statusName.includes('overdue') || statusName.includes('blocked') || daysSinceUpdate >= 7);
      }).length;
      const lowStockCount = productDocs.filter((product) => {
        const threshold = Number(product.low_stock_threshold ?? 5);
        const stock = Number(product.stock ?? 0);
        return Number.isFinite(stock) && Number.isFinite(threshold) && stock <= threshold;
      }).length;

      setStats({
        dailySales: dailyTotal,
        monthlyProfit: monthlyProfitTotal,
        activeRepairs: activeRepairsCount,
        lowStock: lowStockCount,
        overdueRepairs: overdueRepairsCount
      });

      const dailyMap = new Map();
      for (let i = 0; i < 7; i++) {
        const date = safeFormatDate(subDays(new Date(), i), 'MMM dd');
        dailyMap.set(date, 0);
      }

      chartDocs.forEach((data: any) => {
        const date = safeFormatDate(data.created_at, 'MMM dd');
        if (dailyMap.has(date)) {
          dailyMap.set(date, dailyMap.get(date) + Number(data.total_amount));
        }
      });

      const formattedChartData = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .reverse();

      setChartData(formattedChartData);

      const topProductMap = new Map<string, TopProductRow>();
      topItemDocs.forEach((itemData: any) => {
        const productId = String(itemData.product_id || itemData.external_sku || itemData.id);
        const existing = topProductMap.get(productId) || {
          productId,
          name: itemData.name || itemData.product_name || 'Imported Product',
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += Number(itemData.quantity || 0);
        existing.revenue += Number(itemData.total_price || 0);
        topProductMap.set(productId, existing);
      });

      const rankedProducts = Array.from(topProductMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const namedProducts = await Promise.all(
        rankedProducts.map(async (productRow) => {
          if (!productRow.name || productRow.name === 'Imported Product') {
            try {
              const productSnap = await getDoc(doc(db, 'products', productRow.productId));
              if (productSnap.exists() && isCompanyScopedRecord(productSnap.data() as any, companyId)) {
                return { ...productRow, name: String(productSnap.data().name || productRow.name) };
              }
            } catch {
              return productRow;
            }
          }
          return productRow;
        })
      );

      setTopProducts(namedProducts);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const moduleItems = useMemo(() => {
    const items = [
      { icon: Wallet, label: 'Expenses', path: '/expenses', color: 'text-[#3B82F6]', permission: 'expenses.view' as PermissionKey },
      { icon: Truck, label: 'Inventory Transfer', path: '/transfer', color: 'text-[#3B82F6]', permission: 'transfer.view' as PermissionKey },
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'text-[#3B82F6]', permission: 'dashboard.view' as PermissionKey },
      { icon: Moon, label: 'End of Day', path: '/end-of-day', color: 'text-[#F59E0B]', permission: 'end_of_day.view' as PermissionKey },
      { icon: Users, label: 'Staff Employee', path: '/staff', color: 'text-[#3B82F6]', permission: 'staff.manage' as PermissionKey },
      { icon: PieChart, label: 'Sales Reports', path: '/reports/sales', color: 'text-[#22C55E]', permission: 'reports.sales' as PermissionKey },
      { icon: PieChart, label: 'Repairs Reports', path: '/reports/repairs', color: 'text-[#3B82F6]', permission: 'reports.repairs' as PermissionKey },
      { icon: History, label: 'Activity Log', path: '/activity', color: 'text-[#A1A1AA]', permission: 'activity.view' as PermissionKey },
      { icon: Database, label: 'Manage Data', path: '/manage-data', color: 'text-[#ed1978]', permission: 'manage_data.view' as PermissionKey },
    ];

    return items.filter((item) => hasPermission(profile, item.permission));
  }, [profile]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 section-card rounded-xl"></div>)}
      </div>
      <div className="h-96 section-card rounded-xl"></div>
    </div>;
  }

  const attentionItems = [
    hasPermission(profile, 'inventory.view') && {
      title: stats.lowStock > 0 ? `${stats.lowStock} low-stock item${stats.lowStock === 1 ? '' : 's'}` : 'Stock position is clear',
      message: stats.lowStock > 0 ? 'Review products below threshold before the next rush.' : 'No immediate stock alerts from current thresholds.',
      cta: stats.lowStock > 0 ? 'Restock now' : 'View inventory',
      to: '/inventory',
      icon: Package,
      tone: stats.lowStock > 0 ? 'warning' : 'success',
    },
    hasPermission(profile, 'repairs.view') && {
      title: stats.overdueRepairs > 0 ? `${stats.overdueRepairs} overdue repair${stats.overdueRepairs === 1 ? '' : 's'}` : `${stats.activeRepairs} active repair${stats.activeRepairs === 1 ? '' : 's'}`,
      message: stats.overdueRepairs > 0 ? 'Stale or blocked jobs need technician attention.' : stats.activeRepairs > 0 ? 'The workshop has jobs moving through the queue.' : 'No active jobs yet. Create an intake when a device arrives.',
      cta: stats.activeRepairs > 0 || stats.overdueRepairs > 0 ? 'View queue' : 'Create job',
      to: stats.activeRepairs > 0 || stats.overdueRepairs > 0 ? '/repairs?status=open' : '/repairs/new',
      icon: stats.overdueRepairs > 0 ? AlertTriangle : Wrench,
      tone: stats.overdueRepairs > 0 ? 'danger' : stats.activeRepairs > 0 ? 'info' : 'neutral',
    },
    hasPermission(profile, 'pos.use') && {
      title: stats.dailySales > 0 ? 'Sales are moving today' : 'No sales yet today',
      message: stats.dailySales > 0 ? 'Cash register activity is live. Keep checkout moving.' : 'Start the first sale from the register when the counter opens.',
      cta: stats.dailySales > 0 ? 'Open POS' : 'Start new sale',
      to: '/pos',
      icon: ShoppingCart,
      tone: stats.dailySales > 0 ? 'success' : 'info',
    },
  ].filter(Boolean) as Array<{
    title: string;
    message: string;
    cta: string;
    to: string;
    icon: any;
    tone: string;
  }>;

  const allClear = stats.lowStock === 0 && stats.overdueRepairs === 0;

  return (
    <div className="space-y-8">
      <div className="hero-card rounded-xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute inset-0 soft-grid opacity-35 pointer-events-none" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#ed1978] to-[#f8a722]" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-3">Operations Desk</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">Operations command center.</h1>
            <p className="text-zinc-400 mt-4 max-w-2xl">Revenue, repair load, stock warnings, and the next best actions for the counter.</p>
          </div>
          <div className={cn(
            "rounded-xl border px-4 py-3 lg:min-w-[260px]",
            allClear ? "border-[#22C55E]/25 bg-[#22C55E]/10" : "border-[#F59E0B]/30 bg-[#F59E0B]/10"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", allClear ? "bg-[#22C55E]/15 text-[#86EFAC]" : "bg-[#F59E0B]/15 text-[#FCD34D]")}>
                {allClear ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Attention</p>
                <p className="font-black text-white">{allClear ? 'No urgent blockers' : 'Action needed'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
        <PrimaryKpiCard
          to="/pos"
          title="Today Revenue"
          value={formatCurrency(stats.dailySales)}
          empty={stats.dailySales <= 0}
          emptyMessage="No sales yet today. Open the register to start the first sale."
          cta={stats.dailySales > 0 ? 'Open cash register' : 'Start new sale'}
          icon={DollarSign}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DashboardKpiLink
            to="/repairs?status=open"
            title="Active Repairs"
            value={stats.activeRepairs.toString()}
            empty={stats.activeRepairs <= 0}
            emptyMessage="No active repairs"
            cta={stats.activeRepairs > 0 ? 'View queue' : 'Create job'}
            icon={Wrench}
            tone="info"
          />
          <DashboardKpiCard
            title="Monthly Profit"
            value={formatCurrency(stats.monthlyProfit)}
            empty={stats.monthlyProfit <= 0}
            emptyMessage="No profit recorded this month"
            icon={TrendingUp}
            tone="success"
          />
          <DashboardKpiLink
            to="/inventory"
            title="Low Stock"
            value={stats.lowStock.toString()}
            empty={stats.lowStock <= 0}
            emptyMessage="All good"
            cta={stats.lowStock > 0 ? 'Restock now' : 'View stock'}
            icon={Package}
            tone={stats.lowStock > 0 ? 'warning' : 'success'}
          />
          <DashboardKpiLink
            to="/repairs?status=open"
            title="Overdue Repairs"
            value={stats.overdueRepairs.toString()}
            empty={stats.overdueRepairs <= 0}
            emptyMessage="No overdue jobs"
            cta={stats.overdueRepairs > 0 ? 'Escalate queue' : 'View repairs'}
            icon={AlertTriangle}
            tone={stats.overdueRepairs > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      <div className="section-card rounded-xl border border-[#2A2A2E] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">What Needs Attention</p>
            <h2 className="mt-2 text-2xl font-black text-white">Next best actions</h2>
          </div>
          <p className="text-sm text-zinc-500">Jump straight into the work that moves the day forward.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {attentionItems.map((item) => (
            <ActionCard key={item.title} {...item} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {moduleItems.map((item, i) => (
          <Link
            key={i}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:-translate-y-0.5 section-card aspect-square text-center gap-3"
            )}
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-[#101012] border border-[#2A2A2E] shadow-sm", item.color)}>
              <item.icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold leading-tight text-white">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 section-card p-6 rounded-xl">
          <h3 className="text-2xl font-black mb-2 text-white">Sales Performance</h3>
          <p className="text-sm text-zinc-400 mb-6">Last 7 days of completed sales.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A2E" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#A1A1AA', fontSize: 12}} tickFormatter={(val) => `R${val}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #2A2A2E', boxShadow: '0 16px 40px rgb(0 0 0 / 0.36)', background: '#141416', color: '#FFFFFF' }}
                  formatter={(val: number) => [formatCurrency(val), 'Sales']}
                />
                <Bar dataKey="amount" fill="#22C55E" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card p-6 rounded-xl">
          <h3 className="text-2xl font-black mb-2 text-white">Top Products</h3>
          <p className="text-sm text-zinc-400 mb-6">Best performers from your recent sales flow.</p>
          <div className="space-y-6">
            {topProducts.length > 0 ? topProducts.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#101012] border border-[#2A2A2E] flex items-center justify-center text-xs font-bold text-[#f8a722]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.quantity} sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#86EFAC]">{formatCurrency(item.revenue)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-zinc-500 text-center py-8">No sales data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getToneClasses(toneName: string) {
  const tones: Record<string, { icon: string; value: string; card: string; button: string }> = {
    success: {
      icon: 'text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10',
      value: 'text-[#86EFAC]',
      card: 'border-[#22C55E]/25 bg-[#22C55E]/8',
      button: 'border-[#22C55E]/35 bg-[#22C55E]/12 text-[#86EFAC] hover:bg-[#22C55E]/18',
    },
    info: {
      icon: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
      value: 'text-[#93C5FD]',
      card: 'border-[#3B82F6]/25 bg-[#3B82F6]/8',
      button: 'border-[#3B82F6]/35 bg-[#3B82F6]/12 text-[#93C5FD] hover:bg-[#3B82F6]/18',
    },
    warning: {
      icon: 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10',
      value: 'text-[#FCD34D]',
      card: 'border-[#F59E0B]/30 bg-[#F59E0B]/10',
      button: 'border-[#F59E0B]/40 bg-[#F59E0B]/14 text-[#FCD34D] hover:bg-[#F59E0B]/20',
    },
    danger: {
      icon: 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10',
      value: 'text-[#FCA5A5]',
      card: 'border-[#EF4444]/30 bg-[#EF4444]/10',
      button: 'border-[#EF4444]/40 bg-[#EF4444]/14 text-[#FCA5A5] hover:bg-[#EF4444]/20',
    },
    neutral: {
      icon: 'text-zinc-300 border-[#2A2A2E] bg-[#101012]',
      value: 'text-white',
      card: 'border-[#2A2A2E] bg-[#141416]',
      button: 'border-[#2A2A2E] bg-[#101012] text-zinc-300 hover:bg-[#1C1C1F]',
    },
  };
  return tones[toneName] || tones.info;
}

function PrimaryKpiCard({ to, title, value, empty, emptyMessage, cta, icon: Icon }: any) {
  return (
    <Link to={to} className="group overflow-hidden rounded-xl border border-[#22C55E]/25 bg-[#111512] p-6 transition-all hover:-translate-y-0.5 hover:border-[#22C55E]/45 hover:shadow-[0_0_34px_rgba(34,197,94,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#86EFAC]">{title}</p>
          <p className="mt-3 text-5xl font-black leading-none text-[#22C55E] md:text-6xl">{value}</p>
          <p className="mt-4 max-w-md text-sm text-zinc-400">{empty ? emptyMessage : 'Completed sales recorded since opening today.'}</p>
        </div>
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#22C55E]/25 bg-[#22C55E]/10 text-[#86EFAC] sm:flex">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2.5 text-sm font-black text-white transition-colors group-hover:bg-[#16A34A]">
        {cta}
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function DashboardKpiCard({ title, value, empty, emptyMessage, icon: Icon, tone }: any) {
  const toneClasses = getToneClasses(tone);
  return (
    <div className={cn("rounded-xl border p-5", toneClasses.card)}>
      <div className="mb-4 flex items-center justify-between">
        <div className={cn("rounded-xl border p-3", toneClasses.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        {empty && <span className="rounded-full border border-[#2A2A2E] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">Empty</span>}
      </div>
      <p className="text-sm font-bold text-zinc-400">{title}</p>
      <p className={cn("mt-1 text-3xl font-black", toneClasses.value)}>{value}</p>
      <p className="mt-3 text-xs text-zinc-500">{empty ? emptyMessage : 'Month-to-date from completed sales.'}</p>
    </div>
  );
}

function DashboardKpiLink({ to, title, value, empty, emptyMessage, cta, icon: Icon, tone }: any) {
  const toneClasses = getToneClasses(tone);
  return (
    <Link to={to} className={cn("group rounded-xl border p-5 transition-all hover:-translate-y-0.5", toneClasses.card)}>
      <div className="mb-4 flex items-center justify-between">
        <div className={cn("rounded-xl border p-3", toneClasses.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">{empty ? 'Clear' : 'Open'}</span>
      </div>
      <p className="text-sm font-bold text-zinc-400">{title}</p>
      <p className={cn("mt-1 text-3xl font-black", toneClasses.value)}>{value}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-zinc-500">{empty ? emptyMessage : cta}</p>
        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ActionCard({ title, message, cta, to, icon: Icon, tone }: any) {
  const toneClasses = getToneClasses(tone);
  return (
    <div className={cn("rounded-xl border p-4", toneClasses.card)}>
      <div className="flex items-start gap-3">
        <div className={cn("rounded-xl border p-3", toneClasses.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-zinc-400">{message}</p>
          <Link to={to} className={cn("mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-colors", toneClasses.button)}>
            {cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
