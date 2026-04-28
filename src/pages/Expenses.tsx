import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Wallet,
  Calendar,
  Tag,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart2,
  DollarSign,
} from 'lucide-react';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { companyQuery, requireCompanyId } from '../lib/db';
import { withCompanyId } from '../lib/companyData';

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  created_at: string;
}

interface SaleRecord {
  id: string;
  total_amount?: number;
  profit?: number;
  created_at?: string;
}

interface RepairRecord {
  id: string;
  total_cost?: number;
  payments?: { amount?: number }[];
  status?: string;
  created_at?: string;
}

const TABS = [
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'pl', label: 'P&L Statement', icon: BarChart2 },
] as const;
type TabId = typeof TABS[number]['id'];

const EXPENSE_CATEGORIES = ['General', 'Rent', 'Utilities', 'Salaries', 'Stock', 'Marketing', 'Repairs', 'Transport', 'Insurance', 'Other'];

export default function Expenses() {
  const { companyId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [repairs, setRepairs] = useState<RepairRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [plPeriod, setPlPeriod] = useState<'this_month' | 'last_30' | 'last_90' | 'all'>('this_month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    amount: 0,
    category: 'General',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  useEffect(() => {
    fetchAll();
  }, [companyId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [expSnap, salesSnap, repairsSnap] = await Promise.all([
        getDocs(companyQuery('expenses', companyId, orderBy('date', 'desc'))),
        getDocs(companyQuery('sales', companyId)),
        getDocs(companyQuery('repairs', companyId)),
      ]);
      setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
      setSales(salesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SaleRecord)));
      setRepairs(repairsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RepairRecord)));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  // P&L period filter
  const plCutoff = useMemo(() => {
    const now = new Date();
    if (plPeriod === 'this_month') return startOfMonth(now);
    if (plPeriod === 'last_30') return subDays(now, 30);
    if (plPeriod === 'last_90') return subDays(now, 90);
    return new Date(0); // all time
  }, [plPeriod]);

  const plEndDate = useMemo(() => {
    if (plPeriod === 'this_month') return endOfMonth(new Date());
    return new Date();
  }, [plPeriod]);

  const plLabel = useMemo(() => {
    if (plPeriod === 'this_month') return format(new Date(), 'MMMM yyyy');
    if (plPeriod === 'last_30') return 'Last 30 Days';
    if (plPeriod === 'last_90') return 'Last 90 Days';
    return 'All Time';
  }, [plPeriod]);

  const plData = useMemo(() => {
    const inRange = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !Number.isNaN(d.getTime()) && d >= plCutoff && d <= plEndDate;
    };

    // Revenue from POS sales
    const posRevenue = sales
      .filter((s) => inRange(s.created_at))
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    const posProfit = sales
      .filter((s) => inRange(s.created_at))
      .reduce((sum, s) => sum + Number(s.profit || 0), 0);

    // Repair revenue (sum of payments)
    const repairRevenue = repairs
      .filter((r) => inRange(r.created_at))
      .reduce((sum, r) => {
        const paid = Array.isArray(r.payments)
          ? r.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
          : Number(r.total_cost || 0);
        return sum + paid;
      }, 0);

    // Expenses by category
    const filteredExpenses = expenses.filter((e) => inRange(e.date));
    const byCategory = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    });
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const totalRevenue = posRevenue + repairRevenue;
    const grossProfit = posProfit + repairRevenue; // repair revenue is treated as gross
    const netProfit = totalRevenue - totalExpenses;

    return {
      posRevenue,
      posProfit,
      repairRevenue,
      totalRevenue,
      grossProfit,
      totalExpenses,
      netProfit,
      byCategory: Array.from(byCategory.entries())
        .map(([cat, amount]) => ({ cat, amount }))
        .sort((a, b) => b.amount - a.amount),
      expenseCount: filteredExpenses.length,
    };
  }, [sales, repairs, expenses, plCutoff, plEndDate]);

  // Expenses tab
  const filteredExpenses = expenses.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );
  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({ title: expense.title, amount: expense.amount, category: expense.category, date: expense.date, notes: expense.notes || '' });
    } else {
      setEditingExpense(null);
      setFormData({ title: '', amount: 0, category: 'General', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), {
          ...formData,
          company_id: requireCompanyId(companyId),
          updated_at: new Date().toISOString(),
        });
        toast.success('Expense updated');
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...withCompanyId(requireCompanyId(companyId), formData),
          created_at: new Date().toISOString(),
        });
        toast.success('Expense added');
      }
      setIsModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense deleted');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500">Track spending and view profit &amp; loss.</p>
        </div>
        {activeTab === 'expenses' && (
          <button
            onClick={() => handleOpenModal()}
            className="appleberry-gradient text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading...</div>
      ) : (
        <>
          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Expenses (Filtered)</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search expenses by title or category..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          <Wallet className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>No expenses found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(expense.date, 'MMM dd, yyyy')}</td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{expense.title}</p>
                            {expense.notes && <p className="text-xs text-gray-400 line-clamp-1">{expense.notes}</p>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{expense.category}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(expense)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(expense.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* P&L TAB */}
          {activeTab === 'pl' && (
            <div className="space-y-6">
              {/* Period selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">Period:</span>
                {(['this_month', 'last_30', 'last_90', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      plPeriod === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p === 'this_month' ? 'This Month' : p === 'last_30' ? 'Last 30 Days' : p === 'last_90' ? 'Last 90 Days' : 'All Time'}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Report header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">Profit &amp; Loss Statement</h2>
                  <p className="text-sm text-gray-500 mt-1">{plLabel}</p>
                </div>

                <div className="px-8 py-6 space-y-0">
                  {/* INCOME */}
                  <PLSection title="Income" />
                  <PLRow label="POS / Retail Sales" value={plData.posRevenue} indent />
                  <PLRow label="Repair Revenue" value={plData.repairRevenue} indent />
                  <PLRow label="Total Revenue" value={plData.totalRevenue} bold />

                  <div className="my-4 border-t border-gray-100" />

                  {/* COST OF GOODS (proxy: revenue - profit for POS) */}
                  <PLSection title="Cost of Goods Sold" />
                  <PLRow label="Cost of Goods (POS)" value={plData.posRevenue - plData.posProfit} indent negative />
                  <PLRow label="Gross Profit" value={plData.posProfit + plData.repairRevenue} bold />

                  <div className="my-4 border-t border-gray-100" />

                  {/* OPERATING EXPENSES */}
                  <PLSection title="Operating Expenses" />
                  {plData.byCategory.map((row) => (
                    <PLRow key={row.cat} label={row.cat} value={row.amount} indent negative />
                  ))}
                  {plData.byCategory.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-400 italic">No expenses recorded for this period.</p>
                  )}
                  <PLRow label="Total Operating Expenses" value={plData.totalExpenses} bold negative />

                  <div className="my-4 border-t border-gray-200" />

                  {/* NET PROFIT */}
                  <div className={`flex items-center justify-between px-4 py-4 rounded-xl mt-2 ${
                    plData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <span className={`text-lg font-black ${plData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      Net {plData.netProfit >= 0 ? 'Profit' : 'Loss'}
                    </span>
                    <div className="flex items-center gap-2">
                      {plData.netProfit >= 0
                        ? <TrendingUp className="w-5 h-5 text-green-600" />
                        : <TrendingDown className="w-5 h-5 text-red-600" />
                      }
                      <span className={`text-2xl font-black ${plData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(Math.abs(plData.netProfit))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Total Revenue" value={plData.totalRevenue} color="blue" icon={DollarSign} />
                <SummaryCard label="Gross Profit" value={plData.posProfit + plData.repairRevenue} color="green" icon={TrendingUp} />
                <SummaryCard label="Total Expenses" value={plData.totalExpenses} color="red" icon={Wallet} />
                <SummaryCard label="Net Profit" value={plData.netProfit} color={plData.netProfit >= 0 ? 'green' : 'red'} icon={BarChart2} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Rent, Electricity, etc."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R)</label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 appleberry-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                  {editingExpense ? 'Update' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PLSection({ title }: { title: string }) {
  return (
    <div className="pt-2 pb-1">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</p>
    </div>
  );
}

function PLRow({ label, value, bold, indent, negative }: { label: string; value: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-4' : ''} ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold' : ''} ${negative && value > 0 ? 'text-red-600' : ''}`}>
        {negative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
      </span>
    </div>
  );
}

function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: number; color: 'blue' | 'green' | 'red'; icon: any }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-xl font-bold ${color === 'red' && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
        {formatCurrency(Math.abs(value))}
      </p>
    </div>
  );
}
