import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
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
  Filter,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Repair, RepairStatus, Customer, Profile, RepairProblem } from '../types';
import { formatCurrency, cn, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';

import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { companyQuery, requireCompanyId } from '../lib/db';
import { buildTicketNumber } from '../lib/business';

const getStatusTone = (statusName?: string | null, updatedAt?: string) => {
  const name = (statusName || '').toLowerCase();
  const updatedTime = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const daysSinceUpdate = Number.isFinite(updatedTime) ? (Date.now() - updatedTime) / 86400000 : 0;

  if (
    name.includes('overdue') ||
    name.includes('problem') ||
    name.includes('blocked') ||
    name.includes('failed') ||
    name.includes('cancel')
  ) {
    return 'danger';
  }

  if (name.includes('waiting') || name.includes('pending') || name.includes('parts') || name.includes('hold')) {
    return 'warning';
  }

  if (
    name.includes('ready') ||
    name.includes('complete') ||
    name.includes('completed') ||
    name.includes('collected') ||
    name.includes('paid')
  ) {
    return 'success';
  }

  if (daysSinceUpdate >= 7) {
    return 'danger';
  }

  return 'info';
};

const getStatusClasses = (tone: string) => {
  switch (tone) {
    case 'success':
      return 'border-[#22C55E]/35 bg-[#22C55E]/12 text-[#86EFAC] shadow-[0_0_22px_rgba(34,197,94,0.10)]';
    case 'warning':
      return 'border-[#F59E0B]/35 bg-[#F59E0B]/12 text-[#FCD34D] shadow-[0_0_22px_rgba(245,158,11,0.10)]';
    case 'danger':
      return 'border-[#EF4444]/35 bg-[#EF4444]/12 text-[#FCA5A5] shadow-[0_0_22px_rgba(239,68,68,0.10)]';
    default:
      return 'border-[#3B82F6]/35 bg-[#3B82F6]/12 text-[#93C5FD] shadow-[0_0_22px_rgba(59,130,246,0.10)]';
  }
};

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
  const initialStatusFilter = searchParams.get('status') === 'open' ? 'Open Repairs' : 'All Statuses';
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
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
    if (!companyId) return;
    const q = companyQuery('repairs', companyId, orderBy('updated_at', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map((repairDoc) => ({
        id: repairDoc.id,
        ...repairDoc.data()
      } as Repair));
      
      setRepairs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setStatusFilter(searchParams.get('status') === 'open' ? 'Open Repairs' : 'All Statuses');
  }, [searchParams]);

  async function fetchStatuses() {
    const querySnapshot = await getDocs(companyQuery('repair_status_options', companyId, orderBy('order_index')));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairStatus));
    setStatuses(data);
  }

  async function fetchCustomers() {
    const querySnapshot = await getDocs(companyQuery('customers', companyId, orderBy('name')));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    setCustomers(data);
  }

  async function fetchProblems() {
    const querySnapshot = await getDocs(companyQuery('repair_problems', companyId));
    setProblems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)));
  }

  async function fetchStaff() {
    const querySnapshot = await getDocs(companyQuery('profiles', companyId));
    setStaff(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile)));
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
          const workspaceId = requireCompanyId(companyId);
          
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
                ...withCompanyId(workspaceId, {}),
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
                ...withCompanyId(workspaceId, {}),
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
              const problemData = { ...withCompanyId(workspaceId, {}), name: problemName, created_at: new Date().toISOString() };
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
              ...withCompanyId(workspaceId, {}),
              customer_id: customer.id,
              ticket_number: row['Ticket #'] || buildTicketNumber(),
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
        company_id: requireCompanyId(companyId),
        status_id: newStatusId, 
        updated_at: new Date().toISOString() 
      });

      // Add to history
      await addDoc(collection(db, `repairs/${repairId}/history`), {
        company_id: requireCompanyId(companyId),
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

  const uniqueStatuses = useMemo(() => {
    const seen = new Set<string>();
    return statuses.filter((status) => {
      const key = (status.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [statuses]);

  const uniqueStaff = useMemo(() => {
    const seen = new Set<string>();
    return staff.filter((member) => {
      const key = (member.full_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [staff]);

  const filteredRepairs = useMemo(() => {
    return enrichedRepairs.filter(r => {
      const statusName = (r.status?.name || '').toLowerCase();
      const isOpenRepair =
        !statusName ||
        (!statusName.includes('collected') &&
          !statusName.includes('cancelled') &&
          !statusName.includes('complete') &&
          !statusName.includes('completed'));

      const matchesSearch = 
        r.device_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.imei && r.imei.includes(search)) ||
        (r.ticket_number && r.ticket_number.toLowerCase().includes(search.toLowerCase())) ||
        r.customer?.name.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus =
        statusFilter === 'All Statuses' ||
        (statusFilter === 'Open Repairs' ? isOpenRepair : r.status?.name === statusFilter);
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

  const queueSummary = useMemo(() => {
    return enrichedRepairs.reduce(
      (acc, repair) => {
        const statusName = repair.status?.name || '';
        const tone = getStatusTone(statusName, repair.updated_at);
        const normalized = statusName.toLowerCase();
        const isClosed =
          normalized.includes('collected') ||
          normalized.includes('cancelled') ||
          normalized.includes('complete') ||
          normalized.includes('completed');

        if (!isClosed && tone !== 'warning' && tone !== 'danger') acc.open += 1;
        if (tone === 'warning') acc.waiting += 1;
        if (tone === 'success') acc.ready += 1;
        if (tone === 'danger') acc.overdue += 1;

        return acc;
      },
      { open: 0, waiting: 0, ready: 0, overdue: 0 }
    );
  }, [enrichedRepairs]);

  const hasActiveFilters = Boolean(search || statusFilter !== 'All Statuses' || technicianFilter !== 'All Technicians');

  const summaryCards = [
    {
      label: 'Open',
      value: queueSummary.open,
      icon: Wrench,
      classes: 'border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#93C5FD]',
      hint: 'Active bench jobs'
    },
    {
      label: 'Waiting Parts',
      value: queueSummary.waiting,
      icon: Clock,
      classes: 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FCD34D]',
      hint: 'Needs attention'
    },
    {
      label: 'Ready',
      value: queueSummary.ready,
      icon: CheckCircle2,
      classes: 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86EFAC]',
      hint: 'Ready or done'
    },
    {
      label: 'Overdue',
      value: queueSummary.overdue,
      icon: AlertTriangle,
      classes: 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#FCA5A5]',
      hint: 'Blocked or stale'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">Workshop Flow</p>
          <h1 className="text-4xl font-black text-white">Repairs</h1>
          <p className="text-zinc-400 mt-2">Track active repair jobs, assignments, service issues, and workshop turnaround.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary justify-center"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button 
            onClick={() => navigate('/repairs/new')}
            className="btn btn-primary justify-center px-5 py-3 text-sm shadow-[0_0_28px_rgba(34,197,94,0.18)]"
          >
            <Plus className="w-5 h-5" />
            New Repair Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={cn('rounded-xl border p-4', item.classes)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-bold opacity-80">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.hint}</p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-black/25 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="section-card rounded-xl p-4 space-y-4 border border-[#2A2A2E]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500 font-bold">
          <Filter className="w-4 h-4 text-[#3B82F6]" />
          Queue Controls
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search ticket, customer, device, IMEI..."
              className="w-full pl-10 pr-4 py-3 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Open Repairs</option>
            {uniqueStatuses.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            className="px-3 py-3 text-sm"
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
          >
            <option>All Technicians</option>
            {uniqueStaff.map(s => (
              <option key={s.id} value={s.full_name || ''}>{s.full_name}</option>
            ))}
          </select>

          <div className="flex items-center justify-end">
            <button 
              onClick={() => {
                setSearch('');
                setStatusFilter('All Statuses');
                setTechnicianFilter('All Technicians');
              }}
              className="px-3 py-2 text-xs text-zinc-500 hover:text-[#3B82F6] font-semibold transition-colors disabled:opacity-30 disabled:hover:text-zinc-500"
              disabled={!hasActiveFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Repairs Table */}
      <div className="section-card rounded-xl overflow-hidden border border-[#2A2A2E]">
        <div className="flex flex-col gap-2 border-b border-[#2A2A2E] bg-[#141416] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Workshop Queue</p>
            <p className="text-xs text-zinc-500">
              Showing {filteredRepairs.length} of {enrichedRepairs.length} repair jobs
            </p>
          </div>
          <p className="text-xs text-zinc-500">Rows open full repair details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm text-left">
            <thead className="bg-[#101012]">
              <tr>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Ticket</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Customer</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Device</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Technician</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Problem</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 text-right">Due</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 text-right">Value</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && repairs.length === 0 ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-5 py-3">
                      <div className="h-16 rounded-lg bg-[#202024]/70" />
                    </td>
                  </tr>
                ))
              ) : filteredRepairs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16">
                    <div className="mx-auto max-w-md text-center">
                      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2A2A2E] bg-[#141416] text-[#3B82F6]">
                        <Wrench className="h-7 w-7" />
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        {hasActiveFilters ? 'No repair jobs match these filters' : 'No repair jobs in the queue'}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        {hasActiveFilters
                          ? 'Try clearing filters or searching by ticket, customer, device, or IMEI.'
                          : 'Create the first repair job to start tracking intake, technician assignment, status, and customer updates.'}
                      </p>
                      <div className="mt-6 flex justify-center gap-3">
                        {hasActiveFilters && (
                          <button
                            onClick={() => {
                              setSearch('');
                              setStatusFilter('All Statuses');
                              setTechnicianFilter('All Technicians');
                            }}
                            className="btn btn-secondary"
                          >
                            Clear Filters
                          </button>
                        )}
                        <button onClick={() => navigate('/repairs/new')} className="btn btn-primary">
                          <Plus className="w-4 h-4" />
                          New Repair Job
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRepairs.map(repair => {
                  const statusName = repair.status?.name || 'New';
                  const statusTone = getStatusTone(statusName, repair.updated_at);
                  const displayTicket = repair.ticket_number || `#${repair.id.substring(0, 8)}`;
                  const problemText = repair.problem?.name || repair.issue_description || 'General repair';
                  const customerName = repair.customer?.name || 'Unknown customer';
                  const technicianName = repair.technician?.full_name || 'Unassigned';

                  return (
                  <tr 
                    key={repair.id} 
                    className="group cursor-pointer border-b border-[#2A2A2E] transition-colors hover:bg-[#1C1C1F]"
                    onClick={() => navigate(`/repairs/${repair.id}`)}
                  >
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className={cn('h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center', getStatusClasses(statusTone))}>
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-black text-white">{displayTicket}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                            {safeFormatDate(repair.created_at, 'dd MMM')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <p className="font-semibold text-white">{customerName}</p>
                      <p className="mt-1 text-xs text-zinc-500">Customer record</p>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <div className="flex items-start gap-2">
                        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                        <div>
                          <p className="font-semibold text-zinc-100">{repair.device_name || 'Unknown device'}</p>
                          {repair.imei && <p className="mt-1 font-mono text-xs text-zinc-500">IMEI {repair.imei}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <span className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em]', getStatusClasses(statusTone))}>
                        {statusName}
                      </span>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <div className="inline-flex max-w-[180px] items-center gap-2 rounded-lg border border-[#2A2A2E] bg-[#141416] px-3 py-2">
                        <User className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                        <span className={cn('truncate text-sm font-semibold', repair.technician ? 'text-zinc-100' : 'text-[#F59E0B]')}>
                          {technicianName}
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 align-top">
                      <p className="line-clamp-2 max-w-[260px] text-sm leading-5 text-zinc-300">{problemText}</p>
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 text-right align-top">
                      {repair.due_date ? (() => {
                        const due = new Date(repair.due_date);
                        const isOverdue = due < new Date() && statusTone !== 'success';
                        return (
                          <span className={cn('text-xs font-semibold whitespace-nowrap', isOverdue ? 'text-[#EF4444]' : 'text-zinc-300')}>
                            {isOverdue ? '⚠ ' : ''}{safeFormatDate(repair.due_date, 'dd MMM')}
                          </span>
                        );
                      })() : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 text-right align-top font-semibold text-zinc-100">
                      {formatCurrency(repair.total_amount || repair.cost || 0)}
                    </td>
                    <td className="border-b border-[#2A2A2E] px-5 py-4 text-right align-top">
                      <p className="text-xs font-semibold text-zinc-300 whitespace-nowrap">{formatRelativeTime(repair.updated_at)}</p>
                      <p className="mt-1 text-[11px] text-zinc-500 whitespace-nowrap">{safeFormatDate(repair.updated_at, 'dd MMM HH:mm')}</p>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-[#2A2A2E]">
            <div className="p-6 border-b border-[#2A2A2E] flex items-center justify-between bg-[#141416]">
              <h2 className="text-xl font-bold text-white">Import Repairs</h2>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedFile(null);
                }} 
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer bg-[#141416]",
                  isDragActive ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-[#2A2A2E] hover:border-[#3B82F6]/60",
                  selectedFile ? "border-[#22C55E] bg-[#22C55E]/10" : ""
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    selectedFile ? "bg-[#22C55E]/15 text-[#86EFAC]" : "bg-[#3B82F6]/15 text-[#93C5FD]"
                  )}>
                    {selectedFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                  </div>
                  <div>
                    {selectedFile ? (
                      <>
                        <p className="font-bold text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-zinc-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-white">
                          {isDragActive ? "Drop the file here" : "Click or drag CSV file to upload"}
                        </p>
                        <p className="text-sm text-zinc-500">Only .csv files are supported</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedFile && (
                <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/25 rounded-xl p-4 flex gap-3">
                  <div className="text-[#93C5FD]">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-zinc-300">
                    <p className="font-bold mb-1 text-white">Ready to import</p>
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
                  className="btn btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !selectedFile}
                  className="btn btn-primary flex-1 justify-center disabled:opacity-50"
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
