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

// ─── Inbox ────────────────────────────────────────────────────────────────────

export type InboxThread = {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'closed' | 'bot_active' | 'pending';
  assignedAgent: string | null;
  accountId: string;
};

export type InboxMessage = {
  id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isBot: boolean;
  isNote: boolean;
};

export type InboxThreadFilters = {
  status?: string;
  assignedToMe?: boolean;
  search?: string;
};

export async function getInboxThreads(filters?: InboxThreadFilters) {
  const { data } = await apiClient.get('/inbox/threads', { params: filters });
  return data as InboxThread[];
}

export async function getInboxThread(id: string) {
  const { data } = await apiClient.get(`/inbox/threads/${id}`);
  return data as { thread: InboxThread; messages: InboxMessage[] };
}

export async function sendInboxMessage(threadId: string, payload: { body: string; isNote?: boolean }) {
  const { data } = await apiClient.post(`/inbox/threads/${threadId}/messages`, payload);
  return data as InboxMessage;
}

export async function updateInboxThread(threadId: string, payload: { status?: string; assignedAgent?: string | null }) {
  const { data } = await apiClient.patch(`/inbox/threads/${threadId}`, payload);
  return data as InboxThread;
}

export async function takeoverInboxThread(threadId: string) {
  const { data } = await apiClient.post(`/inbox/threads/${threadId}/takeover`);
  return data as InboxThread;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export type AnalyticsOverview = {
  totalSent: number;
  deliveryRate: number;
  replyRate: number;
  failedMessages: number;
  totalSentTrend: number;
  deliveryRateTrend: number;
  replyRateTrend: number;
  failedMessagesTrend: number;
};

export type AnalyticsCampaignRow = {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  replyRate: number;
  status: string;
};

export type AnalyticsAccountHealth = {
  id: string;
  name: string;
  phone: string;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'offline';
  dailySends: number;
};

export type AnalyticsParams = {
  from?: string;
  to?: string;
  accountId?: string;
};

export async function getAnalyticsOverview(params?: AnalyticsParams) {
  const { data } = await apiClient.get('/analytics/overview', { params });
  return data as AnalyticsOverview;
}

export async function getAnalyticsCampaigns(params?: AnalyticsParams) {
  const { data } = await apiClient.get('/analytics/campaigns', { params });
  return data as AnalyticsCampaignRow[];
}

export async function getAnalyticsAccounts(params?: AnalyticsParams) {
  const { data } = await apiClient.get('/analytics/accounts', { params });
  return data as AnalyticsAccountHealth[];
}
