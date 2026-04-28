'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getInboxThread,
  getInboxThreads,
  sendInboxMessage,
  takeoverInboxThread,
  updateInboxThread,
  type InboxThreadFilters,
} from '../lib/api';

export function useInboxThreads(filters?: InboxThreadFilters) {
  return useQuery({
    queryKey: ['inbox', 'threads', filters],
    queryFn: () => getInboxThreads(filters),
    refetchInterval: 15_000,
  });
}

export function useInboxThread(id: string) {
  return useQuery({
    queryKey: ['inbox', 'thread', id],
    queryFn: () => getInboxThread(id),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

export function useSendMessage(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; isNote?: boolean }) => sendInboxMessage(threadId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'threads'] });
    },
  });
}

export function useUpdateThread(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status?: string; assignedAgent?: string | null }) =>
      updateInboxThread(threadId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'threads'] });
    },
  });
}

export function useTakeoverThread(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => takeoverInboxThread(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'threads'] });
    },
  });
}
