'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { DownloadCloud, Sparkles, UploadCloud } from 'lucide-react';

import { useImportFlow } from '../../hooks/use-flows';
import { InlineFormCard } from '../blocks/inline-form-card';

export function ImportFlowForm({ onImported }: { onImported?: (flowId: string) => void }) {
  const importMutation = useImportFlow();
  const [flowName, setFlowName] = useState('');
  const [description, setDescription] = useState('Imported from legacy keyword-trigger JSON');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedName = useMemo(() => {
    if (!file?.name) {
      return 'Imported WhatsApp Workflow';
    }

    return file.name.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setError(null);

    if (nextFile && !flowName.trim()) {
      setFlowName(nextFile.name.replace(/\.json$/i, '').replace(/[-_]+/g, ' '));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError('Choose a workflow JSON file first.');
      return;
    }

    try {
      setError(null);
      const rawText = await file.text();
      const payload = JSON.parse(rawText) as Record<string, unknown>;
      const imported = await importMutation.mutateAsync({
        name: flowName.trim() || suggestedName,
        description: description.trim() || undefined,
        payload,
      });

      onImported?.(imported.id);
      setFlowName('');
      setFile(null);
    } catch {
      setError('This file could not be imported. Make sure it is valid JSON from the keyword builder.');
    }
  }

  return (
    <InlineFormCard
      title="Upload workflow"
      description="Import your keyword-trigger chatbot JSON and convert it into Appleberry flow nodes with AI fallback controls."
    >
      <form className="grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr]" onSubmit={handleSubmit}>
        <div className="space-y-3">
          <label className="flex min-h-[122px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-sky-200 bg-sky-50/70 px-5 text-center transition hover:border-sky-300 hover:bg-sky-50">
            <UploadCloud className="h-6 w-6 text-sky-500" />
            <span className="mt-3 text-sm font-medium text-slate-700">
              {file ? file.name : 'Choose JSON workflow file'}
            </span>
            <span className="mt-1 text-xs text-slate-400">Supports legacy keyword-trigger exports with chatbot items and templates.</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
          </label>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        </div>

        <div className="grid gap-3">
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Flow name"
            value={flowName}
            onChange={(event) => setFlowName(event.target.value)}
          />
          <textarea
            className="min-h-[74px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Import description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-amber-400" />
              AI-ready conversion
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Imported fallback bots stay mapped as AI nodes, and their on/off state can be switched after import.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workflow import</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{flowName.trim() || suggestedName}</p>
            <p className="mt-2 text-sm text-slate-500">Upload, normalize, and prepare the workflow for download and AI control.</p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            disabled={importMutation.isPending}
          >
            <DownloadCloud className="h-4 w-4" />
            {importMutation.isPending ? 'Importing...' : 'Upload and convert'}
          </button>
        </div>
      </form>
    </InlineFormCard>
  );
}
