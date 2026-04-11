'use client';

import axios from 'axios';

import { useSessionStore } from '../stores/session-store';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken, activeWorkspaceId } = useSessionStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (activeWorkspaceId) {
    config.headers['x-workspace-id'] = activeWorkspaceId;
  }

  return config;
});
