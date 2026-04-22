import { useEffect, useMemo, useState } from 'react';
import { getDocs, orderBy } from 'firebase/firestore';
import { History, ShoppingCart, Wallet, Wrench, Package, Users, RotateCcw } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { useTenant } from '../lib/tenant';
import { companyQuery, companySubcollection } from '../lib/db';

type ActivityItem = {
  id: string;
  type: 'sale' | 'refund' | 'expense' | 'repair' | 'repair-history' | 'product' | 'customer';
  title: string;
  description: string;
  createdAt: string;
  actor?: string;
};

type RepairRecord = {
  id: string;
  company_id?: string | null;
  device_name?: string;
  customer_id?: string;
  created_at?: string;
  updated_at?: string;
};

export default function ActivityLog() {
  const { companyId } = useTenant();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityItem['type']>('all');

  useEffect(() => {
    fetchActivity();
  }, [companyId]);

  async function fetchActivity() {
    setLoading(true);
    try {
      const [salesSnapshot, refundsSnapshot, expensesSnapshot, productsSnapshot, customersSnapshot, repairsSnapshot] = await Promise.all([
        getDocs(companyQuery('sales', companyId)),
        getDocs(companyQuery('refunds', companyId)),
        getDocs(companyQuery('expenses', companyId)),
        getDocs(companyQuery('products', companyId)),
        getDocs(companyQuery('customers', companyId)),
        getDocs(companyQuery('repairs', companyId)),
      ]);

      const salesDocs = salesSnapshot.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as any));
      const refundDocs = refundsSnapshot.docs.map((refundDoc) => ({ id: refundDoc.id, ...refundDoc.data() } as any));
      const expensesDocs = expensesSnapshot.docs.map((expenseDoc) => ({ id: expenseDoc.id, ...expenseDoc.data() } as any));
      const productsDocs = productsSnapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() } as any));
      const customersDocs = customersSnapshot.docs.map((customerDoc) => ({ id: customerDoc.id, ...customerDoc.data() } as any));
      const repairRecords = repairsSnapshot.docs.map((repairDoc) => ({ id: repairDoc.id, ...repairDoc.data() } as RepairRecord));
      const historySnapshots = await Promise.all(
        repairRecords.map(async (repair) => {
          try {
            const historyQuery = companySubcollection(`repairs/${repair.id}/history`, companyId, orderBy('created_at', 'desc'));
            const historySnapshot = await getDocs(historyQuery);
            return historySnapshot.docs.map((historyDoc) => ({ repairId: repair.id, id: historyDoc.id, ...historyDoc.data() }));
          } catch (error) {
            console.error(`Error fetching history for repair ${repair.id}:`, error);
            return [];
          }
        })
      );

      const nextActivities: ActivityItem[] = [
        ...salesDocs.map((saleDoc: any) => ({
          id: `sale-${saleDoc.id}`,
          type: 'sale' as const,
          title: 'Sale completed',
          description: `Invoice #${saleDoc.id.slice(0, 8)} recorded in POS.`,
          createdAt: String(saleDoc.created_at || ''),
          actor: saleDoc.staff_id || 'POS',
        })),
        ...refundDocs.map((refundDoc: any) => ({
          id: `refund-${refundDoc.id}`,
          type: 'refund' as const,
          title: `${refundDoc.refund_type === 'full' ? 'Full' : 'Partial'} refund processed`,
          description: `Sale #${String(refundDoc.sale_id || '').slice(0, 8)} refunded for ${formatCurrency(Number(refundDoc.amount || 0))}. Reason: ${refundDoc.reason || 'No reason provided'}`,
          createdAt: String(refundDoc.created_at || ''),
          actor: refundDoc.processed_by || 'System',
        })),
        ...expensesDocs.map((expenseDoc: any) => ({
          id: `expense-${expenseDoc.id}`,
          type: 'expense' as const,
          title: 'Expense logged',
          description: `${expenseDoc.title || 'Expense'} added to expenses.`,
          createdAt: String(expenseDoc.created_at || expenseDoc.date || ''),
        })),
        ...productsDocs.map((productDoc: any) => ({
          id: `product-${productDoc.id}`,
          type: 'product' as const,
          title: 'Inventory item added',
          description: `${productDoc.name || 'Product'} created in inventory.`,
          createdAt: String(productDoc.created_at || ''),
        })),
        ...customersDocs.map((customerDoc: any) => ({
          id: `customer-${customerDoc.id}`,
          type: 'customer' as const,
          title: 'Customer added',
          description: `${customerDoc.name || 'Customer'} added to the customer list.`,
          createdAt: String(customerDoc.created_at || ''),
        })),
        ...repairRecords.map((repair) => ({
          id: `repair-${repair.id}`,
          type: 'repair' as const,
          title: 'Repair opened',
          description: `${repair.device_name || 'Repair job'} created.`,
          createdAt: String(repair.created_at || repair.updated_at || ''),
        })),
        ...historySnapshots.flat().map((history: any) => ({
          id: `repair-history-${history.repairId}-${history.id}`,
          type: 'repair-history' as const,
          title: 'Repair status updated',
          description: history.notes || `Repair ${String(history.repairId).slice(0, 8)} status changed.`,
          createdAt: String(history.created_at || ''),
          actor: history.changed_by || 'System',
        })),
      ]
        .filter((item) => item.createdAt)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 150);

      setActivities(nextActivities);
    } catch (error) {
      console.error('Error fetching activity log:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredActivities = useMemo(() => {
    if (typeFilter === 'all') return activities;
    return activities.filter((activity) => activity.type === typeFilter);
  }, [activities, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500">See recent operational changes across sales, repairs, customers, and stock.</p>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white"
        >
          <option value="all">All activity</option>
          <option value="sale">Sales</option>
          <option value="refund">Refunds</option>
          <option value="repair">Repairs</option>
          <option value="repair-history">Repair updates</option>
          <option value="expense">Expenses</option>
          <option value="product">Inventory</option>
          <option value="customer">Customers</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse flex gap-4 items-start p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))
          ) : filteredActivities.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No activity found for this filter.</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div key={activity.id} className="flex gap-4 items-start p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg(activity.type)}`}>
                  {iconForType(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <p className="font-semibold text-gray-900">{activity.title}</p>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{safeFormatDate(activity.createdAt, 'dd MMM yyyy HH:mm')}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                  {activity.actor && <p className="text-xs text-gray-400 mt-2">Actor: {activity.actor}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function iconForType(type: ActivityItem['type']) {
  const className = 'w-5 h-5';
  if (type === 'sale') return <ShoppingCart className={`${className} text-blue-600`} />;
  if (type === 'refund') return <RotateCcw className={`${className} text-red-600`} />;
  if (type === 'expense') return <Wallet className={`${className} text-red-600`} />;
  if (type === 'repair' || type === 'repair-history') return <Wrench className={`${className} text-amber-600`} />;
  if (type === 'product') return <Package className={`${className} text-violet-600`} />;
  return <Users className={`${className} text-green-600`} />;
}

function iconBg(type: ActivityItem['type']) {
  if (type === 'sale') return 'bg-blue-50';
  if (type === 'refund') return 'bg-red-50';
  if (type === 'expense') return 'bg-red-50';
  if (type === 'repair' || type === 'repair-history') return 'bg-amber-50';
  if (type === 'product') return 'bg-violet-50';
  return 'bg-green-50';
}
