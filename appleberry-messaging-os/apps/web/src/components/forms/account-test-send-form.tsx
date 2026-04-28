'use client';

import { FormEvent, useState } from 'react';

import { useWhatsappAccountActions } from '../../hooks/use-whatsapp-account-detail';
import { InlineFormCard } from '../blocks/inline-form-card';

export function AccountTestSendForm({ accountId }: { accountId: string }) {
  const mutation = useWhatsappAccountActions(accountId);
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('Appleberry Messaging OS test message');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutation.mutateAsync({
      action: 'test-send',
      payload: {
        to,
        message,
      },
    });

    setFeedback(result?.operation?.message ?? 'Test send processed.');
  }

  async function verifyConnection() {
    const result = await mutation.mutateAsync({ action: 'verify-connection' });
    setFeedback(result?.operation?.message ?? 'Verification finished.');
  }

  return (
    <InlineFormCard title="Connection checks" description="Verify provider connectivity and send a real test message where supported.">
      <div className="space-y-4">
        <button
          type="button"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => void verifyConnection()}
        >
          Verify connection
        </button>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Destination phone number"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 md:col-span-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Processing...' : 'Run test send'}
          </button>
        </form>

        {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
      </div>
    </InlineFormCard>
  );
}
