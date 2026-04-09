import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowRightLeft,
  CheckCircle2,
  Package,
  Plus,
  Search,
  Send,
  Truck,
  X,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Product } from '../types';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { filterByCompany, withCompanyId } from '../lib/companyData';

type TransferStatus = 'draft' | 'sent' | 'received' | 'cancelled';

type TransferLine = {
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
};

type InventoryTransfer = {
  id: string;
  company_id?: string | null;
  transfer_number: string;
  from_branch: string;
  to_branch: string;
  status: TransferStatus;
  notes: string | null;
  items: TransferLine[];
  total_items: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  sent_at?: string | null;
  received_at?: string | null;
};

type TransferLineDraft = {
  product_id: string;
  quantity: number;
};

const BRANCH_OPTIONS = ['Main Store', 'Workshop', 'Warehouse', 'Branch 2'];

const emptyLine = (): TransferLineDraft => ({
  product_id: '',
  quantity: 1,
});

const defaultForm = {
  from_branch: 'Main Store',
  to_branch: 'Workshop',
  status: 'draft' as TransferStatus,
  notes: '',
  lines: [emptyLine()],
};

function createDefaultForm() {
  return {
    ...defaultForm,
    lines: [emptyLine()],
  };
}

function buildTransferNumber() {
  return `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default function InventoryTransfer() {
  const { company } = useTenant();
  const companyId = company?.id || null;
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<InventoryTransfer | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [formData, setFormData] = useState(createDefaultForm);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [transferSnapshot, productSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'inventory_transfers'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'products'), orderBy('name'))),
      ]);

      const transferData = filterByCompany(transferSnapshot.docs.map((transferDoc) => ({ id: transferDoc.id, ...transferDoc.data() } as InventoryTransfer)), companyId);
      const productData = filterByCompany(productSnapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() } as Product)), companyId);

      setTransfers(transferData);
      setProducts(productData);
      setSelectedTransferId((current) => {
        if (current && transferData.some((transfer) => transfer.id === current)) {
          return current;
        }
        return transferData[0]?.id || null;
      });
    } catch (error: any) {
      console.error('Failed to load transfers:', error);
      toast.error(error.message || 'Failed to load inventory transfers');
    } finally {
      setLoading(false);
    }
  }

  const filteredTransfers = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return transfers;
    return transfers.filter((transfer) =>
      [transfer.transfer_number, transfer.from_branch, transfer.to_branch, transfer.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText))
    );
  }, [transfers, search]);

  const selectedTransfer = useMemo(
    () => transfers.find((transfer) => transfer.id === selectedTransferId) || null,
    [transfers, selectedTransferId]
  );

  const stats = useMemo(() => {
    const inTransit = transfers.filter((transfer) => transfer.status === 'sent').length;
    const completed = transfers.filter((transfer) => transfer.status === 'received').length;
    const movedUnits = transfers.reduce((sum, transfer) => sum + transfer.total_items, 0);
    const movedValue = transfers.reduce((sum, transfer) => sum + Number(transfer.subtotal || 0), 0);
    return { total: transfers.length, inTransit, completed, movedUnits, movedValue };
  }, [transfers]);

  const statusTone = (status: TransferStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'sent':
        return 'bg-blue-50 text-blue-700';
      case 'received':
        return 'bg-green-50 text-green-700';
      case 'cancelled':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const openModal = (transfer?: InventoryTransfer) => {
    if (transfer) {
      setEditingTransfer(transfer);
      setFormData({
        from_branch: transfer.from_branch,
        to_branch: transfer.to_branch,
        status: transfer.status,
        notes: transfer.notes || '',
        lines: transfer.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });
    } else {
      setEditingTransfer(null);
      setFormData(createDefaultForm());
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransfer(null);
    setFormData(createDefaultForm());
  };

  const addLine = () => setFormData((current) => ({ ...current, lines: [...current.lines, emptyLine()] }));

  const removeLine = (index: number) => {
    setFormData((current) => ({
      ...current,
      lines: current.lines.length === 1 ? current.lines : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const updateLine = (index: number, patch: Partial<TransferLineDraft>) => {
    setFormData((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.from_branch || !formData.to_branch) {
      toast.error('Choose both source and destination branches');
      return;
    }
    if (formData.from_branch === formData.to_branch) {
      toast.error('Source and destination branches must be different');
      return;
    }

    const preparedLines = formData.lines
      .map((line) => {
        const product = products.find((item) => item.id === line.product_id);
        if (!product || line.quantity <= 0) return null;
        const unitCost = Number(product.cost_price || 0);
        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || null,
          quantity: Number(line.quantity || 0),
          unit_cost: unitCost,
          line_total: unitCost * Number(line.quantity || 0),
        } satisfies TransferLine;
      })
      .filter(Boolean) as TransferLine[];

    if (preparedLines.length === 0) {
      toast.error('Add at least one valid transfer line');
      return;
    }

    const insufficientStock = preparedLines.find((line) => {
      const product = products.find((item) => item.id === line.product_id);
      return !product || product.stock < line.quantity;
    });
    if (insufficientStock && (!editingTransfer || editingTransfer.status === 'draft')) {
      toast.error(`Not enough stock for ${insufficientStock.product_name}`);
      return;
    }

    const subtotal = preparedLines.reduce((sum, line) => sum + line.line_total, 0);
    const totalItems = preparedLines.reduce((sum, line) => sum + line.quantity, 0);
    const now = new Date().toISOString();

    const payload = {
      from_branch: formData.from_branch,
      to_branch: formData.to_branch,
      status: formData.status,
      notes: formData.notes.trim() || null,
      items: preparedLines,
      total_items: totalItems,
      subtotal,
      updated_at: now,
    };

    setSaving(true);
    try {
      if (editingTransfer) {
        await updateDoc(doc(db, 'inventory_transfers', editingTransfer.id), payload);
        toast.success('Inventory transfer updated');
      } else {
        await addDoc(collection(db, 'inventory_transfers'), {
          ...withCompanyId(companyId, {}),
          ...payload,
          transfer_number: buildTransferNumber(),
          created_at: now,
          created_by: auth.currentUser?.uid || null,
          sent_at: null,
          received_at: null,
        });
        toast.success('Inventory transfer created');
      }
      closeModal();
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save inventory transfer');
    } finally {
      setSaving(false);
    }
  };

  const sendTransfer = async (transfer: InventoryTransfer) => {
    if (transfer.status !== 'draft') {
      toast.info('Only draft transfers can be sent');
      return;
    }

    const insufficientStock = transfer.items.find((line) => {
      const product = products.find((item) => item.id === line.product_id);
      return !product || product.stock < line.quantity;
    });
    if (insufficientStock) {
      toast.error(`Not enough stock for ${insufficientStock.product_name}`);
      return;
    }

    const confirmed = window.confirm(`Send ${transfer.transfer_number}? This will reduce stock at ${transfer.from_branch}.`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      for (const line of transfer.items) {
        const product = products.find((item) => item.id === line.product_id);
        batch.update(doc(db, 'products', line.product_id), {
          stock: Math.max(0, Number(product?.stock || 0) - line.quantity),
          updated_at: now,
          last_transfer_out_at: now,
          last_transfer_number: transfer.transfer_number,
        });
      }

      batch.update(doc(db, 'inventory_transfers', transfer.id), {
        status: 'sent',
        sent_at: now,
        updated_at: now,
      });

      await batch.commit();
      toast.success('Transfer sent and source stock reduced');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send transfer');
    } finally {
      setProcessing(false);
    }
  };

  const receiveTransfer = async (transfer: InventoryTransfer) => {
    if (transfer.status !== 'sent') {
      toast.info('Only sent transfers can be received');
      return;
    }

    const confirmed = window.confirm(`Receive ${transfer.transfer_number}? This will add stock to ${transfer.to_branch}.`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      for (const line of transfer.items) {
        const product = products.find((item) => item.id === line.product_id);
        batch.update(doc(db, 'products', line.product_id), {
          stock: Number(product?.stock || 0) + line.quantity,
          updated_at: now,
          last_transfer_in_at: now,
          last_transfer_number: transfer.transfer_number,
        });
      }

      batch.update(doc(db, 'inventory_transfers', transfer.id), {
        status: 'received',
        received_at: now,
        updated_at: now,
      });

      await batch.commit();
      toast.success('Transfer received and destination stock updated');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive transfer');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (transfer: InventoryTransfer) => {
    const confirmed = window.confirm(`Delete ${transfer.transfer_number}?`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'inventory_transfers', transfer.id));
      toast.success('Transfer deleted');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete transfer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Movement Control</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Inventory Transfer</h1>
          <p className="text-[#5d6468] mt-2">Move stock between branches with a clean send and receive workflow.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="appleberry-gradient text-white px-4 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Transfers" value={String(stats.total)} icon={ArrowRightLeft} tone="blue" />
        <StatCard title="In Transit" value={String(stats.inTransit)} icon={Truck} tone="amber" />
        <StatCard title="Completed" value={String(stats.completed)} icon={CheckCircle2} tone="green" />
        <StatCard title="Moved Value" value={formatCurrency(stats.movedValue)} icon={Package} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="section-card rounded-[24px] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transfer, branch, status..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-[680px] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-gray-400">Loading transfers...</div>
            ) : filteredTransfers.length === 0 ? (
              <div className="p-6 text-gray-400">No inventory transfers yet.</div>
            ) : (
              filteredTransfers.map((transfer) => (
                <button
                  key={transfer.id}
                  onClick={() => setSelectedTransferId(transfer.id)}
                  className={`w-full text-left px-5 py-4 transition-colors ${selectedTransferId === transfer.id ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{transfer.transfer_number}</p>
                      <p className="text-xs text-gray-500">{transfer.from_branch} → {transfer.to_branch}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusTone(transfer.status)}`}>
                      {transfer.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div><span className="font-semibold text-gray-900">{transfer.total_items}</span> units</div>
                    <div><span className="font-semibold text-gray-900">{transfer.items.length}</span> lines</div>
                    <div><span className="font-semibold text-gray-900">{formatCurrency(transfer.subtotal)}</span></div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="section-card rounded-[24px] overflow-hidden">
          {selectedTransfer ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-gray-900">{selectedTransfer.transfer_number}</h2>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusTone(selectedTransfer.status)}`}>
                      {selectedTransfer.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{selectedTransfer.from_branch} → {selectedTransfer.to_branch}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedTransfer.status === 'draft' && (
                    <button onClick={() => sendTransfer(selectedTransfer)} disabled={processing} className="px-4 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">
                      Send Transfer
                    </button>
                  )}
                  {selectedTransfer.status === 'sent' && (
                    <button onClick={() => receiveTransfer(selectedTransfer)} disabled={processing} className="px-4 py-2.5 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50">
                      Receive Transfer
                    </button>
                  )}
                  <button onClick={() => openModal(selectedTransfer)} className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(selectedTransfer)} className="px-4 py-2.5 rounded-xl font-semibold bg-red-50 text-red-600 hover:bg-red-100">
                    Delete
                  </button>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 border-b border-gray-100">
                <InfoCard label="Created" value={safeFormatDate(selectedTransfer.created_at, 'dd MMM yyyy HH:mm')} />
                <InfoCard label="Sent" value={safeFormatDate(selectedTransfer.sent_at, 'dd MMM yyyy HH:mm', 'Not sent')} />
                <InfoCard label="Received" value={safeFormatDate(selectedTransfer.received_at, 'dd MMM yyyy HH:mm', 'Not received')} />
                <InfoCard label="Subtotal" value={formatCurrency(selectedTransfer.subtotal)} />
              </div>

              {selectedTransfer.notes && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Notes</p>
                  <p className="text-sm text-gray-700">{selectedTransfer.notes}</p>
                </div>
              )}

              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransfer.items.map((item, index) => (
                      <tr key={`${selectedTransfer.id}-${item.product_id}-${index}`} className="border-b border-gray-50">
                        <td className="px-4 py-4"><p className="font-medium text-gray-900">{item.product_name}</p></td>
                        <td className="px-4 py-4 text-gray-600">{item.sku || 'No SKU'}</td>
                        <td className="px-4 py-4 text-right text-gray-700">{item.quantity}</td>
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
              Select a transfer to view details.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingTransfer ? 'Edit Inventory Transfer' : 'New Inventory Transfer'}</h2>
                <p className="text-sm text-gray-500">Prepare stock moves between branches and keep the movement history clean.</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <SelectField label="From Branch" value={formData.from_branch} onChange={(value) => setFormData((current) => ({ ...current, from_branch: value }))} options={BRANCH_OPTIONS.map((branch) => ({ label: branch, value: branch }))} />
                <SelectField label="To Branch" value={formData.to_branch} onChange={(value) => setFormData((current) => ({ ...current, to_branch: value }))} options={BRANCH_OPTIONS.map((branch) => ({ label: branch, value: branch }))} />
                <SelectField
                  label="Status"
                  value={formData.status}
                  onChange={(value) => setFormData((current) => ({ ...current, status: value as TransferStatus }))}
                  options={[
                    { label: 'Draft', value: 'draft' },
                    { label: 'Sent', value: 'sent' },
                    { label: 'Received', value: 'received' },
                    { label: 'Cancelled', value: 'cancelled' },
                  ]}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Transfer Lines</h3>
                    <p className="text-sm text-gray-500">Choose products and set the quantities moving between branches.</p>
                  </div>
                  <button type="button" onClick={addLine} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">
                    Add Line
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.lines.map((line, index) => {
                    const selectedProduct = products.find((product) => product.id === line.product_id);
                    return (
                      <div key={`line-${index}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_140px_44px] gap-3 items-end">
                        <SelectField
                          label={`Product ${index + 1}`}
                          value={line.product_id}
                          onChange={(value) => updateLine(index, { product_id: value })}
                          options={[
                            { label: 'Choose product', value: '' },
                            ...products.map((product) => ({
                              label: `${product.name}${product.sku ? ` (${product.sku})` : ''}`,
                              value: product.id,
                            })),
                          ]}
                        />
                        <Field label="Qty" type="number" min={1} value={String(line.quantity)} onChange={(value) => updateLine(index, { quantity: Number(value || 0) })} />
                        <button type="button" onClick={() => removeLine(index)} className="h-11 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center" title="Remove line">
                          <X className="w-4 h-4" />
                        </button>
                        {selectedProduct && (
                          <div className="md:col-span-3 text-xs text-gray-500 -mt-1">
                            Current stock: {selectedProduct.stock} • Value: {formatCurrency(selectedProduct.cost_price)}
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
                  placeholder="Branch handover notes, driver details, or stock movement comments."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="appleberry-gradient text-white px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : editingTransfer ? 'Save Changes' : 'Create Transfer'}
                </button>
              </div>
            </form>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fff8ef] border border-[#eadac8] p-4">
      <p className="text-xs uppercase tracking-wider text-[#7b5c3c]">{label}</p>
      <p className="text-sm font-semibold text-[#18242b] mt-1">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        min={min}
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
