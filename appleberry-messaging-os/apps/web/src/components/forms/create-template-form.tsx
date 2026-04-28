'use client';

import { FormEvent, useState } from 'react';

import { useCreateTemplate } from '../../hooks/use-workspace-data';
import { InlineFormCard } from '../blocks/inline-form-card';

export function CreateTemplateForm() {
  const mutation = useCreateTemplate();
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [body, setBody] = useState('{"text":"Hello from Appleberry"}');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError(null);
      await mutation.mutateAsync({
        name,
        type,
        status: 'DRAFT',
        body: JSON.parse(body),
      });
      setName('');
    } catch (submissionError) {
      if (submissionError instanceof SyntaxError) {
        setError('Template body must be valid JSON.');
      } else {
        setError('Unable to create template right now.');
      }
    }
  }

  return (
    <InlineFormCard title="Create template" description="Add a reusable text, media, or interactive template.">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          placeholder="Template name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <select
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="TEXT">Text</option>
          <option value="MEDIA">Media</option>
          <option value="BUTTON">Button</option>
          <option value="LIST">List</option>
        </select>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 md:col-span-2"
          placeholder='{"text":"Hello from Appleberry"}'
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 md:col-span-4"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Create template'}
        </button>
        {error ? <p className="text-sm text-rose-500 md:col-span-4">{error}</p> : null}
      </form>
    </InlineFormCard>
  );
}
