'use client';

import { FormEvent, useEffect, useState } from 'react';

import { useWhatsappAccountConnectionConfig } from '../../hooks/use-whatsapp-account-detail';
import { InlineFormCard } from '../blocks/inline-form-card';

export function CloudApiConfigForm({
  accountId,
  phoneNumber,
}: {
  accountId: string;
  phoneNumber?: string | null;
}) {
  const mutation = useWhatsappAccountConnectionConfig(accountId);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  useEffect(() => {
    if (phoneNumber) {
      setPhoneNumberId(phoneNumber);
    }
  }, [phoneNumber]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      mode: 'cloud_api',
      credentials: {
        phoneNumberId,
        businessAccountId,
        accessToken,
        verifyToken,
      },
      metadata: {
        savedFrom: 'dashboard',
      },
    });
  }

  return (
    <InlineFormCard title="Cloud API connection" description="Store Cloud API credentials and webhook verification settings.">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Phone number ID"
          value={phoneNumberId}
          onChange={(event) => setPhoneNumberId(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Business account ID"
          value={businessAccountId}
          onChange={(event) => setBusinessAccountId(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 md:col-span-2"
          placeholder="Permanent access token"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 md:col-span-2"
          placeholder="Webhook verify token"
          value={verifyToken}
          onChange={(event) => setVerifyToken(event.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 md:col-span-2"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving credentials...' : 'Save Cloud API settings'}
        </button>
      </form>
    </InlineFormCard>
  );
}
