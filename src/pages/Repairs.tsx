import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, onSnapshot, writeBatch, where, setDoc } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Wrench, 
  Clock, 
  User, 
  Smartphone, 
  ChevronRight,
  MessageSquare,
  History,
  Upload,
  X,
  FileText,
  Download,
  Filter
} from 'lucide-react';
import { Repair, RepairStatus, Customer, Profile, RepairProblem } from '../types';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';

import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../lib/tenant';
import { filterByCompany, withCompanyId } from '../lib/companyData';

export default function Repairs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { company } = useTenant();
  const companyId = company?.id || null;
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [statuses, setStatuses] = useState<RepairStatus[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [problems, setProblems] = useState<RepairProblem[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [technicianFilter, setTechnicianFilter] = useState('All Technicians');
  
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);

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

  useEffect(() => {
    fetchStatuses();
    fetchCustomers();
    fetchProblems();
    fetchStaff();

    // Real-time subscription
    const q = query(collection(db, 'repairs'), orderBy('updated_at', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = filterByCompany(snapshot.docs.map((repairDoc) => ({
        id: repairDoc.id,
        ...repairDoc.data()
      } as Repair)), companyId);
      
      setRepairs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchStatuses() {
    const querySnapshot = await getDocs(query(collection(db, 'repair_status_options'), orderBy('order_index')));
    const data = filterByCompany(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairStatus)), companyId);
    setStatuses(data);
  }

  async function fetchCustomers() {
    const querySnapshot = await getDocs(query(collection(db, 'customers'), orderBy('name')));
    const data = filterByCompany(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)), companyId);
    setCustomers(data);
  }

  async function fetchProblems() {
    const querySnapshot = await getDocs(collection(db, 'repair_problems'));
    setProblems(filterByCompany(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)), companyId));
  }

  async function fetchStaff() {
    const querySnapshot = await getDocs(collection(db, 'profiles'));
    setStaff(filterByCompany(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)), companyId));
  }

  const handleImport = async () => {
    if (!selectedFile) return;

    setLoading(true);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          let importCount = 0;
          
          // Pre-fetch data for mapping
          const currentCustomers = [...customers];
          const currentStatuses = [...statuses];
          const currentProblems = [...problems];
          const currentStaff = [...staff];

          for (const row of rows) {
            const firstName = row['First Name'] || '';
            const lastName = row['Last Name'] || '';
            const email = row['Email'] || '';
            const phone = row['Contact No'] || '';
            
            if (!firstName && !lastName && !phone) continue;

            // 1. Find or Create Customer
            let customer = currentCustomers.find(c => 
              (email && c.email === email) || (phone && c.phone === phone)
            );

            if (!customer) {
              const customerData = {
                ...withCompanyId(companyId, {}),
                first_name: firstName,
                last_name: lastName,
                name: `${firstName} ${lastName}`.trim(),
                email: email,
                phone: phone,
                secondary_phone: row['Secondary phone'] || '',
                company: row['Company'] || '',
                fax: row['Fax'] || '',
                customer_type: row['Customer Type'] || '',
                address_info: {
                  address: row['Shipping address one'] || '',
                  city: row['Shipping city'] || '',
                  state: row['Shipping state'] || '',
                  zip: row['Shipping zip'] || ''
                },
                created_at: new Date().toISOString()
              };
              const customerRef = await addDoc(collection(db, 'customers'), customerData);
              customer = { id: customerRef.id, ...customerData } as Customer;
              currentCustomers.push(customer);
            }

            // 2. Map Status
            const statusName = row['Status'] || 'New';
            let status = currentStatuses.find(s => s.name.toLowerCase() === statusName.toLowerCase());
            if (!status) {
              // Create status if not exists
              const statusData = {
                ...withCompanyId(companyId, {}),
                name: statusName,
                color: '#94a3b8',
                order_index: currentStatuses.length
              };
              const statusRef = await addDoc(collection(db, 'repair_status_options'), statusData);
              status = { id: statusRef.id, ...statusData } as RepairStatus;
              currentStatuses.push(status);
              setStatuses([...currentStatuses]);
            }

            // 3. Map Problem
            const problemName = row['Problem'] || 'General Repair';
            let problem = currentProblems.find(p => p.name.toLowerCase() === problemName.toLowerCase());
            if (!problem) {
              const problemData = { ...withCompanyId(companyId, {}), name: problemName, created_at: new Date().toISOString() };
              const problemRef = await addDoc(collection(db, 'repair_problems'), problemData);
              problem = { id: problemRef.id, ...problemData } as RepairProblem;
              currentProblems.push(problem);
              setProblems([...currentProblems]);
            }

            // 4. Map Technician
            const techName = row['Tech Assigned'] || '';
            let technician = currentStaff.find(s => s.full_name?.toLowerCase() === techName.toLowerCase());
            
            // 5. Create Repair
            const parseCSVDate = (dateStr: string) => {
              if (!dateStr) return new Date().toISOString();
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                // Assuming DD-MM-YY
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = 2000 + parseInt(parts[2]);
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) return date.toISOString();
              }
              return new Date().toISOString();
            };

            const cost = parseFloat((row['Cost'] || row['Price'] || row['Total'] || row['Amount'] || '0').replace(/[^0-9.]/g, '')) || 0;

            const repairData = {
              ...withCompanyId(companyId, {}),
              customer_id: customer.id,
              ticket_number: row['Ticket #'] || '',
              device_name: `${row['Brand'] || ''} ${row['Model'] || ''}`.trim() || 'Unknown Device',
              imei: row['IMEI/Serial No.'] || '',
              issue_description: row['Problem'] || '',
              problem_id: problem.id,
              technician_id: technician?.id || null,
              status_id: status.id,
              cost: cost,
              notes: `Ticket #: ${row['Ticket #'] || 'N/A'}\nBin: ${row['Bin Location'] || 'N/A'}\nDetails: ${row['More Details'] || ''}`,
              ticket_details: {
                passcode: row['Password'] || '',
              },
              created_at: parseCSVDate(row['Created']),
              updated_at: parseCSVDate(row['Last Update']),
            };

            await addDoc(collection(db, 'repairs'), repairData);
            importCount++;
          }

          toast.success(`Successfully imported ${importCount} repairs`);
          setIsImportModalOpen(false);
          setSelectedFile(null);
          fetchCustomers(); // Refresh customers list
        } catch (error: any) {
          console.error('Import error:', error);
          toast.error('Import failed: ' + error.message);
        }
        setLoading(false);
      },
      error: (error) => {
        toast.error('Error parsing CSV: ' + error.message);
        setLoading(false);
      }
    });
  };

  const handleUpdateStatus = async (repairId: string, newStatusId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const repairRef = doc(db, 'repairs', repairId);
      await updateDoc(repairRef, { 
        status_id: newStatusId, 
        updated_at: new Date().toISOString() 
      });

      // Add to history
      await addDoc(collection(db, `repairs/${repairId}/history`), {
        company_id: companyId,
        repair_id: repairId,
        status_id: newStatusId,
        changed_by: user.uid,
        notes: 'Status updated',
        created_at: new Date().toISOString()
      });
      toast.success('Status updated');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const enrichedRepairs = useMemo(() => {
    return repairs.map(repair => {
      const customer = customers.find(c => c.id === repair.customer_id);
      const status = statuses.find(s => s.id === repair.status_id);
      const technician = staff.find(s => s.id === repair.technician_id);
      const problem = problems.find(p => p.id === repair.problem_id);
      return {
        ...repair,
        customer,
        status,
        technician,
        problem
      };
    });
  }, [repairs, customers, statuses, staff, problems]);

  const filteredRepairs = useMemo(() => {
    return enrichedRepairs.filter(r => {
      const matchesSearch = 
        r.device_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.imei && r.imei.includes(search)) ||
        (r.ticket_number && r.ticket_number.toLowerCase().includes(search.toLowerCase())) ||
        r.customer?.name.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Statuses' || r.status?.name === statusFilter;
      const matchesTech = technicianFilter === 'All Technicians' || r.technician?.full_name === technicianFilter;
      
      return matchesSearch && matchesStatus && matchesTech;
    });
  }, [enrichedRepairs, search, statusFilter, technicianFilter]);

  const formatRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Workshop Flow</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Repairs</h1>
          <p className="text-[#5d6468] mt-2">Track active repair jobs, assignments, service issues, and workshop turnaround.</p>
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
            onClick={() => navigate('/repairs/new')}
            className="appleberry-gradient text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Repair Job
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="section-card rounded-[24px] p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Repairs..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/90 border border-[#dbc8b2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="bg-white/90 border border-[#dbc8b2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            {statuses.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            className="bg-white/90 border border-[#dbc8b2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
          >
            <option>All Technicians</option>
            {staff.map(s => (
              <option key={s.id} value={s.full_name || ''}>{s.full_name}</option>
            ))}
          </select>

          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={() => {
                setSearch('');
                setStatusFilter('All Statuses');
                setTechnicianFilter('All Technicians');
              }}
              className="text-xs text-gray-500 hover:text-primary font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Repairs Table */}
      <div className="section-card rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f7efe5] border-b border-[#e4d2bd] text-[#655b55] font-bold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Ticket</th>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Tech</th>
                <th className="px-6 py-4">Problem</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && repairs.length === 0 ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-4 h-16 bg-gray-50/50"></td>
                  </tr>
                ))
              ) : filteredRepairs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                    No repair jobs found.
                  </td>
                </tr>
              ) : (
                filteredRepairs.map(repair => (
                  <tr 
                    key={repair.id} 
                    className="hover:bg-[#fbf4eb] transition-colors cursor-pointer"
                    onClick={() => navigate(`/repairs/${repair.id}`)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {repair.customer?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {repair.ticket_number || repair.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {repair.device_name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {repair.technician?.full_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {repair.problem?.name || repair.issue_description || 'General'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {safeFormatDate(repair.created_at, 'dd-MM-yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                        style={{ backgroundColor: repair.status?.color || '#94a3b8' }}
                      >
                        {repair.status?.name || 'New'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400 text-xs whitespace-nowrap">
                      {formatRelativeTime(repair.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <h2 className="text-xl font-bold">Import Repairs</h2>
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
                  isDragActive ? "border-primary bg-primary/5" : "border-[#dbc8b2] hover:border-primary/50 hover:bg-[#fbf4eb]",
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
                    <p>The system will map your CSV columns to customers and repair jobs. This will create new customers if they don't exist.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-[#d9c4ae] text-gray-600 rounded-lg font-medium hover:bg-[#fbf4eb] transition-all"
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
    </div>
  );
}
