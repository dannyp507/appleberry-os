import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, orderBy } from 'firebase/firestore';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Printer, Download, RotateCcw, FileText } from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdf';
import { Refund, Repair, Sale, ShopSettings } from '../types';
import { getCompanySettingsDocId } from '../lib/company';
import { isCompanyScopedRecord } from '../lib/companyData';
import { useTenant } from '../lib/tenant';
import { companyQuery, companySubcollection } from '../lib/db';
import { hasPermission } from '../lib/permissions';
import RefundModal from '../components/pos/RefundModal';

export default function InvoiceView() {
  const { id } = useParams();
  const { companyId, profile } = useTenant();
  const [sale, setSale] = useState<Sale | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    if (id) fetchInvoiceData();
  }, [id]);

  async function fetchInvoiceData() {
    try {
      const saleSnap = await getDoc(doc(db, 'sales', id!));
      if (!saleSnap.exists()) { setNotFound(true); return; }

      const saleData = { id: saleSnap.id, ...saleSnap.data() } as Sale;
      if (companyId && saleData.company_id !== companyId) { setNotFound(true); return; }
      setSale(saleData);

      const [custSnap, itemsSnap, refundsSnap, shopSnap] = await Promise.all([
        saleData.customer_id ? getDoc(doc(db, 'customers', saleData.customer_id)) : Promise.resolve(null),
        getDocs(companySubcollection(`sales/${id}/items`, saleData.company_id)),
        getDocs(companyQuery('refunds', saleData.company_id, orderBy('created_at', 'desc'))),
        getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', saleData.company_id || 'global'))),
      ]);

      if (custSnap?.exists() && isCompanyScopedRecord(custSnap.data() as any, saleData.company_id)) {
        setCustomer(custSnap.data());
      }
      setItems(itemsSnap.docs.map(d => d.data()));
      setRefunds(
        refundsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Refund))
          .filter(r => r.sale_id === id)
      );
      if (shopSnap.exists()) setShop(shopSnap.data() as ShopSettings);
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = async () => {
    const invoiceData: Partial<Repair> = {
      id: id!,
      ticket_number: sale?.ticket_number || id?.slice(0, 8),
      device_name: sale?.device_name || 'General Sale',
      imei: (sale as any)?.imei || null,
      subtotal: sale?.subtotal,
      global_discount: sale?.global_discount ?? 0,
      total_amount: sale?.total_amount,
      created_at: sale?.created_at || '',
    };
    const pdfDoc = await generateInvoicePDF(invoiceData, customer, items, shop || undefined);
    pdfDoc.save(`Invoice_${id?.slice(0, 8)}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22C55E]" />
      </div>
    );
  }

  if (notFound || !sale) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#2A2A2E] flex items-center justify-center">
          <FileText className="h-8 w-8 text-zinc-600" />
        </div>
        <p className="text-white font-bold text-lg">Invoice not found</p>
        <p className="text-zinc-500 text-sm">This invoice may have been deleted or you don't have access.</p>
      </div>
    );
  }

  const payments: { method: string; amount: number }[] = Array.isArray((sale as any).payments)
    ? (sale as any).payments
    : sale.payment_method
      ? [{ method: sale.payment_method, amount: sale.total_amount }]
      : [];

  return (
    <div className="min-h-screen bg-[#0A0A0C] py-8 px-4 print:bg-white print:p-0">
      {/* Action bar — hidden when printing */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-[#22C55E]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Invoice #{(sale.ticket_number || id?.slice(0, 8) || '').toUpperCase()}</p>
            <p className="text-xs text-zinc-500">{safeFormatDate(sale.created_at, 'dd MMM yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          {hasPermission(profile, 'refunds.process') && (sale.refund_status || 'none') !== 'full' && (
            <button
              onClick={() => setRefundOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <RotateCcw className="h-4 w-4" /> Refund
            </button>
          )}
        </div>
      </div>

      {/* Invoice document — intentionally white for print */}
      <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">
        <div className="p-10">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              {shop?.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-12 mb-3 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#22C55E] flex items-center justify-center text-white font-bold text-2xl mb-3">A</div>
              )}
              <h1 className="text-xl font-black text-gray-900">{shop?.name || 'Appleberry OS'}</h1>
              {shop?.address && <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] leading-relaxed">{shop.address}</p>}
              {shop?.phone && <p className="text-xs text-gray-500">{shop.phone}</p>}
              {shop?.email && <p className="text-xs text-gray-500">{shop.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-gray-100 uppercase tracking-widest mb-2">Invoice</p>
              <p className="text-sm font-bold text-gray-900">#{(sale.ticket_number || id?.slice(0, 8) || '').toUpperCase()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{safeFormatDate(sale.created_at, 'dd MMM yyyy')}</p>
              {sale.refund_status && sale.refund_status !== 'none' && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded">
                  {sale.refund_status === 'full' ? 'Refunded' : 'Partially Refunded'}
                </span>
              )}
            </div>
          </div>

          {/* Bill To / From */}
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
              <p className="font-bold text-gray-900">{customer?.name || sale.customer_name || 'Walk-in Customer'}</p>
              {(customer?.phone || sale.customer_phone) && <p className="text-sm text-gray-500">{customer?.phone || sale.customer_phone}</p>}
              {customer?.email && <p className="text-sm text-gray-500">{customer.email}</p>}
            </div>
            {shop?.vatNumber || shop?.regNumber ? (
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Business Details</p>
                {shop?.vatNumber && <p className="text-xs text-gray-500">VAT: {shop.vatNumber}</p>}
                {shop?.regNumber && <p className="text-xs text-gray-500">REG: {shop.regNumber}</p>}
                {shop?.website && <p className="text-xs text-gray-500">{shop.website}</p>}
              </div>
            ) : null}
          </div>

          {/* Line items table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Description</th>
                <th className="py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">Qty</th>
                <th className="py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Unit Price</th>
                {items.some(i => i.discount > 0) && (
                  <th className="py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Discount</th>
                )}
                <th className="py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 font-semibold text-gray-900 text-sm">{item.name}</td>
                  <td className="py-3 text-center text-gray-600 text-sm">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-600 text-sm">{formatCurrency(item.unit_price)}</td>
                  {items.some(i => i.discount > 0) && (
                    <td className="py-3 text-right text-red-500 text-sm">
                      {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '—'}
                    </td>
                  )}
                  <td className="py-3 text-right font-bold text-gray-900 text-sm">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals + Payments */}
          <div className="flex flex-col sm:flex-row gap-8 justify-end">
            {/* Payment methods */}
            {payments.length > 0 && (
              <div className="flex-1 max-w-xs">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Paid Via</p>
                <div className="space-y-1.5">
                  {payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-500 capitalize">{p.method}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="w-56 space-y-2">
              {sale.subtotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.subtotal)}</span>
                </div>
              )}
              {(sale.global_discount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span className="font-bold">-{formatCurrency(sale.global_discount!)}</span>
                </div>
              )}
              {(sale as any).tax_amount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>VAT ({((sale as any).tax_rate * 100).toFixed(0)}%)</span>
                  <span>{formatCurrency((sale as any).tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-gray-900">
                <span>Total</span>
                <span>{formatCurrency(sale.total_amount)}</span>
              </div>
              {Number(sale.refunded_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Refunded</span>
                  <span className="font-bold">-{formatCurrency(Number(sale.refunded_amount))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Refund history */}
          {refunds.length > 0 && (
            <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-4 print:hidden">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Refund History</p>
              <div className="space-y-2">
                {refunds.map(refund => (
                  <div key={refund.id} className="flex items-start justify-between rounded-lg bg-white p-3 border border-gray-100">
                    <div>
                      <p className="font-bold capitalize text-gray-900 text-sm">{refund.refund_type} refund</p>
                      <p className="text-xs text-gray-500">{refund.reason} · {safeFormatDate(refund.created_at, 'dd MMM yyyy HH:mm')}</p>
                    </div>
                    <p className="font-black text-red-600 text-sm">{formatCurrency(refund.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">Thank you for your business!</p>
            {shop?.name && <p className="text-xs text-gray-400 mt-1">{shop.name}</p>}
            <p className="text-[10px] text-gray-300 mt-2 uppercase tracking-widest">Terms & Conditions Apply</p>
          </div>
        </div>
      </div>

      <RefundModal
        isOpen={refundOpen}
        sale={sale}
        companyId={companyId}
        onClose={() => setRefundOpen(false)}
        onComplete={fetchInvoiceData}
      />
    </div>
  );
}
