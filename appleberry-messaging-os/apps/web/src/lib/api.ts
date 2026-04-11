'use client';

import { apiClient } from './api-client';

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    globalRole: string;
  };
};

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  return data;
}

export async function getProfile() {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function getWhatsappAccounts() {
  const { data } = await apiClient.get('/whatsapp-accounts');
  return data;
}

export async function createWhatsappAccount(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/whatsapp-accounts', payload);
  return data;
}

export async function getCampaigns() {
  const { data } = await apiClient.get('/campaigns');
  return data;
}

export async function createCampaign(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/campaigns', payload);
  return data;
}

export async function getContacts() {
  const { data } = await apiClient.get('/contacts');
  return data;
}

export async function createContact(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/contacts', payload);
  return data;
}

export async function getTemplates() {
  const { data } = await apiClient.get('/templates');
  return data;
}

export async function createTemplate(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/templates', payload);
  return data;
}

export async function getFlows() {
  const { data } = await apiClient.get('/flows');
  return data;
}

export async function getFlowDetail(id: string) {
  const { data } = await apiClient.get(`/flows/${id}`);
  return data;
}

export async function importFlow(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/flows/import', payload);
  return data;
}

export async function exportFlow(id: string) {
  const { data } = await apiClient.get(`/flows/${id}/export`);
  return data;
}

export async function toggleFlowAi(id: string, payload: { enabled: boolean }) {
  const { data } = await apiClient.patch(`/flows/${id}/ai`, payload);
  return data;
}

export async function updateFlow(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/flows/${id}`, payload);
  return data;
}

export async function deleteFlow(id: string) {
  const { data } = await apiClient.delete(`/flows/${id}`);
  return data;
}

export async function assignDefaultFlowToAccount(
  accountId: string,
  payload: { flowId?: string | null; enabled?: boolean },
) {
  const { data } = await apiClient.post(`/whatsapp-accounts/${accountId}/default-flow`, payload);
  return data;
}
