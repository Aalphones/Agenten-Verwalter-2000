import { useState } from 'react';
import type { ReactElement } from 'react';
import { SeverityIcon } from '@/components/SeverityIcon';
import { UsagePopover } from '@/features/usage/UsagePopover';
import { useUsage } from '@/features/usage/useUsage';
import { formatResetAt } from '@/features/usage/usageTexts';
import type { UsageLimit } from '@/lib/bindings/UsageLimit';
import type { UsageStatus } from '@/lib/bindings/UsageStatus';
import { severityOf } from '@/lib/severity';
import type { Severity } from '@/lib/severity';
import './UsageButton.css';

const SESSION_LIMIT_KIND = 'session';
const FULL_PERCENT = 100;
const BUTTON_TITLE = 'Kontingent deines Abos (5-Stunden-Fenster) — Klick für Details';

/** Kontingent des Abos als Zeile im Fuß der Seitenleiste; es gilt dem Konto, nicht einer Session. */
export function UsageButton(): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const status: UsageStatus | null = useUsage(isOpen);
  // Beim Einhängen festgehalten; der Reset-Zeitpunkt im Tooltip braucht keine Sekundengenauigkeit.
  const [now] = useState<number>(() => Date.now());
  const sessionLimit: UsageLimit | undefined = status?.snapshot?.limits.find(
    (limit: UsageLimit) => limit.kind === SESSION_LIMIT_KIND,
  );
  const severity: Severity = severityOf(sessionLimit?.percent ?? 0);
  const resetAt: string | null =
    sessionLimit?.resetsAt == null ? null : formatResetAt(sessionLimit.resetsAt, now);
  const title: string =
    resetAt === null ? BUTTON_TITLE : `${BUTTON_TITLE}\nZurückgesetzt ${resetAt}`;

  return (
    <div className="usage-button">
      <button
        type="button"
        className={`usage-button__trigger severity severity--${sessionLimit === undefined ? 'none' : severity}`}
        aria-expanded={isOpen}
        title={title}
        onClick={(): void => {
          setIsOpen((current: boolean) => !current);
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M2 10.5a5 5 0 1 1 10 0" />
          <path d="M7 10.5 9.2 6.8" />
        </svg>
        <span className="usage-button__name">Kontingent</span>
        {sessionLimit !== undefined && (
          <>
            <SeverityIcon severity={severity} />
            <span className="usage-button__bar">
              <span
                className="usage-button__fill"
                style={{ width: `${String(Math.min(sessionLimit.percent, FULL_PERCENT))}%` }}
              />
            </span>
            <span className="usage-button__label">{`${String(sessionLimit.percent)} %`}</span>
          </>
        )}
      </button>
      {isOpen && (
        <UsagePopover
          status={status}
          onClose={(): void => {
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
