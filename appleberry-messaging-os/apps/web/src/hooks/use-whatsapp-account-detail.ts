'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../lib/api-client';

export function useWhatsappAccountDetail(id: string) {
  return useQuery({
    queryKey: ['workspace', 'whatsapp-accounts', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/whatsapp-accounts/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useWhatsappAccountActions(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { action: string; note?: string; payload?: Record<string, string> }) => {
      const { data } = await apiClient.post(`/whatsapp-accounts/${id}/actions`, payload);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts', id] });
    },
  });
}

export function useWhatsappAccountConnectionConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      mode: 'cloud_api' | 'whatsapp_web';
      credentials: Record<string, string>;
      metadata?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post(`/whatsapp-accounts/${id}/connection-config`, payload);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts', id] });
    },
  });
}

export function useAssignDefaultFlow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { flowId?: string | null; enabled?: boolean }) => {
      const { data } = await apiClient.post(`/whatsapp-accounts/${id}/default-flow`, payload);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts', id] });
    },
  });
}
