import type { ReactElement, ReactNode } from 'react';
import { settingEntry } from '@/features/settings/settingsCatalog';
import type { SettingId } from '@/features/settings/settingsCatalog';
import './SettingRow.css';

interface SettingRowProps {
  /** Name und ⓘ-Text kommen aus dem Katalog. */
  id: SettingId;
  /** Das Bedienelement. */
  children: ReactNode;
}

export function SettingRow({ id, children }: SettingRowProps): ReactElement {
  const { label, info } = settingEntry(id);
  return (
    <div className="setting-row">
      <div className="setting-row__label">
        <span>{label}</span>
        <button
          type="button"
          className="setting-row__info"
          title={info}
          aria-label={`Erklärung zu ${label}: ${info}`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 6.4v3.4" />
            <circle cx="7" cy="4.3" r="0.5" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}
