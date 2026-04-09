import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  orderBy,
  onSnapshot,
  where
} from 'firebase/firestore';
import Fuse from 'fuse.js';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  ArrowRight,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  PenTool,
  FileText,
  X
} from 'lucide-react';
import { Product, Customer, Profile, Repair } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import CustomerModal from '../components/repairs/CustomerModal';
import PostSaleModal from '../components/pos/PostSaleModal';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord, withCompanyId } from '../lib/companyData';

interface InvoiceSummary {
  created_at: string;
  subtotal: number;
  global_discount: number;
  total_amount: number;
}

interface CartItem extends Product {
  quantity: number;
  custom_price?: number;
  discount?: number; // Fixed amount discount per unit
}

interface Payment {
  method: string;
  amount: number;
  timestamp: string;
}

export default function POS() {
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const repairId = searchParams.get('repairId');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPostSaleModalOpen, setIsPostSaleModalOpen] = useState(false);
  const [currentRepair, setCurrentRepair] = useState<Repair | null>(null);
  const [lastSaleData, setLastSaleData] = useState<{ repair: Repair | null; customer: Customer | null; cart: any[]; saleId?: string; invoiceSummary: InvoiceSummary } | null>(null);
  const [isActivityLogExpanded, setIsActivityLogExpanded] = useState(false);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showProductResults, setShowProductResults] = useState(false);

  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const customersQuery = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)), companyId));
    });
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setCustomers(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)), companyId));
    });

    fetchStaff();
    
    if (auth.currentUser) {
      setSelectedStaffId(auth.currentUser.uid);
    }

    if (repairId) {
      loadRepairData(repairId);
    }

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
    };
  }, [companyId, repairId]);

  async function loadRepairData(id: string) {
    try {
      const repairSnap = await getDoc(doc(db, 'repairs', id));
      if (!repairSnap.exists()) {
        toast.error('Repair ticket not found');
        return;
      }
      
      const repairData = { id: repairSnap.id, ...repairSnap.data() } as Repair;
      if (!isCompanyScopedRecord(repairData, companyId)) {
        toast.error('This repair does not belong to your company workspace');
        return;
      }
      setCurrentRepair(repairData);
      
      // Set customer
      if (repairData.customer_id) {
        const custSnap = await getDoc(doc(db, 'customers', repairData.customer_id));
        if (custSnap.exists() && isCompanyScopedRecord(custSnap.data() as any, companyId)) {
          setSelectedCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }
      }

      // Load items
      const itemsSnap = await getDocs(collection(db, `repairs/${id}/items`));
      const repairItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const newCartItems: CartItem[] = repairItems.map((item: any) => ({
        id: item.product_id || `repair-item-${item.id}`,
        name: item.name,
        selling_price: item.unit_price || 0,
        cost_price: 0,
        category: 'Repair Service',
        sku: '',
        barcode: '',
        imei: '',
        low_stock_threshold: 0,
        created_at: new Date().toISOString(),
        quantity: item.quantity || 1,
        custom_price: item.unit_price || 0,
        discount: item.discount || 0,
        stock: 0
      } as any));

      if (newCartItems.length > 0) {
        setCart(newCartItems);
        setGlobalDiscount(repairData.global_discount || 0);
        toast.success('Repair items loaded into cart');
      } else if (repairData.cost > 0) {
        // Fallback for repairs without individual items but with a total cost
        const fallbackItem: CartItem = {
          id: `repair-service-${id}`,
          name: `Repair Service: ${repairData.device_name}`,
          selling_price: repairData.cost,
          cost_price: 0,
          category: 'Repair Service',
          sku: '',
          barcode: '',
          imei: '',
          low_stock_threshold: 0,
          created_at: new Date().toISOString(),
          quantity: 1,
          custom_price: repairData.cost,
          discount: 0,
          stock: 0
        } as any;
        setCart([fallbackItem]);
        setGlobalDiscount(repairData.global_discount || 0);
        toast.success('Repair cost loaded into cart');
      } else {
        toast.info('This repair ticket has no items or cost assigned');
      }
    } catch (error: any) {
      console.error('Error loading repair data:', error);
      toast.error('Failed to load repair data. Please check if the repair exists.');
    }
  }

  async function fetchStaff() {
    const q = query(collection(db, 'profiles'), where('role', 'in', ['admin', 'staff']));
    const querySnapshot = await getDocs(q);
    setStaff(filterByCompany(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)), companyId));
  }

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['name', 'sku', 'barcode', 'imei'],
      threshold: 0.3,
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return fuse.search(search).map(result => result.item);
  }, [search, fuse]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearch('');
    setShowProductResults(false);
  };

  const updateQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const updatePrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, custom_price: newPrice } : item
    ));
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, discount: discount } : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    setPayments([...payments, {
      method: paymentMethod,
      amount: amount,
      timestamp: new Date().toISOString()
    }]);
    setPaymentAmount('');
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((acc, item) => {
    const price = item.custom_price ?? item.selling_price;
    const discount = item.discount ?? 0;
    return acc + ((price - discount) * item.quantity);
  }, 0);

  const grandTotal = Math.max(0, subtotal - globalDiscount);
  const vat = grandTotal * 0.15;
  const taxableTotal = grandTotal - vat;
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const amountDue = grandTotal - totalPaid;
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (amountDue > 0.01) {
      toast.error(`Please collect full payment. Amount due: ${formatCurrency(amountDue)}`);
      return;
    }
    
    setLoading(true);
    try {
      const saleRef = await addDoc(collection(db, 'sales'), withCompanyId(companyId, {
        customer_id: selectedCustomer?.id || null,
        subtotal: subtotal,
        global_discount: globalDiscount,
        total_amount: grandTotal,
        profit: cart.reduce((acc, item) => {
          const price = item.custom_price ?? item.selling_price;
          const discount = item.discount ?? 0;
          return acc + (((price - discount) - item.cost_price) * item.quantity);
        }, 0),
        payment_methods: payments.map(p => p.method),
        payments: payments,
        staff_id: selectedStaffId,
        created_at: new Date().toISOString()
      }));

      for (const item of cart) {
        const actualPrice = item.custom_price ?? item.selling_price;
        const discount = item.discount ?? 0;
        
        await addDoc(collection(db, `sales/${saleRef.id}/items`), withCompanyId(companyId, {
          sale_id: saleRef.id,
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          original_price: item.selling_price,
          unit_price: actualPrice - discount,
          discount: discount,
          total_price: (actualPrice - discount) * item.quantity,
          created_at: new Date().toISOString()
        }));

        // Update stock
        const productRef = doc(db, 'products', item.id);
        await updateDoc(productRef, {
          stock: (item.stock || 0) - item.quantity
        });
      }

      toast.success('Sale completed successfully!');
      setLastSaleData({
        repair: currentRepair,
        customer: selectedCustomer,
        cart: [...cart],
        saleId: saleRef.id,
        invoiceSummary: {
          created_at: new Date().toISOString(),
          subtotal,
          global_discount: globalDiscount,
          total_amount: grandTotal,
        }
      });
      setIsPostSaleModalOpen(true);
      clearSale();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearSale = () => {
    setCart([]);
    setPayments([]);
    setSelectedCustomer(null);
    setCurrentRepair(null);
    setGlobalDiscount(0);
    setCustomerSearch('');
    setSearch('');
  };

  return (
    <div className="h-full flex gap-6 overflow-hidden">
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        <div className="hero-card rounded-[28px] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Point Of Sale</p>
            <h1 className="display-font text-4xl font-bold text-[#18242b]">Cash Register</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/80 border border-[#e3d5c4] rounded-xl px-3 py-2 shadow-sm">
              <UserIcon className="w-4 h-4 text-gray-400" />
              <select 
                className="text-sm font-medium bg-transparent focus:outline-none"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <button className="bg-[#214e5f] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-sm">
              Petty Cash
            </button>
          </div>
        </div>

        {/* Item Search */}
        <div className="section-card p-4 rounded-[24px]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Scan or Search Item..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowProductResults(true);
                }}
                onFocus={() => setShowProductResults(true)}
              />
              {showProductResults && search && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        onClick={() => addToCart(p)}
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.category} • {formatCurrency(p.selling_price)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">No products found</div>
                  )}
                </div>
              )}
            </div>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <LayoutGrid className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Cart Table */}
        <div className="flex-1 section-card rounded-[24px] overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-12">#</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">Description</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">Need/Have/OnPO</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">Time/Qty</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600">Unit Price</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600">Discount</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 italic">
                      No items in cart.
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => {
                    const price = item.custom_price ?? item.selling_price;
                    const discount = item.discount ?? 0;
                    const itemTotal = (price - discount) * item.quantity;
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-center text-gray-500">0 / {item.stock || 0} / 0</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-gray-200 rounded">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold w-8">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-gray-200 rounded">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="number"
                            step="0.01"
                            className="w-24 text-right border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent font-medium"
                            value={price}
                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value))}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-20 text-right border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent text-red-600 font-medium"
                            value={item.discount || ''}
                            onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(itemTotal)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Log */}
        <div className="section-card rounded-[24px] overflow-hidden">
          <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <button 
              onClick={() => setIsActivityLogExpanded(!isActivityLogExpanded)}
              className="flex items-center gap-2 flex-1 text-left focus:outline-none"
            >
              {isActivityLogExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="font-bold text-gray-700">Activity Log</span>
            </button>
            <div className="flex items-center gap-2">
              <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                <option>All Activities</option>
              </select>
              <button className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 flex items-center gap-1">
                <PenTool className="w-3 h-3" /> Add Digital Signature
              </button>
              <button className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Add New Note
              </button>
            </div>
          </div>
          {isActivityLogExpanded && (
            <div className="p-4 border-t border-gray-100 min-h-[100px] text-sm text-gray-500 italic">
              No activities logged for this sale.
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex flex-col space-y-4">
        {/* Customer Search */}
        <div className="section-card p-4 rounded-[24px] space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search Customers"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerResults(true);
                }}
                onFocus={() => setShowCustomerResults(true)}
              />
              {showCustomerResults && customerSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowCustomerResults(false);
                          setCustomerSearch('');
                        }}
                      >
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.phone || c.email}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-xs">No customers found</div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
          {selectedCustomer && (
            <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{selectedCustomer.phone}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="section-card p-6 rounded-[24px] space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-gray-600">Subtotal :</span>
              <span className="font-bold text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-600">Global Discount :</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">R</span>
                <input 
                  type="number"
                  step="0.01"
                  className="w-20 text-right border-b border-gray-200 focus:border-primary focus:outline-none text-red-600 font-bold"
                  value={globalDiscount || ''}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-gray-600">Taxable Total :</span>
              <span className="font-bold text-gray-900">{formatCurrency(taxableTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-gray-600">Vat (15%) :</span>
              <span className="font-bold text-gray-900">{formatCurrency(vat)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-gray-600">Total Time/QTY: {totalQty}</span>
            </div>
            <div className="flex justify-between text-xl font-black pt-2 border-t border-gray-100">
              <span className="text-gray-900">Grand Total :</span>
              <span className="text-gray-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#334155] text-white px-4 py-2 text-center font-bold text-sm">
            Take payment
          </div>
          <div className="p-4 space-y-4">
            {payments.length > 0 && (
              <div className="space-y-2 mb-4">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span className="text-gray-600">{p.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{formatCurrency(p.amount)}</span>
                      <button onClick={() => removePayment(i)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-3">
              <select 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option>Cash</option>
                <option>Card</option>
                <option>EFT</option>
              </select>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddPayment}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Payment
                </button>
              </div>
            </div>
          </div>
          <div className="bg-[#e2e8f0] p-4 flex justify-between items-center">
            <span className="font-black text-gray-700">Amount Due</span>
            <span className="font-black text-gray-900 text-xl">{formatCurrency(amountDue)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            disabled={cart.length === 0 || loading || amountDue > 0.01}
            onClick={handleCheckout}
            className="w-full bg-[#e2e8f0] text-gray-900 py-3 rounded-lg font-black text-lg hover:bg-gray-300 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>
          <button
            onClick={clearSale}
            className="w-full bg-[#f97316] text-white py-3 rounded-lg font-black text-lg hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
          >
            Clear Sale & Start Over
          </button>
        </div>
      </div>

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(customer) => {
          setCustomers([customer, ...customers]);
          setSelectedCustomer(customer);
          setIsCustomerModalOpen(false);
        }}
      />
      <PostSaleModal 
        isOpen={isPostSaleModalOpen}
        onClose={() => setIsPostSaleModalOpen(false)}
        repair={lastSaleData?.repair || null}
        customer={lastSaleData?.customer || null}
        cart={lastSaleData?.cart || []}
        saleId={lastSaleData?.saleId}
        invoiceSummary={lastSaleData?.invoiceSummary || null}
      />
    </div>
  );
}
