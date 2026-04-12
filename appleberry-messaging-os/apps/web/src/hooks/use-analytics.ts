'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getAnalyticsAccounts,
  getAnalyticsCampaigns,
  getAnalyticsOverview,
  type AnalyticsParams,
} from '../lib/api';

export function useAnalyticsOverview(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'overview', params],
    queryFn: () => getAnalyticsOverview(params),
  });
}

export function useAnalyticsCampaigns(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'campaigns', params],
    queryFn: () => getAnalyticsCampaigns(params),
  });
}

export function useAnalyticsAccounts(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'accounts', params],
    queryFn: () => getAnalyticsAccounts(params),
  });
}
