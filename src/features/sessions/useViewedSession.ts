import { useEffect } from 'react';
import { setViewedSession } from '@/lib/sessions';

/** Meldet dem Core, welche Session gerade sichtbar ist; deren Neues gilt dann als gelesen. */
export function useViewedSession(sessionId: string | null): void {
  useEffect(() => {
    setViewedSession(sessionId).catch((reason: unknown) => {
      console.error('Sichtbare Session nicht gemeldet', reason);
    });
  }, [sessionId]);
}
