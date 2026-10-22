import type { ReactElement } from 'react';
import { SnowflakeIcon } from '@/components/SnowflakeIcon';
import type { KnownPromptCacheState } from '@/features/promptcache/promptCacheState';
import './PromptCacheSymbol.css';

const PERCENT_FACTOR = 100;
const ICON_SIZE = 12;

const COLD_TITLE = 'Prompt-Cache abgelaufen bzw. für ein anderes Modell';
const FRESH_TITLE =
  'Verlauf zusammengefasst, der Cache wird mit der nächsten Nachricht neu aufgebaut';

export interface PromptCacheView {
  modifier: 'warm' | 'cold' | 'fresh';
  /** Kurzform neben dem Symbol, z.B. „57 min“. */
  text: string;
  title: string;
}

interface PromptCacheSymbolProps {
  state: KnownPromptCacheState;
}

/** Zustand des Prompt-Caches als Symbol mit Kurztext; die Farbe trägt den Zustand. Der Text darf per CSS
 *  wegfallen (`prompt-cache-symbol__text`), das Symbol bleibt. */
export function PromptCacheSymbol({ state }: PromptCacheSymbolProps): ReactElement {
  const view: PromptCacheView = promptCacheView(state);
  return (
    <span className={`prompt-cache-symbol prompt-cache-symbol--${view.modifier}`}>
      {renderSymbol(state)}
      <span className="prompt-cache-symbol__text">{view.text}</span>
    </span>
  );
}

export function promptCacheView(state: KnownPromptCacheState): PromptCacheView {
  if (state.kind === 'warm') {
    return {
      modifier: 'warm',
      text: `${String(state.minutesLeft)} min`,
      title: `Prompt-Cache warm, noch ${String(state.minutesLeft)} min`,
    };
  }
  if (state.kind === 'cold') {
    return { modifier: 'cold', text: 'kalt', title: COLD_TITLE };
  }
  return { modifier: 'fresh', text: 'neu', title: FRESH_TITLE };
}

function renderSymbol(state: KnownPromptCacheState): ReactElement {
  if (state.kind === 'warm') {
    // Der gefüllte Anteil des Rings ist die Restzeit.
    return (
      <span
        className="prompt-cache-symbol__ring"
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
  return <RenewIcon />;
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
