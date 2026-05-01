import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Search, ShoppingBag, Plus, X, User, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Customer } from '../types';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';
import { withCompanyId } from '../lib/companyData';
import { toast } from 'sonner';

type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

type OrderRecord = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  total_amount: number;
  status: OrderStatus;
  items?: OrderItem[];
  notes?: string;
  created_at: string;
};

type OrderRow = {
  order: OrderRecord;
  customer: Customer | null;
  expanded: boolean;
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-zinc-700 text-gray-700' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
  ready: { label: 'Ready', color: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
};

export default function Orders() {
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [newOrder, setNewOrder] = useState({ customer_name: '', customer_phone: '', notes: '', items: [{ name: '', quantity: 1, unit_price: 0 }] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchOrders() {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(companyQuery('orders', companyId));
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderRecord));

      const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
      const customers: Record<string, Customer> = {};
      await Promise.all(
        customerIds.map(async (cid) => {
          const cSnap = await getDoc(doc(db, 'customers', cid));
          if (cSnap.exists()) customers[cid] = { id: cSnap.id, ...cSnap.data() } as Customer;
        })
      );

      setRows(
        orders
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((order) => ({
            order,
            customer: order.customer_id ? customers[order.customer_id] || null : null,
            expanded: false,
          }))
      );
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setRows((prev) => prev.map((r) => (r.order.id === id ? { ...r, expanded: !r.expanded } : r)));
  }

  async function updateStatus(id: string, status: OrderStatus) {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      setRows((prev) => prev.map((r) => r.order.id === id ? { ...r, order: { ...r.order, status } } : r));
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleCreateOrder() {
    if (!companyId) return;
    const items = newOrder.items.filter((i) => i.name.trim());
    if (!newOrder.customer_name || items.length === 0) {
      toast.error('Customer name and at least one item are required');
      return;
    }
    setSaving(true);
    try {
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      await addDoc(collection(db, 'orders'), withCompanyId(companyId, {
        customer_name: newOrder.customer_name,
        customer_phone: newOrder.customer_phone,
        notes: newOrder.notes,
        items,
        total_amount: total,
        status: 'pending' as OrderStatus,
        created_at: new Date().toISOString(),
      }));
      toast.success('Order created');
      setShowModal(false);
      setNewOrder({ customer_name: '', customer_phone: '', notes: '', items: [{ name: '', quantity: 1, unit_price: 0 }] });
      fetchOrders();
    } catch {
      toast.error('Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        row.order.id.toLowerCase().includes(q) ||
        (row.customer?.name || '').toLowerCase().includes(q) ||
        (row.customer?.phone || '').includes(q) ||
        ((row.order as any).customer_name || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || row.order.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.order.status] = (c[r.order.status] || 0) + 1; });
    return c;
  }, [rows]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22C55E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts['pending'] || 0} pending · {counts['ready'] || 0} ready for pickup
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-[#22C55E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16a34a] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders or customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22C55E] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#22C55E] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-gray-600">No orders found</p>
          <p className="mt-1 text-xs text-gray-400">Create your first order to get started.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Order</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2E]">
              {filteredRows.map((row) => {
                const st = STATUS_CONFIG[row.order.status] || STATUS_CONFIG.pending;
                const customerName = row.customer?.name || (row.order as any).customer_name || 'Walk-in';
                const customerPhone = row.customer?.phone || (row.order as any).customer_phone || '';
                return (
                  <>
                    <tr key={row.order.id} className="hover:bg-white/[0.02] cursor-pointer" onClick={() => toggleExpand(row.order.id)}>
                      <td className="px-5 py-4">
                        <span className="text-sm font-mono text-gray-600">{row.order.id.slice(-8).toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{customerName}</p>
                            {customerPhone && <p className="text-xs text-gray-400">{customerPhone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(row.order.total_amount)}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={row.order.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateStatus(row.order.id, e.target.value as OrderStatus)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border-0 cursor-pointer focus:outline-none ${st.color} bg-transparent`}
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k} className="bg-white text-white">{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">{safeFormatDate(row.order.created_at)}</td>
                      <td className="px-5 py-4">
                        {row.expanded
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </td>
                    </tr>
                    {row.expanded && (
                      <tr key={`${row.order.id}-expanded`} className="bg-[#0F0F11]">
                        <td colSpan={6} className="px-5 py-4">
                          {row.order.items && row.order.items.length > 0 ? (
                            <div className="space-y-1">
                              {row.order.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">{item.quantity}× {item.name}</span>
                                  <span className="text-gray-500">{formatCurrency(item.quantity * item.unit_price)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No items recorded</p>
                          )}
                          {row.order.notes && (
                            <p className="mt-2 text-xs text-gray-400 italic">{row.order.notes}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Order Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-[#0F0F11] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-white">New Order</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Customer Name *</label>
                  <input
                    type="text"
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={newOrder.customer_phone}
                    onChange={(e) => setNewOrder((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                    placeholder="072 000 0000"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500">Items *</label>
                  <button
                    onClick={() => setNewOrder((f) => ({ ...f, items: [...f.items, { name: '', quantity: 1, unit_price: 0 }] }))}
                    className="text-xs text-[#22C55E] hover:underline"
                  >
                    + Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {newOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => setNewOrder((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it) }))}
                        placeholder="Item name"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        min={1}
                        onChange={(e) => setNewOrder((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it) }))}
                        className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-white focus:border-[#22C55E] focus:outline-none"
                      />
                      <input
                        type="number"
                        value={item.unit_price}
                        min={0}
                        step={0.01}
                        onChange={(e) => setNewOrder((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, unit_price: Number(e.target.value) } : it) }))}
                        placeholder="Price"
                        className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-white focus:border-[#22C55E] focus:outline-none"
                      />
                      {newOrder.items.length > 1 && (
                        <button onClick={() => setNewOrder((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} className="text-gray-400 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm font-semibold text-gray-900">
                  Total: {formatCurrency(newOrder.items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes</label>
                <textarea
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none resize-none"
                  placeholder="Special instructions..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={saving}
                className="rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#16a34a] disabled:opacity-60 transition-colors"
              >
                {saving ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
