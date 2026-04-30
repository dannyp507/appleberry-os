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
import { isCompanyScopedRecord } from '../lib/companyData';
import { companyQuery, companySubcollection, requireCompanyId } from '../lib/db';
import { roundMoney } from '../lib/business';

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
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickItem, setQuickItem] = useState({ name: '', price: '', qty: '1' });
  const [linkedTicketInput, setLinkedTicketInput] = useState('');
  const [linkedRepairs, setLinkedRepairs] = useState<{ id: string; ticket_number?: string; device_name?: string }[]>([]);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateSent, setEstimateSent] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    // Wait for both the repair ID and the company to load before subscribing.
    // If companyId is null, the isCompanyScopedRecord check below would falsely
    // reject the repair and redirect back — causing the blank-on-first-click bug.
    if (!id || !companyId) return;

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
        setEstimateSent(Boolean(repairData.estimate_sent));

        // Load linked repairs
        const linkedIds: string[] = Array.isArray(repairData.linked_repair_ids) ? repairData.linked_repair_ids : [];
        if (linkedIds.length > 0) {
          const linked = await Promise.all(
            linkedIds.map(async (lid) => {
              const s = await getDoc(doc(db, 'repairs', lid));
              return s.exists() ? { id: s.id, ticket_number: s.data().ticket_number, device_name: s.data().device_name } : null;
            })
          );
          setLinkedRepairs(linked.filter(Boolean) as any[]);
        }

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
      companySubcollection(`repairs/${id}/items`, companyId, orderBy('created_at', 'asc')),
      (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairItem)));
      }
    );

    // Load other data
    fetchProducts();
    fetchStatuses();
    fetchStaff();
    fetchProblems();

    // Load activity log
    const unsubscribeLog = onSnapshot(
      query(collection(db, `repairs/${id}/history`), orderBy('created_at', 'desc')),
      (snapshot) => {
        setActivityLog(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubscribeRepair();
      unsubscribeItems();
      unsubscribeLog();
    };
  }, [id, companyId, navigate]);

  async function fetchProducts() {
    if (!companyId) return;
    const q = companyQuery('products', companyId, orderBy('name'));
    const snapshot = await getDocs(q);
    setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
  }

  async function fetchStatuses() {
    if (!companyId) return;
    const q = companyQuery('repair_status_options', companyId, orderBy('order_index'));
    const snapshot = await getDocs(q);
    setStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairStatus)));
  }

  async function fetchStaff() {
    if (!companyId) return;
    const q = query(collection(db, 'profiles'), where('company_id', '==', companyId), where('role', 'in', ['admin', 'staff']));
    const snapshot = await getDocs(q);
    setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)));
  }

  async function fetchProblems() {
    if (!companyId) return;
    const snapshot = await getDocs(companyQuery('repair_problems', companyId, orderBy('name')));
    setProblems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)));
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
      const workspaceId = requireCompanyId(companyId);
      await addDoc(collection(db, `repairs/${id}/items`), {
        company_id: workspaceId,
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

  const handleSaveSignature = async () => {
    if (!signatureCanvasRef.current || !id) return;
    const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
    await updateDoc(doc(db, 'repairs', id), {
      customer_signature: dataUrl,
      updated_at: new Date().toISOString(),
    });
    setShowSignatureModal(false);
    toast.success('Signature saved');
  };

  const handleClearSignature = () => {
    if (!signatureCanvasRef.current) return;
    const ctx = signatureCanvasRef.current.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height); }
  };

  const setupCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    signatureCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top };
    };
    canvas.onmousedown = (e) => { isDrawingRef.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    canvas.onmousemove = (e) => { if (!isDrawingRef.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    canvas.onmouseup = () => { isDrawingRef.current = false; };
    canvas.onmouseleave = () => { isDrawingRef.current = false; };
    canvas.ontouchstart = (e) => { e.preventDefault(); isDrawingRef.current = true; ctx.beginPath(); const p = getPos(e.touches[0]); ctx.moveTo(p.x, p.y); };
    canvas.ontouchmove = (e) => { e.preventDefault(); if (!isDrawingRef.current) return; const p = getPos(e.touches[0]); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    canvas.ontouchend = () => { isDrawingRef.current = false; };
  };

  const handleLinkRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repair || !id || !linkedTicketInput.trim()) return;
    try {
      const q = query(
        collection(db, 'repairs'),
        where('ticket_number', '==', linkedTicketInput.trim()),
        where('company_id', '==', companyId)
      );
      const snap = await getDocs(q);
      if (snap.empty) { toast.error('Ticket not found'); return; }
      const linkedId = snap.docs[0].id;
      if (linkedId === id) { toast.error("Can't link a ticket to itself"); return; }
      const existing: string[] = Array.isArray(repair.linked_repair_ids) ? repair.linked_repair_ids : [];
      if (existing.includes(linkedId)) { toast.error('Already linked'); return; }
      const newIds = [...existing, linkedId];
      await updateDoc(doc(db, 'repairs', id), { linked_repair_ids: newIds });
      const linked = snap.docs[0].data();
      setLinkedRepairs(prev => [...prev, { id: linkedId, ticket_number: linked.ticket_number, device_name: linked.device_name }]);
      setLinkedTicketInput('');
      toast.success('Repair linked');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUnlinkRepair = async (linkedId: string) => {
    if (!repair || !id) return;
    const existing: string[] = Array.isArray(repair.linked_repair_ids) ? repair.linked_repair_ids : [];
    const newIds = existing.filter(i => i !== linkedId);
    await updateDoc(doc(db, 'repairs', id), { linked_repair_ids: newIds });
    setLinkedRepairs(prev => prev.filter(r => r.id !== linkedId));
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const price = parseFloat(quickItem.price);
    const qty = parseInt(quickItem.qty, 10) || 1;
    if (!quickItem.name.trim() || isNaN(price) || price < 0) {
      toast.error('Enter a name and valid price');
      return;
    }
    try {
      const workspaceId = requireCompanyId(companyId);
      await addDoc(collection(db, `repairs/${id}/items`), {
        company_id: workspaceId,
        product_id: null,
        name: quickItem.name.trim(),
        quantity: qty,
        unit_price: price,
        discount: 0,
        total_price: roundMoney(price * qty),
        is_one_time: true,
        created_at: new Date().toISOString(),
      });
      setQuickItem({ name: '', price: '', qty: '1' });
      setShowQuickAdd(false);
      toast.success('Item added');
    } catch (err: any) {
      toast.error(err.message);
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
      total_price: roundMoney(Math.max(0, item.unit_price - item.discount) * newQty)
    });
  };

  const updateItemPrice = async (itemId: string, newPrice: number) => {
    if (!id) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    await updateDoc(doc(db, `repairs/${id}/items`, itemId), {
      unit_price: newPrice,
      total_price: roundMoney(Math.max(0, newPrice - item.discount) * item.quantity)
    });
  };

  const updateItemDiscount = async (itemId: string, discount: number) => {
    if (!id) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    await updateDoc(doc(db, `repairs/${id}/items`, itemId), {
      discount: discount,
      total_price: roundMoney(Math.max(0, item.unit_price - discount) * item.quantity)
    });
  };

  const handleUpdateRepair = async (updates: Partial<Repair>) => {
    if (!id) return;
    try {
      const workspaceId = requireCompanyId(companyId);
      await updateDoc(doc(db, 'repairs', id), {
        ...updates,
        company_id: workspaceId,
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

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const user = auth.currentUser;
      const workspaceId = requireCompanyId(companyId);
      await addDoc(collection(db, `repairs/${id}/history`), {
        company_id: workspaceId,
        repair_id: id,
        type: 'note',
        notes: newNote.trim(),
        changed_by: user?.uid || 'system',
        changed_by_name: staff.find(s => s.id === user?.uid)?.full_name || 'Staff',
        created_at: new Date().toISOString()
      });
      setNewNote('');
      toast.success('Note added');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingNote(false);
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
          <button
            onClick={() => window.print()}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="Print repair sheet"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowEstimateModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
            title="View / send estimate"
          >
            <FileText className="w-4 h-4" />
            Estimate
          </button>
          <button
            onClick={() => setShowSignatureModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm ${repair?.customer_signature ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
            title="Customer signature"
          >
            <PenTool className="w-4 h-4" />
            {repair?.customer_signature ? 'Signed' : 'Signature'}
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
            </div>
            <div className="p-6 space-y-5">
              {/* Device + IMEI */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-1">{repair.device_name}</h2>
                  <p className="text-sm text-gray-500">IMEI/Serial: {repair.imei || 'N/A'}</p>
                </div>
              </div>

              {/* Problem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Problem</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={repair.problem_id || ''}
                    onChange={async (e) => {
                      const probId = e.target.value;
                      const problem = problems.find(p => p.id === probId);
                      if (!problem) return;
                      await handleUpdateRepair({ problem_id: probId, issue_description: problem.name });
                      if (problem.default_price && problem.default_price > 0) {
                        const existing = items.find(item => item.name === problem.name);
                        if (!existing) {
                          if (confirm(`Add standard price of ${formatCurrency(problem.default_price)} for ${problem.name}?`)) {
                            const workspaceId = requireCompanyId(companyId);
                            await addDoc(collection(db, `repairs/${id}/items`), {
                              company_id: workspaceId,
                              product_id: `prob-${probId}`,
                              name: problem.name,
                              quantity: 1,
                              unit_price: problem.default_price,
                              discount: 0,
                              total_price: problem.default_price,
                              created_at: new Date().toISOString()
                            });
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

                {/* Due Date */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Due Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={repair.due_date?.substring(0, 10) || ''}
                    onChange={(e) => handleUpdateRepair({ due_date: e.target.value || null })}
                  />
                </div>
              </div>

              {/* Technician + Salesman */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tech Assigned</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={repair.technician_id || ''}
                    onChange={(e) => handleUpdateRepair({ technician_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Salesperson</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={repair.salesman_id || ''}
                    onChange={(e) => handleUpdateRepair({ salesman_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bin Location + Lock Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bin Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Shelf A3"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={repair.bin_location || ''}
                    onChange={(e) => handleUpdateRepair({ bin_location: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lock Password / PIN</label>
                  <input
                    type="text"
                    placeholder="Device passcode"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={repair.ticket_details?.passcode || ''}
                    onChange={(e) => handleUpdateRepair({ ticket_details: { ...repair.ticket_details, passcode: e.target.value } })}
                  />
                </div>
              </div>

              {/* Linked Repairs */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Linked Tickets</label>
                <form onSubmit={handleLinkRepair} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Enter ticket number to link..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={linkedTicketInput}
                    onChange={e => setLinkedTicketInput(e.target.value)}
                  />
                  <button type="submit" className="shrink-0 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:opacity-80">
                    Link
                  </button>
                </form>
                {linkedRepairs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {linkedRepairs.map(r => (
                      <div key={r.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/repairs/${r.id}`)}
                          className="text-xs font-bold text-blue-700 hover:underline"
                        >
                          {r.ticket_number || r.id.slice(-6)} {r.device_name ? `· ${r.device_name}` : ''}
                        </button>
                        <button type="button" onClick={() => handleUnlinkRepair(r.id)} className="text-blue-400 hover:text-blue-700 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Parts */}
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
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" /> Quick Add
                </button>
              </div>
              {showQuickAdd && (
                <form onSubmit={handleQuickAdd} className="flex gap-2 items-end bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Description</label>
                    <input
                      required
                      placeholder="Labour, Part name..."
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                      value={quickItem.name}
                      onChange={e => setQuickItem({ ...quickItem, name: e.target.value })}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qty</label>
                    <input
                      type="number" min="1"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                      value={quickItem.qty}
                      onChange={e => setQuickItem({ ...quickItem, qty: e.target.value })}
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Price (R)</label>
                    <input
                      required type="number" step="0.01" min="0"
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                      value={quickItem.price}
                      onChange={e => setQuickItem({ ...quickItem, price: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="shrink-0 px-3 py-1.5 bg-primary text-white rounded text-sm font-semibold hover:opacity-90">
                    Add
                  </button>
                  <button type="button" onClick={() => setShowQuickAdd(false)} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </form>
              )}
              {showProductResults && search && (
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
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
                </div>
              )}
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
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{activityLog.length}</span>
              </button>
            </div>
            {isActivityLogExpanded && (
              <div className="border-t border-gray-100">
                {/* Add Note */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a note…"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> Add Note
                    </button>
                  </div>
                </div>
                {/* Log Entries */}
                {activityLog.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm italic">No activities yet.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <History className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium">{entry.notes || entry.type}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {entry.changed_by_name || entry.changed_by} · {safeFormatDate(entry.created_at, 'dd MMM yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
            <div className="p-4 space-y-3">
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
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
              </select>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">R</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddPayment(); }}
                  />
                </div>
                <button
                  onClick={handleAddPayment}
                  className="px-3 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {/* Payments made */}
              {(repair.payments || []).length > 0 && (
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {(repair.payments || []).map((p, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-2 text-xs">
                      <span className="font-bold text-gray-600">{p.method}</span>
                      <span className="font-black text-green-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-[#e2e8f0] p-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Total Paid</span>
                <span className="font-bold text-green-700">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-black text-gray-700">Amount Due</span>
                <span className={`font-black text-xl ${amountDue <= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {amountDue <= 0 ? 'PAID' : formatCurrency(amountDue)}
                </span>
              </div>
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

      {/* Signature Modal */}
      {showSignatureModal && repair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold">Customer Signature</h2>
                <p className="text-sm text-gray-500">Sign below to authorise repair</p>
              </div>
              <button onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5">
              {repair.customer_signature ? (
                <div className="mb-4">
                  <p className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signature on file
                  </p>
                  <img src={repair.customer_signature} alt="Customer signature" className="border border-gray-200 rounded-lg w-full" />
                </div>
              ) : null}
              <p className="text-xs text-gray-500 mb-2 font-medium">Draw signature below</p>
              <canvas
                ref={setupCanvas}
                width={380}
                height={160}
                className="border-2 border-dashed border-gray-300 rounded-xl w-full cursor-crosshair bg-white touch-none"
                style={{ touchAction: 'none' }}
              />
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                type="button"
                onClick={handleClearSignature}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 text-sm"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSaveSignature}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-xl font-semibold hover:opacity-80 text-sm"
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Modal */}
      {showEstimateModal && repair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-amber-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Repair Estimate</h2>
                <p className="text-sm text-gray-500">{repair.ticket_number} · {repair.device_name}</p>
              </div>
              <button onClick={() => setShowEstimateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-semibold">{customer?.name || repair.customer_name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Device</span>
                  <span className="font-semibold">{repair.device_name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-semibold">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Item</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-600">Qty</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-600">Price</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic">No items added yet</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 font-black text-right text-gray-900">TOTAL</td>
                    <td className="px-3 py-2 text-right font-black text-gray-900">
                      {formatCurrency(items.reduce((s, i) => s + i.total_price, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {repair.ticket_details?.notes && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 mb-4">
                  <p className="font-semibold text-gray-700 mb-1">Notes</p>
                  {repair.ticket_details.notes}
                </div>
              )}

              {estimateSent && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  Estimate marked as sent
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 text-sm"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={async () => {
                  if (!id) return;
                  await updateDoc(doc(db, 'repairs', id), {
                    estimate_sent: true,
                    estimate_sent_at: new Date().toISOString(),
                  });
                  setEstimateSent(true);
                  toast.success('Estimate marked as sent');
                }}
                disabled={estimateSent}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:opacity-90 text-sm disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" /> Mark Sent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
