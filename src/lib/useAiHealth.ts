import { useEffect, useState } from 'react';
import { fetchHealth } from './ai';
import type { HealthResponse } from '../types';

/** null = masih memuat. */
export function useAiHealth(): HealthResponse | null {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetchHealth().then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return health;
}
