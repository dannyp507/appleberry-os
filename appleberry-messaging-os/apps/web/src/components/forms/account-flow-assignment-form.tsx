'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Sparkles, Waypoints } from 'lucide-react';

import { useFlows } from '../../hooks/use-flows';
import { useAssignDefaultFlow } from '../../hooks/use-whatsapp-account-detail';
import { InlineFormCard } from '../blocks/inline-form-card';

export function AccountFlowAssignmentForm({
  accountId,
  assignedFlowId,
  chatbotEnabled,
}: {
  accountId: string;
  assignedFlowId?: string;
  chatbotEnabled?: boolean;
}) {
  const flowsQuery = useFlows();
  const assignMutation = useAssignDefaultFlow(accountId);
  const flows = Array.isArray(flowsQuery.data) ? flowsQuery.data : [];
  const [flowId, setFlowId] = useState(assignedFlowId ?? '');
  const [enabled, setEnabled] = useState(Boolean(chatbotEnabled));

  useEffect(() => {
    setFlowId(assignedFlowId ?? '');
    setEnabled(Boolean(chatbotEnabled));
  }, [assignedFlowId, chatbotEnabled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await assignMutation.mutateAsync({
      flowId: flowId || null,
      enabled,
    });
  }

  return (
    <InlineFormCard
      title="Default chatbot flow"
      description="Assign a default keyword-trigger flow to this WhatsApp profile and control whether the bot stays active."
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="rounded-[22px] bg-slate-50 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Waypoints className="h-4 w-4 text-sky-500" />
            Profile bot assignment
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Link this account to one imported chatbot flow. This becomes the default flow used for keyword and fallback automation.
          </p>
        </div>

        <select
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          value={flowId}
          onChange={(event) => setFlowId(event.target.value)}
        >
          <option value="">No default flow assigned</option>
          {flows.map((flow: any) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>

        <label className="flex items-center justify-between rounded-[22px] border border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Bot active</p>
            <p className="mt-1 text-xs text-slate-400">Turn the assigned AI or keyword bot on or off for this profile.</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((current) => !current)}
            className={`inline-flex h-8 w-14 items-center rounded-full px-1 transition ${
              enabled ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-200'
            }`}
          >
            <span className="block h-6 w-6 rounded-full bg-white shadow" />
          </button>
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={assignMutation.isPending}
        >
          <Sparkles className="h-4 w-4" />
          {assignMutation.isPending ? 'Saving assignment...' : 'Save chatbot assignment'}
        </button>
      </form>
    </InlineFormCard>
  );
}
