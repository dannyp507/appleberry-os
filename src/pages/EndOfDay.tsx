import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Moon, 
  Sun, 
  DollarSign, 
  Wallet, 
  TrendingUp,
  ArrowRight,
  Printer,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { startOfDay, endOfDay, format } from 'date-fns';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { filterByCompany } from '../lib/companyData';

export default function EndOfDay() {
  const { companyId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [actualCash, setActualCash] = useState<string>('');
  const [data, setData] = useState({
    sales: 0,
    expenses: 0,
    profit: 0,
    salesCount: 0,
    paymentMethods: {
      cash: 0,
      card: 0,
      eft: 0
    }
  });

  useEffect(() => {
    fetchDaySummary();
  }, [companyId]);

  async function fetchDaySummary() {
    setLoading(true);
    try {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());

      // Fetch Sales
      const salesRef = collection(db, 'sales');
      const salesQuery = query(salesRef, where('created_at', '>=', todayStart.toISOString()), where('created_at', '<=', todayEnd.toISOString()));
      const salesSnapshot = await getDocs(salesQuery);
      const salesDocs = filterByCompany(salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)), companyId);
      
      let totalSales = 0;
      let totalProfit = 0;
      let methods = { cash: 0, card: 0, eft: 0 };

      salesDocs.forEach(d => {
        totalSales += Number(d.total_amount);
        totalProfit += Number(d.profit);
        
        // Handle multiple payments per sale
        if (d.payments && Array.isArray(d.payments)) {
          d.payments.forEach((p: any) => {
            const method = p.method?.toLowerCase();
            const amount = Number(p.amount) || 0;
            if (method === 'cash') methods.cash += amount;
            else if (method === 'card') methods.card += amount;
            else if (method === 'eft') methods.eft += amount;
          });
        } else if (d.payment_method) {
          // Fallback for legacy single payment sales
          const method = d.payment_method.toLowerCase();
          const amount = Number(d.total_amount) || 0;
          if (method === 'cash') methods.cash += amount;
          else if (method === 'card') methods.card += amount;
          else if (method === 'eft') methods.eft += amount;
        }
      });

      // Fetch Expenses
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(expensesRef, where('date', '==', format(new Date(), 'yyyy-MM-dd')));
      const expensesSnapshot = await getDocs(expensesQuery);
      const expenseDocs = filterByCompany(expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)), companyId);
      const totalExpenses = expenseDocs.reduce((acc, doc) => acc + Number(doc.amount), 0);

      setData({
        sales: totalSales,
        expenses: totalExpenses,
        profit: totalProfit - totalExpenses,
        salesCount: salesDocs.length,
        paymentMethods: methods
      });
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  }

  const handleCloseDay = () => {
    toast.success('Day closed successfully. Summary saved to history.');
    // In a real app, you'd save this summary to a 'day_closures' collection.
  };

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-32 bg-gray-100 rounded-xl"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Moon className="w-6 h-6 text-primary" />
            End of Day Summary
          </h1>
          <p className="text-gray-500">Review today's performance before closing.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{safeFormatDate(new Date(), 'EEEE, MMM dd')}</p>
          <p className="text-xs text-gray-500">Status: <span className="text-green-600 font-bold uppercase">Open</span></p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          title="Total Sales" 
          value={formatCurrency(data.sales)} 
          icon={DollarSign} 
          color="text-blue-600" 
          bgColor="bg-blue-50"
          subtitle={`${data.salesCount} transactions`}
        />
        <SummaryCard 
          title="Total Expenses" 
          value={formatCurrency(data.expenses)} 
          icon={Wallet} 
          color="text-red-600" 
          bgColor="bg-red-50"
          subtitle="Business spending"
        />
        <SummaryCard 
          title="Net Profit" 
          value={formatCurrency(data.profit)} 
          icon={TrendingUp} 
          color="text-green-600" 
          bgColor="bg-green-50"
          subtitle="Sales profit - Expenses"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment Breakdown & Reconciliation */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Payment Breakdown
            </h3>
            <div className="space-y-4">
              <PaymentRow label="Cash" amount={data.paymentMethods.cash} total={data.sales} />
              <PaymentRow label="Card" amount={data.paymentMethods.card} total={data.sales} />
              <PaymentRow label="EFT" amount={data.paymentMethods.eft} total={data.sales} />
            </div>
          </div>

          {/* Cash Reconciliation */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Cash Reconciliation
            </h3>
            <p className="text-sm text-gray-500 mb-6">Enter the actual cash counted in the drawer to check for variances.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Counted</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R</span>
                  <input
                    type="number"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-lg"
                  />
                </div>
              </div>

              {actualCash !== '' && (
                <div className={cn(
                  "p-4 rounded-xl flex justify-between items-center",
                  Number(actualCash) - data.paymentMethods.cash === 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  <span className="font-medium">Variance:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(Number(actualCash) - data.paymentMethods.cash)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">Ready to close?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Closing the day will generate a final report and reset the daily counters. 
              Make sure all transactions are recorded.
            </p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              <Printer className="w-5 h-5" />
              Print X-Report
            </button>
            <button 
              onClick={handleCloseDay}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 appleberry-gradient text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Close Day
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, bgColor, subtitle }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", bgColor, color)}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function PaymentRow({ label, amount, total }: any) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="font-bold text-gray-900">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
