import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { formatThousands } from '@/features/context/formatTokens';
import type { LocalModel } from '@/lib/bindings/LocalModel';
import type { LocalModels } from '@/lib/bindings/LocalModels';
import './LocalModelMenu.css';

const LOCAL_MODEL_MENU_WIDTH = 380;

interface LocalModelMenuProps {
  value: string | null;
  models: LocalModels | null;
  isLoading: boolean;
  onChange: (id: string) => void;
  onReload: () => void;
  onClose: () => void;
}

export function LocalModelMenu({
  value,
  models,
  isLoading,
  onChange,
  onReload,
  onClose,
}: LocalModelMenuProps): ReactElement {
  function renderBody(): ReactElement | ReactElement[] {
    if (models === null) {
      return <p className="local-model-menu__message">{isLoading ? 'Lädt …' : ''}</p>;
    }
    if (models.error !== null) {
      return (
        <p className="local-model-menu__message">
          LM Studio nicht erreichbar unter {models.baseUrl}. Läuft der lokale Server in LM Studio? (
          {models.error})
        </p>
      );
    }
    if (models.models.length === 0) {
      return <p className="local-model-menu__message">LM Studio meldet keine Sprachmodelle.</p>;
    }
    return models.models.map((model: LocalModel) => renderModel(model));
  }

  function renderModel(model: LocalModel): ReactElement {
    const isChecked: boolean = model.id === value;
    const kindText: string = model.kind === 'vlm' ? 'Text und Bild' : 'Nur Text';
    const hint: string = model.isLoaded
      ? `${kindText} · Kontext ${formatThousands(model.loadedContextLength ?? model.maxContextLength)}`
      : 'Nicht geladen — in LM Studio laden';
    return (
      <button
        key={model.id}
        type="button"
        role="menuitemradio"
        aria-checked={isChecked}
        disabled={!model.isLoaded}
        className={`local-model-menu__item${isChecked ? ' local-model-menu__item--checked' : ''}`}
        onClick={(): void => {
          onChange(model.id);
        }}
      >
        <span className="local-model-menu__text">
          <span className="local-model-menu__name">{model.id}</span>
          <span className="local-model-menu__hint">{hint}</span>
        </span>
        {isChecked && <CheckMark />}
      </button>
    );
  }

  return (
    <Popover
      label="Lokales Modell"
      placement="below"
      align="start"
      width={LOCAL_MODEL_MENU_WIDTH}
      onClose={onClose}
    >
      <div className="local-model-menu__head">Modelle in LM Studio</div>
      {renderBody()}
      <div className="local-model-menu__foot">
        <span>Gilt ab der nächsten Nachricht jeder Session.</span>
        <button type="button" className="local-model-menu__reload" onClick={onReload}>
          Neu laden
        </button>
      </div>
    </Popover>
  );
}

function CheckMark(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.4 6.3 4.9 8.7 9.6 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
