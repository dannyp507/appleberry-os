import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, updateDoc, where } from 'firebase/firestore';
import { Edit2, Plus, Search, Smartphone, Trash2 } from 'lucide-react';
import Fuse from 'fuse.js';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { companyQuery, requireCompanyId } from '../lib/db';
import { DeviceInventoryItem } from '../types';
import { cn, formatCurrency, safeFormatDate } from '../lib/utils';

const DEVICE_STATUSES: DeviceInventoryItem['status'][] = ['in_stock', 'reserved', 'sold', 'repair', 'trade_in', 'archived'];
const STATUS_LABELS: Record<DeviceInventoryItem['status'], string> = {
  in_stock: 'In Stock',
  reserved: 'Reserved',
  sold: 'Sold',
  repair: 'Repair',
  trade_in: 'Trade-In',
  archived: 'Archived',
};

const CONDITION_OPTIONS = ['New', 'A Grade', 'B Grade', 'C Grade', 'Refurbished', 'Trade-In'];

const emptyForm = {
  name: '',
  brand: '',
  model: '',
  imei: '',
  serial_number: '',
  condition: 'A Grade',
  status: 'in_stock' as DeviceInventoryItem['status'],
  source: '',
  color: '',
  storage: '',
  buy_price: 0,
  sell_price: 0,
  notes: '',
  acquired_at: '',
  sold_at: '',
};

