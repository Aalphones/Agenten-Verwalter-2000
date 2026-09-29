import type { ReactElement } from 'react';
import { stateLabel, stateTone } from '@/features/background/backgroundLabels';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import { useBackgroundStore } from '@/stores/background';
import './BackgroundLine.css';

const UNKNOWN_TYPE = 'Agent';

interface BackgroundLineProps {
  sessionId: string;
  item: BackgroundItem;
}

/** Verlaufszeile eines Subagenten oder Hintergrundprozesses; ein Klick öffnet das Panel auf diesem Eintrag. */
export function BackgroundLine({ sessionId, item }: BackgroundLineProps): ReactElement {
  const openItem = useBackgroundStore((state) => state.openItem);

  function renderDetails(): ReactElement {
    if (item.kind === 'subagent') {
      return (
        <>
          <span className="background-line__name">Agent</span>
          <span className="background-line__type">{item.subagentType ?? UNKNOWN_TYPE}</span>
          <span className="background-line__title">{item.title}</span>
          <span className="background-line__meta">
            · {stateLabel(item.state)} · {String(item.toolUses)} Aufrufe
          </span>
        </>
      );
    }
    return (
      <>
        <span className="background-line__name">Bash</span>
        <span className="background-line__note">im Hintergrund</span>
        <span className="background-line__command">{item.title}</span>
        {item.url !== null && <span className="background-line__url">→ {item.url}</span>}
      </>
    );
  }

  return (
    <button
      type="button"
      className="background-line"
      title="Im Hintergrund-Panel öffnen"
      onClick={(): void => {
        openItem(sessionId, item);
      }}
    >
      <span
        className={`background-line__dot background-line__dot--${stateTone(item.state)}`}
        aria-hidden="true"
      />
      {renderDetails()}
      <svg
        className="background-line__chevron"
        width="11"
        height="11"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5.5 3.5 9 7l-3.5 3.5" />
      </svg>
    </button>
  );
}
