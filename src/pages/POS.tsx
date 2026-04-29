import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  addDoc,
  orderBy,
  onSnapshot,
  where,
  runTransaction
} from 'firebase/firestore';
import Fuse from 'fuse.js';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  ArrowRight,
  LayoutGrid,
  User as UserIcon,
  PenTool,
  FileText,
  X,
  Receipt,
  MoreHorizontal,
  ScanLine
} from 'lucide-react';
import { Product, Customer, Profile, Repair } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import CustomerModal from '../components/repairs/CustomerModal';
import PostSaleModal from '../components/pos/PostSaleModal';
import { useTenant } from '../lib/tenant';
import { isCompanyScopedRecord, withCompanyId } from '../lib/companyData';
import { buildInvoiceNumber, isStockTrackedProduct, roundMoney, TAX_RATE } from '../lib/business';
import { companyQuery, companySubcollection, requireCompanyId } from '../lib/db';

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
  const [isSaleToolsOpen, setIsSaleToolsOpen] = useState(false);
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [isBrowsingProducts, setIsBrowsingProducts] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '', quantity: '1' });
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showProductResults, setShowProductResults] = useState(false);
  const [customerCreditBalance, setCustomerCreditBalance] = useState(0);
  const [drawers, setDrawers] = useState<{ id: string; name: string }[]>([]);
  const [selectedDrawerId, setSelectedDrawerId] = useState<string>(() => localStorage.getItem('pos_drawer_id') || '');
  const [selectedDrawerName, setSelectedDrawerName] = useState<string>(() => localStorage.getItem('pos_drawer_name') || '');
  const paymentAmountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!companyId) return;

    const productsQuery = companyQuery('products', companyId, orderBy('name'));
    const customersQuery = companyQuery('customers', companyId, orderBy('name'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    fetchStaff();
    fetchDrawers();

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

  // Load store credit balance when customer changes
  useEffect(() => {
    if (!selectedCustomer?.id || !companyId) {
      setCustomerCreditBalance(0);
      return;
    }
    getDocs(
      query(
        collection(db, 'store_credit'),
        where('company_id', '==', companyId),
        where('customer_id', '==', selectedCustomer.id)
      )
    ).then((snap) => {
      const total = snap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      setCustomerCreditBalance(Math.max(0, total));
    }).catch(() => setCustomerCreditBalance(0));
  }, [selectedCustomer?.id, companyId]);

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
      const itemsSnap = await getDocs(companySubcollection(`repairs/${id}/items`, companyId));
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
    if (!companyId) return;
    const q = query(collection(db, 'profiles'), where('company_id', '==', companyId), where('role', 'in', ['admin', 'staff']));
    const querySnapshot = await getDocs(q);
    setStaff(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)));
  }

  async function fetchDrawers() {
    if (!companyId) return;
    try {
      const snap = await getDocs(query(collection(db, 'drawers'), where('company_id', '==', companyId)));
      const drawerList = snap.docs.map(d => ({ id: d.id, name: d.data().name as string }));
      setDrawers(drawerList);
      // Auto-select first drawer if none saved
      if (!localStorage.getItem('pos_drawer_id') && drawerList.length > 0) {
        setSelectedDrawerId(drawerList[0].id);
        setSelectedDrawerName(drawerList[0].name);
        localStorage.setItem('pos_drawer_id', drawerList[0].id);
        localStorage.setItem('pos_drawer_name', drawerList[0].name);
      }
    } catch { /* drawers collection may not exist yet */ }
  }

  function handleDrawerChange(id: string) {
    const drawer = drawers.find(d => d.id === id);
    setSelectedDrawerId(id);
    setSelectedDrawerName(drawer?.name || '');
    localStorage.setItem('pos_drawer_id', id);
    localStorage.setItem('pos_drawer_name', drawer?.name || '');
  }

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['name', 'sku', 'barcode', 'imei'],
      threshold: 0.3,
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (search) return fuse.search(search).map(result => result.item);
    if (isBrowsingProducts) return products.slice(0, 20);
    return [];
  }, [search, fuse, products, isBrowsingProducts]);

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
    setIsBrowsingProducts(false);
    setShowProductResults(false);
  };

  const handleAddCustomItem = () => {
    const name = customItem.name.trim();
    const price = roundMoney(parseFloat(customItem.price));
    const quantity = parseInt(customItem.quantity, 10) || 1;

    if (!name) {
      toast.error('Enter a custom item name.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid custom item price.');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be at least 1.');
      return;
    }

    const item: CartItem = {
      id: `custom-${Date.now()}`,
      name,
      selling_price: price,
      cost_price: 0,
      category: 'Service',
      sku: null,
      barcode: null,
      imei: null,
      low_stock_threshold: 0,
      created_at: new Date().toISOString(),
      quantity,
      custom_price: price,
      discount: 0,
      stock: 0
    };

    setCart((prev) => [...prev, item]);
    setCustomItem({ name: '', price: '', quantity: '1' });
    setIsCustomItemOpen(false);
    toast.success('Custom item added');
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
    if (paymentMethod === 'Store Credit') {
      if (!selectedCustomer) {
        toast.error('Select a customer to use store credit.');
        return;
      }
      const alreadyUsed = payments.filter(p => p.method === 'Store Credit').reduce((s, p) => s + p.amount, 0);
      if (alreadyUsed + amount > customerCreditBalance + 0.001) {
        toast.error(`Insufficient store credit. Available: R${customerCreditBalance.toFixed(2)}`);
        return;
      }
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
    return acc + (Math.max(0, price - discount) * item.quantity);
  }, 0);

  const grandTotal = roundMoney(Math.max(0, subtotal - globalDiscount));
  const vat = roundMoney(grandTotal * TAX_RATE);
  const taxableTotal = roundMoney(grandTotal - vat);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const amountDue = roundMoney(grandTotal - totalPaid);
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  const paymentEntered = parseFloat(paymentAmount) || 0;
  const projectedPaid = roundMoney(totalPaid + paymentEntered);
  const projectedDue = roundMoney(grandTotal - projectedPaid);
  const projectedChange = paymentMethod === 'Cash' ? Math.max(0, roundMoney(projectedPaid - grandTotal)) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!companyId) {
      toast.error('A company workspace is required before checkout.');
      return;
    }
    if (!selectedStaffId) {
      toast.error('Please select the cashier/staff member for this sale.');
      return;
    }
    if (globalDiscount < 0 || globalDiscount > subtotal) {
      toast.error('Discount cannot be negative or greater than the sale subtotal.');
      return;
    }
    const invalidItem = cart.find((item) => item.quantity <= 0 || (item.custom_price ?? item.selling_price) < 0 || (item.discount ?? 0) < 0);
    if (invalidItem) {
      toast.error(`Please fix quantity, price, or discount for ${invalidItem.name}.`);
      return;
    }
    if (amountDue > 0.01) {
      toast.error(`Please collect full payment. Amount due: ${formatCurrency(amountDue)}`);
      return;
    }
    
    setLoading(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      const now = new Date().toISOString();
      const saleRef = doc(collection(db, 'sales'));
      const invoiceNumber = buildInvoiceNumber();

      await runTransaction(db, async (transaction) => {
        const productSnapshots = new Map<string, Product>();

        for (const item of cart) {
          if (!isStockTrackedProduct(item)) continue;

          const productRef = doc(db, 'products', item.id);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            throw new Error(`${item.name} no longer exists in inventory.`);
          }

          const product = { id: productSnap.id, ...productSnap.data() } as Product;
          if (product.company_id !== workspaceId) {
            throw new Error(`${item.name} does not belong to this company workspace.`);
          }
          if (Number(product.stock || 0) < item.quantity) {
            throw new Error(`${item.name} has only ${Number(product.stock || 0)} in stock.`);
          }

          productSnapshots.set(item.id, product);
        }

        const profit = roundMoney(cart.reduce((acc, item) => {
          const inventoryProduct = productSnapshots.get(item.id);
          const price = item.custom_price ?? item.selling_price;
          const discount = item.discount ?? 0;
          const unitPrice = Math.max(0, price - discount);
          const costPrice = inventoryProduct?.cost_price ?? item.cost_price ?? 0;
          return acc + ((unitPrice - costPrice) * item.quantity);
        }, 0));

        transaction.set(saleRef, withCompanyId(workspaceId, {
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || `${selectedCustomer?.first_name || ''} ${selectedCustomer?.last_name || ''}`.trim() || null,
          customer_phone: selectedCustomer?.phone || null,
          invoice_number: invoiceNumber,
          ticket_number: currentRepair?.ticket_number || null,
          repair_id: currentRepair?.id || null,
          device_name: currentRepair?.device_name || null,
          subtotal: roundMoney(subtotal),
          global_discount: roundMoney(globalDiscount),
          tax_rate: TAX_RATE,
          tax_amount: vat,
          taxable_total: taxableTotal,
          total_amount: grandTotal,
          profit,
          payment_method: payments[0]?.method?.toLowerCase() || 'cash',
          payment_methods: payments.map(p => p.method),
          payments: payments.map((payment) => ({ ...payment, amount: roundMoney(payment.amount) })),
          status: 'completed',
          refunded_amount: 0,
          refund_status: 'none',
          refunded_item_quantities: {},
          staff_id: selectedStaffId,
          drawer_id: selectedDrawerId || null,
          drawer_name: selectedDrawerName || null,
          created_by: auth.currentUser?.uid || selectedStaffId,
          created_at: now,
          updated_at: now
        }));

        for (const item of cart) {
          const actualPrice = item.custom_price ?? item.selling_price;
          const discount = item.discount ?? 0;
          const unitPrice = roundMoney(Math.max(0, actualPrice - discount));
          const itemTotal = roundMoney(unitPrice * item.quantity);
          const saleItemPayload = withCompanyId(workspaceId, {
            sale_id: saleRef.id,
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            original_price: roundMoney(item.selling_price),
            unit_price: unitPrice,
            discount: roundMoney(discount),
            total_price: itemTotal,
            created_at: now
          });

          transaction.set(doc(collection(db, `sales/${saleRef.id}/items`)), saleItemPayload);
          transaction.set(doc(collection(db, 'sale_items')), saleItemPayload);

          const inventoryProduct = productSnapshots.get(item.id);
          if (inventoryProduct) {
            const productRef = doc(db, 'products', item.id);
            transaction.update(productRef, {
              stock: Number(inventoryProduct.stock || 0) - item.quantity,
              updated_at: now,
            });
            transaction.set(doc(collection(db, 'inventory_movements')), withCompanyId(workspaceId, {
              type: 'sale',
              product_id: item.id,
              product_name: item.name,
              quantity: -item.quantity,
              sale_id: saleRef.id,
              reason: 'POS sale',
              actor_id: auth.currentUser?.uid || selectedStaffId,
              created_at: now,
            }));
          }
        }

        if (currentRepair?.id) {
          transaction.update(doc(db, 'repairs', currentRepair.id), {
            paid_amount: roundMoney((currentRepair.paid_amount || 0) + grandTotal),
            total_amount: grandTotal,
            status_payment: 'paid',
            sale_id: saleRef.id,
            updated_at: now,
          });
          transaction.set(doc(collection(db, `repairs/${currentRepair.id}/history`)), withCompanyId(workspaceId, {
            repair_id: currentRepair.id,
            status_id: currentRepair.status_id,
            changed_by: auth.currentUser?.uid || selectedStaffId,
            notes: `Paid through POS invoice ${invoiceNumber}`,
            created_at: now,
          }));
        }

        transaction.set(doc(collection(db, 'activity_logs')), withCompanyId(workspaceId, {
          actor_id: auth.currentUser?.uid || selectedStaffId,
          action: 'sale.completed',
          entity_type: 'sale',
          entity_id: saleRef.id,
          summary: `Completed sale ${invoiceNumber} for ${formatCurrency(grandTotal)}`,
          created_at: now,
        }));
      });

      // Deduct store credit if used
      const creditUsed = payments.filter(p => p.method === 'Store Credit').reduce((s, p) => s + p.amount, 0);
      if (creditUsed > 0 && selectedCustomer?.id) {
        await addDoc(collection(db, 'store_credit'), withCompanyId(workspaceId, {
          customer_id: selectedCustomer.id,
          amount: -creditUsed,
          reason: `Applied to sale ${invoiceNumber}`,
          source: 'redemption',
          sale_id: saleRef.id,
          created_by: auth.currentUser?.uid || selectedStaffId,
          created_at: now,
        }));
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
    setCustomerCreditBalance(0);
  };

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-5 xl:flex-row xl:gap-6">
      {/* Main Area */}
      <div className="order-1 flex flex-1 min-w-0 flex-col space-y-4">
        <div className="hero-card rounded-xl px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">Point Of Sale</p>
            <h1 className="text-3xl md:text-4xl font-black text-white">Cash Register</h1>
            <p className="mt-2 text-sm text-zinc-400">Scan, add items, take payment, and complete the sale from one focused register view.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 bg-[#101012] border border-[#2A2A2E] rounded-xl px-3 py-2 shadow-sm min-w-0">
              <UserIcon className="w-4 h-4 text-zinc-500" />
              <select
                className="min-w-0 text-sm font-medium bg-transparent focus:outline-none text-white"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            {drawers.length > 0 && (
              <div className="flex items-center gap-2 bg-[#101012] border border-[#2A2A2E] rounded-xl px-3 py-2 shadow-sm min-w-0">
                <span className="text-zinc-500 text-xs font-bold">🗄</span>
                <select
                  className="min-w-0 text-sm font-medium bg-transparent focus:outline-none text-white"
                  value={selectedDrawerId}
                  onChange={(e) => handleDrawerChange(e.target.value)}
                >
                  <option value="">No Drawer</option>
                  {drawers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn btn-secondary px-3 py-2 text-xs">
              Petty Cash
            </button>
            <button onClick={() => setIsSaleToolsOpen(true)} className="btn btn-secondary px-3 py-2 text-xs text-zinc-400">
              <MoreHorizontal className="w-4 h-4" />
              Sale Tools
            </button>
          </div>
        </div>

        {/* Item Search */}
        <div className="section-card p-4 rounded-xl border border-[#2A2A2E] bg-[#141416]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Add Items</p>
              <p className="text-xs text-zinc-500">Scan barcode, search SKU, IMEI, or product name.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-[#2A2A2E] bg-[#101012] px-3 py-2 text-xs font-bold text-zinc-400 sm:flex">
              <ShoppingCart className="h-4 w-4 text-[#3B82F6]" />
              {totalQty} items
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3B82F6]" />
              <input
                type="text"
                placeholder="Scan or search item..."
                className="w-full pl-10 pr-4 py-4 text-base font-bold focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsBrowsingProducts(false);
                  setShowProductResults(true);
                }}
                onFocus={() => setShowProductResults(true)}
              />
              {showProductResults && (search || isBrowsingProducts) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#141416] border border-[#2A2A2E] rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        className="w-full px-4 py-3 text-left hover:bg-white/[0.05] flex items-center justify-between gap-4"
                        onClick={() => addToCart(p)}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-xs text-zinc-500">{p.category} · {formatCurrency(p.selling_price)} · Stock {p.stock || 0}</p>
                        </div>
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#22C55E]/15 text-[#86EFAC]">
                          <Plus className="w-4 h-4" />
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-zinc-500">No products found</div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setIsCustomItemOpen(true)} className="btn btn-secondary px-4" title="Add custom item">
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setSearch('');
                setIsBrowsingProducts(true);
                setShowProductResults(true);
              }}
              className="btn btn-secondary px-4"
              title="Browse products"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Table */}
        <div className="flex-1 section-card rounded-xl overflow-hidden flex flex-col border border-[#2A2A2E] bg-[#141416]">
          <div className="flex flex-col gap-2 border-b border-[#2A2A2E] bg-[#101012] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-black text-white">Current Sale</p>
                <span className="rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#93C5FD]">
                  {cart.length} lines
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{cart.length ? `${totalQty} total quantity` : 'Cart is ready for scanned items'}</p>
            </div>
            <p className="text-xs font-bold text-zinc-400">Subtotal {formatCurrency(subtotal)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
              <thead className="bg-[#101012]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Item</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Stock</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Unit</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Discount</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Line Total</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14">
                      <div className="mx-auto max-w-sm text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2A2A2E] bg-[#101012] text-[#3B82F6]">
                          <ScanLine className="h-7 w-7" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Cart is empty</h3>
                        <p className="mt-2 text-sm text-zinc-400">Scan a barcode or search above to add the first item to this sale.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => {
                    const price = item.custom_price ?? item.selling_price;
                    const discount = item.discount ?? 0;
                    const itemTotal = (price - discount) * item.quantity;
                    
                    return (
                      <tr key={item.id} className="group transition-colors hover:bg-[#202024]">
                        <td className="border-b border-[#2A2A2E] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2E] bg-[#101012] text-xs font-black text-zinc-400">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">{item.name}</p>
                              <p className="mt-1 truncate text-xs text-zinc-500">{item.sku || item.barcode || item.category || 'POS line item'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-center">
                          <span className={cn('inline-flex min-w-14 justify-center rounded-lg border px-2.5 py-1 text-xs font-bold', Number(item.stock || 0) <= Number(item.low_stock_threshold || 0) ? 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FCD34D]' : 'border-[#2A2A2E] bg-[#101012] text-zinc-300')}>
                            {item.stock || 0}
                          </span>
                        </td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-lg border border-[#2A2A2E] bg-[#101012] p-2 text-zinc-300 transition-colors hover:border-[#EF4444]/40 hover:text-[#FCA5A5]">
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              className="h-9 w-14 rounded-lg border border-[#2A2A2E] bg-[#101012] px-2 text-center font-black text-white focus:border-[#3B82F6] focus:outline-none"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                            />
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-lg border border-[#2A2A2E] bg-[#101012] p-2 text-zinc-300 transition-colors hover:border-[#22C55E]/40 hover:text-[#86EFAC]">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-right">
                          <input 
                            type="number"
                            step="0.01"
                            className="w-24 rounded-lg border border-transparent bg-[#101012] px-2 py-2 text-right font-semibold hover:border-[#3A3A42] focus:border-[#3B82F6] focus:outline-none"
                            value={price}
                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value))}
                          />
                        </td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-right">
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-20 rounded-lg border border-transparent bg-[#101012] px-2 py-2 text-right font-semibold text-[#FCA5A5] hover:border-[#3A3A42] focus:border-[#3B82F6] focus:outline-none"
                            value={item.discount || ''}
                            onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-right font-black text-[#86EFAC]">{formatCurrency(itemTotal)}</td>
                        <td className="border-b border-[#2A2A2E] px-4 py-3 text-center">
                          <button onClick={() => removeFromCart(item.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#EF4444]/35 bg-[#EF4444]/10 text-[#FCA5A5] transition-colors hover:border-[#EF4444] hover:bg-[#EF4444]/20 hover:text-white" title="Remove item">
                            <X className="w-4 h-4" />
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
      </div>

      {/* Right Sidebar */}
      <div className="order-2 w-full xl:w-[26rem] xl:max-w-[26rem] flex flex-col space-y-4 border-t border-[#2A2A2E] pt-5 xl:sticky xl:top-5 xl:self-start xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
        {/* Customer Search */}
        <div className="section-card p-4 rounded-xl space-y-3 border border-[#2A2A2E]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Customer</p>
              <p className="text-xs text-zinc-500">Optional, but recommended for invoices and repairs.</p>
            </div>
            {currentRepair && (
              <span className="rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#93C5FD]">
                Repair
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search Customers"
                className="w-full px-3 py-3 text-sm"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerResults(true);
                }}
                onFocus={() => setShowCustomerResults(true)}
              />
              {showCustomerResults && customerSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#141416] border border-[#2A2A2E] rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        className="w-full px-4 py-3 text-left hover:bg-white/[0.05] flex items-center justify-between"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowCustomerResults(false);
                          setCustomerSearch('');
                        }}
                      >
                        <div>
                          <p className="font-semibold text-sm text-white">{c.name}</p>
                          <p className="text-[10px] text-zinc-500">{c.phone || c.email}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-zinc-500 text-xs">No customers found</div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsCustomerModalOpen(true)}
              className="btn btn-secondary px-3 py-3 text-sm"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
          {selectedCustomer && (
            <div className="flex items-center justify-between p-2 bg-[#22C55E]/10 border border-[#22C55E]/25 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#22C55E]/15 flex items-center justify-center text-[#86EFAC]">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{selectedCustomer.phone}</p>
                  {customerCreditBalance > 0 && (
                    <p className="text-[10px] font-bold text-[#86EFAC]">💳 Credit: R{customerCreditBalance.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="section-card overflow-hidden rounded-xl border border-[#22C55E]/25 bg-[#111512] shadow-[0_0_40px_rgba(34,197,94,0.08)]">
          <div className="border-b border-[#22C55E]/20 bg-[#22C55E]/12 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#86EFAC]">Grand Total</p>
                <p className="mt-2 break-words text-5xl font-black leading-none text-[#22C55E] drop-shadow-[0_0_22px_rgba(34,197,94,0.22)] md:text-6xl xl:text-[4.75rem]">
                  {formatCurrency(grandTotal)}
                </p>
              </div>
              <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#22C55E]/25 bg-black/20 text-[#86EFAC] sm:flex">
                <Receipt className="h-8 w-8" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-[#2A2A2E] bg-black/20 p-3">
                <p className="text-zinc-500">Items</p>
                <p className="mt-1 font-black text-white">{totalQty}</p>
              </div>
              <div className="rounded-lg border border-[#2A2A2E] bg-black/20 p-3">
                <p className="text-zinc-500">Paid</p>
                <p className="mt-1 font-black text-white">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5 bg-[#141416]">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-zinc-400">Subtotal</span>
              <span className="font-bold text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-zinc-400">Sale Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">R</span>
                <input 
                  type="number"
                  step="0.01"
                  className="w-24 rounded-lg border border-[#2A2A2E] bg-[#101012] px-2 py-2 text-right font-bold text-[#FCA5A5] focus:border-[#3B82F6] focus:outline-none"
                  value={globalDiscount || ''}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-zinc-400">Taxable Total</span>
              <span className="font-bold text-white">{formatCurrency(taxableTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-zinc-400">Vat (15%)</span>
              <span className="font-bold text-white">{formatCurrency(vat)}</span>
            </div>
            <div className={cn("flex justify-between rounded-xl border p-3 text-sm", amountDue > 0.01 ? "border-[#F59E0B]/30 bg-[#F59E0B]/10" : "border-[#22C55E]/30 bg-[#22C55E]/10")}>
              <span className="font-black text-white">Amount Due</span>
              <span className={cn("font-black", amountDue > 0.01 ? "text-[#FCD34D]" : "text-[#86EFAC]")}>{formatCurrency(Math.max(0, amountDue))}</span>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="section-card rounded-xl overflow-hidden border border-[#2A2A2E] bg-[#141416]">
          <div className="bg-[#3B82F6]/15 text-[#93C5FD] border-b border-[#2A2A2E] px-5 py-4 font-black text-sm uppercase tracking-[0.12em] flex items-center justify-between">
            <span>Take payment</span>
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="p-5 space-y-6">
            {payments.length > 0 && (
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-[#101012] p-3 rounded-lg border border-[#2A2A2E]">
                    <span className="font-bold text-zinc-300">{p.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{formatCurrency(p.amount)}</span>
                      <button onClick={() => removePayment(i)} className="text-zinc-500 hover:text-[#EF4444]">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Payment method</label>
              <select
                className="w-full px-3 py-4 text-base font-bold focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  window.setTimeout(() => paymentAmountRef.current?.focus(), 0);
                }}
              >
                <option>Cash</option>
                <option>Cheque</option>
                <option>Visa</option>
                <option>Mastercard</option>
                <option>AMEX</option>
                <option>Discover</option>
                <option>Other</option>
                <option>Debit Card</option>
                <option>EFT Via Capital</option>
                <option>EFT Via FNB</option>
                <option>EFT</option>
                {selectedCustomer && customerCreditBalance > 0 && (
                  <option value="Store Credit">Store Credit (R{customerCreditBalance.toFixed(2)} available)</option>
                )}
              </select>
              {paymentMethod === 'Store Credit' && (
                <p className="text-xs font-semibold text-[#22C55E] mt-1">
                  💳 Available: R{customerCreditBalance.toFixed(2)}
                </p>
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-[#2A2A2E] bg-[#101012] p-4">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-400">Amount received</label>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg font-black">R</span>
                  <input
                    ref={paymentAmountRef}
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-5 text-3xl font-black text-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddPayment}
                  className="btn btn-secondary justify-center px-3 py-3 text-sm"
                >
                  <Plus className="w-4 h-4" /> Payment
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-[#2A2A2E] bg-[#141416] p-3">
                  <p className="text-zinc-500">After entry</p>
                  <p className={cn("mt-1 font-black", projectedDue > 0.01 ? "text-[#FCD34D]" : "text-[#86EFAC]")}>
                    {projectedDue > 0.01 ? formatCurrency(projectedDue) : 'Paid'}
                  </p>
                </div>
                <div className={cn("rounded-lg border p-3", projectedChange > 0 ? "border-[#22C55E]/35 bg-[#22C55E]/10" : "border-[#2A2A2E] bg-[#141416]")}>
                  <p className="text-zinc-500">Change</p>
                  <p className={cn("mt-1 text-lg font-black", projectedChange > 0 ? "text-[#86EFAC]" : "text-white")}>{formatCurrency(projectedChange)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className={cn("p-5 flex justify-between items-center border-t border-[#2A2A2E]", amountDue > 0.01 ? "bg-[#F59E0B]/12" : "bg-[#22C55E]/12")}>
            <span className="font-black text-white">Amount Due</span>
            <span className={cn("font-black text-xl", amountDue > 0.01 ? "text-[#FCD34D]" : "text-[#86EFAC]")}>{formatCurrency(Math.max(0, amountDue))}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-2">
          <button
            disabled={cart.length === 0 || loading || amountDue > 0.01}
            onClick={handleCheckout}
            className="w-full justify-center rounded-xl bg-[#22C55E] px-5 py-6 text-lg font-black text-white shadow-[0_0_38px_rgba(34,197,94,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {loading ? 'Processing...' : (
              <>
                <Banknote className="h-5 w-5" />
                Complete Sale
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
          <button
            onClick={clearSale}
            className="mt-2 w-full justify-center rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-4 py-3 text-sm font-bold text-[#FCA5A5] transition-colors hover:border-[#EF4444] hover:bg-[#EF4444]/16 hover:text-white"
          >
            Clear Sale & Start Over
          </button>
        </div>
      </div>

      {isCustomItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-md overflow-hidden rounded-2xl border border-[#2A2A2E] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] bg-[#141416] px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-white">Add Custom Item</h2>
                <p className="mt-1 text-sm text-zinc-500">Use for labour, non-stock services, or one-off charges.</p>
              </div>
              <button onClick={() => setIsCustomItemOpen(false)} className="text-zinc-500 transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Item name</span>
                <input
                  className="mt-2 w-full px-3 py-3 text-sm font-semibold"
                  value={customItem.name}
                  onChange={(event) => setCustomItem((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Labour, diagnostic fee, screen fitting..."
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Price</span>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">R</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full pl-8 pr-3 py-3 text-sm font-semibold"
                      value={customItem.price}
                      onChange={(event) => setCustomItem((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Qty</span>
                  <input
                    type="number"
                    min="1"
                    className="mt-2 w-full px-3 py-3 text-sm font-semibold"
                    value={customItem.quantity}
                    onChange={(event) => setCustomItem((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsCustomItemOpen(false)} className="btn btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button onClick={handleAddCustomItem} className="btn btn-primary flex-1 justify-center">
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSaleToolsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-xl overflow-hidden rounded-2xl border border-[#2A2A2E] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] bg-[#141416] px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-white">Sale Tools</h2>
                <p className="mt-1 text-sm text-zinc-500">Secondary actions are kept out of the checkout lane.</p>
              </div>
              <button onClick={() => setIsSaleToolsOpen(false)} className="text-zinc-500 transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-6">
              <button className="flex w-full items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#141416] p-4 text-left transition-colors hover:border-[#3B82F6]/40 hover:bg-[#1C1C1F]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#93C5FD]">
                    <PenTool className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Add Digital Signature</p>
                    <p className="text-xs text-zinc-500">Capture approval or collection proof.</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </button>
              <button className="flex w-full items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#141416] p-4 text-left transition-colors hover:border-[#3B82F6]/40 hover:bg-[#1C1C1F]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#93C5FD]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Add New Note</p>
                    <p className="text-xs text-zinc-500">Record checkout context without cluttering the sale.</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </button>
              <div className="rounded-xl border border-[#2A2A2E] bg-[#101012] p-4">
                <p className="font-bold text-white">Activity Log</p>
                <p className="mt-2 text-sm text-zinc-500">No activities logged for this sale.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(customer) => {
          setCustomers([customer, ...customers]);
          setSelectedCustomer(customer);
          setIsCustomerModalOpen(false);
        }}
        companyId={companyId}
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
