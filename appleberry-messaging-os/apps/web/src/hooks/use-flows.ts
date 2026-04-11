'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteFlow, exportFlow, getFlowDetail, getFlows, importFlow, toggleFlowAi, updateFlow } from '../lib/api';

export function useFlows() {
  return useQuery({
    queryKey: ['workspace', 'flows'],
    queryFn: getFlows,
  });
}

export function useFlowDetail(id: string) {
  return useQuery({
    queryKey: ['workspace', 'flows', id],
    queryFn: () => getFlowDetail(id),
    enabled: Boolean(id),
  });
}

export function useImportFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importFlow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows'] });
    },
  });
}

export function useExportFlow() {
  return useMutation({
    mutationFn: exportFlow,
  });
}

export function useToggleFlowAi(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { enabled: boolean }) => toggleFlowAi(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows', id] });
    },
  });
}

export function useUpdateFlow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateFlow(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows', id] });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFlow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'flows'] });
    },
  });
}
