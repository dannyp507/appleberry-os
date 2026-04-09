import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Truck,
  LayoutDashboard,
  Moon,
  Calendar,
  Users,
  Globe,
  PieChart,
  History,
  PlayCircle,
  Database,
  Settings,
  Share2
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
import { Profile } from '../types';
import { PermissionKey, hasPermission } from '../lib/permissions';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord } from '../lib/companyData';

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
    lowStock: 0
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

      const salesRef = collection(db, 'sales');
      const dailyQuery = query(salesRef, where('created_at', '>=', today.toISOString()));
      const monthlyQuery = query(salesRef, where('created_at', '>=', monthStart.toISOString()));
      const repairsRef = collection(db, 'repairs');
      const productsRef = collection(db, 'products');
      const lowStockQuery = query(productsRef, where('stock', '<', 5));
      const chartQuery = query(salesRef, where('created_at', '>=', sevenDaysAgo.toISOString()));
      const topItemsQuery = query(collection(db, 'sale_items'), orderBy('created_at', 'desc'), limit(200));

      const [dailySnapshot, monthlySnapshot, repairsSnapshot, lowStockSnapshot, chartSnapshot, topItemsSnapshot] = await Promise.all([
        getDocs(dailyQuery),
        getDocs(monthlyQuery),
        getDocs(repairsRef),
        getDocs(lowStockQuery),
        getDocs(chartQuery),
        getDocs(topItemsQuery),
      ]);

      const dailyDocs = filterByCompany(dailySnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);
      const monthlyDocs = filterByCompany(monthlySnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);
      const repairDocs = filterByCompany(repairsSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);
      const lowStockDocs = filterByCompany(lowStockSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);
      const chartDocs = filterByCompany(chartSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);
      const topItemDocs = filterByCompany(topItemsSnapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as any)), companyId);

      const dailyTotal = dailyDocs.reduce((acc, snapshotDoc: any) => acc + Number(snapshotDoc.total_amount || 0), 0);
      const monthlyProfitTotal = monthlyDocs.reduce((acc, snapshotDoc: any) => acc + Number(snapshotDoc.profit || 0), 0);
      const activeRepairsCount = repairDocs.length;
      const lowStockCount = lowStockDocs.length;

      setStats({
        dailySales: dailyTotal,
        monthlyProfit: monthlyProfitTotal,
        activeRepairs: activeRepairsCount,
        lowStock: lowStockCount
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
      { icon: Wallet, label: 'Expenses', path: '/expenses', color: 'bg-[#0088B5]', permission: 'expenses.view' as PermissionKey },
      { icon: Truck, label: 'Inventory Transfer', path: '/transfer', color: 'bg-[#0088B5]', permission: 'transfer.view' as PermissionKey },
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'bg-[#0088B5]', permission: 'dashboard.view' as PermissionKey },
      { icon: Moon, label: 'End of Day', path: '/end-of-day', color: 'bg-[#0088B5]', permission: 'end_of_day.view' as PermissionKey },
      { icon: Calendar, label: 'Appointment Calendar', path: '/appointments', color: 'bg-[#0088B5]', permission: 'appointments.view' as PermissionKey },
      { icon: Users, label: 'Staff Employee', path: '/staff', color: 'bg-[#0088B5]', permission: 'staff.manage' as PermissionKey },
      { icon: Globe, label: 'Website', path: '/website', color: 'bg-[#0088B5]', permission: 'website.view' as PermissionKey },
      { icon: PieChart, label: 'Sales Reports', path: '/reports/sales', color: 'bg-[#0088B5]', permission: 'reports.sales' as PermissionKey },
      { icon: PieChart, label: 'Repairs Reports', path: '/reports/repairs', color: 'bg-[#0088B5]', permission: 'reports.repairs' as PermissionKey },
      { icon: PieChart, label: 'Inventory Reports', path: '/reports/inventory', color: 'bg-[#0088B5]', permission: 'reports.inventory' as PermissionKey },
      { icon: History, label: 'Activity Log', path: '/activity', color: 'bg-[#0088B5]', permission: 'activity.view' as PermissionKey },
      { icon: PlayCircle, label: 'Getting Started', path: '/getting-started', color: 'bg-[#0088B5]', permission: 'getting_started.view' as PermissionKey },
      { icon: Database, label: 'Manage Data', path: '/manage-data', color: 'bg-[#0088B5]', permission: 'manage_data.view' as PermissionKey },
      { icon: Settings, label: 'Setup', path: '/setup', color: 'bg-[#0088B5]', permission: 'setup.view' as PermissionKey },
      { icon: Share2, label: 'Integrations', path: '/integrations', color: 'bg-[#0088B5]', permission: 'integrations.view' as PermissionKey },
    ];

    return items.filter((item) => hasPermission(profile, item.permission));
  }, [profile]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 section-card rounded-2xl"></div>)}
      </div>
      <div className="h-96 section-card rounded-2xl"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="hero-card rounded-[28px] p-6 md:p-8 overflow-hidden relative">
        <div className="absolute inset-0 soft-grid opacity-50 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-3">Appleberry OS</p>
            <h1 className="display-font text-4xl md:text-5xl font-bold text-[#18242b] leading-none">Repair commerce, stock, and service in one place.</h1>
            <p className="text-[#5d6468] mt-4 max-w-2xl">
              Welcome back to Appleberry OS. Keep sales moving, repairs on schedule, and inventory under control from one operations desk.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/70 border border-white/70 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">Today</p>
              <p className="text-2xl font-bold text-[#18242b] mt-2">{formatCurrency(stats.dailySales)}</p>
            </div>
            <div className="rounded-2xl bg-[#18333d] text-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Repairs</p>
              <p className="text-2xl font-bold mt-2">{stats.activeRepairs}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Daily Sales" 
          value={formatCurrency(stats.dailySales)} 
          icon={DollarSign} 
          trend="+12%" 
          trendUp={true}
          color="bg-blue-500"
        />
        <StatCard 
          title="Monthly Profit" 
          value={formatCurrency(stats.monthlyProfit)} 
          icon={TrendingUp} 
          trend="+8%" 
          trendUp={true}
          color="bg-green-500"
        />
        <StatCard 
          title="Active Repairs" 
          value={stats.activeRepairs.toString()} 
          icon={Wrench} 
          trend="-2" 
          trendUp={false}
          color="bg-orange-500"
        />
        <StatCard 
          title="Low Stock Items" 
          value={stats.lowStock.toString()} 
          icon={Package} 
          trend={stats.lowStock > 0 ? "Action needed" : "All good"} 
          trendUp={stats.lowStock === 0}
          color="bg-pink-500"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {moduleItems.map((item, i) => (
          <Link
            key={i}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl transition-all hover:-translate-y-0.5 section-card aspect-square text-center gap-3 border border-[#dbc8b2]"
            )}
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm", item.color)}>
              <item.icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold leading-tight text-[#18242b]">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 section-card p-6 rounded-[24px]">
          <h3 className="display-font text-2xl font-bold mb-2 text-[#18242b]">Sales Performance</h3>
          <p className="text-sm text-[#6a6f72] mb-6">Last 7 days of completed sales.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadac8" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `R${val}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #eadac8', boxShadow: '0 10px 30px rgb(0 0 0 / 0.08)', background: '#fffaf3' }}
                  formatter={(val: number) => [formatCurrency(val), 'Sales']}
                />
                <Bar dataKey="amount" fill="#c65a22" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card p-6 rounded-[24px]">
          <h3 className="display-font text-2xl font-bold mb-2 text-[#18242b]">Top Products</h3>
          <p className="text-sm text-[#6a6f72] mb-6">Best performers from your recent sales flow.</p>
          <div className="space-y-6">
            {topProducts.length > 0 ? topProducts.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#efe0ce] flex items-center justify-center text-xs font-bold text-[#7b5c3c]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity} sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.revenue)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500 text-center py-8">No sales data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, color }: any) {
  return (
    <div className="section-card p-6 rounded-[24px]">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl text-white shadow-sm", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn(
          "flex items-center text-xs font-medium px-2 py-1 rounded-full",
          trendUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm text-[#6a6f72] font-medium">{title}</p>
        <p className="text-2xl font-bold text-[#18242b]">{value}</p>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
