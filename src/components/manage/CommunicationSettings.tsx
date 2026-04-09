import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Mail, MessageSquare, Save, Shield, Globe, Smartphone, AlertCircle } from 'lucide-react';
import { CommunicationSettings } from '../../types';
import { toast } from 'sonner';
import { useTenant } from '../../lib/tenant';
import { getCompanySettingsDocId } from '../../lib/company';

export default function CommunicationSettingsComponent() {
  const { companyId } = useTenant();
  const [settings, setSettings] = useState<CommunicationSettings>({
    mode: 'test',
    email: {
      host: '',
      port: '465',
      secure: true,
      user: '',
      pass: '',
      fromName: '',
      fromEmail: ''
    },
    whatsapp: {
      provider: 'official',
      accessToken: '',
      phoneId: '',
      templateName: 'invoice_notification',
      instanceId: '',
      apiUrl: 'https://socialposter.planifyx.com/api/send'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    try {
      const docId = getCompanySettingsDocId('communication', companyId || 'global');
      const docSnap = await getDoc(doc(db, 'settings', docId));
      if (docSnap.exists()) {
        const saved = docSnap.data() as CommunicationSettings;
        setSettings({
          mode: saved.mode || 'test',
          email: {
            host: saved.email?.host || '',
            port: saved.email?.port || '465',
            secure: saved.email?.secure ?? true,
            user: saved.email?.user || '',
            pass: saved.email?.pass || '',
            fromName: saved.email?.fromName || '',
            fromEmail: saved.email?.fromEmail || '',
          },
          whatsapp: {
            provider: saved.whatsapp?.provider || 'official',
            accessToken: saved.whatsapp?.accessToken || '',
            phoneId: saved.whatsapp?.phoneId || '',
            templateName: saved.whatsapp?.templateName || 'invoice_notification',
            instanceId: saved.whatsapp?.instanceId || '',
            apiUrl: saved.whatsapp?.apiUrl || 'https://socialposter.planifyx.com/api/send',
          }
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const docId = getCompanySettingsDocId('communication', companyId || 'global');
      await setDoc(doc(db, 'settings', docId), { ...settings, company_id: companyId || null }, { merge: true });
      toast.success('Communication settings saved successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Messaging Mode
          </h2>
          <p className="text-sm text-gray-500">Keep Appleberry OS in safe testing mode until you intentionally allow live outbound messages.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-4 p-1 bg-gray-100 rounded-xl w-fit">
            <button
              onClick={() => setSettings({ ...settings, mode: 'test' })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.mode !== 'live' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Test Mode
            </button>
            <button
              onClick={() => setSettings({ ...settings, mode: 'live' })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.mode === 'live' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Live Mode
            </button>
          </div>

          <div className={`rounded-xl border p-4 flex gap-3 ${settings.mode === 'live' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
            <Shield className={`w-5 h-5 shrink-0 ${settings.mode === 'live' ? 'text-green-600' : 'text-amber-600'}`} />
            <div className={`text-sm ${settings.mode === 'live' ? 'text-green-800' : 'text-amber-800'}`}>
              <p className="font-bold mb-1">{settings.mode === 'live' ? 'Live sending is enabled' : 'Test mode is protecting outbound messaging'}</p>
              <p>
                {settings.mode === 'live'
                  ? 'Emails and WhatsApp messages can be sent to real customers if valid credentials are present.'
                  : 'The server will block WhatsApp and email sends even if credentials are entered, so you can test the app safely.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Settings (SMTP)
            </h2>
            <p className="text-sm text-gray-500">Configure your email server to send invoices to customers.</p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.email.host}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, host: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input
                  type="text"
                  placeholder="465"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  value={settings.email.port}
                  onChange={e => setSettings({ ...settings, email: { ...settings.email, port: e.target.value } })}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-gray-300"
                    checked={settings.email.secure}
                    onChange={e => setSettings({ ...settings, email: { ...settings.email, secure: e.target.checked } })}
                  />
                  <span className="text-sm text-gray-600">Secure (SSL/TLS)</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.email.user}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, user: e.target.value } })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.email.pass}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, pass: e.target.value } })}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input
                type="text"
                placeholder="My Repair Shop"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.email.fromName}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, fromName: e.target.value } })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input
                type="email"
                placeholder="noreply@myshop.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.email.fromEmail}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, fromEmail: e.target.value } })}
              />
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
              <Shield className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700">
                For Gmail, you must use an <strong>App Password</strong>. Standard passwords will be blocked by Google's security.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              WhatsApp Settings (Meta API)
            </h2>
            <p className="text-sm text-gray-500">Connect to Meta WhatsApp Business API to send automated messages.</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex gap-4 p-1 bg-gray-100 rounded-xl w-fit mb-6">
            <button
              onClick={() => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, provider: 'official' } })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.whatsapp.provider === 'official' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Official (Meta API)
            </button>
            <button
              onClick={() => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, provider: 'unofficial' } })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.whatsapp.provider === 'unofficial' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Unofficial (Instance-based)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {settings.whatsapp.provider === 'official' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Access Token</label>
                  <input
                    type="password"
                    placeholder="EAAB..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.whatsapp.accessToken}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, accessToken: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    placeholder="1092..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.whatsapp.phoneId}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, phoneId: e.target.value } })}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint URL</label>
                  <input
                    type="text"
                    placeholder="https://socialposter.planifyx.com/api/send"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.whatsapp.apiUrl}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, apiUrl: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instance ID</label>
                  <input
                    type="text"
                    placeholder="68AF..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.whatsapp.instanceId}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, instanceId: e.target.value } })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                  <input
                    type="password"
                    placeholder="Your access token"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={settings.whatsapp.accessToken}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, accessToken: e.target.value } })}
                  />
                </div>
              </>
            )}
          </div>

          {settings.whatsapp.provider === 'official' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                placeholder="invoice_notification"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                value={settings.whatsapp.templateName}
                onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, templateName: e.target.value } })}
              />
              <p className="text-[10px] text-gray-500 mt-1">The name of the approved template in your Meta Business Manager.</p>
            </div>
          )}

          <div className={`p-4 rounded-xl border flex gap-3 ${settings.whatsapp.provider === 'official' ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
            {settings.whatsapp.provider === 'official' ? (
              <>
                <Globe className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-xs text-green-700">
                  WhatsApp messages require pre-approved templates. Ensure your "Invoice" template is approved before sending.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                <p className="text-xs text-orange-700">
                  Unofficial APIs do not require templates, but carry a higher risk of account suspension. Use responsibly for transactional messages only.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
