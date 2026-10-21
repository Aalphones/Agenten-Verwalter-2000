import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { formatClock, formatTokens } from '@/features/context/formatTokens';
import { cacheTtlLabel } from '@/features/promptcache/promptCacheState';
import type { KnownPromptCacheState } from '@/features/promptcache/promptCacheState';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { PromptCache } from '@/lib/bindings/PromptCache';
import { modelName } from '@/lib/labels';
import './PromptCachePopover.css';

const PROMPT_CACHE_POPOVER_WIDTH = 300;

const EXPLANATION =
  'Jede Antwort setzt die Uhr zurück. Ein Modellwechsel oder das Zusammenfassen des Verlaufs macht den Cache sofort kalt.';

interface PromptCachePopoverProps {
  cache: PromptCache;
  state: KnownPromptCacheState;
  /** Das Modell, das die Session jetzt gewählt hat; kann vom Modell des Caches abweichen. */
  sessionModel: ModelId;
  onClose: () => void;
}

interface Headline {
  title: string;
  status: string;
}

export function PromptCachePopover({
  cache,
  state,
  sessionModel,
  onClose,
}: PromptCachePopoverProps): ReactElement {
  const headline: Headline = headlineFor(state, sessionModel);
  return (
    <Popover
      label="Prompt-Cache"
      placement="below"
      align="end"
      width={PROMPT_CACHE_POPOVER_WIDTH}
      onClose={onClose}
    >
      <div className="prompt-cache-popover">
        <h2 className="prompt-cache-popover__title">{headline.title}</h2>
        <dl className="prompt-cache-popover__rows">
          {renderRow('Zustand', headline.status)}
          {renderRow('Im Cache', `${formatTokens(cache.tokens)} Token`)}
          {renderRow('Haltedauer', `${cacheTtlLabel(cache.ttlMs)} (laut letzter Antwort)`)}
          {renderRow('Letzte Antwort', `${formatClock(cache.anchorAt)} Uhr`)}
          {renderRow('Modell', modelName(cache.model))}
        </dl>
        <p className="prompt-cache-popover__note">{EXPLANATION}</p>
      </div>
    </Popover>
  );
}

function headlineFor(state: KnownPromptCacheState, sessionModel: ModelId): Headline {
  if (state.kind === 'warm') {
    return {
      title: 'Prompt-Cache warm',
      status: `warm, noch ${String(state.minutesLeft)} min`,
    };
  }
  if (state.kind === 'cold' && state.reason === 'expired') {
    return {
      title: 'Prompt-Cache abgelaufen',
      status: `kalt seit ${formatClock(state.expiredAt)} Uhr`,
    };
  }
  if (state.kind === 'cold') {
    return {
      title: 'Prompt-Cache gilt für ein anderes Modell',
      status: `kalt — gewählt ist ${modelName(sessionModel)}`,
    };
  }
  return {
    title: 'Cache nach Zusammenfassung',
    status: 'wird mit der nächsten Nachricht neu aufgebaut',
  };
}

function renderRow(label: string, value: string): ReactElement {
  return (
    <div className="prompt-cache-popover__row">
      <dt className="prompt-cache-popover__label">{label}</dt>
      <dd className="prompt-cache-popover__value">{value}</dd>
    </div>
  );
}
