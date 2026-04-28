'use client';

import { FormEvent, useState } from 'react';

import { useCreateCampaign } from '../../hooks/use-workspace-data';
import { InlineFormCard } from '../blocks/inline-form-card';

export function CreateCampaignForm() {
  const mutation = useCreateCampaign();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('Africa/Johannesburg');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      name,
      description: description || undefined,
      timezone,
      accountRotation: false,
    });
    setName('');
    setDescription('');
  }

  return (
    <InlineFormCard title="Create campaign" description="Start a draft broadcast campaign for the current workspace.">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Campaign name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Create campaign'}
        </button>
      </form>
    </InlineFormCard>
  );
}
