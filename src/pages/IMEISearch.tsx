import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Search, 
  Smartphone, 
  History, 
  ShoppingCart, 
  Wrench,
  User,
  Calendar
} from 'lucide-react';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { useSearchParams } from 'react-router-dom';
import { companyQuery } from '../lib/db';

export default function IMEISearch() {
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const [imei, setImei] = useState(searchParams.get('query') || '');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei) return;
    setLoading(true);

    try {
      // 1. Search in Products (Inventory)
      const productQuery = companyQuery('products', companyId, where('imei', '==', imei));
      const productSnapshot = await getDocs(productQuery);
      const scopedProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const product = scopedProducts.length > 0 ? scopedProducts[0] : null;

      // 2. Search in Repairs
      const repairsQuery = companyQuery('repairs', companyId, where('imei', '==', imei), orderBy('created_at', 'desc'));
      const repairsSnapshot = await getDocs(repairsQuery);
      const repairs = repairsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // 3. Search in Sales (via sale_items)
      // Note: In Firebase, we'd need to fetch sale_items and then their parent sales.
      // Simplified for now: just fetch sale_items that match product_id if product found.
      let sales: any[] = [];
      if (product) {
        const salesQuery = companyQuery('sale_items', companyId, where('product_id', '==', product.id));
        const salesSnapshot = await getDocs(salesQuery);
        sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      }

      setResults({ product, repairs: repairs || [], sales: sales || [] });
      if (!product && repairs.length === 0) {
        toast.info('No history found for this IMEI');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const nextQuery = searchParams.get('query') || '';
    setImei(nextQuery);
  }, [searchParams]);

  useEffect(() => {
    const nextQuery = searchParams.get('query') || '';
    if (!nextQuery) return;

    const run = async () => {
      setLoading(true);
      try {
        // 1. Search in Products (Inventory)
        const productQuery = companyQuery('products', companyId, where('imei', '==', nextQuery));
        const productSnapshot = await getDocs(productQuery);
        const scopedProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const product = scopedProducts.length > 0 ? scopedProducts[0] : null;

        // 2. Search in Repairs
        const repairsQuery = companyQuery('repairs', companyId, where('imei', '==', nextQuery), orderBy('created_at', 'desc'));
        const repairsSnapshot = await getDocs(repairsQuery);
        const repairs = repairsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        let sales: any[] = [];
        if (product) {
          const salesQuery = companyQuery('sale_items', companyId, where('product_id', '==', product.id));
          const salesSnapshot = await getDocs(salesQuery);
          sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        }

        setResults({ product, repairs: repairs || [], sales: sales || [] });
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [searchParams, companyId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">IMEI Tracking</h1>
        <p className="text-zinc-400 text-base">Search device history across inventory, sales, and repairs.</p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Enter 15-digit IMEI number..."
          className="w-full pl-12 pr-32 py-4 bg-[#141416] border border-[#2A2A2E] rounded-2xl text-lg font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-[#22C55E] transition-all"
          value={imei}
          onChange={(e) => setImei(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#22C55E] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded-xl font-bold disabled:opacity-50 transition-all text-sm"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results && (
        <div className="space-y-6">
          {/* Device Info */}
          <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-6 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-8 h-8 text-[#22C55E]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{results.product?.name || 'Unknown Device'}</h2>
              <p className="text-zinc-500 font-mono tracking-widest text-sm mt-0.5">{imei}</p>
              <div className="mt-2 flex gap-2 flex-wrap">
                {results.product && (
                  <span className="px-2.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase rounded-full tracking-wider">In Inventory</span>
                )}
                {results.sales.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase rounded-full tracking-wider">Sold</span>
                )}
                {results.repairs.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase rounded-full tracking-wider">Repair History</span>
                )}
                {!results.product && results.sales.length === 0 && results.repairs.length === 0 && (
                  <span className="px-2.5 py-0.5 bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase rounded-full tracking-wider">Not Found</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                Sales History
              </div>
              <div className="space-y-2">
                {results.sales.length > 0 ? results.sales.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-[#2A2A2E] bg-[#141416] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-white">{formatCurrency(item.unit_price)}</p>
                      <span className="text-[10px] text-zinc-500 font-medium uppercase">{safeFormatDate(item.created_at, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <User className="w-3 h-3" />
                      {item.sales?.customer?.name || 'Walk-in Customer'}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-zinc-500 italic">No sales records found.</p>
                )}
              </div>
            </div>

            {/* Repair History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Wrench className="w-4 h-4 text-orange-400" />
                Repair History
              </div>
              <div className="space-y-2">
                {results.repairs.length > 0 ? results.repairs.map((repair: any) => (
                  <div key={repair.id} className="rounded-xl border border-[#2A2A2E] bg-[#141416] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-white">{repair.status?.name || 'Unknown Status'}</p>
                      <span className="text-[10px] text-zinc-500 font-medium uppercase">{safeFormatDate(repair.created_at, 'MMM dd, yyyy')}</span>
                    </div>
                    {repair.issue_description && <p className="text-xs text-zinc-400 mb-2">{repair.issue_description}</p>}
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <User className="w-3 h-3" />
                      {repair.customer?.name || 'Unknown Customer'}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-zinc-500 italic">No repair records found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="py-20 text-center">
          <History className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-500">Enter an IMEI to see full device history</p>
        </div>
      )}
    </div>
  );
}
