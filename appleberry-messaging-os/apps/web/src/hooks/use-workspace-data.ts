'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCampaign,
  createContact,
  createTemplate,
  createWhatsappAccount,
  getCampaigns,
  getContacts,
  getTemplates,
  getWhatsappAccounts,
} from '../lib/api';

export function useWhatsappAccounts() {
  return useQuery({
    queryKey: ['workspace', 'whatsapp-accounts'],
    queryFn: getWhatsappAccounts,
  });
}

export function useCreateWhatsappAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWhatsappAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'whatsapp-accounts'] }),
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['workspace', 'campaigns'],
    queryFn: getCampaigns,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'campaigns'] }),
  });
}

export function useContacts() {
  return useQuery({
    queryKey: ['workspace', 'contacts'],
    queryFn: getContacts,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'contacts'] }),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ['workspace', 'templates'],
    queryFn: getTemplates,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace', 'templates'] }),
  });
}
