import { useEffect, useState } from 'react';
import type { Party } from '../types';
import { subscribeToParties } from './queueStore';

export function useQueue(): Party[] {
  const [parties, setParties] = useState<Party[]>([]);

  useEffect(() => subscribeToParties(setParties), []);

  return parties;
}
