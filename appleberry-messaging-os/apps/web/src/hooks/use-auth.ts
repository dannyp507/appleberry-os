'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { getProfile, login, type LoginPayload } from '../lib/api';
import { useSessionStore } from '../stores/session-store';

export function useLogin() {
  const setSession = useSessionStore((state) => state.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async (data) => {
      setSession({
        accessToken: data.accessToken,
        user: {
          ...data.user,
          memberships: [],
        },
      });
    },
  });
}

export function useProfile() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const setSession = useSessionStore((state) => state.setSession);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const profile = await getProfile();
      if (accessToken) {
        setSession({ accessToken, user: profile });
      }
      return profile;
    },
    enabled: Boolean(accessToken),
  });
}
