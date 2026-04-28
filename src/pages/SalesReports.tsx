import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { DollarSign, TrendingUp, ShoppingCart, CreditCard, AlertCircle, Package, Tag, Receipt, BarChart2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Profile, Customer } from '../types';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';

type SaleRecord = {
  id: string;
  company_id?: string | null;
  total_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  profit?: number;
  created_at?: string;
  staff_id?: string;
  staff_name?: string;
  payments?: { method?: string; amount?: number }[];
  payment_method?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  invoice_number?: string | null;
};

type SaleItem = {
  id: string;
  company_id?: string;
  sale_id?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  created_at?: string;
};

type ProductMeta = {
  id: string;
  category?: string;
  name?: string;
};

const PAYMENT_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'by_product', label: 'By Product', icon: Package },
  { id: 'by_category', label: 'By Category', icon: Tag },
  { id: 'by_tax', label: 'Tax', icon: Receipt },
  { id: 'unpaid', label: 'Unpaid Invoices', icon: AlertCircle },
] as const;
type TabId = typeof TABS[number]['id'];

export default function SalesReports() {
  const { companyId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [productMeta, setProductMeta] = useState<Map<string, ProductMeta>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  const [customerMap, setCustomerMap] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [companyId]);

  async function fetchReportData() {
    if (!companyId) return;
    setLoading(true);
    try {
      const [salesSnapshot, profilesSnapshot, itemsSnapshot, productsSnapshot] = await Promise.all([
        getDocs(companyQuery('sales', companyId)),
        getDocs(companyQuery('profiles', companyId)),
        getDocs(companyQuery('sale_items', companyId)),
        getDocs(companyQuery('products', companyId)),
      ]);

      const salesData = salesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SaleRecord));
      setSales(salesData);
      setSaleItems(itemsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SaleItem)));

      setStaffMap(
        new Map(
          profilesSnapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as Profile))
            .map((p) => [p.id, p.full_name || 'Staff Member'])
        )
      );

      setProductMeta(
        new Map(
          productsSnapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as ProductMeta))
            .map((p) => [p.id, p])
        )
      );

      // Load customers for unpaid invoices tab
      const customerIds = Array.from(new Set(salesData.map((s) => s.customer_id).filter(Boolean))) as string[];
      if (customerIds.length > 0) {
        const entries = await Promise.all(
          customerIds.map(async (id) => {
            const snap = await getDoc(doc(db, 'customers', id));
            return [id, snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null] as const;
          })
        );
        setCustomerMap(new Map(entries.filter((e): e is [string, Customer] => e[1] !== null)));
      }
    } catch (error) {
      console.error('Error fetching sales report data:', error);
    } finally {
      setLoading(false);
    }
  }

  const cutoff = useMemo(() => subDays(new Date(), period - 1), [period]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const d = sale.created_at ? new Date(sale.created_at) : null;
      return d && !Number.isNaN(d.getTime()) && d >= cutoff;
    });
  }, [period, sales, cutoff]);

  const filteredItems = useMemo(() => {
    const saleIds = new Set(filteredSales.map((s) => s.id));
    return saleItems.filter((item) => saleIds.has(item.sale_id || ''));
  }, [filteredSales, saleItems]);

  const metrics = useMemo(() => {
    const revenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const profit = filteredSales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
    const tickets = filteredSales.length;
    return { revenue, profit, tickets, averageTicket: tickets > 0 ? revenue / tickets : 0 };
  }, [filteredSales]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { day: string; sales: number; profit: number }>();
    filteredSales.forEach((s) => {
      const day = safeFormatDate(s.created_at, 'dd MMM', 'Unknown');
      const entry = map.get(day) || { day, sales: 0, profit: 0 };
      entry.sales += Number(s.total_amount || 0);
      entry.profit += Number(s.profit || 0);
      map.set(day, entry);
    });
    return Array.from(map.values());
  }, [filteredSales]);

  const paymentBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((s) => {
      if (Array.isArray(s.payments) && s.payments.length > 0) {
        s.payments.forEach((p) => {
          const key = (p.method || 'Unknown').toUpperCase();
          totals.set(key, (totals.get(key) || 0) + Number(p.amount || 0));
        });
      } else if (s.payment_method) {
        const key = s.payment_method.toUpperCase();
        totals.set(key, (totals.get(key) || 0) + Number(s.total_amount || 0));
      }
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  const staffPerformance = useMemo(() => {
    const totals = new Map<string, { name: string; sales: number; revenue: number; profit: number }>();
    filteredSales.forEach((s) => {
      const staffId = s.staff_id || 'unassigned';
      const entry = totals.get(staffId) || {
        name: staffMap.get(staffId) || s.staff_name || 'Unassigned',
        sales: 0, revenue: 0, profit: 0,
      };
      entry.sales += 1;
      entry.revenue += Number(s.total_amount || 0);
      entry.profit += Number(s.profit || 0);
      totals.set(staffId, entry);
    });
    return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, staffMap]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; category: string }>();
    filteredItems.forEach((item) => {
      const key = item.product_id || item.name || 'Unknown';
      const meta = item.product_id ? productMeta.get(item.product_id) : null;
      const entry = map.get(key) || {
        name: item.name || 'Unknown',
        qty: 0,
        revenue: 0,
        category: meta?.category || '—',
      };
      entry.qty += Number(item.quantity || 0);
      entry.revenue += Number(item.total_price || 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredItems, productMeta]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; qty: number; revenue: number; items: number }>();
    filteredItems.forEach((item) => {
      const meta = item.product_id ? productMeta.get(item.product_id) : null;
      const cat = meta?.category || 'Uncategorised';
      const entry = map.get(cat) || { category: cat, qty: 0, revenue: 0, items: 0 };
      entry.qty += Number(item.quantity || 0);
      entry.revenue += Number(item.total_price || 0);
      entry.items += 1;
      map.set(cat, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredItems, productMeta]);

  const taxSummary = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + Number(s.tax_amount || 0), 0);
    const subtotal = filteredSales.reduce((sum, s) => sum + Number(s.subtotal || s.total_amount || 0), 0);
    // monthly breakdown
    const monthly = new Map<string, { month: string; taxable: number; tax: number }>();
    filteredSales.forEach((s) => {
      const month = safeFormatDate(s.created_at, 'MMM yyyy', 'Unknown');
      const entry = monthly.get(month) || { month, taxable: 0, tax: 0 };
      entry.taxable += Number(s.subtotal || s.total_amount || 0);
      entry.tax += Number(s.tax_amount || 0);
      monthly.set(month, entry);
    });
    return { total, subtotal, monthly: Array.from(monthly.values()) };
  }, [filteredSales]);

  const unpaidInvoices = useMemo(() => {
    return sales
      .map((s) => {
        const payments = Array.isArray(s.payments) ? s.payments : [];
        const amountPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const balance = Math.max(0, Number(s.total_amount || 0) - amountPaid);
        const status: 'unpaid' | 'partial' = amountPaid <= 0 ? 'unpaid' : 'partial';
        return { sale: s, balance, amountPaid, status };
      })
      .filter((row) => row.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);
  }, [sales]);

  const totalUnpaid = unpaidInvoices.reduce((sum, row) => sum + row.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-gray-500">Revenue, profit, taxes, and inventory insights.</p>
        </div>
        {activeTab !== 'unpaid' && (
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'unpaid' && unpaidInvoices.length > 0 && (
              <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unpaidInvoices.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading report...</div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R${v}`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Mix</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                          {paymentBreakdown.map((entry, i) => (
                            <Cell key={entry.name} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {paymentBreakdown.map((entry, i) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                          <span className="text-gray-600 truncate">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-gray-900 ml-2">{formatCurrency(entry.value)}</span>
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
                      {staffPerformance.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No sales found.</td></tr>
                      ) : staffPerformance.map((entry) => (
                        <tr key={entry.name} className="border-b border-gray-50">
                          <td className="px-4 py-4 font-medium text-gray-900">{entry.name}</td>
                          <td className="px-4 py-4 text-right text-gray-600">{entry.sales}</td>
                          <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(entry.revenue)}</td>
                          <td className="px-4 py-4 text-right font-semibold text-green-600">{formatCurrency(entry.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BY PRODUCT TAB */}
          {activeTab === 'by_product' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Sales by Product</h3>
                <span className="text-sm text-gray-400">{byProduct.length} products</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Qty Sold</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No items found for this period.</td></tr>
                    ) : byProduct.map((row) => (
                      <tr key={row.name} className="border-b border-gray-50">
                        <td className="px-4 py-3.5 font-medium text-gray-900">{row.name}</td>
                        <td className="px-4 py-3.5 text-gray-500">{row.category}</td>
                        <td className="px-4 py-3.5 text-right text-gray-700">{row.qty}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {byProduct.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-900" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {byProduct.reduce((s, r) => s + r.qty, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {formatCurrency(byProduct.reduce((s, r) => s + r.revenue, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* BY CATEGORY TAB */}
          {activeTab === 'by_category' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Category</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => `R${v}`} />
                        <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} width={120} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Items Sold</th>
                          <th className="px-4 py-3 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byCategory.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">No data for this period.</td></tr>
                        ) : byCategory.map((row) => (
                          <tr key={row.category} className="border-b border-gray-50">
                            <td className="px-4 py-3.5 font-medium text-gray-900">{row.category}</td>
                            <td className="px-4 py-3.5 text-right text-gray-700">{row.qty}</td>
                            <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAX TAB */}
          {activeTab === 'by_tax' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">Taxable Sales (excl. VAT)</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(taxSummary.subtotal - taxSummary.total)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">VAT Collected</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(taxSummary.total)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">Gross (incl. VAT)</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(taxSummary.subtotal)}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Tax Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3 text-right">Gross Sales</th>
                        <th className="px-4 py-3 text-right">VAT Collected</th>
                        <th className="px-4 py-3 text-right">Net (excl. VAT)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxSummary.monthly.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No data for this period.</td></tr>
                      ) : taxSummary.monthly.map((row) => (
                        <tr key={row.month} className="border-b border-gray-50">
                          <td className="px-4 py-3.5 font-medium text-gray-900">{row.month}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{formatCurrency(row.taxable)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-blue-600">{formatCurrency(row.tax)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(row.taxable - row.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* UNPAID INVOICES TAB */}
          {activeTab === 'unpaid' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">Outstanding Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">{unpaidInvoices.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">Total Outstanding</p>
                  <p className="text-2xl font-bold text-red-500">{formatCurrency(totalUnpaid)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm text-gray-500 mb-1">Partial Payments</p>
                  <p className="text-2xl font-bold text-amber-500">{unpaidInvoices.filter((r) => r.status === 'partial').length}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Unpaid &amp; Partially Paid Invoices</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidInvoices.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">All invoices are paid!</td></tr>
                      ) : unpaidInvoices.map((row) => {
                        const customer = row.sale.customer_id ? customerMap.get(row.sale.customer_id) : null;
                        return (
                          <tr key={row.sale.id} className="border-b border-gray-50">
                            <td className="px-4 py-3.5 font-mono text-xs text-gray-700">
                              {row.sale.invoice_number || row.sale.id.slice(-8).toUpperCase()}
                            </td>
                            <td className="px-4 py-3.5 text-gray-700">{customer?.name || row.sale.customer_name || '—'}</td>
                            <td className="px-4 py-3.5 text-gray-500">{safeFormatDate(row.sale.created_at, 'dd MMM yyyy', '—')}</td>
                            <td className="px-4 py-3.5 text-right text-gray-700">{formatCurrency(Number(row.sale.total_amount || 0))}</td>
                            <td className="px-4 py-3.5 text-right text-gray-700">{formatCurrency(row.amountPaid)}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-red-500">{formatCurrency(row.balance)}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${
                                row.status === 'partial'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                {row.status === 'partial' ? 'Partial' : 'Unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
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
