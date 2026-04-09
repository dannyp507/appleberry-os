import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import {
  ClipboardList,
  FileText,
  Package,
  Search,
  ShoppingCart,
  Smartphone,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { filterByCompany } from '../lib/companyData';
import { Customer, Product, Profile, Repair, Sale } from '../types';
import { hasPermission } from '../lib/permissions';
import { safeFormatDate } from '../lib/utils';

type SearchCategory = 'customers' | 'repairs' | 'sales' | 'purchase_orders' | 'orders' | 'products';

type SearchResult = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  icon: typeof User;
  score?: number;
};

type PurchaseOrderLike = {
  id: string;
  company_id?: string | null;
  po_number?: string | null;
  supplier_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type OrderLike = {
  id: string;
  company_id?: string | null;
  order_number?: string | null;
  customer_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function normalize(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function looksLikeImei(term: string) {
  const digits = term.replace(/\D/g, '');
  return digits.length >= 8;
}

function escapeParam(value: string) {
  return encodeURIComponent(value);
}

function highlightText(text: string, term: string) {
  if (!term.trim()) return text;

  const normalizedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${normalizedTerm})`, 'ig');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-[#f7d8b6] px-0.5 text-[#8d3e18]">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function scoreMatch(value: string, term: string) {
  const normalizedValue = normalize(value);
  if (!normalizedValue || !term) return 0;
  if (normalizedValue === term) return 120;
  if (normalizedValue.startsWith(term)) return 80;
  if (normalizedValue.includes(term)) return 40;
  return 0;
}

export default function GlobalSearch({
  profile,
  className = '',
  compact = false,
}: {
  profile: Profile | null;
  className?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { companyId } = useTenant();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (key === 'escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const nextResults = await searchWorkspace(trimmed, companyId, profile);
        setResults(nextResults);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [term, open, companyId, profile]);

  const grouped = useMemo(() => {
    return {
      customers: results.filter((result) => result.category === 'customers'),
      repairs: results.filter((result) => result.category === 'repairs'),
      sales: results.filter((result) => result.category === 'sales'),
      purchase_orders: results.filter((result) => result.category === 'purchase_orders'),
      orders: results.filter((result) => result.category === 'orders'),
      products: results.filter((result) => result.category === 'products'),
    };
  }, [results]);

  const closeAndGo = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex items-center gap-3 rounded-2xl border border-[#ddcbb7] bg-[rgba(255,251,245,0.92)] text-left shadow-[0_8px_24px_rgba(63,43,22,0.06)] transition hover:bg-white ${compact ? 'px-2.5 py-2.5' : 'px-3 py-2.5'} ${className}`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2e3d1] text-[#214e5f]">
          <Search className="h-4 w-4" />
        </div>
        {!compact && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#17242b]">Global search</p>
              <p className="truncate text-xs text-[#6d7478]">IMEI, customer, ticket, invoice, PO, or order</p>
            </div>
            <div className="hidden rounded-xl border border-[#dfcfbb] bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b5c3c] sm:block">
              Ctrl K
            </div>
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-[#0c1820]/55 p-3 pt-20 backdrop-blur-sm md:p-6 md:pt-24">
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[30px] border border-[#ddcbb7] bg-[rgba(255,251,245,0.98)] shadow-[0_24px_80px_rgba(17,34,41,0.24)]">
            <div className="flex items-center gap-3 border-b border-[#eadaca] px-4 py-4 md:px-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2e3d1] text-[#214e5f]">
                <Search className="h-5 w-5" />
              </div>
              <input
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search IMEI, customer, t#, s#, p#, or o#"
                className="w-full bg-transparent text-base font-medium text-[#17242b] outline-none placeholder:text-[#8a8f93]"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-[#e2d3c2] bg-white/80 p-2 text-[#667278] hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4 md:p-5">
              {!term.trim() && (
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    'Customer name or phone',
                    'IMEI or SKU',
                    'Ticket number like t#1024',
                    'Invoice like s#',
                    'Purchase order like p#',
                    'Order like o#',
                  ].map((hint) => (
                    <div key={hint} className="rounded-2xl border border-[#eadaca] bg-white px-4 py-4 text-sm text-[#58646a]">
                      {hint}
                    </div>
                  ))}
                </div>
              )}

              {loading && term.trim() && (
                <div className="py-12 text-center text-sm text-[#6c767b]">Searching across the workspace...</div>
              )}

              {!loading && term.trim().length >= 2 && results.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-[#c5b49f]" />
                  <p className="text-sm font-semibold text-[#33434b]">No matching records found</p>
                  <p className="mt-1 text-sm text-[#6c767b]">Try a name, IMEI, ticket number, or invoice id.</p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="space-y-6">
                  <ResultGroup title="Customers" items={grouped.customers} onSelect={closeAndGo} term={term} />
                  <ResultGroup title="Repairs" items={grouped.repairs} onSelect={closeAndGo} term={term} />
                  <ResultGroup title="Invoices" items={grouped.sales} onSelect={closeAndGo} term={term} />
                  <ResultGroup title="Purchase Orders" items={grouped.purchase_orders} onSelect={closeAndGo} term={term} />
                  <ResultGroup title="Orders" items={grouped.orders} onSelect={closeAndGo} term={term} />
                  <ResultGroup title="Products & IMEI" items={grouped.products} onSelect={closeAndGo} term={term} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultGroup({
  title,
  items,
  onSelect,
  term,
}: {
  title: string;
  items: SearchResult[];
  onSelect: (href: string) => void;
  term: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b5c3c]">{title}</p>
        <span className="rounded-full border border-[#e5d6c5] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b6f51]">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={`${item.category}-${item.id}`}
            type="button"
            onClick={() => onSelect(item.href)}
            className="flex w-full items-start gap-3 rounded-2xl border border-[#eadaca] bg-white px-4 py-4 text-left transition hover:border-[#d3b494] hover:bg-[#fff8f0]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e3d0] text-[#214e5f]">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#17242b]">{highlightText(item.title, term)}</p>
                {item.meta && <span className="text-xs uppercase tracking-[0.14em] text-[#8a714f]">{item.meta}</span>}
              </div>
              <p className="mt-1 text-sm text-[#627077]">{highlightText(item.subtitle, term)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

async function searchWorkspace(term: string, companyId: string | null, profile: Profile | null): Promise<SearchResult[]> {
  const normalized = normalize(term);
  const isTicketSearch = normalized.startsWith('t#');
  const isInvoiceSearch = normalized.startsWith('s#');
  const isPoSearch = normalized.startsWith('p#');
  const isOrderSearch = normalized.startsWith('o#');
  const imeiSearch = looksLikeImei(normalized);
  const cleanTerm = normalized.replace(/^[tspo]#/, '').trim();

  const requests: Array<Promise<SearchResult[]>> = [];

  if (hasPermission(profile, 'customers.view') && !isTicketSearch && !isInvoiceSearch && !isPoSearch && !isOrderSearch) {
    requests.push(searchCustomers(cleanTerm || normalized, companyId));
  }

  if (hasPermission(profile, 'repairs.view')) {
    requests.push(searchRepairs(isTicketSearch ? cleanTerm : normalized, companyId));
  }

  if (hasPermission(profile, 'invoices.view')) {
    requests.push(searchSales(isInvoiceSearch ? cleanTerm : normalized, companyId));
  }

  if (hasPermission(profile, 'purchase_orders.view')) {
    requests.push(searchPurchaseOrders(isPoSearch ? cleanTerm : normalized, companyId));
  }

  if (hasPermission(profile, 'orders.view')) {
    requests.push(searchOrders(isOrderSearch ? cleanTerm : normalized, companyId));
  }

  if (hasPermission(profile, 'inventory.view') || hasPermission(profile, 'imei.view')) {
    requests.push(searchProducts(imeiSearch ? cleanTerm || normalized : normalized, companyId));
  }

  const grouped = await Promise.all(requests);
  return grouped.flat().slice(0, 18);
}

async function searchCustomers(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'customers'), orderBy('first_name'), limit(60)));
  const customers = filterByCompany(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as Customer)), companyId);
  return customers
    .map((customer) => {
      const score =
        scoreMatch(customer.name || '', term) +
        scoreMatch(customer.first_name || '', term) +
        scoreMatch(customer.last_name || '', term) +
        scoreMatch(customer.phone || '', term) +
        scoreMatch(customer.email || '', term) +
        scoreMatch(customer.company || '', term);

      return { customer, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ customer, score }) => ({
      id: customer.id,
      category: 'customers',
      title: customer.name || `${customer.first_name} ${customer.last_name || ''}`.trim(),
      subtitle: [customer.phone, customer.email, customer.company].filter(Boolean).join(' • ') || 'Customer record',
      meta: 'customer',
      href: `/customers?search=${escapeParam(customer.name || customer.phone || customer.email || customer.id)}`,
      icon: User,
      score,
    }));
}

async function searchRepairs(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'repairs'), orderBy('updated_at', 'desc'), limit(60)));
  const repairs = filterByCompany(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as Repair)), companyId);
  return repairs
    .map((repair) => {
      const score =
        scoreMatch(repair.ticket_number || '', term) +
        scoreMatch(repair.device_name || '', term) +
        scoreMatch(repair.imei || '', term) +
        scoreMatch(repair.issue_description || '', term);

      return { repair, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ repair, score }) => ({
      id: repair.id,
      category: 'repairs',
      title: repair.ticket_number || `Repair ${repair.id.slice(0, 8)}`,
      subtitle: [repair.device_name, repair.imei, safeFormatDate(repair.updated_at, 'dd MMM yyyy')].filter(Boolean).join(' • '),
      meta: 'repair',
      href: `/repairs/${repair.id}`,
      icon: Wrench,
      score,
    }));
}

