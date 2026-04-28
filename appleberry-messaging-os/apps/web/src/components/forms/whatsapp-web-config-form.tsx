'use client';

import { FormEvent, useState } from 'react';

import { useWhatsappAccountConnectionConfig } from '../../hooks/use-whatsapp-account-detail';
import { InlineFormCard } from '../blocks/inline-form-card';

export function WhatsappWebConfigForm({ accountId }: { accountId: string }) {
  const mutation = useWhatsappAccountConnectionConfig(accountId);
  const [deviceName, setDeviceName] = useState('Appleberry Desktop');
  const [sessionLabel, setSessionLabel] = useState('Primary session');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutateAsync({
      mode: 'whatsapp_web',
      credentials: {
        deviceName,
        sessionLabel,
      },
      metadata: {
        bootstrap: 'qr',
      },
    });
  }

  return (
    <InlineFormCard title="WhatsApp Web session" description="Prepare a QR-based session bootstrap for the unofficial engine.">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Device name"
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
          required
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Session label"
          value={sessionLabel}
          onChange={(event) => setSessionLabel(event.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 md:col-span-2"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Preparing QR...' : 'Generate QR session'}
        </button>
      </form>
    </InlineFormCard>
  );
}
