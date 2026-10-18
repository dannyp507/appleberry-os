import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { Search, FileText, Download, Eye, Receipt, CreditCard, AlertCircle, RotateCcw } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Customer, Profile, Sale } from '../types';
import { useTenant } from '../lib/tenant';
import { isCompanyScopedRecord } from '../lib/companyData';
import { companyQuery } from '../lib/db';
import { getAuthHeaders } from '../lib/authHeaders';
import RefundModal from '../components/pos/RefundModal';
import { hasPermission } from '../lib/permissions';
import { roundMoney, TAX_RATE } from '../lib/business';
import { normalizeImportedNumber } from '../lib/numbering';

type SaleRecord = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  invoice_number?: string | null;
  external_invoice_number?: string | null;
  staff_id?: string | null;
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
  invoiceNumber: string;
  salesPerson: string;
  taxable: number;
  taxes: number;
  amountPaid: number;
  balance: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paymentSummary: string;
};

export default function Invoices() {
  const { companyId, profile } = useTenant();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'refunds' | 'unpaid'>('all');
  const [salesPersonFilter, setSalesPersonFilter] = useState('all');
  const [salesPeople, setSalesPeople] = useState<string[]>([]);
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
      const [salesSnapshot, staffSnapshot] = await Promise.all([
        getDocs(companyQuery('sales', companyId)),
        getDocs(companyQuery('profiles', companyId)),
      ]);
      const sales = salesSnapshot.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as SaleRecord));
      const staffNames = new Map(
        staffSnapshot.docs.map((staffDoc) => [staffDoc.id, (staffDoc.data() as Profile).full_name || 'Staff'])
      );

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

          // Prices include VAT, so the VAT portion is total × rate / (1 + rate).
          const taxes = roundMoney(total * TAX_RATE / (1 + TAX_RATE));

          return {
            sale,
            customer,
            invoiceNumber:
              normalizeImportedNumber('invoice', sale.invoice_number || sale.external_invoice_number) ||
              `#${sale.id.slice(0, 8)}`,
            salesPerson: (sale.staff_id && staffNames.get(sale.staff_id)) || 'Unassigned',
            taxable: roundMoney(total - taxes),
            taxes,
            amountPaid,
            balance,
            paymentStatus,
            paymentSummary,
          };
        })
        .sort((a, b) => String(b.sale.created_at || '').localeCompare(String(a.sale.created_at || '')));

      setRows(invoiceRows);
      setSalesPeople(Array.from(new Set(invoiceRows.map((row) => row.salesPerson))).sort());
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
        row.invoiceNumber.toLowerCase().includes(query) ||
        (row.customer?.name || row.sale.customer_name || '').toLowerCase().includes(query) ||
        (row.customer?.phone || '').toLowerCase().includes(query);
      const matchesType =
        statusFilter === 'all' ||
        (statusFilter === 'refunds' && (row.sale.refund_status || 'none') !== 'none') ||
        (statusFilter === 'unpaid' && row.balance > 0.01);
      const matchesSalesPerson = salesPersonFilter === 'all' || row.salesPerson === salesPersonFilter;
      return matchesSearch && matchesType && matchesSalesPerson;
    });
  }, [rows, search, statusFilter, salesPersonFilter]);

  const summary = useMemo(() => {
    const totalInvoiced = filteredRows.reduce((sum, row) => sum + Number(row.sale.total_amount || 0), 0);
    const totalPaid = filteredRows.reduce((sum, row) => sum + row.amountPaid, 0);
    const outstanding = filteredRows.reduce((sum, row) => sum + row.balance, 0);
    const avgInvoice = filteredRows.length > 0 ? totalInvoiced / filteredRows.length : 0;
    return { totalInvoiced, totalPaid, outstanding, avgInvoice };
  }, [filteredRows]);

  const downloadInvoicePdf = async (saleId: string) => {
    try {
      const response = await fetch(`/api/invoices/${saleId}.pdf`, {
        headers: await getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      console.error('Invoice PDF download failed:', error);
      alert(error.message || 'Failed to download invoice PDF.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Sales Invoices</h1>
          <p className="text-zinc-400">Track completed sales, balances, refunds, and customer invoice history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Invoices" value={filteredRows.length.toString()} icon={Receipt} tone="blue" />
        <SummaryCard title="Invoiced" value={formatCurrency(summary.totalInvoiced)} icon={FileText} tone="amber" />
        <SummaryCard title="Collected" value={formatCurrency(summary.totalPaid)} icon={CreditCard} tone="green" />
        <SummaryCard title="Outstanding" value={formatCurrency(summary.outstanding)} icon={AlertCircle} tone="red" />
      </div>

      <div className="section-card rounded-xl p-4 space-y-4">
        {/* Filters along the top, search on the right, as in Cellstore */}
        <div className="flex flex-col lg:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5"
          >
            <option value="all">All Types</option>
            <option value="refunds">Refunds</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            value={salesPersonFilter}
            onChange={(e) => setSalesPersonFilter(e.target.value)}
            className="px-4 py-2.5"
          >
            <option value="all">All Sales People</option>
            {salesPeople.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Customer or Invoice"
              className="w-full pl-10 pr-4 py-2.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ops-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                <th className="px-3 py-3 whitespace-nowrap">Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Time</th>
                <th className="px-3 py-3 whitespace-nowrap">Invoice#</th>
                <th className="px-3 py-3 whitespace-nowrap">Customer Name</th>
                <th className="px-3 py-3 whitespace-nowrap">Sales Person</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Taxable</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Taxes</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Non Taxable</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Total</th>
                <th className="px-3 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse border-b border-gray-50">
                    <td colSpan={10} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center text-gray-400">
                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.sale.id}
                    className="cursor-pointer border-b border-gray-50 hover:bg-gray-50/80 transition-colors"
                    onClick={() => navigate(`/view-invoice/${row.sale.id}`)}
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">{safeFormatDate(row.sale.created_at, 'dd-MM-yy')}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">{safeFormatDate(row.sale.created_at, 'h:mm a')}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-900">{row.invoiceNumber}</p>
                      {(row.sale.refund_status || 'none') !== 'none' && (
                        <span className={refundPill(row.sale.refund_status || 'none')}>{refundLabel(row.sale.refund_status || 'none')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900">{row.customer?.name || row.sale.customer_name || 'Unassigned'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">{row.salesPerson}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-gray-700">{formatCurrency(row.taxable)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-gray-700">{formatCurrency(row.taxes)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-gray-700">{formatCurrency(0)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(Number(row.sale.total_amount || 0))}</p>
                      {row.balance > 0.01 && <p className="text-xs text-red-600">Due {formatCurrency(row.balance)}</p>}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
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
    blue: 'bg-[#3B82F6]/10 text-[#93C5FD] border-[#3B82F6]/30',
    amber: 'bg-[#F59E0B]/10 text-[#FCD34D] border-[#F59E0B]/30',
    green: 'bg-[#22C55E]/10 text-[#86EFAC] border-[#22C55E]/30',
    red: 'bg-[#EF4444]/10 text-[#FCA5A5] border-[#EF4444]/30',
  };

  return (
    <div className="section-card rounded-xl p-5">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
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
