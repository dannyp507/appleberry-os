import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { 
  Wrench, 
  User, 
  Smartphone, 
  Clock, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  PenTool, 
  FileText,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Printer,
  Share2,
  MoreVertical,
  ShoppingCart
} from 'lucide-react';
import { Repair, Customer, Product, RepairStatus, Profile, RepairProblem } from '../types';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord } from '../lib/companyData';

interface RepairItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  product_id?: string;
}

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useTenant();
  const companyId = company?.id || null;
  
  const [repair, setRepair] = useState<Repair | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<RepairItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statuses, setStatuses] = useState<RepairStatus[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [problems, setProblems] = useState<RepairProblem[]>([]);
  
  const [search, setSearch] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const [isActivityLogExpanded, setIsActivityLogExpanded] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Load Repair
    const unsubscribeRepair = onSnapshot(doc(db, 'repairs', id), async (docSnap) => {
      if (docSnap.exists()) {
        const repairData = { id: docSnap.id, ...docSnap.data() } as Repair;
        if (!isCompanyScopedRecord(repairData, companyId)) {
          toast.error('Repair not found');
          navigate('/repairs');
          setLoading(false);
          return;
        }
        setRepair(repairData);
        
        // Load Customer
        const custSnap = await getDoc(doc(db, 'customers', repairData.customer_id));
        if (custSnap.exists() && isCompanyScopedRecord(custSnap.data(), companyId)) {
          setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }
      } else {
        toast.error('Repair not found');
        navigate('/repairs');
      }
      setLoading(false);
    });

    // Load Items
    const unsubscribeItems = onSnapshot(
      query(collection(db, `repairs/${id}/items`), orderBy('created_at', 'asc')),
      (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairItem)));
      }
    );

    // Load other data
    fetchProducts();
    fetchStatuses();
    fetchStaff();
    fetchProblems();

    return () => {
      unsubscribeRepair();
      unsubscribeItems();
    };
  }, [id, companyId, navigate]);

  async function fetchProducts() {
    const q = query(collection(db, 'products'), orderBy('name'));
    const snapshot = await getDocs(q);
    setProducts(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)), companyId));
  }

  async function fetchStatuses() {
    const q = query(collection(db, 'repair_status_options'), orderBy('order_index'));
    const snapshot = await getDocs(q);
    setStatuses(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairStatus)), companyId));
  }

  async function fetchStaff() {
    const q = query(collection(db, 'profiles'), where('role', 'in', ['admin', 'staff']));
    const snapshot = await getDocs(q);
    setStaff(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)), companyId));
  }

  async function fetchProblems() {
    const snapshot = await getDocs(collection(db, 'repair_problems'));
    setProblems(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)), companyId));
  }

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['name', 'sku', 'barcode'],
      threshold: 0.3,
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return fuse.search(search).map(result => result.item);
  }, [search, fuse]);

  const addToRepair = async (product: Product) => {
    if (!id) return;
    try {
      await addDoc(collection(db, `repairs/${id}/items`), {
        company_id: companyId,
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.selling_price,
        discount: 0,
        total_price: product.selling_price,
        created_at: new Date().toISOString()
      });
      setSearch('');
      setShowProductResults(false);
      toast.success('Item added');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateItemQuantity = async (itemId: string, newQty: number) => {
    if (!id) return;
    if (newQty <= 0) {
      await deleteDoc(doc(db, `repairs/${id}/items`, itemId));
      return;
    }
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    await updateDoc(doc(db, `repairs/${id}/items`, itemId), {
      quantity: newQty,
      total_price: (item.unit_price - item.discount) * newQty
    });
  };

  const updateItemPrice = async (itemId: string, newPrice: number) => {
    if (!id) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    await updateDoc(doc(db, `repairs/${id}/items`, itemId), {
      unit_price: newPrice,
      total_price: (newPrice - item.discount) * item.quantity
    });
  };

  const updateItemDiscount = async (itemId: string, discount: number) => {
    if (!id) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    await updateDoc(doc(db, `repairs/${id}/items`, itemId), {
      discount: discount,
      total_price: (item.unit_price - discount) * item.quantity
    });
  };

  const handleUpdateRepair = async (updates: Partial<Repair>) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'repairs', id), {
        ...updates,
        updated_at: new Date().toISOString()
      });
      toast.success('Repair updated');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddPayment = async () => {
    if (!id || !repair) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    const newPayment = {
      method: paymentMethod,
      amount: amount,
      timestamp: new Date().toISOString()
    };

    const currentPayments = repair.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);

    try {
      await updateDoc(doc(db, 'repairs', id), {
        payments: updatedPayments,
        paid_amount: totalPaid,
        updated_at: new Date().toISOString()
      });
      setPaymentAmount('');
      toast.success('Payment added');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const subtotal = items.reduce((acc, item) => acc + item.total_price, 0);
  const globalDiscount = repair?.global_discount || 0;
  const grandTotal = Math.max(0, subtotal - globalDiscount);
  const totalPaid = repair?.paid_amount || 0;
  const amountDue = grandTotal - totalPaid;

  const suggestedProducts = useMemo(() => {
    if (!repair?.device_name) return [];
    // Search for device name + common repair parts
    const deviceWords = repair.device_name.split(' ');
    const mainModel = deviceWords.slice(0, 3).join(' ');
    
    const issue = (repair.issue_description || '').toLowerCase();
    const keywords = ['lcd', 'screen', 'battery', 'charging', 'port', 'glass', 'camera', 'speaker'];
    const issueKeywords = keywords.filter(k => issue.includes(k));

    return products.filter(p => {
      const name = p.name.toLowerCase();
      const matchesModel = name.includes(mainModel.toLowerCase());
      const matchesIssue = issueKeywords.some(k => name.includes(k));
      const isCommonPart = keywords.some(k => name.includes(k));
      
      return matchesModel && (matchesIssue || isCommonPart);
    }).slice(0, 8);
  }, [repair?.device_name, repair?.issue_description, products]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!repair) return null;

  return (
    <div className="h-full flex flex-col gap-6 bg-[#f8f9fa] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/repairs')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repair Ticket</h1>
            <p className="text-sm text-gray-500">Manage repair details and billing.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            <Printer className="w-5 h-5" />
          </button>
          <button className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            <Share2 className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-gray-200 mx-2" />
          <button className="bg-[#9333ea] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
            Shop Spares
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 space-y-4 overflow-y-auto pr-2">
          {/* Repair Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <User className="w-4 h-4" />
                Ticket #{repair.ticket_number || repair.id.substring(0, 8)}
              </div>
              <button className="p-1 hover:bg-gray-200 rounded text-gray-400">
                <PenTool className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-1">{repair.device_name}</h2>
                  <p className="text-sm text-gray-500">Serial: {repair.imei || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <span className="font-bold">Technician:</span>
                    <select 
                      className="bg-transparent focus:outline-none font-medium text-primary"
                      value={repair.technician_id || ''}
                      onChange={(e) => handleUpdateRepair({ technician_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-sm">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Problem:</span>
                  <div className="mt-1">
                    <select
                      className="bg-transparent focus:outline-none font-medium text-primary w-full"
                      value={repair.problem_id || ''}
                      onChange={async (e) => {
                        const probId = e.target.value;
                        const problem = problems.find(p => p.id === probId);
                        if (!problem) return;

                        await handleUpdateRepair({ 
                          problem_id: probId,
                          issue_description: problem.name
                        });

                        // Auto-add service item if problem has a default price
                        if (problem.default_price && problem.default_price > 0) {
                          const existing = items.find(item => item.name === problem.name);
                          if (!existing) {
                            if (confirm(`This problem has a standard price of ${formatCurrency(problem.default_price)}. Would you like to add it to the repair items?`)) {
                              await addDoc(collection(db, `repairs/${id}/items`), {
                                company_id: companyId,
                                product_id: `prob-${probId}`,
                                name: problem.name,
                                quantity: 1,
                                unit_price: problem.default_price,
                                discount: 0,
                                total_price: problem.default_price,
                                created_at: new Date().toISOString()
                              });
                              toast.success(`Added ${problem.name} service`);
                            }
                          }
                        }
                      }}
                    >
                      <option value="">Select Problem</option>
                      {problems.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {suggestedProducts.length > 0 && (
                  <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <span className="font-bold text-primary uppercase tracking-wider text-[10px] flex items-center gap-1 mb-2">
                      <AlertCircle className="w-3 h-3" />
                      Suggested Parts for {repair.device_name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {suggestedProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addToRepair(p)}
                          className="text-[10px] bg-white border border-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition-all font-bold"
                        >
                          + {p.name} ({formatCurrency(p.selling_price)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <Clock className="w-3 h-3" />
                Created: {safeFormatDate(repair.created_at, 'dd MMM yyyy HH:mm')}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <History className="w-3 h-3" />
                Updated: {safeFormatDate(repair.updated_at, 'dd MMM yyyy HH:mm')}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by product name, SKU or Serial"
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                          onClick={() => addToRepair(p)}
                        >
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-[10px] text-gray-500">{p.category} • {formatCurrency(p.selling_price)}</p>
                          </div>
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-xs">No products found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-600 w-12">#</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Description</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">Need/Have/OnPO</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">Time/Qty</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600">Unit Price</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                        No parts or services added yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-center text-gray-500">0 / 0 / 0</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-gray-200 rounded">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold w-8">{item.quantity}</span>
                            <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-gray-200 rounded">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="number"
                            className="w-24 text-right border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent font-medium"
                            value={item.unit_price}
                            onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value))}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(item.total_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => updateItemQuantity(item.id, 0)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                No activities logged for this repair.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex flex-col space-y-4 overflow-y-auto pr-2">
          {/* Status Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Repair Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              style={{ color: statuses.find(s => s.id === repair.status_id)?.color }}
              value={repair.status_id}
              onChange={(e) => handleUpdateRepair({ status_id: e.target.value })}
            >
              {statuses.map(s => (
                <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Customer Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><PenTool className="w-3 h-3" /></button>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><Share2 className="w-3 h-3" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 leading-tight">{customer?.name || 'Loading...'}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Customer</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600 flex items-center gap-2">
                <span className="text-gray-400">@</span> {customer?.email || 'No email'}
              </p>
              <p className="text-gray-600 flex items-center gap-2">
                <span className="text-gray-400">#</span> {customer?.phone || 'No phone'}
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-600">Taxable Total :</span>
                <span className="font-bold text-gray-900">{formatCurrency(grandTotal * 0.85)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-600">(0%):</span>
                <span className="font-bold text-gray-900">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-600">Total Time/QTY: {items.reduce((acc, i) => acc + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-xl font-black pt-4 border-t border-gray-100">
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
                    className="px-3 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-1"
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
              onClick={() => navigate(`/pos?repairId=${id}`)}
              className="w-full bg-[#9333ea] text-white py-3 rounded-lg font-black text-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-6 h-6" />
              Go to POS
            </button>
            <button
              className="w-full bg-[#f97316] text-white py-3 rounded-lg font-black text-lg hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
            >
              Cancel
            </button>
            <button
              onClick={() => navigate('/repairs')}
              className="w-full bg-[#e2e8f0] text-gray-900 py-3 rounded-lg font-black text-lg hover:bg-gray-300 transition-all"
            >
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
