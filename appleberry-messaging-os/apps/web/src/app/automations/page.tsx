'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { PageHeader } from '../../components/blocks/page-header';
import {
  getAutoresponders,
  createAutoresponder,
  updateAutoresponder,
  deleteAutoresponder,
  toggleAutoresponder,
} from '../../lib/api';

const TRIGGER_TYPES = [
  { value: 'EXACT_KEYWORD', label: 'Exact Keyword' },
  { value: 'CONTAINS_KEYWORD', label: 'Contains Keyword' },
  { value: 'REGEX', label: 'Regex Pattern' },
  { value: 'FIRST_MESSAGE', label: 'First Message' },
  { value: 'RETURNING_CONTACT', label: 'Returning Contact' },
  { value: 'OUTSIDE_HOURS', label: 'Outside Business Hours' },
  { value: 'FALLBACK', label: 'Fallback (no match)' },
];

const ACTION_TYPES = [
  { value: 'SEND_TEXT', label: 'Send Text' },
  { value: 'SEND_TEMPLATE', label: 'Send Template' },
  { value: 'TAG_CONTACT', label: 'Tag Contact' },
  { value: 'START_FLOW', label: 'Start Flow' },
  { value: 'ASSIGN_AGENT', label: 'Assign Agent' },
  { value: 'CALL_WEBHOOK', label: 'Call Webhook' },
];

const TRIGGER_BADGE: Record<string, string> = {
  EXACT_KEYWORD: 'bg-indigo-50 text-indigo-700',
  CONTAINS_KEYWORD: 'bg-violet-50 text-violet-700',
  REGEX: 'bg-amber-50 text-amber-700',
  FIRST_MESSAGE: 'bg-emerald-50 text-emerald-700',
  RETURNING_CONTACT: 'bg-sky-50 text-sky-700',
  OUTSIDE_HOURS: 'bg-orange-50 text-orange-700',
  FALLBACK: 'bg-slate-100 text-slate-600',
};

const ACTION_BADGE: Record<string, string> = {
  SEND_TEXT: 'bg-emerald-50 text-emerald-700',
  SEND_TEMPLATE: 'bg-sky-50 text-sky-700',
  TAG_CONTACT: 'bg-violet-50 text-violet-700',
  START_FLOW: 'bg-indigo-50 text-indigo-700',
  ASSIGN_AGENT: 'bg-amber-50 text-amber-700',
  CALL_WEBHOOK: 'bg-rose-50 text-rose-700',
};

const KEYWORD_TRIGGERS = new Set(['EXACT_KEYWORD', 'CONTAINS_KEYWORD', 'REGEX']);

type RuleForm = {
  name: string;
  triggerType: string;
  keywords: string;
  priority: number;
  actionType: string;
  actionConfig: string;
  active: boolean;
};

