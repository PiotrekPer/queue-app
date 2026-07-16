/**
 * useNow — a shared 1s clock so ticket cards keep their elapsed/hold values live
 * without each card owning its own interval. Returns `Date.now()` in ms.
 * One interval drives every subscriber; unaffected by Reduce Motion (it's data,
 * not motion — no animated transitions here).
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
