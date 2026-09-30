import type { ReactElement } from 'react';
import { UsagePopover } from '@/features/usage/UsagePopover';
import { useUsage } from '@/features/usage/useUsage';
import { USAGE_WARNING_PERCENT } from '@/features/usage/usageTexts';
import type { UsageLimit } from '@/lib/bindings/UsageLimit';
import type { UsageStatus } from '@/lib/bindings/UsageStatus';
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
  const sessionLimit: UsageLimit | undefined = status?.snapshot?.limits.find(
    (limit: UsageLimit) => limit.kind === SESSION_LIMIT_KIND,
  );
  const isWarning: boolean =
    sessionLimit !== undefined && sessionLimit.percent >= USAGE_WARNING_PERCENT;

  function renderLabel(): string {
    if (status?.snapshot == null) {
      return '5h –';
    }
    if (sessionLimit === undefined) {
      return 'Kontingent';
    }
    return `5h ${String(sessionLimit.percent)} %`;
  }

  return (
    <div className="usage-button">
      <button
        type="button"
        className={`usage-button__trigger${isWarning ? ' usage-button__trigger--warning' : ''}`}
        aria-expanded={isOpen}
        title={BUTTON_TITLE}
        onClick={onToggle}
      >
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
