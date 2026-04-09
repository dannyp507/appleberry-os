import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ShopSettings as ShopSettingsType } from '../../types';
import { toast } from 'sonner';
import { Store, Save, Upload, Trash2, Globe, Phone, Mail, FileText } from 'lucide-react';
import { useTenant } from '../../lib/tenant';
import { getCompanySettingsDocId } from '../../lib/company';

export default function ShopSettings() {
  const { companyId } = useTenant();
  const [settings, setSettings] = useState<ShopSettingsType>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    vatNumber: '',
    regNumber: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    try {
      const docId = getCompanySettingsDocId('shop', companyId || 'global');
      const docSnap = await getDoc(doc(db, 'settings', docId));
      if (docSnap.exists()) {
        setSettings(docSnap.data() as ShopSettingsType);
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
      toast.error('Failed to load shop settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const docId = getCompanySettingsDocId('shop', companyId || 'global');
      await setDoc(doc(db, 'settings', docId), { ...settings, company_id: companyId || null }, { merge: true });
      toast.success('Shop settings saved successfully');
    } catch (error) {
      console.error('Error saving shop settings:', error);
      toast.error('Failed to save shop settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
            <p className="text-gray-500">Configure your business details for invoices and reports.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Company Information
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                placeholder="Appleberry OS"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
              <textarea
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="123 Repair Street, Tech City, 1234"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+27 12 345 6789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@appleberry.co.za"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Website
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                placeholder="www.appleberry.co.za"
              />
            </div>
          </div>

          {/* Logo & Tax Info */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Company Logo
              </h3>
              
              <div className="flex items-start gap-4">
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden group relative">
                  {settings.logoUrl ? (
                    <>
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => setSettings({ ...settings, logoUrl: '' })}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-6 h-6 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-[10px] text-gray-500">Logo URL</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-gray-500">Paste your logo image URL here. For best results, use a transparent PNG or a high-quality JPG.</p>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                    value={settings.logoUrl}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tax & Registration
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.vatNumber}
                    onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                    placeholder="4123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reg Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.regNumber}
                    onChange={(e) => setSettings({ ...settings, regNumber: e.target.value })}
                    placeholder="2024/123456/07"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-gray-900 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Invoice Header Preview</h3>
          <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">Live Preview</div>
        </div>
        
        <div className="bg-white rounded-xl p-8 text-gray-900 max-w-2xl mx-auto shadow-2xl">
          <div className="flex justify-between items-start">
            <div>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-12 mb-4 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-xl appleberry-gradient flex items-center justify-center text-white font-bold text-2xl mb-4">A</div>
              )}
              <h4 className="text-xl font-black">{settings.name || 'Your Business Name'}</h4>
              <p className="text-xs text-gray-500 whitespace-pre-line">{settings.address || 'Business Address'}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact</p>
              <p className="text-xs">{settings.phone}</p>
              <p className="text-xs">{settings.email}</p>
              <p className="text-xs text-primary font-bold">{settings.website}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
