import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';
import { Printer, Download } from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdf';
import { Repair, ShopSettings } from '../types';
import { getCompanySettingsDocId } from '../lib/company';
import { isCompanyScopedRecord } from '../lib/companyData';

export default function InvoiceView() {
  const { id } = useParams();
  const [sale, setSale] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchInvoiceData();
    }
  }, [id]);

  async function fetchInvoiceData() {
    try {
      const saleSnap = await getDoc(doc(db, 'sales', id!));
      if (saleSnap.exists()) {
        const saleData = saleSnap.data();
        setSale(saleData);

        if (saleData.customer_id) {
          const custSnap = await getDoc(doc(db, 'customers', saleData.customer_id));
          if (custSnap.exists() && isCompanyScopedRecord(custSnap.data() as any, saleData.company_id)) {
            setCustomer(custSnap.data());
          }
        }

        const itemsSnap = await getDocs(collection(db, `sales/${id}/items`));
        setItems(itemsSnap.docs.map(doc => doc.data()));

        const shopSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', saleData.company_id || 'global')));
        if (shopSnap.exists()) {
          setShop(shopSnap.data());
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading invoice...</div>;
  }

  if (!sale) {
    return <div className="h-screen flex items-center justify-center">Invoice not found</div>;
  }

  const handleDownload = async () => {
    const invoiceData: Partial<Repair> = {
      id: id!,
      ticket_number: sale.ticket_number || id?.slice(0, 8),
      device_name: sale.device_name || 'General Sale',
      imei: sale.imei || null,
      subtotal: sale.subtotal,
      global_discount: sale.global_discount ?? 0,
      total_amount: sale.total_amount,
      created_at: sale.created_at,
    };
    const doc = await generateInvoicePDF(invoiceData, customer, items, shop || undefined);
    doc.save(`Invoice_${id?.slice(0, 8)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Actions Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-end gap-2 print:hidden">
          <button onClick={() => window.print()} className="p-2 hover:bg-white rounded-lg transition-all text-gray-600 flex items-center gap-2 text-sm font-bold">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownload} className="p-2 hover:bg-white rounded-lg transition-all text-gray-600 flex items-center gap-2 text-sm font-bold">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>

        <div className="p-12">
          {/* Header */}
          <div className="flex justify-between items-start mb-12">
            <div>
              {shop?.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-12 mb-4 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-xl appleberry-gradient flex items-center justify-center text-white font-bold text-2xl mb-4">
                  A
                </div>
              )}
              <h1 className="text-2xl font-black text-gray-900">{shop?.name || 'Appleberry OS'}</h1>
              <p className="text-sm text-gray-500">{shop?.address || 'Operations Suite'}</p>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black text-gray-200 mb-2 uppercase tracking-widest">Invoice</h2>
              <p className="text-sm font-bold text-gray-900">#{id?.slice(0, 8)}</p>
              <p className="text-sm text-gray-500">{new Date(sale.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Bill To</h3>
              <p className="font-bold text-gray-900">{customer?.name || 'Walk-in Customer'}</p>
              {customer?.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
              {customer?.email && <p className="text-sm text-gray-500">{customer.email}</p>}
            </div>
            <div className="text-right">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">From</h3>
              <p className="font-bold text-gray-900">{shop?.name || 'Appleberry OS'}</p>
              <p className="text-sm text-gray-500 whitespace-pre-line">{shop?.address || '123 Repair Street, Tech City'}</p>
              <p className="text-sm text-gray-500">{shop?.phone || '+1 234 567 890'}</p>
              {shop?.vatNumber && <p className="text-[10px] text-gray-400 mt-2">VAT: {shop.vatNumber}</p>}
              {shop?.regNumber && <p className="text-[10px] text-gray-400">REG: {shop.regNumber}</p>}
            </div>
          </div>

          {/* Table */}
          <table className="w-full mb-12">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Description</th>
                <th className="py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">Qty</th>
                <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Price</th>
                <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-4 font-bold text-gray-900">{item.name}</td>
                  <td className="py-4 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-4 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                  <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold text-gray-900">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.global_discount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span className="font-bold">-{formatCurrency(sale.global_discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black pt-3 border-t-2 border-gray-900">
                <span>Total</span>
                <span>{formatCurrency(sale.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-24 pt-12 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">Thank you for choosing Appleberry OS!</p>
            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Terms & Conditions Apply</p>
          </div>
        </div>
      </div>
    </div>
  );
}
