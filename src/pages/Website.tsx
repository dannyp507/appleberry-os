import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Globe, Save } from 'lucide-react';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { toast } from 'sonner';

type WebsiteSettings = {
  business_name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website_url?: string;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
};

export default function Website() {
  const { companyId } = useTenant();
  const [settings, setSettings] = useState<WebsiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchSettings();
    }
  }, [companyId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const settingsDoc = await getDoc(doc(db, 'website_settings', companyId));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as WebsiteSettings);
      }
    } catch (error) {
      console.error('Error fetching website settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!companyId) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'website_settings', companyId), settings);
      toast.success('Website settings saved successfully');
    } catch (error) {
      console.error('Error saving website settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Website Management</h1>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Business Name</label>
            <input
              type="text"
              value={settings.business_name || ''}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={settings.description || ''}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Website URL</label>
            <input
              type="url"
              value={settings.website_url || ''}
              onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Social Media Links</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Facebook</label>
            <input
              type="url"
              value={settings.social_links?.facebook || ''}
              onChange={(e) => setSettings({
                ...settings,
                social_links: { ...settings.social_links, facebook: e.target.value }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Instagram</label>
            <input
              type="url"
              value={settings.social_links?.instagram || ''}
              onChange={(e) => setSettings({
                ...settings,
                social_links: { ...settings.social_links, instagram: e.target.value }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Twitter</label>
            <input
              type="url"
              value={settings.social_links?.twitter || ''}
              onChange={(e) => setSettings({
                ...settings,
                social_links: { ...settings.social_links, twitter: e.target.value }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}