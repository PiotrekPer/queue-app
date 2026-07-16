import { QueryClient } from '@tanstack/react-query';

/** Shared react-query client. Realtime keeps the queue fresh; polling is a fallback. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
