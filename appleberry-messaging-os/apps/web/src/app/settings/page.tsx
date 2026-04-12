'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Key, Shield, Users, Settings } from 'lucide-react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useSessionStore } from '../../stores/session-store';
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getWorkspaceMembers,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspace,
} from '../../lib/api';

type Tab = 'workspace' | 'team' | 'apikeys' | 'security';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'workspace', label: 'Workspace', icon: Settings },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'apikeys', label: 'API Keys', icon: Key },
  { id: 'security', label: 'Security', icon: Shield },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    INACTIVE: 'bg-slate-100 text-slate-500',
    SUSPENDED: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function WorkspaceTab() {
  const user = useSessionStore((state) => state.user);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const activeMembership = user?.memberships.find((m) => m.workspace.id === activeWorkspaceId) ?? user?.memberships[0];
  const workspace = activeMembership?.workspace;

  const [name, setName] = useState(workspace?.name ?? '');
  const [timezone, setTimezone] = useState(workspace?.timezone ?? 'UTC');
  const [locale, setLocale] = useState(workspace?.locale ?? 'en-US');
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace?.id) return;
    setSaving(true);
    try {
      await updateWorkspace(workspace.id, { name, timezone, locale, brandColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h3 className="mb-5 text-base font-semibold text-slate-900">Workspace Settings</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Workspace Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              {['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              {['en-US', 'en-GB', 'es-ES', 'pt-BR', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Brand Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-xl border border-slate-200"
              />
              <span className="font-mono text-sm text-slate-500">{brandColor}</span>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[20px] border border-red-100 bg-red-50 px-6 py-5">
        <h3 className="mb-1 text-sm font-semibold text-red-700">Danger Zone</h3>
        <p className="mb-4 text-xs text-red-500">Permanently delete this workspace and all its data. This cannot be undone.</p>
        <button
          type="button"
          className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
        >
          Delete Workspace
        </button>
      </div>
    </div>
  );
}

function TeamTab() {
  const user = useSessionStore((state) => state.user);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['workspace', activeWorkspaceId, 'members'],
    queryFn: () => getWorkspaceMembers(activeWorkspaceId!),
    enabled: !!activeWorkspaceId,
  });

  const members: any[] = Array.isArray(membersQuery.data) ? membersQuery.data : [];

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;
    setInviting(true);
    try {
      await inviteWorkspaceMember(activeWorkspaceId, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId, 'members'] });
    } catch {
      // noop
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!activeWorkspaceId) return;
    await removeWorkspaceMember(activeWorkspaceId, memberId);
    queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId, 'members'] });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h3 className="mb-5 text-base font-semibold text-slate-900">Invite Team Member</h3>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {inviting ? 'Inviting…' : 'Invite'}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Team Members</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {membersQuery.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Loading members…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No team members yet.</td></tr>
              ) : (
                members.map((m: any) => (
                  <tr key={m.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{m.user?.firstName} {m.user?.lastName}</td>
                    <td className="px-4 py-3 text-slate-500">{m.user?.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{m.role}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={m.status ?? 'ACTIVE'} /></td>
                    <td className="px-4 py-3">
                      {m.user?.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleRemove(m.id)}
                          className="rounded-xl p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: getApiKeys });
  const keys: any[] = Array.isArray(keysQuery.data) ? keysQuery.data : [];

  const ALL_SCOPES = ['MESSAGE_SEND', 'CONTACT_READ', 'CONTACT_WRITE', 'CAMPAIGN_WRITE', 'ANALYTICS_READ', 'FLOW_EXECUTE', 'ACCOUNT_READ', 'ACCOUNT_WRITE'];

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createApiKey({ name, scopes });
      setNewKeySecret((result as any).rawKey ?? (result as any).key ?? null);
      setName('');
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
    <div className="max-w-3xl space-y-6">
      {newKeySecret && (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-6 py-5">
          <p className="mb-1 text-sm font-semibold text-emerald-800">API Key Created — Save this now!</p>
          <p className="mb-3 text-xs text-emerald-600">This key will not be shown again. Copy it immediately.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-xl border border-emerald-200 bg-white px-4 py-2.5 font-mono text-xs text-slate-900">
              {newKeySecret}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(newKeySecret)}
              className="whitespace-nowrap rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              Copy
            </button>
          </div>
          <button type="button" onClick={() => setNewKeySecret(null)} className="mt-3 text-xs text-emerald-600 underline hover:no-underline">
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h3 className="mb-5 text-base font-semibold text-slate-900">Create API Key</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Key Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Integration"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    scopes.includes(scope) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || scopes.length === 0}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create Key'}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">API Keys</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Prefix</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Scopes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Last Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {keysQuery.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No API keys yet.</td></tr>
              ) : (
                keys.map((k: any) => (
                  <tr key={k.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{k.prefix}…</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(k.scopes ?? []).slice(0, 3).map((s: string) => (
                          <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s}</span>
                        ))}
                        {(k.scopes ?? []).length > 3 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">+{k.scopes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      {confirmRevoke === k.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleRevoke(k.id)} className="text-xs font-medium text-red-600 hover:underline">Confirm</button>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      setMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h3 className="mb-5 text-base font-semibold text-slate-900">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          {message && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Two-Factor Authentication</h3>
            <p className="mt-1 text-sm text-slate-500">Add an extra layer of security to your account.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">Coming soon</span>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          2FA via authenticator app will be available in a future release.
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Active Sessions</h3>
        <div className="space-y-3">
          {[
            { device: 'Chrome on macOS', location: 'New York, US', current: true, lastSeen: 'Now' },
            { device: 'Safari on iPhone', location: 'New York, US', current: false, lastSeen: '2 hours ago' },
          ].map((session, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {session.device}
                  {session.current && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">Current</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">{session.location} · {session.lastSeen}</p>
              </div>
              {!session.current && (
                <button type="button" className="text-xs font-medium text-red-500 hover:underline">Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('workspace');

  return (
    <DashboardShell title="Settings" eyebrow="Configuration">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your workspace, team, and security preferences.</p>
        </div>

        <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'workspace' && <WorkspaceTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'apikeys' && <ApiKeysTab />}
        {activeTab === 'security' && <SecurityTab />}
      </div>
    </DashboardShell>
  );
}
