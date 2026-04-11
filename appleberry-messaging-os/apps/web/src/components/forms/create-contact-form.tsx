'use client';

import { FormEvent, useState } from 'react';

import { useCreateContact } from '../../hooks/use-workspace-data';
import { InlineFormCard } from '../blocks/inline-form-card';

export function CreateContactForm() {
  const mutation = useCreateContact();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      fullName,
      phoneNumber,
      email: email || undefined,
      optInStatus: true,
    });
    setFullName('');
    setPhoneNumber('');
    setEmail('');
  }

  return (
    <InlineFormCard title="Add contact" description="Create a contact record with consent-ready defaults.">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Add contact'}
        </button>
      </form>
    </InlineFormCard>
  );
}
