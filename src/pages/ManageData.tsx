import React, { useState } from 'react';
import {
  Database,
  Upload,
  Download,
  ChevronRight,
  MessageSquare,
  Store,
  AlertCircle,
  Package,
  Users,
  Wrench,
  ShoppingCart,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { companyQuery } from '../lib/db';
import { toast } from 'sonner';
import { cn, safeFormatDate } from '../lib/utils';
import ImportSystem from '../components/import/ImportSystem';
import ManageProblems from '../components/manage/ManageProblems';
import CommunicationSettings from '../components/manage/CommunicationSettings';
import ShopSettings from '../components/manage/ShopSettings';

type ManageSection = 'shop' | 'import' | 'export' | 'problems' | 'communication';

// ─── CSV export helpers ───────────────────────────────────────────────────────
function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export panel ─────────────────────────────────────────────────────────────
function ExportPanel({ companyId }: { companyId: string | null }) {
  const [exporting, setExporting] = useState<string | null>(null);

  const exports = [
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      collection: 'customers',
      fields: ['id', 'name', 'first_name', 'last_name', 'phone', 'email', 'customer_type', 'created_at'],
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      collection: 'products',
      fields: ['id', 'name', 'category', 'sku', 'barcode', 'cost_price', 'selling_price', 'stock', 'product_type', 'created_at'],
    },
    {
      id: 'repairs',
      label: 'Repairs',
      icon: Wrench,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      collection: 'repairs',
      fields: ['id', 'ticket_number', 'customer_id', 'device_name', 'device_brand', 'device_model', 'imei', 'issue_description', 'cost', 'total_amount', 'paid_amount', 'status_id', 'technician_id', 'created_at'],
    },
    {
      id: 'sales',
      label: 'Sales',
      icon: ShoppingCart,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      collection: 'sales',
      fields: ['id', 'ticket_number', 'customer_id', 'customer_name', 'total_amount', 'profit', 'payment_method', 'staff_id', 'drawer_name', 'created_at'],
    },
  ];

  async function handleExport(exp: typeof exports[number]) {
    if (!companyId) { toast.error('No workspace selected'); return; }
    setExporting(exp.id);
    try {
      const snap = await getDocs(companyQuery(exp.collection, companyId));
      const rows = snap.docs.map(d => {
        const data = d.data();
        const row: Record<string, any> = { id: d.id };
        exp.fields.slice(1).forEach(f => { row[f] = data[f] ?? ''; });
        return row;
      });
      if (rows.length === 0) { toast.info('No data to export'); return; }
      const csv = toCSV(rows);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `${exp.id}_export_${date}.csv`);
      toast.success(`Exported ${rows.length} ${exp.label.toLowerCase()}`);
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-gray-900">Export Data</h3>
        <p className="text-sm text-gray-500 mt-1">Download your data as CSV files. Each export includes all records for your workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {exports.map(exp => (
          <div key={exp.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-xl p-2.5 ${exp.bg}`}>
                <exp.icon className={`h-5 w-5 ${exp.color}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{exp.label}</p>
                <p className="text-xs text-gray-400">{exp.fields.length} columns</p>
              </div>
            </div>
            <div className="text-xs text-zinc-600 mb-4 font-mono leading-relaxed">
              {exp.fields.slice(0, 5).join(', ')}{exp.fields.length > 5 ? ` +${exp.fields.length - 5} more` : ''}
            </div>
            <button
              onClick={() => handleExport(exp)}
              disabled={exporting === exp.id}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              {exporting === exp.id ? 'Exporting…' : `Export ${exp.label}`}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-400 font-medium">⚠ Export note</p>
        <p className="text-xs text-amber-400/70 mt-1">
          Exported files contain business data. Store them securely and do not share them publicly.
          IDs in CSV files can be used for re-importing or cross-referencing records.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ManageData() {
  const { companyId } = useTenant();
  const [activeSection, setActiveSection] = useState<ManageSection>('shop');

  const menuItems: { id: ManageSection; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'shop', label: 'Shop Settings', icon: Store, description: 'Business info, logo, VAT' },
    { id: 'import', label: 'Import Data', icon: Upload, description: 'CellStore migration & CSV import' },
    { id: 'export', label: 'Export Data', icon: Download, description: 'Download records as CSV' },
    { id: 'problems', label: 'Repair Problems', icon: AlertCircle, description: 'Manage problem presets' },
    { id: 'communication', label: 'Communication', icon: MessageSquare, description: 'Email & WhatsApp settings' },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'shop': return <ShopSettings />;
      case 'import': return (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-1">CellStore Migration</h2>
              <p className="text-blue-100 text-sm mb-4 max-w-md">
                Migrate your entire business from CellStore in minutes. Upload your exported files and we'll handle the rest.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['C', 'P', 'S', 'R'].map(l => (
                    <div key={l} className="w-7 h-7 rounded-full border-2 border-blue-600 bg-blue-400 flex items-center justify-center text-[10px] font-bold">{l}</div>
                  ))}
                </div>
                <p className="text-xs text-blue-100">Customers, Products, Sales & Repairs</p>
              </div>
            </div>
            <Database className="absolute -right-6 -bottom-6 w-36 h-36 text-blue-500/20 rotate-12" />
          </div>
          <ImportSystem />
        </div>
      );
      case 'export': return <ExportPanel companyId={companyId} />;
      case 'problems': return <ManageProblems />;
      case 'communication': return <CommunicationSettings />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">Shop settings, data import/export, and communication configuration</p>
      </div>

      <div className="flex gap-6 min-h-[70vh]">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                activeSection === item.id
                  ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                  : 'text-gray-500 hover:text-white hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate">{item.label}</p>
                <p className={`text-[10px] truncate mt-0.5 ${activeSection === item.id ? 'text-[#22C55E]/60' : 'text-zinc-600'}`}>
                  {item.description}
                </p>
              </div>
              {activeSection === item.id && <ChevronRight className="w-3 h-3 shrink-0 ml-auto" />}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0 rounded-2xl border border-gray-200 bg-white p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