const DEFAULT_FORM: RuleForm = {
  name: '',
  triggerType: 'EXACT_KEYWORD',
  keywords: '',
  priority: 10,
  actionType: 'SEND_TEXT',
  actionConfig: '',
  active: true,
};

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({ queryKey: ['autoresponders'], queryFn: getAutoresponders });
  const rules: any[] = Array.isArray(rulesQuery.data) ? rulesQuery.data : [];

  const [form, setForm] = useState<RuleForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function updateForm(field: keyof RuleForm, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name,
      triggerType: form.triggerType,
      keywords: KEYWORD_TRIGGERS.has(form.triggerType) ? form.keywords.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      priority: form.priority,
      action: { type: form.actionType, config: form.actionConfig },
      active: form.active,
    };
    try {
      if (editingId) {
        await updateAutoresponder(editingId, payload);
      } else {
        await createAutoresponder(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['autoresponders'] });
      setForm(DEFAULT_FORM);
      setEditingId(null);
      setShowForm(false);
    } catch {
      // noop
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(rule: any) {
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      keywords: Array.isArray(rule.keywords) ? rule.keywords.join(', ') : (rule.keywords ?? ''),
      priority: rule.priority ?? 10,
      actionType: rule.action?.type ?? 'SEND_TEXT',
      actionConfig: rule.action?.config ?? '',
      active: rule.active ?? true,
    });
    setEditingId(rule.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    await deleteAutoresponder(id);
    setConfirmDelete(null);
    queryClient.invalidateQueries({ queryKey: ['autoresponders'] });
  }

  async function handleToggle(id: string) {
    await toggleAutoresponder(id);
    queryClient.invalidateQueries({ queryKey: ['autoresponders'] });
  }

  // Demo rules for display when empty
  const demoRules = [
    { id: 'd1', name: 'Welcome Message', triggerType: 'FIRST_MESSAGE', keywords: [], priority: 1, action: { type: 'SEND_TEXT', config: 'Hello! Welcome to our service.' }, active: true },
    { id: 'd2', name: 'Price Inquiry', triggerType: 'CONTAINS_KEYWORD', keywords: ['price', 'cost', 'how much'], priority: 5, action: { type: 'SEND_TEMPLATE', config: 'pricing_template' }, active: true },
    { id: 'd3', name: 'After Hours', triggerType: 'OUTSIDE_HOURS', keywords: [], priority: 100, action: { type: 'SEND_TEXT', config: 'We are closed. We will respond during business hours.' }, active: false },
  ];

  const displayRules = rules.length > 0 ? rules : demoRules;

  const stats = [
    [String(displayRules.length), 'Total rules'],
    [String(displayRules.filter((r) => r.active).length), 'Active rules'],
    ['148', 'Triggers today'],
    ['312', 'Actions executed'],
  ];

  return (
    <DashboardShell title="Automations" eyebrow="Automation">
      <div className="space-y-6">
        <PageHeader
          title="Autoresponder Engine"
          description="Define trigger rules and automated actions to respond to contacts instantly."
          badge="Smart automation"
        />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-3xl font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Create / Edit Form */}
        <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setEditingId(null); setForm(DEFAULT_FORM); }}
            className="flex w-full items-center justify-between px-6 py-4"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {showForm ? (editingId ? 'Edit Rule' : 'New Rule') : 'Create Autoresponder Rule'}
              </span>
            </div>
            <span className="text-xs text-slate-400">{showForm ? 'Collapse' : 'Expand'}</span>
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className="border-t border-slate-200 px-6 pb-6 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Rule Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    placeholder="e.g. Price Inquiry Handler"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Priority</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={form.priority}
                    onChange={(e) => updateForm('priority', Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Trigger Type</label>
                  <select
                    value={form.triggerType}
                    onChange={(e) => updateForm('triggerType', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    {TRIGGER_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {KEYWORD_TRIGGERS.has(form.triggerType) && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {form.triggerType === 'REGEX' ? 'Pattern' : 'Keywords (comma-separated)'}
                    </label>
                    <input
                      type="text"
                      value={form.keywords}
                      onChange={(e) => updateForm('keywords', e.target.value)}
                      placeholder={form.triggerType === 'REGEX' ? '^hello.*world$' : 'price, cost, how much'}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Action Type</label>
                  <select
                    value={form.actionType}
                    onChange={(e) => updateForm('actionType', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    {ACTION_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {form.actionType === 'SEND_TEXT' ? 'Message Text' :
                     form.actionType === 'SEND_TEMPLATE' ? 'Template Name / ID' :
                     form.actionType === 'TAG_CONTACT' ? 'Tag Name' :
                     form.actionType === 'START_FLOW' ? 'Flow ID' :
                     form.actionType === 'ASSIGN_AGENT' ? 'Agent ID or Queue' :
                     'Webhook URL'}
                  </label>
                  {form.actionType === 'SEND_TEXT' ? (
                    <textarea
                      rows={3}
                      value={form.actionConfig}
                      onChange={(e) => updateForm('actionConfig', e.target.value)}
                      placeholder="Type your auto-reply message here…"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  ) : (
                    <input
                      type="text"
                      value={form.actionConfig}
                      onChange={(e) => updateForm('actionConfig', e.target.value)}
                      placeholder={form.actionType === 'CALL_WEBHOOK' ? 'https://yourapp.com/webhook' : 'Enter value…'}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.active}
                    onClick={() => updateForm('active', !form.active)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.active ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-slate-700">{form.active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : editingId ? 'Update Rule' : 'Create Rule'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm(DEFAULT_FORM); }}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rules table */}
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-base font-semibold text-slate-900">Autoresponder Rules</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Trigger', 'Keywords', 'Action', 'Priority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rulesQuery.isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Loading rules…</td></tr>
                ) : (
                  displayRules.map((rule: any) => (
                    <tr key={rule.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{rule.name}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TRIGGER_BADGE[rule.triggerType] ?? 'bg-slate-100 text-slate-600'}`}>
                          {TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.label ?? rule.triggerType}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px] truncate text-xs text-slate-500">
                        {Array.isArray(rule.keywords) ? rule.keywords.join(', ') : (rule.keywords ?? '—')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ACTION_BADGE[rule.action?.type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {ACTION_TYPES.find((a) => a.value === rule.action?.type)?.label ?? rule.action?.type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{rule.priority}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggle(rule.id)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${rule.active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(rule)}
                            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {confirmDelete === rule.id ? (
                            <>
                              <button onClick={() => handleDelete(rule.id)} className="text-xs font-medium text-red-600 hover:underline px-1">Del</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-400 px-1">No</button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(rule.id)}
                              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
