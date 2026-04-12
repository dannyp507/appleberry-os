'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, AlertTriangle, ExternalLink, Webhook, Code2 } from 'lucide-react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { getApiKeys, createApiKey, revokeApiKey } from '../../lib/api';

const ALL_SCOPES = [
  'MESSAGE_SEND',
  'CONTACT_READ',
  'CONTACT_WRITE',
  'CAMPAIGN_WRITE',
  'ANALYTICS_READ',
  'FLOW_EXECUTE',
  'ACCOUNT_READ',
  'ACCOUNT_WRITE',
];

const API_ENDPOINTS = [
  { method: 'POST', path: '/v1/send-message', description: 'Send a WhatsApp message to a contact', color: 'bg-emerald-500' },
  { method: 'POST', path: '/v1/campaigns', description: 'Create and schedule a broadcast campaign', color: 'bg-emerald-500' },
  { method: 'GET', path: '/v1/contacts', description: 'Retrieve paginated contact list', color: 'bg-sky-500' },
  { method: 'GET', path: '/v1/reports', description: 'Fetch analytics and delivery reports', color: 'bg-sky-500' },
  { method: 'POST', path: '/v1/flows/import', description: 'Import a chatbot flow definition', color: 'bg-emerald-500' },
  { method: 'GET', path: '/v1/templates', description: 'List approved WhatsApp message templates', color: 'bg-sky-500' },
];

const WEBHOOK_EVENTS = [
  { event: 'message.received', description: 'Fires when an inbound message is received' },
  { event: 'message.delivered', description: 'Fires when a message reaches the recipient device' },
  { event: 'message.read', description: 'Fires when the recipient opens the message' },
  { event: 'message.failed', description: 'Fires when a message could not be delivered' },
  { event: 'contact.created', description: 'Fires when a new contact is added' },
  { event: 'campaign.completed', description: 'Fires when a bulk campaign finishes sending' },
  { event: 'flow.triggered', description: 'Fires when a chatbot flow is triggered by a contact' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title="Copy"
    >
      <Copy className="h-4 w-4" />
      {copied && <span className="sr-only">Copied!</span>}
    </button>
  );
}

export default function ApiCenterPage() {
  const queryClient = useQueryClient();
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: getApiKeys });
  const keys: any[] = Array.isArray(keysQuery.data) ? keysQuery.data : [];

  const [keyName, setKeyName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createApiKey({ name: keyName, scopes });
      setNewKeySecret((result as any).rawKey ?? (result as any).key ?? null);
      setKeyName('');
      setScopes([]);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } catch {
      // noop
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeApiKey(id);
    setConfirmRevoke(null);
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  }

  return (
    <DashboardShell title="API & Webhooks" eyebrow="Developer">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">API & Webhooks</h1>
          <p className="mt-1 text-sm text-slate-500">Manage API keys, explore endpoints, and configure webhook subscriptions.</p>
        </div>

        {/* New key revealed banner */}
        {newKeySecret && (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-6 py-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Save your API key — you won&apos;t see it again!</p>
            </div>
            <p className="mb-3 text-xs text-emerald-600">Copy this key now. For security reasons, we do not store the raw key.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-xl border border-emerald-200 bg-white px-4 py-3 font-mono text-sm text-slate-900">
                {newKeySecret}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(newKeySecret)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <button type="button" onClick={() => setNewKeySecret(null)} className="mt-3 text-xs text-emerald-600 underline hover:no-underline">
              I&apos;ve saved it — dismiss
            </button>
          </div>
        )}

        {/* API Keys section */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Code2 className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Keys list */}
            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
              {keysQuery.isLoading ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">Loading keys…</div>
              ) : keys.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">No API keys yet. Create one to get started.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {keys.map((k: any) => (
                    <div key={k.id} className="px-5 py-4 transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{k.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-400">{k.prefix}••••••••</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(k.scopes ?? []).map((s: string) => (
                              <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-slate-400">
                            Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                          </span>
                          {confirmRevoke === k.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleRevoke(k.id)} className="text-xs font-medium text-red-600 hover:underline">Revoke</button>
                              <button onClick={() => setConfirmRevoke(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevoke(k.id)}
                              className="rounded-xl px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create key form */}
            <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Create New Key</h3>
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Key Name</label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="Production integration"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Permissions</label>
                  <div className="space-y-1.5">
                    {ALL_SCOPES.map((scope) => (
                      <label key={scope} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 transition hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={scopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creating || scopes.length === 0 || !keyName}
                  className="w-full rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create API Key'}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* API Docs section */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">API Reference</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {API_ENDPOINTS.map(({ method, path, description, color }) => (
              <button
                key={path}
                type="button"
                className="group rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-bold text-white ${color}`}>{method}</span>
                  <code className="text-xs text-slate-600 group-hover:text-indigo-600">{path}</code>
                </div>
                <p className="text-sm text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Webhook Events section */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Webhook Events</h2>
          </div>
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <p className="text-sm text-slate-500">Subscribe to these events to receive real-time notifications via POST request to your endpoint.</p>
            </div>
            <div className="divide-y divide-slate-200">
              {WEBHOOK_EVENTS.map(({ event, description }) => (
                <div key={event} className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50">
                  <div>
                    <code className="text-sm font-medium text-slate-900">{event}</code>
                    <p className="mt-0.5 text-xs text-slate-400">{description}</p>
                  </div>
                  <CopyButton text={event} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
