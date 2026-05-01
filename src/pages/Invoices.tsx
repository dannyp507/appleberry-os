import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { Search, FileText, Download, Eye, Receipt, CreditCard, AlertCircle, RotateCcw } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Customer, Sale, ShopSettings } from '../types';
import { useTenant } from '../lib/tenant';
import { isCompanyScopedRecord } from '../lib/companyData';
import { companyQuery, companySubcollection } from '../lib/db';
import { generateInvoicePDF } from '../lib/pdf';
import { getCompanySettingsDocId } from '../lib/company';
import RefundModal from '../components/pos/RefundModal';
import { hasPermission } from '../lib/permissions';
import { toast } from 'sonner';

type SaleRecord = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  subtotal?: number;
  global_discount?: number;
  total_amount?: number;
  created_at?: string;
  payments?: { method?: string; amount?: number; timestamp?: string }[];
  payment_method?: string;
  refunded_amount?: number;
  refund_status?: 'none' | 'partial' | 'full';
  refunded_item_quantities?: Record<string, number>;
};

type InvoiceRow = {
  sale: SaleRecord;
  customer: Customer | null;
  amountPaid: number;
  balance: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paymentSummary: string;
};

export default function Invoices() {
  const { companyId, profile } = useTenant();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [refundSale, setRefundSale] = useState<Sale | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const salesSnapshot = await getDocs(companyQuery('sales', companyId));
      const sales = salesSnapshot.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as SaleRecord));

      const customerIds = Array.from(new Set(sales.map((sale) => sale.customer_id).filter(Boolean))) as string[];
      const customerEntries = await Promise.all(
        customerIds.map(async (customerId) => {
          const customerSnap = await getDoc(doc(db, 'customers', customerId));
          return [customerId, customerSnap.exists() && isCompanyScopedRecord(customerSnap.data() as any, companyId) ? ({ id: customerSnap.id, ...customerSnap.data() } as Customer) : null] as const;
        })
      );
      const customerMap = new Map<string, Customer | null>(customerEntries);

      const invoiceRows = sales
        .map((sale) => {
          const customer = sale.customer_id ? customerMap.get(sale.customer_id) || null : null;
          const payments = Array.isArray(sale.payments) ? sale.payments : [];
          const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const total = Number(sale.total_amount || 0);
          const balance = Math.max(0, total - amountPaid);
          const paymentStatus: InvoiceRow['paymentStatus'] = amountPaid <= 0 ? 'unpaid' : balance > 0.01 ? 'partial' : 'paid';
          const paymentSummary = payments.length > 0
            ? Array.from(new Set(payments.map((payment) => payment.method || 'Unknown'))).join(', ')
            : sale.payment_method || 'No payment';

          return {
            sale,
            customer,
            amountPaid,
            balance,
            paymentStatus,
            paymentSummary,
          };
        })
        .sort((a, b) => String(b.sale.created_at || '').localeCompare(String(a.sale.created_at || '')));

      setRows(invoiceRows);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const query = search.toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        row.sale.id.toLowerCase().includes(query) ||
        (row.customer?.name || '').toLowerCase().includes(query) ||
        (row.customer?.phone || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || row.paymentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const totalInvoiced = filteredRows.reduce((sum, row) => sum + Number(row.sale.total_amount || 0), 0);
    const totalPaid = filteredRows.reduce((sum, row) => sum + row.amountPaid, 0);
    const outstanding = filteredRows.reduce((sum, row) => sum + row.balance, 0);
    const avgInvoice = filteredRows.length > 0 ? totalInvoiced / filteredRows.length : 0;
    return { totalInvoiced, totalPaid, outstanding, avgInvoice };
  }, [filteredRows]);

  const downloadInvoicePdf = async (saleId: string) => {
    const tid = toast.loading('Generating PDF…');
    try {
      // Fetch sale + items + customer + shop from Firestore client-side
      const saleSnap = await getDoc(doc(db, 'sales', saleId));
      if (!saleSnap.exists()) throw new Error('Sale not found');
      const sale = { id: saleSnap.id, ...saleSnap.data() } as any;

      const [itemsSnap, shopSnap] = await Promise.all([
        getDocs(companySubcollection(`sales/${saleId}/items`, sale.company_id)),
        getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', sale.company_id || 'global'))),
      ]);
      const items = itemsSnap.docs.map(d => d.data());
      const shop = shopSnap.exists() ? shopSnap.data() as ShopSettings : undefined;

      let customer: Customer | null = null;
      if (sale.customer_id) {
        const custSnap = await getDoc(doc(db, 'customers', sale.customer_id));
        if (custSnap.exists()) customer = { id: custSnap.id, ...custSnap.data() } as Customer;
      }

      const invoiceRecord = {
        id: saleId,
        ticket_number: sale.ticket_number || saleId.slice(0, 8),
        device_name: sale.device_name || 'General Sale',
        imei: sale.imei || null,
        subtotal: sale.subtotal ?? sale.total_amount,
        global_discount: sale.global_discount ?? 0,
        total_amount: sale.total_amount,
        created_at: sale.created_at || new Date().toISOString(),
      };

      const pdfDoc = await generateInvoicePDF(invoiceRecord, customer, items, shop);
      pdfDoc.save(`Invoice_${sale.ticket_number || saleId.slice(0, 8)}.pdf`);
      toast.success('PDF downloaded', { id: tid });
    } catch (error: any) {
      console.error('Invoice PDF download failed:', error);
      toast.error(error.message || 'Failed to generate PDF', { id: tid });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-2">Sales Ledger</p>
          <h1 className="text-3xl font-black text-gray-900">Invoices</h1>
          <p className="text-gray-500">Track completed sales, balances, refunds, and customer invoice history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Invoices" value={filteredRows.length.toString()} icon={Receipt} tone="blue" />
        <SummaryCard title="Invoiced" value={formatCurrency(summary.totalInvoiced)} icon={FileText} tone="amber" />
        <SummaryCard title="Collected" value={formatCurrency(summary.totalPaid)} icon={CreditCard} tone="green" />
        <SummaryCard title="Outstanding" value={formatCurrency(summary.outstanding)} icon={AlertCircle} tone="red" />
      </div>

      <div className="section-card rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice id, customer name, or phone"
              className="w-full pl-10 pr-4 py-2.5"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="ops-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Refund</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse border-b border-gray-50">
                    <td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-gray-400">
                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.sale.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">#{row.sale.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-400">Avg ticket {formatCurrency(summary.avgInvoice)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{row.customer?.name || 'Walk-in Customer'}</p>
                      <p className="text-xs text-gray-500">{row.customer?.phone || row.customer?.email || 'No contact details'}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{safeFormatDate(row.sale.created_at, 'dd MMM yyyy HH:mm')}</td>
                    <td className="px-4 py-4">
                      <span className={statusPill(row.paymentStatus)}>{labelForStatus(row.paymentStatus)}</span>
                      <p className="text-xs text-gray-500 mt-1">{row.paymentSummary}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={refundPill(row.sale.refund_status || 'none')}>
                        {refundLabel(row.sale.refund_status || 'none')}
                      </span>
                      {Number(row.sale.refunded_amount || 0) > 0 && (
                        <p className="text-xs text-red-600 mt-1">{formatCurrency(Number(row.sale.refunded_amount || 0))}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(Number(row.sale.total_amount || 0))}</td>
                    <td className="px-4 py-4 text-right font-semibold text-red-600">{formatCurrency(row.balance)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/view-invoice/${row.sale.id}`}
                          className="btn btn-secondary min-h-0 px-3 py-2 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => downloadInvoicePdf(row.sale.id)}
                          className="btn btn-primary min-h-0 px-3 py-2 text-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        {hasPermission(profile, 'refunds.process') && (row.sale.refund_status || 'none') !== 'full' && (
                          <button
                            type="button"
                            onClick={() => setRefundSale(row.sale as Sale)}
                            className="btn btn-danger min-h-0 px-3 py-2 text-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <RefundModal
        isOpen={Boolean(refundSale)}
        sale={refundSale}
        companyId={companyId}
        onClose={() => setRefundSale(null)}
        onComplete={fetchInvoices}
      />
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'blue' | 'amber' | 'green' | 'red' }) {
  const toneClasses = {
    blue: 'bg-[#3B82F6]/10 text-blue-700 border-[#3B82F6]/30',
    amber: 'bg-[#F59E0B]/10 text-amber-700 border-[#F59E0B]/30',
    green: 'bg-[#22C55E]/10 text-green-700 border-[#22C55E]/30',
    red: 'bg-[#EF4444]/10 text-red-700 border-[#EF4444]/30',
  };

  return (
    <div className="section-card rounded-xl p-5">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}

function statusPill(status: 'paid' | 'partial' | 'unpaid') {
  if (status === 'paid') return 'badge badge-success';
  if (status === 'partial') return 'badge badge-warning';
  return 'badge badge-danger';
}

function labelForStatus(status: 'paid' | 'partial' | 'unpaid') {
  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  return 'Unpaid';
}

function refundPill(status: 'none' | 'partial' | 'full') {
  if (status === 'full') return 'badge badge-danger';
  if (status === 'partial') return 'badge badge-warning';
  return 'badge badge-muted';
}

function refundLabel(status: 'none' | 'partial' | 'full') {
  if (status === 'full') return 'Refunded';
  if (status === 'partial') return 'Part refund';
  return 'None';
}
