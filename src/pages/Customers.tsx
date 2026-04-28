import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, orderBy, writeBatch, query, where } from 'firebase/firestore';
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  Edit2,
  History,
  Upload,
  Download,
  X,
  Building2,
  MapPin,
  FileText,
  MessageSquareMore,
  CreditCard,
} from 'lucide-react';

import { Customer } from '../types';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { useSearchParams } from 'react-router-dom';
import { companyQuery, requireCompanyId } from '../lib/db';

const CustomerCard = memo(function CustomerCard({
  customer,
  creditBalance,
  onEdit,
  onAddCredit,
}: {
  customer: Customer;
  creditBalance: number;
  onEdit: (customer: Customer) => void;
  onAddCredit: (customer: Customer) => void;
}) {
  return (
    <div className="section-card p-6 rounded-[24px] hover:-translate-y-0.5 transition-all group relative">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-full bg-[#efe0ce] flex items-center justify-center text-[#c65a22]">
          <User className="w-6 h-6" />
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddCredit(customer)}
            title="Manage store credit"
            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(customer)}
            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">
        {customer.first_name} {customer.last_name}
      </h3>
      {customer.company && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Building2 className="w-3 h-3" />
          {customer.company}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4 text-gray-400" />
          {customer.phone || 'No phone'}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="w-4 h-4 text-gray-400" />
          <span className="truncate">{customer.email || 'No email'}</span>
        </div>
        {customer.address_info?.city && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400" />
            {customer.address_info.city}, {customer.address_info.state}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {creditBalance > 0 && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-green-100 text-green-700">
              💳 Credit: R{creditBalance.toFixed(2)}
            </span>
          )}
          <span className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
            customer.whatsapp_marketing_opt_in === false
              ? "bg-[#f6e4de] text-[#9b4c28]"
              : "bg-[#e4f2eb] text-[#2f6b4a]"
          )}>
            WhatsApp {customer.whatsapp_marketing_opt_in === false ? 'opted out' : 'opted in'}
          </span>
          <span className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
            customer.email_marketing_opt_in === false
              ? "bg-[#f6e4de] text-[#9b4c28]"
              : "bg-[#e4edf5] text-[#31546f]"
          )}>
            Email {customer.email_marketing_opt_in === false ? 'opted out' : 'opted in'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default function Customers() {
  const { companyId } = useTenant();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [creditBalances, setCreditBalances] = useState<Map<string, number>>(new Map());
  const [creditModalCustomer, setCreditModalCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  } as any);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    email_marketing_opt_in: true,
    whatsapp_marketing_opt_in: true,
    marketing_opt_out_reason: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(companyQuery('customers', companyId, orderBy('first_name')));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      // Load store credit balances
      if (companyId && data.length > 0) {
        const creditSnap = await getDocs(
          query(collection(db, 'store_credit'), where('company_id', '==', companyId))
        );
        const balMap = new Map<string, number>();
        creditSnap.docs.forEach(d => {
          const cid = d.data().customer_id as string;
          balMap.set(cid, (balMap.get(cid) || 0) + Number(d.data().amount || 0));
        });
        // Only keep positive balances
        balMap.forEach((v, k) => { if (v <= 0) balMap.delete(k); });
        setCreditBalances(balMap);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  }

  async function handleAddCreditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditModalCustomer || !companyId) return;
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt === 0) { toast.error('Enter a valid amount'); return; }
    setSavingCredit(true);
    try {
      await addDoc(collection(db, 'store_credit'), {
        company_id: companyId,
        customer_id: creditModalCustomer.id,
        amount: amt,
        reason: creditReason || (amt > 0 ? 'Manual credit' : 'Manual debit'),
        source: 'manual',
        created_by: auth.currentUser?.uid || '',
        created_at: new Date().toISOString(),
      });
      toast.success(amt > 0 ? 'Store credit added' : 'Store credit deducted');
      setCreditModalCustomer(null);
      setCreditAmount('');
      setCreditReason('');
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCredit(false);
    }
  }

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        company: customer.company || '',
        address: customer.address_info?.address || '',
        city: customer.address_info?.city || '',
        state: customer.address_info?.state || '',
        zip: customer.address_info?.zip || '',
        email_marketing_opt_in: customer.email_marketing_opt_in !== false,
        whatsapp_marketing_opt_in: customer.whatsapp_marketing_opt_in !== false,
        marketing_opt_out_reason: customer.marketing_opt_out_reason || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        company: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        email_marketing_opt_in: true,
        whatsapp_marketing_opt_in: true,
        marketing_opt_out_reason: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const customerData = withCompanyId(requireCompanyId(companyId), {
      first_name: formData.first_name,
      last_name: formData.last_name,
      name: `${formData.first_name} ${formData.last_name}`.trim(),
      phone: formData.phone,
      email: formData.email,
      company: formData.company,
      email_marketing_opt_in: formData.email_marketing_opt_in,
      whatsapp_marketing_opt_in: formData.whatsapp_marketing_opt_in,
      marketing_opt_out_reason: formData.marketing_opt_out_reason || null,
      address_info: {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip
      },
      updated_at: new Date().toISOString()
    });

    try {
      if (editingCustomer) {
        const customerRef = doc(db, 'customers', editingCustomer.id);
        await updateDoc(customerRef, customerData);
        toast.success('Customer updated');
      } else {
        await addDoc(collection(db, 'customers'), {
          ...customerData,
          created_at: new Date().toISOString()
        });
        toast.success('Customer added');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setLoading(true);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let batch = writeBatch(db);
          const customersCol = collection(db, 'customers');
          
          let count = 0;
          let totalCount = 0;
          for (const row of results.data as any[]) {
            const firstName = row['First Name'] || '';
            const lastName = row['Last Name'] || '';
            const email = row['Email'] || '';
            const phone = row['Contact No'] || '';
            const company = row['Company'] || '';
            
            if (!firstName) continue;

            const newDoc = doc(customersCol);
            batch.set(newDoc, {
              company_id: requireCompanyId(companyId),
              first_name: firstName,
              last_name: lastName,
              name: `${firstName} ${lastName}`.trim(),
              email: email,
              phone: phone,
              secondary_phone: row['Secondary phone'] || '',
              company: company,
              email_marketing_opt_in: true,
              whatsapp_marketing_opt_in: true,
              marketing_opt_out_reason: null,
              address_info: {
                address: row['Shipping address one'] || '',
                city: row['Shipping city'] || '',
                state: row['Shipping state'] || '',
                zip: row['Shipping zip'] || ''
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            count++;
            totalCount++;

            if (count === 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }
          
          toast.success(`Successfully imported ${totalCount} customers`);
          setIsImportModalOpen(false);
          setSelectedFile(null);
          fetchCustomers();
        } catch (error: any) {
          toast.error('Import failed: ' + error.message);
        }
        setLoading(false);
      },
      error: (error) => {
        toast.error('Error parsing CSV file: ' + error.message);
        setLoading(false);
      }
    });
  };

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return customers;

    return customers.filter((customer) =>
      (customer.first_name?.toLowerCase() || '').includes(normalizedSearch) ||
      (customer.last_name?.toLowerCase() || '').includes(normalizedSearch) ||
      (customer.phone && customer.phone.includes(search.trim())) ||
      (customer.email && customer.email.toLowerCase().includes(normalizedSearch))
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Client Records</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Customers</h1>
          <p className="text-[#5d6468] mt-2">Manage your client database, contact details, and import history.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="section-card text-[#4b5357] px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-white transition-all"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="appleberry-gradient text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="section-card rounded-[24px] p-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          className="w-full pl-10 pr-4 py-3 bg-white/90 border border-[#dbc8b2] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!isModalOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading && customers.length === 0 ? (
          [1,2,3].map(i => <div key={i} className="h-48 section-card animate-pulse rounded-[24px]"></div>)
          ) : filteredCustomers.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              creditBalance={creditBalances.get(customer.id) || 0}
              onEdit={handleOpenModal}
              onAddCredit={(c) => { setCreditModalCustomer(c); setCreditAmount(''); setCreditReason(''); }}
            />
          ))}
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <h2 className="text-xl font-bold">Import Customers</h2>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedFile(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
                  isDragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50",
                  selectedFile ? "border-green-500 bg-green-50" : ""
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    selectedFile ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
                  )}>
                    {selectedFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                  </div>
                  <div>
                    {selectedFile ? (
                      <>
                        <p className="font-bold text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-gray-900">
                          {isDragActive ? "Drop the file here" : "Click or drag CSV file to upload"}
                        </p>
                        <p className="text-sm text-gray-500">Only .csv files are supported</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedFile && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <div className="text-blue-600">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Ready to import</p>
                    <p>The system will map your CSV columns to the customer database. This process might take a few moments for large files.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !selectedFile}
                  className="flex-1 appleberry-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Start Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.first_name}
                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.last_name}
                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.company}
                  onChange={e => setFormData({...formData, company: e.target.value})}
                />
              </div>
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-medium text-gray-900">Address Information</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.state}
                      onChange={e => setFormData({...formData, state: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.zip}
                      onChange={e => setFormData({...formData, zip: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <MessageSquareMore className="w-4 h-4 text-[#c65a22]" />
                  <h3 className="font-medium text-gray-900">Marketing & Consent</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="rounded-xl border border-[#dbc8b2] bg-[#fbf4eb] px-4 py-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={formData.whatsapp_marketing_opt_in}
                      onChange={(e) => setFormData({ ...formData, whatsapp_marketing_opt_in: e.target.checked })}
                    />
                    <div>
                      <p className="font-medium text-[#18242b]">Allow WhatsApp marketing</p>
                      <p className="text-sm text-[#5d6468] mt-1">Promotions, pickup reminders, and customer follow-ups can be sent by WhatsApp.</p>
                    </div>
                  </label>
                  <label className="rounded-xl border border-[#dbc8b2] bg-[#fbf4eb] px-4 py-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={formData.email_marketing_opt_in}
                      onChange={(e) => setFormData({ ...formData, email_marketing_opt_in: e.target.checked })}
                    />
                    <div>
                      <p className="font-medium text-[#18242b]">Allow email marketing</p>
                      <p className="text-sm text-[#5d6468] mt-1">Campaigns, newsletters, and review requests can be sent by email.</p>
                    </div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opt-out note</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Reason if customer asked not to be contacted"
                    value={formData.marketing_opt_out_reason}
                    onChange={e => setFormData({...formData, marketing_opt_out_reason: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 appleberry-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  {editingCustomer ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Credit Modal */}
      {creditModalCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold">Store Credit</h2>
                <p className="text-sm text-gray-500">{creditModalCustomer.first_name} {creditModalCustomer.last_name}</p>
              </div>
              <button onClick={() => setCreditModalCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Current Balance</p>
                  <p className="text-2xl font-black text-green-700">
                    R{(creditBalances.get(creditModalCustomer.id) || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <form onSubmit={handleAddCreditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (use negative to deduct)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 100.00 or -50.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-200 focus:border-green-500"
                    value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <input
                    type="text"
                    placeholder="Refund, goodwill, deposit..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-200 focus:border-green-500"
                    value={creditReason}
                    onChange={e => setCreditReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreditModalCustomer(null)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCredit}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingCredit ? 'Saving...' : 'Apply'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
