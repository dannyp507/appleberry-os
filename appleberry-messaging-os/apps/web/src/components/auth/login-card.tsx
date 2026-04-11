'use client';

import { FormEvent, useState } from 'react';

import { useLogin, useProfile } from '../../hooks/use-auth';

export function LoginCard() {
  const [email, setEmail] = useState('owner@appleberry.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const loginMutation = useLogin();
  const profileQuery = useProfile();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await loginMutation.mutateAsync({ email, password });
    if (response.accessToken) {
      await profileQuery.refetch();
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg">
      <h2 className="text-2xl font-semibold text-slate-900">Sign in to Appleberry</h2>
      <p className="mt-2 text-sm text-slate-500">Use the seeded owner account to bootstrap the workspace UI.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
        {loginMutation.error ? (
          <p className="text-sm text-rose-500">Unable to sign in. Check the API server and seed data.</p>
        ) : null}
      </form>
    </div>
  );
}
