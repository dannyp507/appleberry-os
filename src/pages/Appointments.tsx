import { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { Calendar, Clock, Plus, Search, Edit2, Trash2, Phone, User, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { safeFormatDate } from '../lib/utils';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';
import { withCompanyId } from '../lib/companyData';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Appointment = {
  id: string;
  company_id?: string | null;
  customer_name: string;
  customer_phone?: string;
  service?: string;
  date: string;
  time?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  created_at: string;
};

const STATUS_CONFIG: Record<Appointment['status'], { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-zinc-700 text-zinc-200' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'No Show', color: 'bg-orange-500/20 text-orange-400' },
};

const EMPTY_FORM = {
  customer_name: '',
  customer_phone: '',
  service: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:00',
  status: 'scheduled' as Appointment['status'],
  notes: '',
};

export default function Appointments() {
  const { companyId } = useTenant();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Appointment['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, [companyId]);

  async function fetchAppointments() {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(companyQuery(companyId, 'appointments', [orderBy('date', 'asc'), orderBy('time', 'asc')]));
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(appt: Appointment) {
    setEditing(appt);
    setForm({
      customer_name: appt.customer_name,
      customer_phone: appt.customer_phone || '',
      service: appt.service || '',
      date: appt.date,
      time: appt.time || '09:00',
      status: appt.status,
      notes: appt.notes || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!companyId || !form.customer_name || !form.date) {
      toast.error('Customer name and date are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'appointments', editing.id), {
          ...form,
          updated_at: new Date().toISOString(),
        });
        toast.success('Appointment updated');
      } else {
        await addDoc(collection(db, 'appointments'), withCompanyId(companyId, {
          ...form,
          created_at: new Date().toISOString(),
        }));
        toast.success('Appointment created');
      }
      setShowModal(false);
      fetchAppointments();
    } catch (err) {
      toast.error('Failed to save appointment');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this appointment?')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'appointments', id));
      toast.success('Appointment deleted');
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  const filtered = appointments.filter((a) => {
    const matchSearch =
      !search ||
      a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.customer_phone || '').includes(search) ||
      (a.service || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = a.date;
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCount = appointments.filter((a) => a.date === today && a.status !== 'cancelled').length;
  const upcomingCount = appointments.filter((a) => a.date > today && a.status !== 'cancelled').length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22C55E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{todayCount} today · {upcomingCount} upcoming</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-[#22C55E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16a34a] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search customer or service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#22C55E] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white focus:border-[#22C55E] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-300">No appointments found</p>
          <p className="mt-1 text-xs text-zinc-500">Schedule your first appointment to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, appts]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-bold ${date === today ? 'text-[#22C55E]' : 'text-white'}`}>
                  {date === today ? 'Today' : safeFormatDate(date)}
                </span>
                <span className="rounded-full bg-[#1C1C1F] border border-[#2A2A2E] px-2 py-0.5 text-xs text-zinc-400">
                  {appts.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {appts.map((appt) => {
                  const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.scheduled;
                  return (
                    <div key={appt.id} className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{appt.customer_name}</p>
                          {appt.customer_phone && (
                            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {appt.customer_phone}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      {appt.service && (
                        <p className="mt-2 text-sm text-[#22C55E] font-medium">{appt.service}</p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {appt.time || 'TBD'}</span>
                      </div>
                      {appt.notes && (
                        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{appt.notes}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2 border-t border-[#2A2A2E] pt-3">
                        <select
                          value={appt.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value as Appointment['status'];
                            await updateDoc(doc(db, 'appointments', appt.id), { status: newStatus });
                            setAppointments((prev) => prev.map((a) => a.id === appt.id ? { ...a, status: newStatus } : a));
                          }}
                          className="flex-1 rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => openEdit(appt)}
                          className="rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] p-1.5 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(appt.id)}
                          disabled={deleting === appt.id}
                          className="rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#2A2A2E] bg-[#0F0F11] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A2A2E] px-6 py-4">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Customer Name *</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={form.customer_phone}
                    onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                    placeholder="072 000 0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Service</label>
                  <input
                    type="text"
                    value={form.service}
                    onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none"
                    placeholder="Screen Repair"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Appointment['status'] }))}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white focus:border-[#22C55E] focus:outline-none"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-[#2A2A2E] bg-[#141416] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#22C55E] focus:outline-none resize-none"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#2A2A2E] px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#16a34a] disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
