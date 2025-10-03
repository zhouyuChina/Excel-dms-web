import { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api';

export type HealthState = 'loading' | 'online' | 'offline' | 'db-issue';

export function useHealth(pollMs?: number) {
  const [state, setState] = useState<HealthState>('loading');

  useEffect(() => {
    let aborted = false;
    let timer: number | undefined;

    const run = async () => {
      try {
        const h = await fetchHealth();
        const next: HealthState = h.ok ? (h.db === false ? 'db-issue' : 'online') : 'offline';
        if (!aborted) setState(next);
      } catch {
        if (!aborted) setState('offline');
      }
    };

    run();
    if (pollMs && pollMs > 0) {
      timer = window.setInterval(run, pollMs);
    }
    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
    };
  }, [pollMs]);

  return state;
}