async function searchSales(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'sales'), orderBy('created_at', 'desc'), limit(60)));
  const sales = filterByCompany(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as Sale)), companyId);
  return sales
    .map((sale) => {
      const score =
        scoreMatch(sale.id, term) +
        scoreMatch(sale.customer_id || '', term) +
        scoreMatch(sale.payment_method || '', term) +
        scoreMatch(sale.created_at || '', term);

      return { sale, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ sale, score }) => ({
      id: sale.id,
      category: 'sales',
      title: `Invoice ${sale.id.slice(0, 8)}`,
      subtitle: [safeFormatDate(sale.created_at, 'dd MMM yyyy'), sale.payment_method?.toUpperCase()].filter(Boolean).join(' • '),
      meta: 'invoice',
      href: `/view-invoice/${sale.id}`,
      icon: FileText,
      score,
    }));
}

async function searchPurchaseOrders(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'purchase_orders'), orderBy('created_at', 'desc'), limit(50)));
  const purchaseOrders = filterByCompany(
    snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as PurchaseOrderLike)),
    companyId
  );
  return purchaseOrders
    .map((order) => {
      const score =
        scoreMatch(order.po_number || '', term) +
        scoreMatch(order.supplier_name || '', term) +
        scoreMatch(order.status || '', term) +
        scoreMatch(order.id, term);

      return { order, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ order, score }) => ({
      id: order.id,
      category: 'purchase_orders',
      title: order.po_number || `PO ${order.id.slice(0, 8)}`,
      subtitle: [order.supplier_name, order.status, safeFormatDate(order.created_at, 'dd MMM yyyy')].filter(Boolean).join(' • '),
      meta: 'purchase order',
      href: `/purchase-orders?search=${escapeParam(order.po_number || order.supplier_name || order.id)}`,
      icon: ClipboardList,
      score,
    }));
}

