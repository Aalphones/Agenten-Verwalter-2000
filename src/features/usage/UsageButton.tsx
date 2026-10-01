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
const BUTTON_TITLE = 'Kontingent deines Claude-Abos (5-Stunden-Fenster) — Klick für Details';

interface UsageButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function UsageButton({ isOpen, onToggle, onClose }: UsageButtonProps): ReactElement {
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

  function renderLabel(): string {
    if (status?.snapshot == null) {
      return '';
    }
    if (sessionLimit === undefined) {
      return 'Kontingent';
    }
    return `${String(sessionLimit.percent)} %`;
  }

  return (
    <div className="usage-button">
      <button
        type="button"
        className={`usage-button__trigger severity severity--${sessionLimit === undefined ? 'none' : severity}`}
        aria-expanded={isOpen}
        title={title}
        onClick={onToggle}
      >
        {sessionLimit !== undefined && <SeverityIcon severity={severity} />}
        <span className="usage-button__bar">
          <span
            className="usage-button__fill"
            style={{ width: `${String(Math.min(sessionLimit?.percent ?? 0, FULL_PERCENT))}%` }}
          />
        </span>
        <span className="usage-button__label">{renderLabel()}</span>
      </button>
      {isOpen && <UsagePopover status={status} onClose={onClose} />}
    </div>
  );
}
