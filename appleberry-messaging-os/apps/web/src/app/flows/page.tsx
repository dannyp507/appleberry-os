'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Download, Pencil, Search, Sparkles, Trash2 } from 'lucide-react';

import { PageHeader } from '../../components/blocks/page-header';
import { ImportFlowForm } from '../../components/flows/import-flow-form';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useDeleteFlow, useExportFlow, useFlowDetail, useFlows, useToggleFlowAi, useUpdateFlow } from '../../hooks/use-flows';
import { useWhatsappAccounts } from '../../hooks/use-workspace-data';
import { useAssignDefaultFlow } from '../../hooks/use-whatsapp-account-detail';

const typeLabels: Record<string, string> = {
  AI_REPLY: 'A',
  SEND_TEXT: 'T',
  SEND_MEDIA: 'M',
  CALL_WEBHOOK: 'W',
  HUMAN_HANDOFF: 'H',
};

type FlowTableItem = {
  id: string;
  name: string;
  keywords: string;
  nextBot: string;
  sent: string;
  status: 'ACTIVE' | 'PAUSED';
  sendTo: string;
  type: string;
  description: string;
};

export default function FlowsPage() {
  const flowsQuery = useFlows();
  const flows = Array.isArray(flowsQuery.data) ? flowsQuery.data : [];
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [search, setSearch] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [assigningAccountId, setAssigningAccountId] = useState('');

  useEffect(() => {
    if (!selectedFlowId && flows.length) {
      setSelectedFlowId(flows[0].id);
    }
  }, [flows, selectedFlowId]);

  const selectedFlowQuery = useFlowDetail(selectedFlowId);
  const selectedFlow = selectedFlowQuery.data;
  const exportMutation = useExportFlow();
  const toggleAiMutation = useToggleFlowAi(selectedFlowId);
  const updateFlowMutation = useUpdateFlow(selectedFlowId);
  const deleteFlowMutation = useDeleteFlow();
  const accountsQuery = useWhatsappAccounts();
  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
  const assignFlowMutation = useAssignDefaultFlow(assigningAccountId);

  useEffect(() => {
    setEditName(selectedFlow?.name ?? '');
    setEditDescription(selectedFlow?.description ?? '');
  }, [selectedFlow?.description, selectedFlow?.name]);

  const flowItems = useMemo<FlowTableItem[]>(() => {
    const nodes = Array.isArray(selectedFlow?.nodes) ? selectedFlow.nodes : [];
    return nodes
      .filter((node: any) => node.type !== 'KEYWORD_ROUTER')
      .map((node: any) => {
        const config = node.config ?? {};
        return {
          id: node.id,
          name: node.label,
          keywords: config.keywordsRaw || (Array.isArray(config.keywords) ? config.keywords.join(', ') : ''),
          nextBot: config.nextBot || '-',
          sent: config.rawLegacy?.sent || '0',
          status: config.rawLegacy?.status === '1' ? 'ACTIVE' : 'PAUSED',
          sendTo: config.sendToMode || config.rawLegacy?.send_to || '1',
          type: node.type,
          description: config.description || config.rawLegacy?.description || '',
        };
      })
      .filter((item: FlowTableItem) => {
        if (!search.trim()) {
          return true;
        }

        const needle = search.toLowerCase();
        return [item.name, item.keywords, item.nextBot, item.description].some((value) =>
          String(value).toLowerCase().includes(needle),
        );
      });
  }, [search, selectedFlow?.nodes]);

  async function handleExport() {
    if (!selectedFlowId) {
      return;
    }

    const result = await exportMutation.mutateAsync(selectedFlowId);
    const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename || 'workflow-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpdateFlow() {
    if (!selectedFlowId) {
      return;
    }

    await updateFlowMutation.mutateAsync({
      name: editName.trim() || selectedFlow?.name,
      description: editDescription.trim() || selectedFlow?.description,
    });
  }

  async function handleDeleteFlow() {
    if (!selectedFlowId) {
      return;
    }

    await deleteFlowMutation.mutateAsync(selectedFlowId);
    setSelectedFlowId(flows.find((flow: any) => flow.id !== selectedFlowId)?.id ?? '');
  }

  async function handleAssignFlow() {
    if (!selectedFlowId || !assigningAccountId) {
      return;
    }

    await assignFlowMutation.mutateAsync({
      flowId: selectedFlowId,
      enabled: true,
    });
    setAssigningAccountId('');
  }

  return (
    <DashboardShell title="Chat Flows" eyebrow="Automation">
      <div className="space-y-6">
        <PageHeader
          title="Keyword Trigger Chat Flows"
          description="Upload legacy chatbot workflows, manage AI fallback, and review each trigger item in a clean operator table."
          badge="Import and export ready"
        />

        <ImportFlowForm onImported={setSelectedFlowId} />

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              [String(flows.length), 'Imported flows'],
              [String(flows.reduce((sum: number, flow: any) => sum + (flow.importSummary?.chatbotCount ?? 0), 0)), 'Flow items'],
              [String(flows.filter((flow: any) => flow.aiAssistantActive).length), 'AI enabled'],
              [String(flows.reduce((sum: number, flow: any) => sum + (flow._count?.runs ?? 0), 0)), 'Execution runs'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[22px] bg-slate-50 px-5 py-5">
                <p className="text-3xl font-semibold text-slate-900">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Chatbot profile</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {selectedFlow?.name || 'Select or import a workflow'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {selectedFlow?.description || 'Imported keyword-trigger items will appear here with status, next-bot links, and AI fallback controls.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input
                  className="w-full min-w-[180px] bg-transparent outline-none placeholder:text-slate-400"
                  placeholder="Search flows"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => toggleAiMutation.mutate({ enabled: !selectedFlow?.aiAssistantActive })}
                disabled={!selectedFlowId || toggleAiMutation.isPending}
                className={`inline-flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
                  selectedFlow?.aiAssistantActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {selectedFlow?.aiAssistantActive ? 'AI active' : 'AI off'}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!selectedFlowId || exportMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Download JSON
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 rounded-[24px] bg-slate-50 p-4 xl:grid-cols-[1.1fr_1fr_auto]">
            <div className="grid gap-3">
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                placeholder="Flow name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                placeholder="Flow description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                value={assigningAccountId}
                onChange={(event) => setAssigningAccountId(event.target.value)}
              >
                <option value="">Assign this flow to a profile</option>
                {accounts.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssignFlow}
                disabled={!selectedFlowId || !assigningAccountId || assignFlowMutation.isPending}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
              >
                {assignFlowMutation.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <button
                type="button"
                onClick={handleUpdateFlow}
                disabled={!selectedFlowId || updateFlowMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteFlow}
                disabled={!selectedFlowId || deleteFlowMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {flows.length ? (
              flows.map((flow: any) => (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => setSelectedFlowId(flow.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    flow.id === selectedFlowId
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {flow.name}
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">Import a JSON workflow to start building keyword-trigger chat flows.</p>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Keywords', 'Next Bot', 'Sent', 'Status', 'Type', 'Send To'].map((column) => (
                    <th key={column} className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {flowItems.length ? (
                  flowItems.map((item: FlowTableItem, index: number) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.description || 'Imported workflow item'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.keywords || '-'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.nextBot}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.sent}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                          {typeLabels[item.type] || <Bot className="h-4 w-4" />}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.sendTo}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      {selectedFlowId
                        ? 'No matching chatbot items found for this search.'
                        : 'Import a workflow to view keyword triggers here.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
