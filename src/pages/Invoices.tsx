import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Search, FileText, Download, Eye, Receipt, CreditCard, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { Customer } from '../types';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord } from '../lib/companyData';

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
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  useEffect(() => {
    fetchInvoices();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      const sales = filterByCompany(
        salesSnapshot.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as SaleRecord)),
        companyId
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">Track completed sales, balances, and customer invoice history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Invoices" value={filteredRows.length.toString()} icon={Receipt} tone="blue" />
        <SummaryCard title="Invoiced" value={formatCurrency(summary.totalInvoiced)} icon={FileText} tone="amber" />
        <SummaryCard title="Collected" value={formatCurrency(summary.totalPaid)} icon={CreditCard} tone="green" />
        <SummaryCard title="Outstanding" value={formatCurrency(summary.outstanding)} icon={AlertCircle} tone="red" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice id, customer name, or phone"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 uppercase text-[11px] tracking-wider">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse border-b border-gray-50">
                    <td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-400">
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
                    <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(Number(row.sale.total_amount || 0))}</td>
                    <td className="px-4 py-4 text-right font-semibold text-red-600">{formatCurrency(row.balance)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/view-invoice/${row.sale.id}`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        <a
                          href={`/api/invoices/${row.sale.id}.pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:opacity-90"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'blue' | 'amber' | 'green' | 'red' }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function statusPill(status: 'paid' | 'partial' | 'unpaid') {
  if (status === 'paid') return 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700';
  if (status === 'partial') return 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700';
  return 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700';
}

function labelForStatus(status: 'paid' | 'partial' | 'unpaid') {
  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  return 'Unpaid';
}
