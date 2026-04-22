import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '../../lib/firebase';
import { roundMoney } from '../../lib/business';
import { companyQuery, companySubcollection, requireCompanyId } from '../../lib/db';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { Refund, RefundItem, RefundType, Sale, SaleItem } from '../../types';
import { withCompanyId } from '../../lib/companyData';

type RefundModalProps = {
  isOpen: boolean;
  sale: Sale | null;
  companyId: string | null;
  onClose: () => void;
  onComplete: () => void;
};

type RefundableLine = SaleItem & {
  refunded_quantity: number;
  remaining_quantity: number;
};

export default function RefundModal({ isOpen, sale, companyId, onClose, onComplete }: RefundModalProps) {
  const [items, setItems] = useState<RefundableLine[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setRefundType('full');
    setReason('');
    setQuantities({});
    void loadRefundData();
  }, [isOpen, sale?.id, companyId]);

  async function loadRefundData() {
    if (!sale) return;
    setLoading(true);
    try {
      const [itemsSnap, refundsSnap] = await Promise.all([
        getDocs(companySubcollection(`sales/${sale.id}/items`, companyId, orderBy('created_at', 'asc'))),
        getDocs(companyQuery('refunds', companyId, orderBy('created_at', 'desc'))),
      ]);

      const saleRefunds = refundsSnap.docs
        .map((refundDoc) => ({ id: refundDoc.id, ...refundDoc.data() } as Refund))
        .filter((refund) => refund.sale_id === sale.id);

      const refundedByItem = new Map<string, number>();
      saleRefunds.forEach((refund) => {
        refund.items.forEach((item) => {
          if (!item.sale_item_id) return;
          refundedByItem.set(item.sale_item_id, (refundedByItem.get(item.sale_item_id) || 0) + Number(item.quantity || 0));
        });
      });

      const nextItems = itemsSnap.docs.map((itemDoc) => {
        const item = { id: itemDoc.id, ...itemDoc.data() } as SaleItem;
        const refundedQuantity = Number((sale.refunded_item_quantities || {})[item.id] ?? refundedByItem.get(item.id) ?? 0);
        return {
          ...item,
          refunded_quantity: refundedQuantity,
          remaining_quantity: Math.max(0, Number(item.quantity || 0) - refundedQuantity),
        };
      });

      setItems(nextItems);
      setRefunds(saleRefunds);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load refund data');
    } finally {
      setLoading(false);
    }
  }

  const refundableItems = useMemo(() => items.filter((item) => item.remaining_quantity > 0), [items]);

  const previewAmount = useMemo(() => {
    if (!sale) return 0;
    const remainingSaleAmount = Math.max(0, Number(sale.total_amount || 0) - Number(sale.refunded_amount || 0));
    if (refundType === 'full') return roundMoney(remainingSaleAmount);

    const lineAmount = refundableItems.reduce((sum, item) => {
      const quantity = Math.max(0, Math.min(Number(quantities[item.id] || 0), item.remaining_quantity));
      return sum + (quantity * Number(item.unit_price || 0));
    }, 0);

    return roundMoney(Math.min(remainingSaleAmount, lineAmount));
  }, [quantities, refundableItems, refundType, sale]);

  const canRefund = Boolean(sale) && refundableItems.length > 0 && previewAmount > 0 && reason.trim().length >= 3;

  async function processRefund() {
    if (!sale) return;
    if (!auth.currentUser) {
      toast.error('You must be signed in to process a refund');
      return;
    }
    if (!canRefund) {
      toast.error('Select refundable items and enter a reason');
      return;
    }

    setProcessing(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      const now = new Date().toISOString();
      const actorId = auth.currentUser.uid;
      const refundRef = doc(collection(db, 'refunds'));

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) {
          throw new Error('Sale not found');
        }

        const saleData = { id: saleSnap.id, ...saleSnap.data() } as Sale;
        if (saleData.company_id !== workspaceId) {
          throw new Error('This sale does not belong to your workspace');
        }

        const saleTotal = Number(saleData.total_amount || 0);
        const previousRefundedAmount = Number(saleData.refunded_amount || 0);
        if (saleData.refund_status === 'full' || previousRefundedAmount >= saleTotal) {
          throw new Error('This sale has already been fully refunded');
        }

        const refundedQuantities = { ...(saleData.refunded_item_quantities || {}) };
        const selectedIds = refundType === 'full'
          ? refundableItems.map((item) => item.id)
          : Object.entries(quantities)
              .filter(([, quantity]) => Number(quantity) > 0)
              .map(([itemId]) => itemId);

        if (selectedIds.length === 0) {
          throw new Error('Select at least one item to refund');
        }

        const refundItems: RefundItem[] = [];
        const productStockUpdates: Array<{ productId: string; quantity: number; name: string }> = [];
        let lineAmount = 0;
        let allItemsFullyRefunded = true;

        for (const itemId of selectedIds) {
          const itemRef = doc(db, 'sales', sale.id, 'items', itemId);
          const itemSnap = await transaction.get(itemRef);
          if (!itemSnap.exists()) {
            throw new Error('A sale line no longer exists');
          }

          const item = { id: itemSnap.id, ...itemSnap.data() } as SaleItem;
          if (item.company_id !== workspaceId || item.sale_id !== sale.id) {
            throw new Error('A sale line does not belong to this workspace');
          }

          const soldQuantity = Number(item.quantity || 0);
          const alreadyRefunded = Number(refundedQuantities[item.id] || 0);
          const remainingQuantity = soldQuantity - alreadyRefunded;
          const requestedQuantity = refundType === 'full'
            ? remainingQuantity
            : Number(quantities[item.id] || 0);

          if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
            continue;
          }
          if (requestedQuantity > remainingQuantity) {
            throw new Error(`Cannot refund more than sold for ${item.name || item.product_id}`);
          }

          const unitPrice = Number(item.unit_price || 0);
          lineAmount += requestedQuantity * unitPrice;
          refundedQuantities[item.id] = alreadyRefunded + requestedQuantity;

          refundItems.push({
            sale_item_id: item.id,
            product_id: item.product_id || null,
            name: item.name || null,
            quantity: requestedQuantity,
            price: roundMoney(unitPrice),
          });

          if (item.product_id) {
            productStockUpdates.push({
              productId: item.product_id,
              quantity: requestedQuantity,
              name: item.name || item.product_id,
            });
          }
        }

        if (refundItems.length === 0) {
          throw new Error('Select at least one refundable item');
        }

        for (const item of items) {
          const projectedRefunded = Number(refundedQuantities[item.id] || 0);
          if (projectedRefunded < Number(item.quantity || 0)) {
            allItemsFullyRefunded = false;
            break;
          }
        }

        const productUpdates = new Map<string, { productId: string; quantity: number; name: string }>();
        productStockUpdates.forEach((update) => {
          const existing = productUpdates.get(update.productId);
          productUpdates.set(update.productId, {
            productId: update.productId,
            quantity: (existing?.quantity || 0) + update.quantity,
            name: existing?.name || update.name,
          });
        });

        const productReads = new Map<string, { stock: number; company_id?: string | null } | null>();
        for (const update of productUpdates.values()) {
          const productRef = doc(db, 'products', update.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            productReads.set(update.productId, null);
            continue;
          }
          const product = productSnap.data() as { stock?: number; company_id?: string | null };
          if (product.company_id !== workspaceId) {
            throw new Error(`${update.name} does not belong to this workspace`);
          }
          productReads.set(update.productId, { stock: Number(product.stock || 0), company_id: product.company_id });
        }

        const remainingSaleAmount = Math.max(0, saleTotal - previousRefundedAmount);
        const refundAmount = refundType === 'full'
          ? roundMoney(remainingSaleAmount)
          : roundMoney(Math.min(remainingSaleAmount, lineAmount));

        if (refundAmount <= 0) {
          throw new Error('There is no remaining refundable amount on this sale');
        }

        productUpdates.forEach((update) => {
          const product = productReads.get(update.productId);
          if (!product) return;
          transaction.update(doc(db, 'products', update.productId), {
            stock: product.stock + update.quantity,
            updated_at: now,
          });
          transaction.set(doc(collection(db, 'inventory_movements')), withCompanyId(workspaceId, {
            type: 'refund',
            product_id: update.productId,
            product_name: update.name,
            quantity: update.quantity,
            sale_id: sale.id,
            refund_id: refundRef.id,
            reason: reason.trim(),
            actor_id: actorId,
            created_at: now,
          }));
        });

        const newRefundedAmount = roundMoney(previousRefundedAmount + refundAmount);
        const refundStatus = newRefundedAmount >= saleTotal || allItemsFullyRefunded ? 'full' : 'partial';

        transaction.set(refundRef, withCompanyId(workspaceId, {
          refund_id: refundRef.id,
          sale_id: sale.id,
          customer_id: saleData.customer_id || null,
          refund_type: refundStatus === 'full' ? 'full' : refundType,
          items: refundItems,
          amount: refundAmount,
          reason: reason.trim(),
          processed_by: actorId,
          created_at: now,
        }));

        transaction.update(saleRef, {
          refunded_amount: newRefundedAmount,
          refund_status: refundStatus,
          refunded_item_quantities: refundedQuantities,
          updated_at: now,
        });

        transaction.set(doc(collection(db, 'activity_logs')), withCompanyId(workspaceId, {
          actor_id: actorId,
          action: 'refund.processed',
          entity_type: 'refund',
          entity_id: refundRef.id,
          sale_id: sale.id,
          amount: refundAmount,
          type: refundStatus === 'full' ? 'full' : refundType,
          summary: `${refundStatus === 'full' ? 'Full' : 'Partial'} refund processed for ${formatCurrency(refundAmount)}`,
          created_at: now,
        }));
      });

      toast.success('Refund processed');
      await loadRefundData();
      onComplete();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  }

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Process Refund</h2>
            <p className="text-sm text-gray-500">Invoice #{sale.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading refund details...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Summary label="Sale Total" value={formatCurrency(Number(sale.total_amount || 0))} />
                <Summary label="Already Refunded" value={formatCurrency(Number(sale.refunded_amount || 0))} />
                <Summary label="This Refund" value={formatCurrency(previewAmount)} highlight />
              </div>

              {refundableItems.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  This sale has no remaining refundable quantities.
                </div>
              ) : (
                <>
                  <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {(['full', 'partial'] as RefundType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRefundType(type)}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                          refundType === type ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        {type} refund
                      </button>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3 text-right">Sold</th>
                          <th className="px-4 py-3 text-right">Refunded</th>
                          <th className="px-4 py-3 text-right">Refund Qty</th>
                          <th className="px-4 py-3 text-right">Line</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => {
                          const selectedQuantity = refundType === 'full'
                            ? item.remaining_quantity
                            : Math.max(0, Number(quantities[item.id] || 0));
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">{item.name || item.product_id || 'Sale item'}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{item.refunded_quantity}</td>
                              <td className="px-4 py-3 text-right">
                                {refundType === 'full' ? (
                                  <span className="font-semibold text-gray-900">{item.remaining_quantity}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.remaining_quantity}
                                    disabled={item.remaining_quantity === 0}
                                    value={quantities[item.id] || ''}
                                    onChange={(event) => {
                                      const next = Math.max(0, Math.min(item.remaining_quantity, Number(event.target.value || 0)));
                                      setQuantities((current) => ({ ...current, [item.id]: next }));
                                    }}
                                    className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {formatCurrency(selectedQuantity * Number(item.unit_price || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Required reason for audit trail"
                    />
                  </div>
                </>
              )}

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                  Refund history
                </h3>
                {refunds.length === 0 ? (
                  <p className="text-sm text-gray-500">No refunds processed for this sale.</p>
                ) : (
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div key={refund.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-semibold text-gray-900">{refund.refund_type} refund</p>
                          <p className="text-xs text-gray-500">{refund.reason} • {safeFormatDate(refund.created_at, 'dd MMM yyyy HH:mm')}</p>
                        </div>
                        <p className="font-bold text-red-600">{formatCurrency(refund.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-5">
          <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600">
            Cancel
          </button>
          <button
            onClick={processRefund}
            disabled={!canRefund || processing || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {processing ? 'Processing...' : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
