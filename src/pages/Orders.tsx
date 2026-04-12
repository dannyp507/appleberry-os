import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { Search, FileText, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Customer } from '../types';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord } from '../lib/companyData';

type OrderRecord = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  total_amount?: number;
  status?: string;
  created_at?: string;
  items?: any[];
};

type OrderRow = {
  order: OrderRecord;
  customer: Customer | null;
};

export default function Orders() {
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    fetchOrders();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as OrderRecord))
        .filter(order => !companyId || !isCompanyScopedRecord(order) || order.company_id === companyId);

      const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
      const customers: Record<string, Customer> = {};

      for (const customerId of customerIds) {
        if (customerId) {
          const customerSnap = await getDoc(doc(db, 'customers', customerId));
          if (customerSnap.exists()) {
            customers[customerId] = { id: customerSnap.id, ...customerSnap.data() } as Customer;
          }
        }
      }

      const orderRows: OrderRow[] = orders.map(order => ({
        order,
        customer: order.customer_id ? customers[order.customer_id] || null : null,
      }));

      setRows(orderRows);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesSearch =
        !search ||
        row.order.id.toLowerCase().includes(search.toLowerCase()) ||
        row.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        row.customer?.phone?.includes(search);

      const matchesStatus = statusFilter === 'all' || row.order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <Link
          to="/orders/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <FileText className="h-4 w-4" />
          New Order
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order id or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((row) => (
                <tr key={row.order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.order.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.customer ? (
                      <div>
                        <div className="font-medium">{row.customer.name}</div>
                        <div className="text-gray-500">{row.customer.phone}</div>
                      </div>
                    ) : (
                      <span className="text-gray-500">Walk-in</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(row.order.total_amount || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      row.order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      row.order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {row.order.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {safeFormatDate(row.order.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/orders/${row.order.id}`}
                      className="text-primary hover:text-primary/80"
                    >
                      <Eye className="h-4 w-4 inline" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new order.</p>
          </div>
        )}
      </div>
    </div>
  );
}