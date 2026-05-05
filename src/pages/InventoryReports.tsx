import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { Package, AlertTriangle, DollarSign, TrendingDown, ArrowUpDown } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';
import { Product } from '../types';

type SortField = 'name' | 'stock' | 'cost_price' | 'selling_price' | 'value';
type SortDir = 'asc' | 'desc';

const CHART_COLORS = ['#22C55E', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

export default function InventoryReports() {
  const { companyId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'by_category' | 'low_stock' | 'valuation'>('overview');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    fetchInventory();
  }, [companyId]);

  async function fetchInventory() {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(companyQuery('products', companyId));
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  const physicalProducts = useMemo(() => products.filter((p) => p.product_type !== 'service'), [products]);

  const stats = useMemo(() => {
    const totalSkus = physicalProducts.length;
    const totalUnits = physicalProducts.reduce((s, p) => s + p.stock, 0);
    const costValue = physicalProducts.reduce((s, p) => s + p.stock * p.cost_price, 0);
    const retailValue = physicalProducts.reduce((s, p) => s + p.stock * p.selling_price, 0);
    const potentialProfit = retailValue - costValue;
    const lowStock = physicalProducts.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length;
    const outOfStock = physicalProducts.filter((p) => p.stock === 0).length;
    return { totalSkus, totalUnits, costValue, retailValue, potentialProfit, lowStock, outOfStock };
  }, [physicalProducts]);

  const categoryData = useMemo(() => {
    const map: Record<string, { units: number; costValue: number; retailValue: number; skus: number }> = {};
    physicalProducts.forEach((p) => {
      const cat = p.category || 'Uncategorised';
      if (!map[cat]) map[cat] = { units: 0, costValue: 0, retailValue: 0, skus: 0 };
      map[cat].units += p.stock;
      map[cat].costValue += p.stock * p.cost_price;
      map[cat].retailValue += p.stock * p.selling_price;
      map[cat].skus += 1;
    });
    return Object.entries(map)
      .map(([category, d]) => ({ category, ...d }))
      .sort((a, b) => b.retailValue - a.retailValue);
  }, [physicalProducts]);

  const sortedProducts = useMemo(() => {
    return [...physicalProducts].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'name') { av = a.name; bv = b.name; }
      else if (sortField === 'stock') { av = a.stock; bv = b.stock; }
      else if (sortField === 'cost_price') { av = a.cost_price; bv = b.cost_price; }
      else if (sortField === 'selling_price') { av = a.selling_price; bv = b.selling_price; }
      else if (sortField === 'value') { av = a.stock * a.cost_price; bv = b.stock * b.cost_price; }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [physicalProducts, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'by_category', label: 'By Category' },
    { id: 'low_stock', label: `Low Stock (${stats.lowStock + stats.outOfStock})` },
    { id: 'valuation', label: 'Valuation' },
  ] as const;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22C55E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">{stats.totalSkus} SKUs · {stats.totalUnits.toLocaleString()} units on hand</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Package, label: 'Cost Value', value: formatCurrency(stats.costValue), sub: `${stats.totalSkus} SKUs`, color: 'text-blue-400' },
          { icon: DollarSign, label: 'Retail Value', value: formatCurrency(stats.retailValue), sub: 'at selling price', color: 'text-[#22C55E]' },
          { icon: TrendingDown, label: 'Potential Profit', value: formatCurrency(stats.potentialProfit), sub: 'if all sold', color: 'text-purple-400' },
          { icon: AlertTriangle, label: 'Stock Alerts', value: `${stats.lowStock + stats.outOfStock}`, sub: `${stats.outOfStock} out · ${stats.lowStock} low`, color: 'text-amber-400' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gray-50 p-2.5">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{card.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-[#22C55E] text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Stock by Category</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
              <XAxis dataKey="category" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#141416', border: '1px solid #2A2A2E', borderRadius: 8, color: '#fff' }}
                formatter={(val: number) => [val.toLocaleString(), 'Units']}
              />
              <Bar dataKey="units" radius={[4, 4, 0, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Category table */}
      {tab === 'by_category' && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">SKUs</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Units</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost Value</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Retail Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryData.map((row, i) => (
                <tr key={row.category} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm font-medium text-gray-900">{row.category}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{row.skus}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{row.units.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{formatCurrency(row.costValue)}</td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#22C55E]">{formatCurrency(row.retailValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="px-5 py-3.5 text-sm font-bold text-gray-900">Total</td>
                <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900">{stats.totalSkus}</td>
                <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900">{stats.totalUnits.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900">{formatCurrency(stats.costValue)}</td>
                <td className="px-5 py-3.5 text-right text-sm font-bold text-[#22C55E]">{formatCurrency(stats.retailValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Low Stock */}
      {tab === 'low_stock' && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {physicalProducts.filter((p) => p.stock <= p.low_stock_threshold).length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-zinc-600" />
              <p className="mt-3 text-sm text-gray-500">All products are sufficiently stocked</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Threshold</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {physicalProducts
                  .filter((p) => p.stock <= p.low_stock_threshold)
                  .sort((a, b) => a.stock - b.stock)
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{p.category}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-sm font-bold ${p.stock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-gray-400">{p.low_stock_threshold}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          p.stock === 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Valuation */}
      {tab === 'valuation' && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {[
                  { label: 'Product', field: 'name' as SortField },
                  { label: 'Stock', field: 'stock' as SortField },
                  { label: 'Cost Price', field: 'cost_price' as SortField },
                  { label: 'Sell Price', field: 'selling_price' as SortField },
                  { label: 'Stock Value', field: 'value' as SortField },
                ].map((col) => (
                  <th
                    key={col.field}
                    onClick={() => toggleSort(col.field)}
                    className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 first:text-left"
                  >
                    <span className="flex items-center gap-1 justify-end first:justify-start">
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{p.stock}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{formatCurrency(p.cost_price)}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-600">{formatCurrency(p.selling_price)}</td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900">{formatCurrency(p.stock * p.cost_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
