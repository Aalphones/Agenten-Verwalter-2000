import type { ReactElement } from 'react';
import { SnowflakeIcon } from '@/components/SnowflakeIcon';
import type {
  KnownPromptCacheState,
  PromptCacheState,
} from '@/features/promptcache/promptCacheState';
import './PromptCachePill.css';

const PERCENT_FACTOR = 100;
const ICON_SIZE = 12;

const COLD_TITLE = 'Prompt-Cache abgelaufen bzw. für ein anderes Modell — Klick für Details';
const FRESH_TITLE =
  'Verlauf zusammengefasst, der Cache wird mit der nächsten Nachricht neu aufgebaut';

interface PromptCachePillProps {
  state: PromptCacheState;
  isOpen: boolean;
  onToggle: () => void;
}

interface PillView {
  modifier: 'warm' | 'cold' | 'fresh';
  text: string;
  title: string;
}

export function PromptCachePill({
  state,
  isOpen,
  onToggle,
}: PromptCachePillProps): ReactElement | null {
  if (state.kind === 'unknown') {
    return null;
  }
  const view: PillView = pillView(state);
  return (
    <button
      type="button"
      className={`prompt-cache-pill prompt-cache-pill--${view.modifier}`}
      aria-expanded={isOpen}
      aria-label={`Prompt-Cache: ${view.text}`}
      title={view.title}
      onClick={onToggle}
    >
      {renderSymbol(state)}
      <span>{view.text}</span>
    </button>
  );
}

function pillView(state: KnownPromptCacheState): PillView {
  if (state.kind === 'warm') {
    return {
      modifier: 'warm',
      text: `Cache ${String(state.minutesLeft)} min`,
      title: `Prompt-Cache warm, noch ${String(state.minutesLeft)} min — Klick für Details`,
    };
  }
  if (state.kind === 'cold') {
    return { modifier: 'cold', text: 'Cache kalt', title: COLD_TITLE };
  }
  return { modifier: 'fresh', text: 'Cache neu', title: FRESH_TITLE };
}

function renderSymbol(state: PromptCacheState): ReactElement | null {
  if (state.kind === 'warm') {
    // Der gefüllte Anteil des Rings ist die Restzeit.
    return (
      <span
        className="prompt-cache-pill__ring"
        aria-hidden="true"
        style={{
          background: `conic-gradient(currentColor 0 ${String(state.fractionLeft * PERCENT_FACTOR)}%, transparent 0)`,
        }}
      />
    );
  }
  if (state.kind === 'cold') {
    return <SnowflakeIcon size={ICON_SIZE} />;
  }
  if (state.kind === 'fresh') {
    return <RenewIcon />;
  }
  return null;
}

function RenewIcon(): ReactElement {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.8 7A4.8 4.8 0 1 1 10.4 3.6" />
      <path d="M11.4 1.6v2.4H9" />
    </svg>
  );
}
