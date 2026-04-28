'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { WorkspaceShell } from '../components/layout/workspace-shell';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </QueryClientProvider>
  );
}
