import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from 'firebase/firestore';
import {
  Moon,
  DollarSign,
  Wallet,
  TrendingUp,
  ArrowRight,
  Printer,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  History,
} from 'lucide-react';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { startOfDay, endOfDay, format } from 'date-fns';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { companyQuery, requireCompanyId } from '../lib/db';

// ─── payment method helpers ───────────────────────────────────────────────────
const ALL_METHODS = [
  'Cash', 'Cheque', 'Visa', 'Mastercard', 'AMEX', 'Discover',
  'Other', 'Debit Card', 'EFT Via Capital', 'EFT Via FNB', 'EFT',
];

function normMethod(m: string) {
  return (m || '').toLowerCase().trim();
}

function bucketPayment(method: string, amount: number, acc: Record<string, number>) {
  const key = ALL_METHODS.find(m => normMethod(m) === normMethod(method)) || 'Other';
  acc[key] = (acc[key] || 0) + amount;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function EndOfDay() {
  const { companyId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  // Cash reconciliation
  const [startingBalance, setStartingBalance] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [comments, setComments] = useState('');

  // Petty cash
  const [pettyItems, setPettyItems] = useState<any[]>([]);
  const [newPettyDesc, setNewPettyDesc] = useState('');
  const [newPettyAmount, setNewPettyAmount] = useState('');
  const [newPettyType, setNewPettyType] = useState<'in' | 'out'>('out');
  const [showPetty, setShowPetty] = useState(true);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Data
  const [data, setData] = useState({
    sales: 0,
    expenses: 0,
    repairs: 0,
    repairsCount: 0,
    salesCount: 0,
    paymentMethods: {} as Record<string, number>,
    storeCreditUsed: 0,
    salesDocs: [] as any[],
  });

  useEffect(() => {
    if (companyId) {
      fetchDaySummary();
      fetchPettyCash();
      fetchHistory();
    }
  }, [companyId]);

  async function fetchDaySummary() {
    setLoading(true);
    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [salesSnap, expSnap, repairSnap] = await Promise.all([
        getDocs(companyQuery('sales', companyId,
          where('created_at', '>=', todayStart),
          where('created_at', '<=', todayEnd)
        )),
        getDocs(companyQuery('expenses', companyId,
          where('date', '==', format(new Date(), 'yyyy-MM-dd'))
        )),
        getDocs(companyQuery('repairs', companyId,
          where('updated_at', '>=', todayStart),
          where('updated_at', '<=', todayEnd)
        )),
      ]);

      const salesDocs = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const expDocs = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const repairDocs = repairSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const methods: Record<string, number> = {};
      let totalSales = 0;

      salesDocs.forEach(d => {
        totalSales += Number(d.total_amount) || 0;
        if (d.payment_methods && Array.isArray(d.payment_methods)) {
          // new format: array of method strings parallel to payments array
          (d.payments || []).forEach((p: any) => bucketPayment(p.method, Number(p.amount) || 0, methods));
        } else if (d.payments && Array.isArray(d.payments)) {
          d.payments.forEach((p: any) => bucketPayment(p.method, Number(p.amount) || 0, methods));
        } else if (d.payment_method) {
          bucketPayment(d.payment_method, Number(d.total_amount) || 0, methods);
        }
      });

      const totalExpenses = expDocs.reduce((a, d) => a + (Number(d.amount) || 0), 0);
      const repairRevenue = repairDocs.reduce((a, d) => a + (Number(d.paid_amount) || 0), 0);

      setData({
        sales: totalSales,
        expenses: totalExpenses,
        repairs: repairRevenue,
        repairsCount: repairDocs.filter(r => r.paid_amount > 0).length,
        salesCount: salesDocs.length,
        paymentMethods: methods,
        storeCreditUsed: 0,
        salesDocs,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPettyCash() {
    if (!companyId) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      const snap = await getDocs(
        query(collection(db, 'petty_cash'),
          where('company_id', '==', companyId),
          where('date', '==', todayStr),
          orderBy('created_at', 'asc')
        )
      );
      setPettyItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* index might not exist yet */ }
  }

  async function fetchHistory() {
    if (!companyId) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'end_of_day'),
          where('company_id', '==', companyId),
          orderBy('created_at', 'desc'),
          limit(10)
        )
      );
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* index might not exist yet */ }
  }

  async function handleAddPetty() {
    if (!newPettyDesc.trim() || !newPettyAmount || !companyId) return;
    const cid = requireCompanyId(companyId);
    const now = new Date().toISOString();
    const item = {
      company_id: cid,
      type: newPettyType,
      reason: newPettyDesc.trim(),
      amount: parseFloat(newPettyAmount) || 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      staff_id: auth.currentUser?.uid || '',
      created_at: now,
    };
    try {
      const ref = await addDoc(collection(db, 'petty_cash'), item);
      setPettyItems([...pettyItems, { id: ref.id, ...item }]);
      setNewPettyDesc('');
      setNewPettyAmount('');
      toast.success('Petty cash entry added');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleCloseDay() {
    if (!companyId) return;
    setClosing(true);
    try {
      const cid = requireCompanyId(companyId);
      const now = new Date().toISOString();
      const totalPettyIn = pettyItems.filter(p => p.type === 'in').reduce((a, p) => a + p.amount, 0);
      const totalPettyOut = pettyItems.filter(p => p.type === 'out').reduce((a, p) => a + p.amount, 0);
      const calcCash = (data.paymentMethods['Cash'] || 0) + parseFloat(startingBalance || '0') - totalPettyOut + totalPettyIn;

      await addDoc(collection(db, 'end_of_day'), {
        company_id: cid,
        date: format(new Date(), 'yyyy-MM-dd'),
        starting_balance: parseFloat(startingBalance) || 0,
        counted_cash: parseFloat(countedCash) || 0,
        calculated_cash: calcCash,
        cash_variance: (parseFloat(countedCash) || 0) - calcCash,
        total_sales: data.sales,
        total_expenses: data.expenses,
        total_repair_revenue: data.repairs,
        payment_methods: data.paymentMethods,
        petty_cash_in: totalPettyIn,
        petty_cash_out: totalPettyOut,
        comments: comments.trim(),
        closed_by: auth.currentUser?.uid || '',
        created_at: now,
      });
      toast.success('Day closed and saved to history');
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClosing(false);
    }
  }

  const totalPettyIn = pettyItems.filter(p => p.type === 'in').reduce((a, p) => a + p.amount, 0);
  const totalPettyOut = pettyItems.filter(p => p.type === 'out').reduce((a, p) => a + p.amount, 0);
  const calcCash = (data.paymentMethods['Cash'] || 0) + parseFloat(startingBalance || '0') - totalPettyOut + totalPettyIn;
  const variance = countedCash !== '' ? parseFloat(countedCash) - calcCash : null;

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 bg-[#1C1C1F] rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-[#1C1C1F] rounded-2xl" />)}</div>
    </div>
  );

  const activeMethods = Object.entries(data.paymentMethods).filter(([, v]) => v > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Moon className="w-6 h-6 text-[#22C55E]" /> End of Day Report
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">{safeFormatDate(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-[#2A2A2E] rounded-xl text-zinc-300 text-sm hover:bg-[#1C1C1F]">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 border border-[#2A2A2E] rounded-xl text-zinc-300 text-sm hover:bg-[#1C1C1F]"
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-5">
          <h3 className="font-bold text-white mb-3 text-sm">Recent End of Day Records</h3>
          {history.length === 0 ? (
            <p className="text-zinc-500 text-sm italic">No records yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-[#2A2A2E] text-sm">
                  <span className="text-zinc-300">{h.date}</span>
                  <span className="text-white font-bold">{formatCurrency(h.total_sales)}</span>
                  <span className={variance != null && variance !== 0 ? 'text-red-400' : 'text-green-400'}>
                    {h.cash_variance >= 0 ? '+' : ''}{formatCurrency(h.cash_variance || 0)} variance
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Sales" value={formatCurrency(data.sales)} sub={`${data.salesCount} transactions`} icon={DollarSign} color="text-blue-400" />
        <StatCard title="Repair Revenue" value={formatCurrency(data.repairs)} sub={`${data.repairsCount} paid repairs`} icon={TrendingUp} color="text-green-400" />
        <StatCard title="Expenses" value={formatCurrency(data.expenses)} sub="Today's costs" icon={Wallet} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Payment Breakdown */}
          <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> Payment Breakdown
            </h3>
            {activeMethods.length === 0 ? (
              <p className="text-zinc-500 text-sm italic">No sales recorded today.</p>
            ) : (
              <div className="space-y-3">
                {activeMethods.map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center py-1 border-b border-[#2A2A2E]">
                    <span className="text-sm text-zinc-300">{method}</span>
                    <span className="font-bold text-white">{formatCurrency(amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-bold text-zinc-400">Total</span>
                  <span className="font-black text-white">{formatCurrency(data.sales)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Petty Cash */}
          <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416]">
            <button
              onClick={() => setShowPetty(!showPetty)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <h3 className="font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-yellow-400" /> Petty Cash
                <span className="text-xs text-zinc-400 font-normal ml-1">In: {formatCurrency(totalPettyIn)} | Out: {formatCurrency(totalPettyOut)}</span>
              </h3>
              {showPetty ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>
            {showPetty && (
              <div className="px-5 pb-5 space-y-3 border-t border-[#2A2A2E] pt-4">
                {/* Add petty cash */}
                <div className="flex gap-2">
                  <select
                    value={newPettyType}
                    onChange={e => setNewPettyType(e.target.value as 'in' | 'out')}
                    className="px-2 py-2 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none"
                  >
                    <option value="out">Out ▼</option>
                    <option value="in">In ▲</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Reason…"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none"
                    value={newPettyDesc}
                    onChange={e => setNewPettyDesc(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    className="w-24 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none"
                    value={newPettyAmount}
                    onChange={e => setNewPettyAmount(e.target.value)}
                  />
                  <button
                    onClick={handleAddPetty}
                    className="px-3 py-2 bg-[#22C55E] text-black rounded-lg text-sm font-bold hover:bg-[#16a34a]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {pettyItems.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {pettyItems.map(p => (
                      <div key={p.id} className="flex justify-between items-center py-1.5 text-sm border-b border-[#2A2A2E]">
                        <span className="text-zinc-400">{p.reason}</span>
                        <span className={p.type === 'in' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {p.type === 'in' ? '+' : '-'}{formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Cash Reconciliation */}
          <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#22C55E]" /> Cash Drawer Count
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Starting Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">R</span>
                  <input
                    type="number"
                    value={startingBalance}
                    onChange={e => setStartingBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-zinc-400">Cash Sales Today</span>
                <span className="font-bold text-white">{formatCurrency(data.paymentMethods['Cash'] || 0)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm border-t border-[#2A2A2E]">
                <span className="text-zinc-400">Petty Cash Out</span>
                <span className="font-bold text-red-400">-{formatCurrency(totalPettyOut)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold border-t border-[#2A2A2E]">
                <span className="text-zinc-300">Calculated Cash</span>
                <span className="text-white">{formatCurrency(calcCash)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Counted Cash</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">R</span>
                  <input
                    type="number"
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
              </div>
              {variance !== null && (
                <div className={cn(
                  'flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm',
                  variance === 0 ? 'bg-green-900/20 text-green-400 border border-green-800' :
                  variance > 0 ? 'bg-blue-900/20 text-blue-400 border border-blue-800' :
                  'bg-red-900/20 text-red-400 border border-red-800'
                )}>
                  <span>Variance</span>
                  <span>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Comments + Close */}
          <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Comments</label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                placeholder="Any notes for today…"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#101012] text-white text-sm focus:border-[#22C55E] focus:outline-none resize-none"
              />
            </div>
            <button
              onClick={handleCloseDay}
              disabled={closing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#22C55E] text-black font-black rounded-xl hover:bg-[#16a34a] disabled:opacity-50 transition-all"
            >
              {closing ? 'Saving…' : 'Close Day & Save Report'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-5">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', color, 'bg-current/10')}>
        <Icon className={cn('w-5 h-5', color)} style={{ opacity: 1 }} />
      </div>
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
    </div>
  );
}
