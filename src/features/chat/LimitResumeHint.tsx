import type { ReactElement } from 'react';
import { formatClock } from '@/features/context/formatTokens';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './LimitResumeHint.css';

interface LimitResumeHintProps {
  session: SessionSummary;
}

const TITLE =
  'Das Kontingent-Limit hat die Antwort unterbrochen. Der Verwalter schickt die Session nach dem Zurücksetzen selbst weiter (Einstellung „Nach Kontingent-Limit automatisch weiter“). Eine eigene Nachricht ersetzt das automatische Weiter.';

/** Zeigt über dem Eingabefeld, dass die Session aufs Kontingent wartet und wann sie weitergeschickt wird. */
export function LimitResumeHint({ session }: LimitResumeHintProps): ReactElement | null {
  if (session.limitResumeAt === null) {
    return null;
  }
  return (
    <div className="limit-resume-hint" role="note" title={TITLE}>
      <strong>Wartet aufs Kontingent.</strong> Der Verwalter schickt die Session um{' '}
      {formatClock(session.limitResumeAt)} selbst weiter. Eine eigene Nachricht ersetzt das.
    </div>
  );
}
