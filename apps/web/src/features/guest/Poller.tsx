'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the server-rendered ticket fresh (§8): re-render via router.refresh()
 * every 8s and whenever the tab becomes visible again. No client fetch, no
 * state — the RSC page (fetchTicket, no-store) does the work. Tiny by design to
 * stay under the <100KB JS budget.
 */
export function Poller({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    // token is part of the closure only to satisfy exhaustive-deps; the route
    // already encodes it, so refresh() re-runs the current RSC tree.
    void token;

    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      router.refresh();
    }, 8000);

    const onVisible = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, token]);

  return null;
}
