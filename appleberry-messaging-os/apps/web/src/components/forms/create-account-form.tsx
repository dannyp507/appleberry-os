'use client';

import { FormEvent, useState } from 'react';

import { useCreateWhatsappAccount } from '../../hooks/use-workspace-data';
import { InlineFormCard } from '../blocks/inline-form-card';

export function CreateAccountForm() {
  const mutation = useCreateWhatsappAccount();
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState('CLOUD_API');
  const [phoneNumber, setPhoneNumber] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      name,
      providerType,
      phoneNumber: phoneNumber || undefined,
    });
    setName('');
    setPhoneNumber('');
  }

  return (
    <InlineFormCard title="Connect account" description="Register a WhatsApp sending account inside the active workspace.">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Account name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <select
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          value={providerType}
          onChange={(event) => setProviderType(event.target.value)}
        >
          <option value="CLOUD_API">Cloud API</option>
          <option value="WHATSAPP_WEB">WhatsApp Web</option>
        </select>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Add account'}
        </button>
      </form>
    </InlineFormCard>
  );
}
