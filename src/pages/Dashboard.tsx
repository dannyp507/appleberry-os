import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  Package,
  Wrench,
  Truck,
  Users,
  History,
  Database,
  ShoppingCart,
  ArrowRight,
  FileText,
  Smartphone,
  CheckSquare,
  SunMedium,
  BarChart2,
  Settings,
  Megaphone,
  MessageSquare,
  Search,
  Calendar,
} from 'lucide-react';
import { safeFormatDate } from '../lib/utils';
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
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3B7DC8]" />
      </div>
    );
  }

  const allTiles = [
    { icon: ShoppingCart, label: 'Cash Register', path: '/pos', permission: 'pos.use' as PermissionKey },
    { icon: Wrench, label: 'Repairs', path: '/repairs', permission: 'repairs.view' as PermissionKey },
    { icon: FileText, label: 'Invoices', path: '/invoices', permission: 'invoices.view' as PermissionKey },
    { icon: Users, label: 'Customers', path: '/customers', permission: 'customers.view' as PermissionKey },
    { icon: Package, label: 'Products', path: '/inventory', permission: 'inventory.view' as PermissionKey },
    { icon: Smartphone, label: 'Devices', path: '/devices', permission: 'devices.view' as PermissionKey },
    { icon: DollarSign, label: 'Expenses', path: '/expenses', permission: 'expenses.view' as PermissionKey },
    { icon: SunMedium, label: 'End of Day', path: '/end-of-day', permission: 'end_of_day.view' as PermissionKey },
    { icon: CheckSquare, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' as PermissionKey },
    { icon: ArrowRight, label: 'Transfers', path: '/transfer', permission: 'transfer.view' as PermissionKey },
    { icon: Truck, label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' as PermissionKey },
    { icon: Calendar, label: 'Appointments', path: '/appointments', permission: 'appointments.view' as PermissionKey },
    { icon: BarChart2, label: 'Sales Reports', path: '/reports/sales', permission: 'reports.sales' as PermissionKey },
    { icon: BarChart2, label: 'Repairs Reports', path: '/reports/repairs', permission: 'reports.repairs' as PermissionKey },
    { icon: BarChart2, label: 'Inventory Reports', path: '/reports/inventory', permission: 'reports.inventory' as PermissionKey },
    { icon: Megaphone, label: 'Campaigns', path: '/campaigns', permission: 'marketing.view' as PermissionKey },
    { icon: MessageSquare, label: 'WhatsApp Studio', path: '/whatsapp-studio', permission: 'marketing.view' as PermissionKey },
    { icon: Search, label: 'IMEI Search', path: '/imei', permission: 'imei.view' as PermissionKey },
    { icon: History, label: 'Activity Log', path: '/activity', permission: 'activity.view' as PermissionKey },
    { icon: Users, label: 'Staff', path: '/staff', permission: 'staff.manage' as PermissionKey },
    { icon: Database, label: 'Manage Data', path: '/manage-data', permission: 'manage_data.view' as PermissionKey },
    { icon: Settings, label: 'Setup', path: '/setup', permission: 'staff.manage' as PermissionKey },
  ].filter(item => hasPermission(profile, item.permission));

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
      {allTiles.map(action => (
        <Link
          key={action.path}
          to={action.path}
          className="flex flex-col items-center justify-center gap-2 bg-[#3B7DC8] hover:bg-[#2d6db8] rounded-lg p-4 text-white transition-colors aspect-square min-h-[90px]"
        >
          <action.icon className="w-7 h-7" />
          <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
        </Link>
      ))}
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
