'use client';

import { PropsWithChildren, useEffect } from 'react';

import { useProfile } from '../../hooks/use-auth';
import { useSessionStore } from '../../stores/session-store';
import { LoginCard } from '../auth/login-card';

export function WorkspaceShell({ children }: PropsWithChildren) {
  const accessToken = useSessionStore((state) => state.accessToken);
  const user = useSessionStore((state) => state.user);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useSessionStore((state) => state.setActiveWorkspaceId);
  const profileQuery = useProfile();

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <LoginCard />
      </div>
    );
  }

  if (profileQuery.isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  const memberships = user?.memberships ?? [];
  const resolvedWorkspaceId = activeWorkspaceId ?? memberships[0]?.workspace.id ?? null;

  useEffect(() => {
    if (!activeWorkspaceId && memberships[0]?.workspace.id) {
      setActiveWorkspaceId(memberships[0].workspace.id);
    }
  }, [activeWorkspaceId, memberships, setActiveWorkspaceId]);

  if (!memberships.length) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          This user has no active workspace memberships yet.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden">
        <select
          value={resolvedWorkspaceId ?? memberships[0].workspace.id}
          onChange={(event) => setActiveWorkspaceId(event.target.value)}
        >
          {memberships.map((membership) => (
            <option key={membership.workspace.id} value={membership.workspace.id}>
              {membership.workspace.name}
            </option>
          ))}
        </select>
      </div>
      {children}
    </>
  );
}
