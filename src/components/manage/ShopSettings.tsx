import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { ShopSettings as ShopSettingsType } from '../../types';
import { toast } from 'sonner';
import { Store, Save, Upload, Trash2, Globe, Phone, Mail, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { useTenant } from '../../lib/tenant';
import { getCompanySettingsDocId } from '../../lib/company';
import { requireCompanyId } from '../../lib/db';

const inputCls = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-sm';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    try {
      const docId = getCompanySettingsDocId('shop', requireCompanyId(companyId));
      const docSnap = await getDoc(doc(db, 'settings', docId));
      if (docSnap.exists()) {
        setSettings(docSnap.data() as ShopSettingsType);
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    const workspaceId = requireCompanyId(companyId);
    const ext = file.name.split('.').pop() || 'png';
    const storageRef = ref(storage, `logos/${workspaceId}/logo.${ext}`);

    setUploading(true);
    setUploadProgress(0);

    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => {
        console.error('Upload error:', error);
        toast.error('Upload failed — check Firebase Storage is enabled in your Firebase console');
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setSettings(prev => ({ ...prev, logoUrl: url }));
        setUploading(false);
        setUploadProgress(0);
        toast.success('Logo uploaded — click Save to apply');
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    );
  }

  async function handleRemoveLogo() {
    if (!settings.logoUrl) return;
    // Try to delete from Storage (best-effort — URL might be external)
    try {
      if (settings.logoUrl.includes('firebasestorage')) {
        const storageRef = ref(storage, settings.logoUrl);
        await deleteObject(storageRef);
      }
    } catch {
      // Ignore — just clear the URL
    }
    setSettings(prev => ({ ...prev, logoUrl: '' }));
    toast.success('Logo removed — click Save to apply');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      const docId = getCompanySettingsDocId('shop', workspaceId);
      await setDoc(doc(db, 'settings', docId), { ...settings, company_id: workspaceId }, { merge: true });
      toast.success('Shop settings saved');
    } catch (error) {
      console.error('Error saving shop settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22C55E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Main form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Company Info */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-[#22C55E]" /> Company Information
          </h3>

          <div>
            <label className={labelCls}>Business Name</label>
            <input
              type="text"
              className={inputCls}
              value={settings.name}
              onChange={e => setSettings({ ...settings, name: e.target.value })}
              placeholder="Appleberry Care Centre"
            />
          </div>

          <div>
            <label className={labelCls}>Business Address</label>
            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              value={settings.address}
              onChange={e => setSettings({ ...settings, address: e.target.value })}
              placeholder="13B Beacon Bay Crossing&#10;Beacon Bay&#10;East London 5214"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Phone</label>
              <input
                type="text"
                className={inputCls}
                value={settings.phone}
                onChange={e => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+27 61 519 4752"
              />
            </div>
            <div>
              <label className={labelCls}><Mail className="w-3 h-3 inline mr-1" />Email</label>
              <input
                type="email"
                className={inputCls}
                value={settings.email}
                onChange={e => setSettings({ ...settings, email: e.target.value })}
                placeholder="info@appleberry.co.za"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}><Globe className="w-3 h-3 inline mr-1" />Website</label>
            <input
              type="text"
              className={inputCls}
              value={settings.website}
              onChange={e => setSettings({ ...settings, website: e.target.value })}
              placeholder="www.appleberry.co.za"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#22C55E]" /> Tax & Registration
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>VAT Number</label>
                <input
                  type="text"
                  className={inputCls}
                  value={settings.vatNumber}
                  onChange={e => setSettings({ ...settings, vatNumber: e.target.value })}
                  placeholder="4123456789"
                />
              </div>
              <div>
                <label className={labelCls}>Reg Number</label>
                <input
                  type="text"
                  className={inputCls}
                  value={settings.regNumber}
                  onChange={e => setSettings({ ...settings, regNumber: e.target.value })}
                  placeholder="2024/123456/07"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right — Logo */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#22C55E]" /> Company Logo
          </h3>

          {/* Logo preview */}
          <div className="flex items-start gap-4">
            <div className="relative w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden group flex-shrink-0">
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#22C55E] animate-spin" />
                  <span className="text-[10px] text-zinc-400">{uploadProgress}%</span>
                </div>
              ) : settings.logoUrl ? (
                <>
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </>
              ) : (
                <div className="text-center p-3">
                  <ImageIcon className="w-6 h-6 text-zinc-600 mx-auto mb-1" />
                  <p className="text-[10px] text-zinc-600">No logo</p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-[#22C55E]/5 rounded-xl py-3 text-sm font-semibold text-gray-400 hover:text-green-600 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? `Uploading ${uploadProgress}%…` : 'Click to upload logo'}
              </button>

              <p className="text-[11px] text-zinc-600 leading-relaxed">
                PNG, JPG, SVG or WebP · Max 5 MB · Transparent PNG recommended for best results on invoices.
              </p>

              {/* Optional: paste URL as fallback */}
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Or paste a URL</label>
                <input
                  type="text"
                  className={`${inputCls} mt-1 text-xs`}
                  value={settings.logoUrl.startsWith('http') && !settings.logoUrl.includes('firebasestorage') ? settings.logoUrl : ''}
                  onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
          </div>

          {/* Invoice preview */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
            <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mb-3">Invoice header preview</p>
            <div className="flex justify-between items-start">
              <div>
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-10 mb-2 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#22C55E] flex items-center justify-center text-white font-black text-xl mb-2">A</div>
                )}
                <p className="text-sm font-black text-gray-900">{settings.name || 'Your Business Name'}</p>
                <p className="text-[10px] text-gray-500 whitespace-pre-line leading-relaxed">{settings.address || 'Your address'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-gray-200 uppercase tracking-widest">Invoice</p>
                <p className="text-[10px] text-gray-500">{settings.phone}</p>
                <p className="text-[10px] text-gray-500">{settings.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex items-center gap-2 bg-[#22C55E] text-black px-8 py-3 rounded-xl font-bold hover:bg-[#16A34A] transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
