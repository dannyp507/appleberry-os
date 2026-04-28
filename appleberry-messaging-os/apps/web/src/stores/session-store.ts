'use client';

import { create } from 'zustand';

type WorkspaceMembership = {
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locale: string;
  };
};

type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: string;
  memberships: WorkspaceMembership[];
};

type SessionState = {
  accessToken: string | null;
  user: SessionUser | null;
  activeWorkspaceId: string | null;
  setSession: (payload: { accessToken: string; user: SessionUser }) => void;
  clearSession: () => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
};

const ACCESS_TOKEN_KEY = 'appleberry.accessToken';
const ACTIVE_WORKSPACE_KEY = 'appleberry.activeWorkspaceId';

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: typeof window !== 'undefined' ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null,
  user: null,
  activeWorkspaceId: typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null,
  setSession: ({ accessToken, user }) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }

    const fallbackWorkspaceId = user.memberships[0]?.workspace.id ?? null;

    set((state) => {
      const nextWorkspaceId = state.activeWorkspaceId ?? fallbackWorkspaceId;

      if (nextWorkspaceId && typeof window !== 'undefined') {
        window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextWorkspaceId);
      }

      return {
        accessToken,
        user,
        activeWorkspaceId: nextWorkspaceId,
      };
    });
  },
  clearSession: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
    set({
      accessToken: null,
      user: null,
      activeWorkspaceId: null,
    });
  },
  setActiveWorkspaceId: (workspaceId) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    }
    set({ activeWorkspaceId: workspaceId });
  },
}));

export type { SessionUser, WorkspaceMembership };