export default function DevicesInventory() {
  const { companyId } = useTenant();
  const [devices, setDevices] = useState<DeviceInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceInventoryItem['status']>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceInventoryItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchDevices();
  }, [companyId]);

  async function fetchDevices() {
    setLoading(true);
    try {
      const snapshot = await getDocs(companyQuery('devices_inventory', companyId, orderBy('created_at', 'desc')));
      setDevices(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as DeviceInventoryItem)));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load devices inventory');
    } finally {
      setLoading(false);
    }
  }

  function openModal(device?: DeviceInventoryItem) {
    if (device) {
      setEditingDevice(device);
      setFormData({
        name: device.name || '',
        brand: device.brand || '',
        model: device.model || '',
        imei: device.imei || '',
        serial_number: device.serial_number || '',
        condition: device.condition || 'A Grade',
        status: device.status,
        source: device.source || '',
        color: device.color || '',
        storage: device.storage || '',
        buy_price: device.buy_price || 0,
        sell_price: device.sell_price || 0,
        notes: device.notes || '',
        acquired_at: device.acquired_at || '',
        sold_at: device.sold_at || '',
      });
    } else {
      setEditingDevice(null);
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.imei.trim()) {
      toast.error('Device name and IMEI are required');
      return;
    }

    const existing = await getDocs(companyQuery('devices_inventory', companyId, where('imei', '==', formData.imei.trim())));
    const duplicate = existing.docs.some((deviceDoc) => deviceDoc.id !== editingDevice?.id);
    if (duplicate) {
      toast.error('A device with this IMEI already exists');
      return;
    }

    const payload = withCompanyId(requireCompanyId(companyId), {
      name: formData.name.trim(),
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      imei: formData.imei.trim(),
      serial_number: formData.serial_number.trim() || null,
      condition: formData.condition || null,
      status: formData.status,
      source: formData.source.trim() || null,
      color: formData.color.trim() || null,
      storage: formData.storage.trim() || null,
      buy_price: Number(formData.buy_price || 0),
      sell_price: Number(formData.sell_price || 0),
      notes: formData.notes.trim() || null,
      acquired_at: formData.acquired_at || null,
      sold_at: formData.sold_at || null,
      updated_at: new Date().toISOString(),
    });

    try {
      if (editingDevice) {
        await updateDoc(doc(db, 'devices_inventory', editingDevice.id), payload);
        toast.success('Device updated');
      } else {
        await addDoc(collection(db, 'devices_inventory'), {
          ...payload,
          created_at: new Date().toISOString(),
        });
        toast.success('Device added');
      }
      setIsModalOpen(false);
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save device');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this device from inventory?')) return;
    try {
      await deleteDoc(doc(db, 'devices_inventory', id));
      toast.success('Device deleted');
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete device');
    }
  }

  const fuse = useMemo(
    () =>
      new Fuse(devices, {
        keys: ['name', 'brand', 'model', 'imei', 'serial_number', 'source', 'storage', 'color'],
        threshold: 0.28,
      }),
    [devices]
  );

  const filteredDevices = useMemo(() => {
    const searched = search.trim() ? fuse.search(search.trim()).map((result) => result.item) : devices;
    return searched.filter((device) => statusFilter === 'all' || device.status === statusFilter);
  }, [devices, fuse, search, statusFilter]);

  const summary = useMemo(() => {
    const inStock = devices.filter((device) => device.status === 'in_stock').length;
    const reserved = devices.filter((device) => device.status === 'reserved').length;
    const sold = devices.filter((device) => device.status === 'sold').length;
    const portfolioValue = devices.reduce((sum, device) => sum + Number(device.sell_price || 0), 0);
    return { inStock, reserved, sold, portfolioValue };
  }, [devices]);

  return (
    <div className="space-y-6">
      <div className="hero-card rounded-[30px] px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6f51]">Device Commerce</p>
            <h1 className="display-font text-3xl font-bold text-[#18242b] md:text-5xl">Track IMEI inventory like real stock.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5f6d74] md:text-base">
              Manage buy-sell-trade devices with IMEI, condition, source, pricing, and status history in one calm workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Tracked Devices" value={devices.length.toString()} tone="slate" />
        <SummaryCard title="In Stock" value={summary.inStock.toString()} tone="green" />
        <SummaryCard title="Reserved" value={summary.reserved.toString()} tone="amber" />
        <SummaryCard title="Portfolio Value" value={formatCurrency(summary.portfolioValue)} tone="blue" />
      </div>

      <div className="section-card space-y-4 rounded-[28px] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#879198]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search device name, IMEI, serial, brand, or source"
              className="w-full rounded-2xl border border-[#dfcfbb] bg-white px-10 py-3 text-sm text-[#17242b] outline-none transition focus:border-[#c58d56] focus:ring-4 focus:ring-[#f4dfc4]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | DeviceInventoryItem['status'])}
            className="rounded-2xl border border-[#dfcfbb] bg-white px-4 py-3 text-sm text-[#17242b] outline-none"
          >
            <option value="all">All statuses</option>
            {DEVICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-[24px] border border-[#eadaca] bg-white/80" />
            ))
          ) : filteredDevices.length === 0 ? (
            <div className="col-span-full rounded-[24px] border border-dashed border-[#d9c7b2] bg-white/60 px-6 py-16 text-center">
              <Smartphone className="mx-auto mb-3 h-12 w-12 text-[#c7b39c]" />
              <p className="text-base font-semibold text-[#34444c]">No devices found</p>
              <p className="mt-2 text-sm text-[#748087]">Add your first device or broaden your search.</p>
            </div>
          ) : (
            filteredDevices.map((device) => (
              <article key={device.id} className="rounded-[24px] border border-[#eadaca] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[#17242b]">{device.name}</p>
                    <p className="mt-1 text-sm text-[#64727a]">{[device.brand, device.model, device.storage].filter(Boolean).join(' • ') || 'Device record'}</p>
                  </div>
                  <span className={statusPill(device.status)}>{STATUS_LABELS[device.status]}</span>
                </div>

                <div className="space-y-2 text-sm text-[#5b6870]">
                  <InfoRow label="IMEI" value={device.imei} mono />
                  {device.serial_number && <InfoRow label="Serial" value={device.serial_number} mono />}
                  {(device.condition || device.color) && <InfoRow label="Condition" value={[device.condition, device.color].filter(Boolean).join(' • ')} />}
                  {device.source && <InfoRow label="Source" value={device.source} />}
                  {(device.buy_price || device.sell_price) && (
                    <InfoRow
                      label="Pricing"
                      value={[device.buy_price ? `Buy ${formatCurrency(device.buy_price)}` : null, device.sell_price ? `Sell ${formatCurrency(device.sell_price)}` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    />
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#f0e5d8] pt-4">
                  <div className="text-xs text-[#8a8f93]">
                    Added {safeFormatDate(device.created_at, 'dd MMM yyyy')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openModal(device)}
                      className="rounded-xl border border-[#e5d6c5] bg-white px-3 py-2 text-sm font-medium text-[#214e5f] transition hover:bg-[#fff7ee]"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(device.id)}
                      className="rounded-xl border border-[#f0d1ca] bg-white px-3 py-2 text-sm font-medium text-[#b24a36] transition hover:bg-[#fff1ef]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1820]/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-[#ddcbb7] bg-[rgba(255,251,245,0.98)] p-6 shadow-[0_24px_80px_rgba(17,34,41,0.24)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8b6f51]">Devices Inventory</p>
                <h2 className="display-font mt-2 text-3xl font-bold text-[#17242b]">{editingDevice ? 'Edit Device' : 'Add Device'}</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-2xl border border-[#e2d3c2] bg-white/80 px-4 py-2 text-sm font-medium text-[#5d6a71]">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Field label="Device Name *">
                <input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="IMEI *">
                <input value={formData.imei} onChange={(e) => setFormData((prev) => ({ ...prev, imei: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Brand">
                <input value={formData.brand} onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Model">
                <input value={formData.model} onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Serial Number">
                <input value={formData.serial_number} onChange={(e) => setFormData((prev) => ({ ...prev, serial_number: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Source">
                <input value={formData.source} onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))} placeholder="Walk-in trade, supplier, buy-back" className={inputClass} />
              </Field>
              <Field label="Condition">
                <select value={formData.condition} onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value }))} className={inputClass}>
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={formData.status} onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as DeviceInventoryItem['status'] }))} className={inputClass}>
                  {DEVICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Color">
                <input value={formData.color} onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Storage">
                <input value={formData.storage} onChange={(e) => setFormData((prev) => ({ ...prev, storage: e.target.value }))} placeholder="128GB" className={inputClass} />
              </Field>
              <Field label="Buy Price">
                <input type="number" min="0" step="0.01" value={formData.buy_price} onChange={(e) => setFormData((prev) => ({ ...prev, buy_price: Number(e.target.value) }))} className={inputClass} />
              </Field>
              <Field label="Sell Price">
                <input type="number" min="0" step="0.01" value={formData.sell_price} onChange={(e) => setFormData((prev) => ({ ...prev, sell_price: Number(e.target.value) }))} className={inputClass} />
              </Field>
              <Field label="Acquired Date">
                <input type="date" value={formData.acquired_at} onChange={(e) => setFormData((prev) => ({ ...prev, acquired_at: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Sold Date">
                <input type="date" value={formData.sold_at} onChange={(e) => setFormData((prev) => ({ ...prev, sold_at: e.target.value }))} className={inputClass} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <textarea value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} rows={4} className={cn(inputClass, 'resize-none')} />
                </Field>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-2xl border border-[#ddcbb7] bg-white px-5 py-3 text-sm font-semibold text-[#526067]">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-[#214e5f] px-5 py-3 text-sm font-semibold text-white">
                  {editingDevice ? 'Save Device' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: 'slate' | 'green' | 'amber' | 'blue' }) {
  const toneClasses = {
    slate: 'bg-[#eaf0f3] text-[#214e5f]',
    green: 'bg-[#eef6ef] text-[#2f7d4b]',
    amber: 'bg-[#fbf1df] text-[#ad6b1c]',
    blue: 'bg-[#eaf3f7] text-[#1f6a86]',
  };

  return (
    <div className="rounded-[24px] border border-[#eadaca] bg-white p-5 shadow-sm">
      <div className={cn('mb-4 inline-flex rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em]', toneClasses[tone])}>{title}</div>
      <p className="text-3xl font-bold text-[#17242b]">{value}</p>
    </div>
  );
}

function statusPill(status: DeviceInventoryItem['status']) {
  const tone = {
    in_stock: 'bg-[#eef6ef] text-[#2f7d4b]',
    reserved: 'bg-[#fbf1df] text-[#ad6b1c]',
    sold: 'bg-[#e7f0f5] text-[#1f6a86]',
    repair: 'bg-[#fff1e8] text-[#b85726]',
    trade_in: 'bg-[#f3ecff] text-[#7752b8]',
    archived: 'bg-[#f2f4f6] text-[#6c757c]',
  }[status];

  return cn('inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]', tone);
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#8b6f51]">{label}</span>
      <span className={cn('text-right text-[#26353d]', mono && 'font-mono text-xs tracking-[0.14em]')}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6f51]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-2xl border border-[#dfcfbb] bg-white px-4 py-3 text-sm text-[#17242b] outline-none transition focus:border-[#c58d56] focus:ring-4 focus:ring-[#f4dfc4]';
