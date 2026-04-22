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
        <h1 className="text-3xl font-bold text-gray-900">IMEI Tracking</h1>
        <p className="text-gray-500 text-lg">Search device history across inventory, sales, and repairs.</p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
        <input
          type="text"
          placeholder="Enter 15-digit IMEI number..."
          className="w-full pl-14 pr-32 py-5 bg-white border border-gray-200 rounded-2xl text-xl font-mono focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all"
          value={imei}
          onChange={(e) => setImei(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 appleberry-gradient text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Device Info */}
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Smartphone className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{results.product?.name || 'Unknown Device'}</h2>
              <p className="text-gray-500 font-mono tracking-widest">{imei}</p>
              <div className="mt-2 flex gap-2">
                {results.product && (
                  <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded">In Inventory</span>
                )}
                {results.sales.length > 0 && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded">Sold</span>
                )}
                {results.repairs.length > 0 && (
                  <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold uppercase rounded">Repair History</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sales History */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
                Sales History
              </div>
              <div className="space-y-3">
                {results.sales.length > 0 ? results.sales.map((item: any) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-gray-900">{formatCurrency(item.unit_price)}</p>
                      <span className="text-[10px] text-gray-400 font-medium uppercase">{safeFormatDate(item.created_at, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-3 h-3" />
                      {item.sales?.customer?.name || 'Walk-in Customer'}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-400 italic">No sales records found.</p>
                )}
              </div>
            </div>

            {/* Repair History */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <Wrench className="w-5 h-5 text-orange-500" />
                Repair History
              </div>
              <div className="space-y-3">
                {results.repairs.length > 0 ? results.repairs.map((repair: any) => (
                  <div key={repair.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-gray-900">{repair.status?.name}</p>
                      <span className="text-[10px] text-gray-400 font-medium uppercase">{safeFormatDate(repair.created_at, 'MMM dd, yyyy')}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{repair.issue_description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-3 h-3" />
                      {repair.customer?.name}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-400 italic">No repair records found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="py-20 text-center text-gray-300">
          <History className="w-20 h-20 mx-auto mb-4 opacity-10" />
          <p className="text-lg">Enter an IMEI to see full device history</p>
        </div>
      )}
    </div>
  );
}
