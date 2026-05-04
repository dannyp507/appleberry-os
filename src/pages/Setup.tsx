import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronRight,
  Wrench,
  Tag,
  Users,
  Package,
  Building2,
  ShoppingCart,
  Palette,
  AlertTriangle,
  Landmark,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { toast } from 'sonner';
import { requireCompanyId } from '../lib/db';

// ─── types ────────────────────────────────────────────────────────────────────
type Tab =
  | 'general'
  | 'cash_drawers'
  | 'repair_statuses'
  | 'repair_problems'
  | 'brand_models'
  | 'categories'
  | 'manufacturers'
  | 'vendors'
  | 'expense_types'
  | 'customer_types';

interface ListItem {
  id: string;
  name: string;
  color?: string;
  order_index?: number;
  default_price?: number;
  brand?: string;
  model?: string;
}

// ─── reusable simple-list manager ─────────────────────────────────────────────
function SimpleListManager({
  title,
  collectionName,
  companyId,
  extraFields,
}: {
  title: string;
  collectionName: string;
  companyId: string | null;
  extraFields?: 'price' | 'color' | 'brand_model';
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newExtra, setNewExtra] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editExtra, setEditExtra] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId, collectionName]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, collectionName),
          where('company_id', '==', companyId),
          orderBy(collectionName === 'repair_status_options' ? 'order_index' : 'name')
        )
      );
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListItem)));
    } catch {
      // orderBy might fail if no index — fall back
      try {
        const snap = await getDocs(
          query(collection(db, collectionName), where('company_id', '==', companyId))
        );
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListItem)));
      } catch (e: any) {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !companyId) return;
    setSaving(true);
    try {
      const cid = requireCompanyId(companyId);
      const payload: any = {
        company_id: cid,
        name: newName.trim(),
        created_at: new Date().toISOString(),
      };
      if (extraFields === 'price') payload.default_price = parseFloat(newExtra) || 0;
      if (extraFields === 'color') payload.color = newExtra || '#6b7280';
      if (extraFields === 'brand_model') {
        payload.brand = newBrand.trim();
        payload.model = newName.trim();
        payload.name = `${newBrand.trim()} ${newName.trim()}`;
      }
      if (collectionName === 'repair_status_options') payload.order_index = items.length;
      const ref = await addDoc(collection(db, collectionName), payload);
      setItems([...items, { id: ref.id, ...payload }]);
      setNewName('');
      setNewExtra('');
      setNewBrand('');
      setNewModel('');
      toast.success('Added');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      setItems(items.filter(i => i.id !== id));
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      const updates: any = { name: editName.trim(), updated_at: new Date().toISOString() };
      if (extraFields === 'price') updates.default_price = parseFloat(editExtra) || 0;
      if (extraFields === 'color') updates.color = editExtra || '#6b7280';
      await updateDoc(doc(db, collectionName, id), updates);
      setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
      setEditId(null);
      toast.success('Updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>

      {/* Add new */}
      <div className="flex gap-2">
        {extraFields === 'brand_model' && (
          <input
            type="text"
            placeholder="Brand (e.g. Apple)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm placeholder-gray-400 focus:border-[#22C55E] focus:outline-none"
            value={newBrand}
            onChange={e => setNewBrand(e.target.value)}
          />
        )}
        <input
          type="text"
          placeholder={extraFields === 'brand_model' ? 'Model (e.g. iPhone 15 Pro)' : 'Name…'}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm placeholder-gray-400 focus:border-[#22C55E] focus:outline-none"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        {extraFields === 'price' && (
          <input
            type="number"
            placeholder="Default price"
            className="w-32 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:border-[#22C55E] focus:outline-none"
            value={newExtra}
            onChange={e => setNewExtra(e.target.value)}
          />
        )}
        {extraFields === 'color' && (
          <input
            type="color"
            className="w-10 h-10 rounded-lg border border-gray-200 bg-white cursor-pointer"
            value={newExtra || '#6b7280'}
            onChange={e => setNewExtra(e.target.value)}
          />
        )}
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-4 py-2 bg-[#22C55E] text-black rounded-lg text-sm font-bold hover:bg-[#16a34a] disabled:opacity-40 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">No items yet. Add your first one above.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors group">
              {extraFields === 'color' && (
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#6b7280' }} />
              )}
              {editId === item.id ? (
                <>
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 rounded border border-[#22C55E] bg-white text-gray-900 text-sm focus:outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                  />
                  {extraFields === 'price' && (
                    <input
                      type="number"
                      className="w-24 px-2 py-1 rounded border border-[#22C55E] bg-white text-gray-900 text-sm focus:outline-none"
                      value={editExtra}
                      onChange={e => setEditExtra(e.target.value)}
                    />
                  )}
                  {extraFields === 'color' && (
                    <input
                      type="color"
                      className="w-8 h-8 rounded cursor-pointer"
                      value={editExtra || item.color || '#6b7280'}
                      onChange={e => setEditExtra(e.target.value)}
                    />
                  )}
                  <button onClick={() => handleSaveEdit(item.id)} className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                  {extraFields === 'price' && item.default_price != null && item.default_price > 0 && (
                    <span className="text-xs text-gray-500 font-medium">R{item.default_price.toFixed(2)}</span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditId(item.id);
                        setEditName(item.name);
                        setEditExtra(
                          extraFields === 'price' ? String(item.default_price || '') :
                          extraFields === 'color' ? (item.color || '') : ''
                        );
                      }}
                      className="p-1 text-gray-500 hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── main setup page ───────────────────────────────────────────────────────────
export default function Setup() {
  const { companyId } = useTenant();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState({
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    date_format: 'DD/MM/YYYY',
    tax_rate: 15,
    low_stock_alert: true,
    email_notifications: true,
    auto_backup: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'system_settings', companyId!));
      if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() }));
    } catch {}
    finally { setLoading(false); }
  }

  async function saveSettings() {
    if (!companyId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'system_settings', companyId), settings);
      toast.success('Settings saved');
    } catch {
      // doc might not exist yet — create it
      try {
        await addDoc(collection(db, 'system_settings'), { ...settings, company_id: companyId });
        toast.success('Settings saved');
      } catch (e: any) {
        toast.error(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'cash_drawers', label: 'Cash Drawers', icon: <Landmark className="w-4 h-4" /> },
    { id: 'repair_statuses', label: 'Repair Statuses', icon: <Palette className="w-4 h-4" /> },
    { id: 'repair_problems', label: 'Repair Problems', icon: <Wrench className="w-4 h-4" /> },
    { id: 'brand_models', label: 'Brand Models', icon: <Package className="w-4 h-4" /> },
    { id: 'categories', label: 'Product Categories', icon: <Tag className="w-4 h-4" /> },
    { id: 'manufacturers', label: 'Manufacturers', icon: <Building2 className="w-4 h-4" /> },
    { id: 'vendors', label: 'Vendors', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'expense_types', label: 'Expense Types', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'customer_types', label: 'Customer Types', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Setup</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure your workspace, lists and defaults</p>
        </div>
      </div>

      <div className="flex gap-6 min-h-[70vh]">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                  : 'text-gray-500 hover:text-white hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="flex-1 text-left">{tab.label}</span>
              {activeTab === tab.id && <ChevronRight className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-6">

          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-xl">
              <h3 className="text-base font-bold text-white">General Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={e => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:border-[#22C55E] focus:outline-none"
                  >
                    <option value="ZAR">South African Rand (ZAR)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:border-[#22C55E] focus:outline-none"
                  >
                    <option value="Africa/Johannesburg">South Africa (GMT+2)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="Europe/London">London</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date Format</label>
                  <select
                    value={settings.date_format}
                    onChange={e => setSettings({ ...settings, date_format: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:border-[#22C55E] focus:outline-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={settings.tax_rate}
                    onChange={e => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-gray-600">Alerts & Notifications</h4>
                {[
                  { key: 'low_stock_alert', label: 'Low stock alerts' },
                  { key: 'email_notifications', label: 'Email notifications' },
                  { key: 'auto_backup', label: 'Automatic data backup' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-9 h-5 rounded-full transition-colors ${(settings as any)[key] ? 'bg-[#22C55E]' : 'bg-zinc-700'} relative`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(settings as any)[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-gray-600 group-hover:text-white transition-colors">{label}</span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={(settings as any)[key]}
                      onChange={e => setSettings({ ...settings, [key]: e.target.checked })}
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] text-black font-bold rounded-xl text-sm hover:bg-[#16a34a] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}

          {activeTab === 'cash_drawers' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">
                Define your cash drawers (e.g. "Front Counter", "Back Office"). Staff select a drawer when opening the POS or running End of Day — sales and cash counts are tracked per drawer.
              </p>
              <SimpleListManager
                title="Cash Drawers"
                collectionName="drawers"
                companyId={companyId}
              />
            </div>
          )}

          {activeTab === 'repair_statuses' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Define the stages a repair moves through. The order here is the default sort order.</p>
              <SimpleListManager
                title="Repair Statuses"
                collectionName="repair_status_options"
                companyId={companyId}
                extraFields="color"
              />
            </div>
          )}

          {activeTab === 'repair_problems' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Pre-defined repair problems staff can select. Optionally set a default price that auto-adds to the repair cart.</p>
              <SimpleListManager
                title="Repair Problems"
                collectionName="repair_problems"
                companyId={companyId}
                extraFields="price"
              />
            </div>
          )}

          {activeTab === 'brand_models' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Add brand + model combinations for quick device selection when creating repairs.</p>
              <SimpleListManager
                title="Brand Models"
                collectionName="brand_models"
                companyId={companyId}
                extraFields="brand_model"
              />
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Product categories used to organise your inventory.</p>
              <SimpleListManager
                title="Product Categories"
                collectionName="product_categories"
                companyId={companyId}
              />
            </div>
          )}

          {activeTab === 'manufacturers' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Manufacturer / brand names for your products.</p>
              <SimpleListManager
                title="Manufacturers"
                collectionName="manufacturers"
                companyId={companyId}
              />
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Vendors / suppliers used in your Expenses module.</p>
              <SimpleListManager
                title="Vendors"
                collectionName="vendors"
                companyId={companyId}
              />
            </div>
          )}

          {activeTab === 'expense_types' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Categories for your business expenses (e.g. Rent, Utilities, Stock, Labour).</p>
              <SimpleListManager
                title="Expense Types"
                collectionName="expense_types"
                companyId={companyId}
              />
            </div>
          )}

          {activeTab === 'customer_types' && (
            <div className="max-w-lg">
              <p className="text-sm text-gray-500 mb-4">Tag customers by type for filtering and reporting (e.g. Wholesale, VIP, Walk-in).</p>
              <SimpleListManager
                title="Customer Types"
                collectionName="customer_types"
                companyId={companyId}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
