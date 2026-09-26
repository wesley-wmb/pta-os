'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';

import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );

  if (!mounted) return null;

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
    />
  );
}

function subscribeToMount() {
  return () => undefined;
}