async function searchOrders(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(40)));
  const orders = filterByCompany(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as OrderLike)), companyId);
  return orders
    .map((order) => {
      const score =
        scoreMatch(order.order_number || '', term) +
        scoreMatch(order.customer_name || '', term) +
        scoreMatch(order.status || '', term) +
        scoreMatch(order.id, term);

      return { order, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ order, score }) => ({
      id: order.id,
      category: 'orders',
      title: order.order_number || `Order ${order.id.slice(0, 8)}`,
      subtitle: [order.customer_name, order.status, safeFormatDate(order.created_at, 'dd MMM yyyy')].filter(Boolean).join(' • '),
      meta: 'order',
      href: `/orders?search=${escapeParam(order.order_number || order.customer_name || order.id)}`,
      icon: ShoppingCart,
      score,
    }));
}

async function searchProducts(term: string, companyId: string | null): Promise<SearchResult[]> {
  const snapshot = await getDocs(query(collection(db, 'products'), orderBy('created_at', 'desc'), limit(80)));
  const products = filterByCompany(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as Product)), companyId);
  return products
    .map((product) => {
      const score =
        scoreMatch(product.name || '', term) +
        scoreMatch(product.sku || '', term) +
        scoreMatch(product.barcode || '', term) +
        scoreMatch(product.imei || '', term);

      return { product, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ product, score }) => {
      const imeiTarget = product.imei ? `/imei?query=${escapeParam(product.imei)}` : `/inventory?search=${escapeParam(product.sku || product.name)}`;
      return {
        id: product.id,
        category: 'products' as const,
        title: product.name,
        subtitle: [product.sku, product.imei, product.category].filter(Boolean).join(' • '),
        meta: product.imei ? 'imei' : 'product',
        href: imeiTarget,
        icon: Smartphone,
        score,
      };
    });
}
