import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import {
  CheckCircle2,
  ClipboardList,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Product } from '../types';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { companyQuery, requireCompanyId } from '../lib/db';

type PurchaseOrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

type PurchaseOrderLine = {
  product_id: string;
  product_name: string;
  sku: string | null;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
};

type PurchaseOrder = {
  id: string;
  company_id?: string | null;
  po_number: string;
  supplier_name: string;
  supplier_email: string | null;
  supplier_phone: string | null;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  notes: string | null;
  items: PurchaseOrderLine[];
  subtotal: number;
  total_items: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  received_at?: string | null;
};

type PurchaseOrderLineDraft = {
  product_id: string;
  ordered_quantity: number;
  unit_cost: number;
};

const emptyLine = (): PurchaseOrderLineDraft => ({
  product_id: '',
  ordered_quantity: 1,
  unit_cost: 0,
});

const defaultForm = {
  supplier_name: '',
  supplier_email: '',
  supplier_phone: '',
  expected_date: '',
  notes: '',
  status: 'draft' as PurchaseOrderStatus,
  lines: [emptyLine()],
};

function createDefaultForm() {
  return {
    ...defaultForm,
    lines: [emptyLine()],
  };
}

function buildPoNumber() {
  return `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default function PurchaseOrders() {
  const { company } = useTenant();
  const [searchParams] = useSearchParams();
  const companyId = company?.id || null;
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [formData, setFormData] = useState(createDefaultForm);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchData();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchData() {
    setLoading(true);
    try {
      const [poSnapshot, productSnapshot] = await Promise.all([
        getDocs(companyQuery('purchase_orders', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('products', companyId, orderBy('name'))),
      ]);

      const poData = poSnapshot.docs.map((poDoc) => ({ id: poDoc.id, ...poDoc.data() } as PurchaseOrder));
      const productData = productSnapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() } as Product));

      setPurchaseOrders(poData);
      setProducts(productData);
      setSelectedOrderId((current) => {
        if (current && poData.some((order) => order.id === current)) {
          return current;
        }
        return poData[0]?.id || null;
      });
    } catch (error: any) {
      console.error('Failed to load purchase orders:', error);
      toast.error(error.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return purchaseOrders;
    return purchaseOrders.filter((order) =>
      [order.po_number, order.supplier_name, order.supplier_email, order.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText))
    );
  }, [purchaseOrders, search]);

  const selectedOrder = useMemo(
    () => purchaseOrders.find((order) => order.id === selectedOrderId) || null,
    [purchaseOrders, selectedOrderId]
  );

  const stats = useMemo(() => {
    const openOrders = purchaseOrders.filter((order) => ['draft', 'ordered', 'partial'].includes(order.status)).length;
    const orderedValue = purchaseOrders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const receivingLines = purchaseOrders.reduce(
      (sum, order) =>
        sum +
        order.items.filter((item) => Number(item.received_quantity || 0) < Number(item.ordered_quantity || 0)).length,
      0
    );
    return {
      total: purchaseOrders.length,
      openOrders,
      orderedValue,
      receivingLines,
    };
  }, [purchaseOrders]);

  const openCreateModal = (order?: PurchaseOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        supplier_name: order.supplier_name,
        supplier_email: order.supplier_email || '',
        supplier_phone: order.supplier_phone || '',
        expected_date: order.expected_date ? order.expected_date.slice(0, 10) : '',
        notes: order.notes || '',
        status: order.status,
        lines:
          order.items.map((item) => ({
            product_id: item.product_id,
            ordered_quantity: item.ordered_quantity,
            unit_cost: item.unit_cost,
          })) || [emptyLine()],
      });
    } else {
      setEditingOrder(null);
      setFormData(createDefaultForm());
    }
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData(createDefaultForm());
  };

  const addLine = () => {
    setFormData((current) => ({ ...current, lines: [...current.lines, emptyLine()] }));
  };

  const removeLine = (index: number) => {
    setFormData((current) => ({
      ...current,
      lines: current.lines.length === 1 ? current.lines : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const updateLine = (index: number, patch: Partial<PurchaseOrderLineDraft>) => {
    setFormData((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    const preparedLines = formData.lines
      .map((line) => {
        const product = products.find((item) => item.id === line.product_id);
        if (!product || line.ordered_quantity <= 0) return null;
        const unitCost = Number(line.unit_cost || product.cost_price || 0);
        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || null,
          ordered_quantity: Number(line.ordered_quantity || 0),
          received_quantity: editingOrder
            ? Number(editingOrder.items.find((item) => item.product_id === product.id)?.received_quantity || 0)
            : 0,
          unit_cost: unitCost,
          line_total: unitCost * Number(line.ordered_quantity || 0),
        } satisfies PurchaseOrderLine;
      })
      .filter(Boolean) as PurchaseOrderLine[];

    if (preparedLines.length === 0) {
      toast.error('Add at least one valid purchase order line');
      return;
    }

    const subtotal = preparedLines.reduce((sum, line) => sum + line.line_total, 0);
    const totalItems = preparedLines.reduce((sum, line) => sum + line.ordered_quantity, 0);
    const now = new Date().toISOString();

    const payload = {
      supplier_name: formData.supplier_name.trim(),
      supplier_email: formData.supplier_email.trim() || null,
      supplier_phone: formData.supplier_phone.trim() || null,
      expected_date: formData.expected_date ? new Date(formData.expected_date).toISOString() : null,
      notes: formData.notes.trim() || null,
      status: formData.status,
      items: preparedLines,
      subtotal,
      total_items: totalItems,
      updated_at: now,
    };

    setSaving(true);
    try {
      if (editingOrder) {
        await updateDoc(doc(db, 'purchase_orders', editingOrder.id), payload);
        toast.success('Purchase order updated');
      } else {
        await addDoc(collection(db, 'purchase_orders'), {
          ...withCompanyId(requireCompanyId(companyId), {}),
          ...payload,
          po_number: buildPoNumber(),
          created_at: now,
          created_by: auth.currentUser?.uid || null,
          received_at: null,
        });
        toast.success('Purchase order created');
      }

      closeCreateModal();
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  const openReceiveModal = (order: PurchaseOrder) => {
    const nextReceiveQuantities: Record<number, number> = {};
    order.items.forEach((item, index) => {
      nextReceiveQuantities[index] = Math.max(item.ordered_quantity - item.received_quantity, 0);
    });
    setReceiveQuantities(nextReceiveQuantities);
    setSelectedOrderId(order.id);
    setIsReceiveOpen(true);
  };

  const handleReceiveStock = async () => {
    if (!selectedOrder) return;

    const receiveLines = selectedOrder.items
      .map((item, index) => ({
        item,
        receiveQuantity: Math.max(0, Number(receiveQuantities[index] || 0)),
      }))
      .filter(({ receiveQuantity }) => receiveQuantity > 0);

    if (receiveLines.length === 0) {
      toast.error('Enter at least one quantity to receive');
      return;
    }

    const overReceived = receiveLines.find(
      ({ item, receiveQuantity }) => item.received_quantity + receiveQuantity > item.ordered_quantity
    );
    if (overReceived) {
      toast.error(`Received quantity is too high for ${overReceived.item.product_name}`);
      return;
    }

    setReceiving(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      const now = new Date().toISOString();
      let fullyReceived = false;

      await runTransaction(db, async (transaction) => {
        const productSnapshots = new Map<string, { stock: number; company_id?: string | null }>();
        for (const { item, receiveQuantity } of receiveLines) {
          const productRef = doc(db, 'products', item.product_id);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            throw new Error(`${item.product_name} no longer exists`);
          }
          const product = productSnap.data() as { stock?: number; company_id?: string | null };
          if (product.company_id !== workspaceId) {
            throw new Error(`${item.product_name} does not belong to this workspace`);
          }
          productSnapshots.set(item.product_id, { stock: Number(product.stock || 0), company_id: product.company_id });
        }

        const updatedItems = selectedOrder.items.map((item, index) => {
          const receiveQuantity = Math.max(0, Number(receiveQuantities[index] || 0));
          if (receiveQuantity <= 0) return item;

          const product = productSnapshots.get(item.product_id);
          transaction.update(doc(db, 'products', item.product_id), {
            stock: Number(product?.stock || 0) + receiveQuantity,
            updated_at: now,
          });
          transaction.set(doc(collection(db, 'inventory_movements')), withCompanyId(workspaceId, {
            type: 'purchase_receive',
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: receiveQuantity,
            purchase_order_id: selectedOrder.id,
            purchase_order_number: selectedOrder.po_number,
            reason: 'Purchase order received',
            actor_id: auth.currentUser?.uid || null,
            created_at: now,
          }));

          return {
            ...item,
            received_quantity: item.received_quantity + receiveQuantity,
          };
        });

        const allReceived = updatedItems.every((item) => item.received_quantity >= item.ordered_quantity);
        const hasReceived = updatedItems.some((item) => item.received_quantity > 0);
        fullyReceived = allReceived;

        transaction.update(doc(db, 'purchase_orders', selectedOrder.id), {
          items: updatedItems,
          status: allReceived ? 'received' : hasReceived ? 'partial' : selectedOrder.status,
          received_at: allReceived ? now : selectedOrder.received_at || null,
          updated_at: now,
        });
      });
      toast.success(fullyReceived ? 'Purchase order fully received' : 'Purchase order partially received');
      setIsReceiveOpen(false);
      setReceiveQuantities({});
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive stock');
    } finally {
      setReceiving(false);
    }
  };

  const handleDelete = async (order: PurchaseOrder) => {
    const confirmed = window.confirm(`Delete ${order.po_number}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'purchase_orders', order.id));
      toast.success('Purchase order deleted');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete purchase order');
    }
  };

  const statusTone = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'ordered':
        return 'bg-blue-50 text-blue-700';
      case 'partial':
        return 'bg-amber-50 text-amber-700';
      case 'received':
        return 'bg-green-50 text-green-700';
      case 'cancelled':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Procurement</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Purchase Orders</h1>
          <p className="text-[#5d6468] mt-2">Create supplier orders, receive incoming stock, and keep procurement history tidy.</p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="appleberry-gradient text-white px-4 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Purchase Orders" value={String(stats.total)} icon={ClipboardList} tone="blue" />
        <StatCard title="Open Orders" value={String(stats.openOrders)} icon={Truck} tone="amber" />
        <StatCard title="Ordered Value" value={formatCurrency(stats.orderedValue)} icon={ShoppingBag} tone="green" />
        <StatCard title="Outstanding Lines" value={String(stats.receivingLines)} icon={Package} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="section-card rounded-[24px] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO, supplier, status..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-gray-400">Loading purchase orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-6 text-gray-400">No purchase orders yet.</div>
            ) : (
              filteredOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left px-5 py-4 transition-colors ${selectedOrderId === order.id ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{order.po_number}</p>
                      <p className="text-xs text-gray-500">{order.supplier_name}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusTone(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div><span className="font-semibold text-gray-900">{order.total_items}</span> units</div>
                    <div><span className="font-semibold text-gray-900">{order.items.length}</span> lines</div>
                    <div><span className="font-semibold text-gray-900">{formatCurrency(order.subtotal)}</span></div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="section-card rounded-[24px] overflow-hidden">
          {selectedOrder ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-gray-900">{selectedOrder.po_number}</h2>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusTone(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedOrder.supplier_name}
                    {selectedOrder.supplier_email ? ` • ${selectedOrder.supplier_email}` : ''}
                    {selectedOrder.supplier_phone ? ` • ${selectedOrder.supplier_phone}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'received' && (
                    <button
                      onClick={() => openReceiveModal(selectedOrder)}
                      className="px-4 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Receive Stock
                    </button>
                  )}
                  <button
                    onClick={() => openCreateModal(selectedOrder)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedOrder)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 border-b border-gray-100">
                <InfoCard label="Created" value={safeFormatDate(selectedOrder.created_at, 'dd MMM yyyy HH:mm')} />
                <InfoCard label="Expected" value={safeFormatDate(selectedOrder.expected_date, 'dd MMM yyyy', 'Not set')} />
                <InfoCard label="Received" value={safeFormatDate(selectedOrder.received_at, 'dd MMM yyyy HH:mm', 'Not received')} />
                <InfoCard label="Subtotal" value={formatCurrency(selectedOrder.subtotal)} />
              </div>

              {selectedOrder.notes && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Notes</p>
                  <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">Ordered</th>
                      <th className="px-4 py-3 text-right">Received</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr key={`${selectedOrder.id}-${item.product_id}-${index}`} className="border-b border-gray-50">
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{item.sku || 'No SKU'}</td>
                        <td className="px-4 py-4 text-right text-gray-700">{item.ordered_quantity}</td>
                        <td className="px-4 py-4 text-right text-gray-700">{item.received_quantity}</td>
                        <td className="px-4 py-4 text-right text-gray-700">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="h-full min-h-[420px] flex items-center justify-center text-gray-400">
              Select a purchase order to view details.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingOrder ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
                <p className="text-sm text-gray-500">Create supplier orders and prepare items for stock receiving.</p>
              </div>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <Field label="Supplier Name" value={formData.supplier_name} onChange={(value) => setFormData((current) => ({ ...current, supplier_name: value }))} required />
                <Field label="Supplier Email" value={formData.supplier_email} onChange={(value) => setFormData((current) => ({ ...current, supplier_email: value }))} />
                <Field label="Supplier Phone" value={formData.supplier_phone} onChange={(value) => setFormData((current) => ({ ...current, supplier_phone: value }))} />
                <Field label="Expected Date" type="date" value={formData.expected_date} onChange={(value) => setFormData((current) => ({ ...current, expected_date: value }))} />
                <SelectField
                  label="Status"
                  value={formData.status}
                  onChange={(value) => setFormData((current) => ({ ...current, status: value as PurchaseOrderStatus }))}
                  options={[
                    { label: 'Draft', value: 'draft' },
                    { label: 'Ordered', value: 'ordered' },
                    { label: 'Partial', value: 'partial' },
                    { label: 'Received', value: 'received' },
                    { label: 'Cancelled', value: 'cancelled' },
                  ]}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Order Lines</h3>
                    <p className="text-sm text-gray-500">Choose products and set the quantities you’re ordering from the supplier.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addLine}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
                  >
                    Add Line
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.lines.map((line, index) => {
                    const selectedProduct = products.find((product) => product.id === line.product_id);
                    return (
                      <div key={`line-${index}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_140px_160px_44px] gap-3 items-end">
                        <SelectField
                          label={`Product ${index + 1}`}
                          value={line.product_id}
                          onChange={(value) => {
                            const product = products.find((item) => item.id === value);
                            updateLine(index, {
                              product_id: value,
                              unit_cost: product?.cost_price || 0,
                            });
                          }}
                          options={[
                            { label: 'Choose product', value: '' },
                            ...products.map((product) => ({
                              label: `${product.name}${product.sku ? ` (${product.sku})` : ''}`,
                              value: product.id,
                            })),
                          ]}
                        />
                        <Field
                          label="Qty"
                          type="number"
                          min={1}
                          value={String(line.ordered_quantity)}
                          onChange={(value) => updateLine(index, { ordered_quantity: Number(value || 0) })}
                        />
                        <Field
                          label="Unit Cost"
                          type="number"
                          step="0.01"
                          min={0}
                          value={String(line.unit_cost)}
                          onChange={(value) => updateLine(index, { unit_cost: Number(value || 0) })}
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="h-11 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                          title="Remove line"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {selectedProduct && (
                          <div className="md:col-span-4 text-xs text-gray-500 -mt-1">
                            Current stock: {selectedProduct.stock} • Cost price: {formatCurrency(selectedProduct.cost_price)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((current) => ({ ...current, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Supplier notes, expected delivery details, or internal comments."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeCreateModal} className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="appleberry-gradient text-white px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : editingOrder ? 'Save Changes' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReceiveOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Receive Stock</h2>
                <p className="text-sm text-gray-500">{selectedOrder.po_number} • {selectedOrder.supplier_name}</p>
              </div>
              <button onClick={() => setIsReceiveOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {selectedOrder.items.map((item, index) => {
                const outstanding = Math.max(item.ordered_quantity - item.received_quantity, 0);
                return (
                  <div key={`${item.product_id}-${index}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_110px_110px_140px] gap-4 items-end border border-gray-100 rounded-xl p-4">
                    <div>
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{item.sku || 'No SKU'} • Ordered {item.ordered_quantity} • Received {item.received_quantity}</p>
                    </div>
                    <InfoCard label="Outstanding" value={String(outstanding)} compact />
                    <InfoCard label="Unit Cost" value={formatCurrency(item.unit_cost)} compact />
                    <Field
                      label="Receive Now"
                      type="number"
                      min={0}
                      max={outstanding}
                      value={String(receiveQuantities[index] ?? outstanding)}
                      onChange={(value) => setReceiveQuantities((current) => ({ ...current, [index]: Number(value || 0) }))}
                    />
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={() => setIsReceiveOpen(false)} className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleReceiveStock} disabled={receiving} className="appleberry-gradient text-white px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50">
                {receiving ? 'Receiving...' : 'Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'blue' | 'green' | 'amber' | 'purple' }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="section-card rounded-[24px] p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-[#6a6f72]">{title}</p>
      <p className="text-2xl font-bold text-[#18242b]">{value}</p>
    </div>
  );
}

function InfoCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-xl bg-gray-50 border border-gray-100 p-4'}>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        required={required}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
