import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  where
} from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  X, 
  Smartphone, 
  User as UserIcon, 
  AlertCircle,
  Package,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Customer, Product, RepairStatus, RepairProblem } from '../types';
import { formatCurrency } from '../lib/utils';
import CustomerModal from '../components/repairs/CustomerModal';
import DeviceModal from '../components/repairs/DeviceModal';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { buildTicketNumber, roundMoney } from '../lib/business';
import { companyQuery, requireCompanyId } from '../lib/db';

export default function NewRepair() {
  const navigate = useNavigate();
  const { company } = useTenant();
  const companyId = company?.id || null;
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [problems, setProblems] = useState<RepairProblem[]>([]);
  const [statuses, setStatuses] = useState<RepairStatus[]>([]);

  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showDeviceResults, setShowDeviceResults] = useState(false);
  const [showProductResults, setShowProductResults] = useState(false);

  // Modal states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<{ name: string; imei: string; serial_number?: string; condition?: string } | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [selectedSalesman, setSelectedSalesman] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [binLocation, setBinLocation] = useState<string>('');
  const [staff, setStaff] = useState<any[]>([]);
  const [ticketDetails, setTicketDetails] = useState({
    passcode: '',
    pattern: '',
    backup_required: false,
    data_loss_risk_accepted: false
  });
  const [formType, setFormType] = useState<'in' | 'out'>('in');
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  async function fetchData() {
    try {
      const [custSnap, prodSnap, probSnap, statSnap, staffSnap] = await Promise.all([
        getDocs(companyQuery('customers', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('products', companyId, orderBy('name'))),
        getDocs(companyQuery('repair_problems', companyId, orderBy('name'))),
        getDocs(companyQuery('repair_status_options', companyId, orderBy('order_index'))),
        getDocs(query(collection(db, 'profiles'), where('company_id', '==', companyId)))
      ]);

      setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setProblems(probSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)));
      setStatuses(statSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairStatus)));
      setStaff(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Pre-select current user as technician
      const user = auth.currentUser;
      if (user) setSelectedTechnician(user.uid);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.first_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.last_name && c.last_name.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const handleAddItem = (product: Product) => {
    const existing = selectedItems.find(item => item.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, {
        id: product.id,
        name: product.name,
        price: product.selling_price,
        quantity: 1,
        type: product.category.toLowerCase().includes('service') ? 'service' : 'part'
      }]);
    }
    setProductSearch('');
    setShowProductResults(false);
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const totalCost = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (!selectedDevice) {
      toast.error('Please select or enter a device');
      return;
    }
    if (!selectedProblem) {
      toast.error('Please select a problem');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const workspaceId = requireCompanyId(companyId);
      const initialStatus = statuses.find(s => s.order_index === 0) || statuses[0];
      const now = new Date().toISOString();

      const repairData = {
        ...withCompanyId(workspaceId, {}),
        ticket_number: buildTicketNumber(),
        customer_id: selectedCustomer.id,
        device_name: selectedDevice.name,
        imei: selectedDevice.imei,
        serial_number: selectedDevice.serial_number || null,
        condition_notes: selectedDevice.condition || null,
        problem_id: selectedProblem,
        issue_description: problems.find(p => p.id === selectedProblem)?.name || '',
        technician_id: selectedTechnician || user?.uid || null,
        salesman_id: selectedSalesman || null,
        due_date: dueDate || null,
        bin_location: binLocation || null,
        cost: roundMoney(totalCost),
        subtotal: roundMoney(totalCost),
        global_discount: 0,
        total_amount: roundMoney(totalCost),
        paid_amount: 0,
        status_id: initialStatus?.id || '',
        services_and_parts: selectedItems,
        ticket_details: ticketDetails,
        intake_checklist: {
          powers_on: null,
          screen_condition: '',
          body_condition: '',
          accessories_received: '',
          liquid_damage_seen: null,
        },
        warranty_notes: '',
        notification_hooks: {
          intake_sent: false,
          ready_sent: false,
          collected_sent: false,
        },
        form_type: formType,
        created_by: user?.uid || null,
        created_at: now,
        updated_at: now
      };

      const docRef = await addDoc(collection(db, 'repairs'), repairData);

      // Add initial history
      await addDoc(collection(db, `repairs/${docRef.id}/history`), {
        company_id: workspaceId,
        repair_id: docRef.id,
        status_id: initialStatus?.id || '',
        changed_by: user?.uid || 'system',
        notes: 'Repair ticket created',
        created_at: now
      });

      for (const item of selectedItems) {
        await addDoc(collection(db, `repairs/${docRef.id}/items`), {
          company_id: workspaceId,
          product_id: item.type === 'part' ? item.id : null,
          name: item.name,
          type: item.type,
          quantity: item.quantity,
          unit_price: roundMoney(item.price),
          discount: 0,
          total_price: roundMoney(item.price * item.quantity),
          created_at: now,
        });
      }

      toast.success('Repair ticket created successfully');
      navigate('/repairs');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/repairs')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Repair Ticket</h1>
          <p className="text-gray-500">Follow these steps to create a repair ticket for your customer. Required fields are marked with an asterisk (*).</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Step 1: Customer */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Who is this repair for?*</h2>
            <div className="relative">
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer.email || selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Start typing or click '+ New Customer' to add your first customer."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerResults(true);
                      }}
                      onFocus={() => setShowCustomerResults(true)}
                    />
                    {showCustomerResults && customerSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
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
                                <p className="font-medium">{c.first_name} {c.last_name}</p>
                                <p className="text-xs text-gray-500">{c.phone || c.email}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">No customers found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    New Customer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Device */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">What device are we repairing?*</h2>
            <div className="relative">
              {selectedDevice ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedDevice.name}</p>
                      <p className="text-sm text-gray-500">IMEI: {selectedDevice.imei || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDevice(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by device name or IMEI"
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setIsDeviceModalOpen(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    New Device
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Problem */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">What did the customer say is wrong?*</h2>
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                value={selectedProblem}
                onChange={(e) => {
                  const probId = e.target.value;
                  setSelectedProblem(probId);
                  
                  // Auto-add service item if problem has a default price
                  const problem = problems.find(p => p.id === probId);
                  if (problem && problem.default_price && problem.default_price > 0) {
                    // Check if already in cart
                    const existing = selectedItems.find(item => item.id === `prob-${probId}`);
                    if (!existing) {
                      setSelectedItems([...selectedItems, {
                        id: `prob-${probId}`,
                        name: problem.name,
                        price: problem.default_price,
                        quantity: 1,
                        type: 'service'
                      }]);
                      toast.success(`Added ${problem.name} service`);
                    }
                  }
                }}
              >
                <option value="">Select Problem</option>
                {problems.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setIsProblemModalOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Problem
              </button>
            </div>
            <p className="text-sm text-gray-500 italic">Click '+ New Problem' to add common issues like 'Cracked screen' or 'Won't turn on'</p>
          </div>
        </div>

        {/* Step 4: Assignment & Details */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">4</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Assign & Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tech Assigned</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  value={selectedSalesman}
                  onChange={(e) => setSelectedSalesman(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location</label>
                <input
                  type="text"
                  placeholder="e.g. Shelf A3"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={binLocation}
                  onChange={(e) => setBinLocation(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Services & Parts */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">5</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Services & Parts</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for service or product to add"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductResults(true);
                    }}
                    onFocus={() => setShowProductResults(true)}
                  />
                  {showProductResults && productSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(p => (
                          <button
                            key={p.id}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            onClick={() => handleAddItem(p)}
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
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                  Product Picker
                </button>
              </div>

              {selectedItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Price</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {item.type === 'service' ? <AlertCircle className="w-4 h-4 text-blue-500" /> : <Package className="w-4 h-4 text-orange-500" />}
                              {item.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.price * item.quantity)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                        <td className="px-4 py-3 text-right text-primary">{formatCurrency(totalCost)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className="text-sm text-gray-500 italic">Add services (like Screen Replacement) and parts to build the invoice.</p>
            </div>
          </div>
        </div>

        {/* Step 6: Optional Details */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">6</div>
          <div className="flex-1">
            <button 
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="w-full flex items-center justify-between py-2 text-lg font-bold text-gray-900 group"
            >
              Optional Ticket Details
              {isDetailsExpanded ? <ChevronUp className="w-6 h-6 text-gray-400 group-hover:text-gray-600" /> : <ChevronDown className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />}
            </button>
            <AnimatePresence>
              {isDetailsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passcode</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          value={ticketDetails.passcode}
                          onChange={e => setTicketDetails({...ticketDetails, passcode: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          value={ticketDetails.pattern}
                          onChange={e => setTicketDetails({...ticketDetails, pattern: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          checked={ticketDetails.backup_required}
                          onChange={e => setTicketDetails({...ticketDetails, backup_required: e.target.checked})}
                        />
                        <span className="text-sm font-medium text-gray-700">Backup Required</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          checked={ticketDetails.data_loss_risk_accepted}
                          onChange={e => setTicketDetails({...ticketDetails, data_loss_risk_accepted: e.target.checked})}
                        />
                        <span className="text-sm font-medium text-gray-700">Data Loss Risk Accepted</span>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Step 7: Form */}
        <div className="flex gap-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">7</div>
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Form</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setFormType('in')}
                className={cn(
                  "px-6 py-2 rounded-lg font-medium transition-all border-2",
                  formType === 'in' 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                Repairs IN
              </button>
              <button
                onClick={() => setFormType('out')}
                className={cn(
                  "px-6 py-2 rounded-lg font-medium transition-all border-2",
                  formType === 'out' 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                repairs out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-12 pt-8 border-t border-gray-200 flex justify-end gap-4">
        <button
          onClick={() => navigate('/repairs')}
          className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Repair Ticket'}
        </button>
      </div>

      {/* Modals */}
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

      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSuccess={(device) => {
          setSelectedDevice(device);
          setIsDeviceModalOpen(false);
        }}
      />

      {/* Problem Modal */}
      {isProblemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add New Problem</h2>
              <button onClick={() => setIsProblemModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Problem Name</label>
                <input
                  id="new-problem-name"
                  type="text"
                  placeholder="e.g. Cracked Screen"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standard Price (Optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                  <input
                    id="new-problem-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsProblemModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const nameInput = document.getElementById('new-problem-name') as HTMLInputElement;
                    const priceInput = document.getElementById('new-problem-price') as HTMLInputElement;
                    if (!nameInput.value) return;
                    try {
                      const price = parseFloat(priceInput.value) || 0;
                      const docRef = await addDoc(collection(db, 'repair_problems'), {
                        ...withCompanyId(requireCompanyId(companyId), {}),
                        name: nameInput.value,
                        default_price: price,
                        created_at: new Date().toISOString()
                      });
                      const newProb = { 
                        id: docRef.id, 
                        name: nameInput.value, 
                        default_price: price,
                        created_at: new Date().toISOString() 
                      };
                      setProblems([...problems, newProb]);
                      setSelectedProblem(docRef.id);
                      
                      // Auto-add service item if price exists
                      if (price > 0) {
                        setSelectedItems([...selectedItems, {
                          id: `prob-${docRef.id}`,
                          name: nameInput.value,
                          price: price,
                          quantity: 1,
                          type: 'service'
                        }]);
                      }
                      
                      setIsProblemModalOpen(false);
                      toast.success('Problem added');
                    } catch (error: any) {
                      toast.error(error.message);
                    }
                  }}
                  className="flex-1 bg-primary text-white px-4 py-2 rounded-lg font-medium"
                >
                  Save Problem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
