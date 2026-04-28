import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Save } from 'lucide-react';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { toast } from 'sonner';

type SystemSettings = {
  currency?: string;
  timezone?: string;
  date_format?: string;
  tax_rate?: number;
  low_stock_alert?: boolean;
  email_notifications?: boolean;
  auto_backup?: boolean;
};

export default function Setup() {
  const { companyId } = useTenant();
  const [settings, setSettings] = useState<SystemSettings>({
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
    if (companyId) {
      fetchSettings();
    }
  }, [companyId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const settingsDoc = await getDoc(doc(db, 'system_settings', companyId));
      if (settingsDoc.exists()) {
        setSettings({ ...settings, ...settingsDoc.data() });
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!companyId) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'system_settings', companyId), settings);
      toast.success('System settings saved successfully');
    } catch (error) {
      console.error('Error saving system settings:', error);
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
        <h1 className="text-2xl font-bold text-gray-900">System Setup</h1>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="ZAR">South African Rand (ZAR)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="GBP">British Pound (GBP)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="Africa/Johannesburg">South Africa (GMT+2)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="Europe/London">London</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date Format</label>
            <select
              value={settings.date_format}
              onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
            <input
              type="number"
              value={settings.tax_rate}
              onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Notifications & Alerts</h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="low_stock_alert"
                type="checkbox"
                checked={settings.low_stock_alert}
                onChange={(e) => setSettings({ ...settings, low_stock_alert: e.target.checked })}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="low_stock_alert" className="ml-2 block text-sm text-gray-900">
                Low stock alerts
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="email_notifications"
                type="checkbox"
                checked={settings.email_notifications}
                onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="email_notifications" className="ml-2 block text-sm text-gray-900">
                Email notifications
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="auto_backup"
                type="checkbox"
                checked={settings.auto_backup}
                onChange={(e) => setSettings({ ...settings, auto_backup: e.target.checked })}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="auto_backup" className="ml-2 block text-sm text-gray-900">
                Automatic data backup
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}