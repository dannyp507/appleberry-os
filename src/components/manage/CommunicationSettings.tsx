import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Mail, MessageSquare, Save, Shield, Globe, Smartphone, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CommunicationSettings } from '../../types';
import { toast } from 'sonner';
import { useTenant } from '../../lib/tenant';
import { getCompanySettingsDocId } from '../../lib/company';
import { requireCompanyId } from '../../lib/db';
import axios from 'axios';
import { getAuthHeaders } from '../../lib/authHeaders';

const inputCls = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-sm';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
const cardCls = 'rounded-2xl border border-gray-200 bg-white overflow-hidden';
const cardHeaderCls = 'p-5 border-b border-gray-100 bg-gray-50';

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
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [companyId]);

  async function fetchSettings() {
    try {
      const docId = getCompanySettingsDocId('communication', requireCompanyId(companyId));
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

  async function handleTestConnection() {
    if (!settings.email.host || !settings.email.user || !settings.email.pass) {
      toast.error('Fill in SMTP Host, Username and Password before testing.');
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const headers = await getAuthHeaders();
      await axios.post('/api/test-email-connection', {
        host: settings.email.host,
        port: settings.email.port,
        secure: settings.email.secure,
        user: settings.email.user,
        pass: settings.email.pass,
      }, { headers, timeout: 15000 });
      setTestResult({ ok: true, message: 'SMTP connection verified — credentials are working!' });
    } catch (err: any) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error || err.message)
        : String(err);
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      const docId = getCompanySettingsDocId('communication', workspaceId);
      await setDoc(doc(db, 'settings', docId), { ...settings, company_id: workspaceId }, { merge: true });
      toast.success('Communication settings saved');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Messaging Mode */}
      <div className={cardCls}>
        <div className={cardHeaderCls}>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Messaging Mode
          </h2>
          <p className="text-xs text-gray-400 mt-1">Must be set to Live Mode before any emails or WhatsApp messages will send.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 p-1 bg-white rounded-xl w-fit border border-gray-200">
            <button
              onClick={() => setSettings({ ...settings, mode: 'test' })}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${settings.mode !== 'live' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-zinc-300'}`}
            >
              Test Mode
            </button>
            <button
              onClick={() => setSettings({ ...settings, mode: 'live' })}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${settings.mode === 'live' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30' : 'text-gray-400 hover:text-zinc-300'}`}
            >
              Live Mode
            </button>
          </div>

          <div className={`rounded-xl border p-4 flex gap-3 ${settings.mode === 'live' ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            <Shield className={`w-5 h-5 shrink-0 mt-0.5 ${settings.mode === 'live' ? 'text-[#22C55E]' : 'text-amber-400'}`} />
            <div className={`text-sm ${settings.mode === 'live' ? 'text-[#86EFAC]' : 'text-amber-300'}`}>
              <p className="font-bold mb-1">{settings.mode === 'live' ? '✓ Live sending is enabled' : '⚠ Test mode is active — no messages will send'}</p>
              <p className="text-xs opacity-80">
                {settings.mode === 'live'
                  ? 'Emails and WhatsApp messages will be sent to real customers when credentials are valid.'
                  : 'The server blocks all outbound sends even if credentials are entered. Safe for testing the app.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className={cardCls}>
        <div className={cardHeaderCls}>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#22C55E]" />
            Email Settings (SMTP)
          </h2>
          <p className="text-xs text-gray-400 mt-1">Configure your email server to send invoices to customers.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                className={inputCls}
                value={settings.email.host}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, host: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Port</label>
                <input
                  type="text"
                  placeholder="465"
                  className={inputCls}
                  value={settings.email.port}
                  onChange={e => setSettings({ ...settings, email: { ...settings.email, port: e.target.value } })}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-200 accent-[#22C55E]"
                    checked={settings.email.secure}
                    onChange={e => setSettings({ ...settings, email: { ...settings.email, secure: e.target.checked } })}
                  />
                  <span className="text-sm text-gray-500">Secure (SSL/TLS)</span>
                </label>
              </div>
            </div>
            <div>
              <label className={labelCls}>Username / Email</label>
              <input
                type="text"
                placeholder="you@gmail.com"
                className={inputCls}
                value={settings.email.user}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, user: e.target.value } })}
              />
            </div>
            <div>
              <label className={labelCls}>Password / App Password</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                className={inputCls}
                value={settings.email.pass}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, pass: e.target.value } })}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>From Name</label>
              <input
                type="text"
                placeholder="Appleberry Care Centre"
                className={inputCls}
                value={settings.email.fromName}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, fromName: e.target.value } })}
              />
            </div>
            <div>
              <label className={labelCls}>From Email</label>
              <input
                type="email"
                placeholder="invoices@myshop.com"
                className={inputCls}
                value={settings.email.fromEmail}
                onChange={e => setSettings({ ...settings, email: { ...settings.email, fromEmail: e.target.value } })}
              />
            </div>
            <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 flex gap-3">
              <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300">
                <p className="font-bold mb-1">Gmail users — use an App Password</p>
                <p className="opacity-80">Go to <span className="font-mono">myaccount.google.com/apppasswords</span>, generate a password for "Appleberry", and paste it above. Your regular Gmail password will be rejected.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-zinc-300 hover:border-[#22C55E]/40 hover:text-[#22C55E] transition-all text-sm font-semibold disabled:opacity-50"
          >
            {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {testingConnection ? 'Testing…' : 'Test SMTP Connection'}
          </button>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm font-medium ${testResult.ok ? 'text-[#22C55E]' : 'text-red-400'}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className={cardCls}>
        <div className={cardHeaderCls}>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#22C55E]" />
            WhatsApp Settings
          </h2>
          <p className="text-xs text-gray-400 mt-1">Connect to WhatsApp to send automated invoice notifications.</p>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex gap-2 p-1 bg-white rounded-xl w-fit border border-gray-200">
            <button
              onClick={() => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, provider: 'official' } })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.whatsapp.provider === 'official' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30' : 'text-gray-400 hover:text-zinc-300'}`}
            >
              Official (Meta API)
            </button>
            <button
              onClick={() => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, provider: 'unofficial' } })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.whatsapp.provider === 'unofficial' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30' : 'text-gray-400 hover:text-zinc-300'}`}
            >
              Unofficial (Instance)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.whatsapp.provider === 'official' ? (
              <>
                <div>
                  <label className={labelCls}>Permanent Access Token</label>
                  <input
                    type="password"
                    placeholder="EAAB..."
                    className={inputCls}
                    value={settings.whatsapp.accessToken}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, accessToken: e.target.value } })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone Number ID</label>
                  <input
                    type="text"
                    placeholder="1092..."
                    className={inputCls}
                    value={settings.whatsapp.phoneId}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, phoneId: e.target.value } })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Template Name</label>
                  <input
                    type="text"
                    placeholder="invoice_notification"
                    className={inputCls}
                    value={settings.whatsapp.templateName}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, templateName: e.target.value } })}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Must match an approved template in your Meta Business Manager.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>API Endpoint URL</label>
                  <input
                    type="text"
                    placeholder="https://socialposter.planifyx.com/api/send"
                    className={inputCls}
                    value={settings.whatsapp.apiUrl}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, apiUrl: e.target.value } })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Instance ID</label>
                  <input
                    type="text"
                    placeholder="68AF..."
                    className={inputCls}
                    value={settings.whatsapp.instanceId}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, instanceId: e.target.value } })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Access Token</label>
                  <input
                    type="password"
                    placeholder="Your access token"
                    className={inputCls}
                    value={settings.whatsapp.accessToken}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, accessToken: e.target.value } })}
                  />
                </div>
              </>
            )}
          </div>

          <div className={`p-4 rounded-xl border flex gap-3 ${settings.whatsapp.provider === 'official' ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            {settings.whatsapp.provider === 'official' ? (
              <>
                <Globe className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <p className="text-xs text-[#86EFAC]">WhatsApp messages require pre-approved templates. Ensure your template is approved in Meta Business Manager before going live.</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Unofficial APIs don't require templates but carry a risk of account suspension. Use for transactional messages only.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#22C55E] text-black px-8 py-3 rounded-xl font-bold hover:bg-[#16A34A] transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
