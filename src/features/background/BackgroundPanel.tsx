import type { ReactElement } from 'react';
import { SideTab } from '@/features/side/SideTab';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { useBackgroundStore } from '@/stores/background';
import './BackgroundPanel.css';

const PANEL_TITLE = 'Nebenfragen';

interface BackgroundPanelProps {
  /** Gezogene Breite in Pixeln. */
  width: number;
  session: SessionSummary;
}

export function BackgroundPanel({ width, session }: BackgroundPanelProps): ReactElement {
  const close = useBackgroundStore((state) => state.close);

  return (
    <aside className="background-panel" aria-label={PANEL_TITLE} style={{ width }}>
      <div className="background-panel__head">
        <h2 className="background-panel__title">{PANEL_TITLE}</h2>
        <button
          type="button"
          className="background-panel__close"
          aria-label="Nebenfragen schließen"
          onClick={close}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
          </svg>
        </button>
      </div>
      <SideTab session={session} />
    </aside>
  );
}
