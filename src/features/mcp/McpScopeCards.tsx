import { useState } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { LOCAL_SOURCE_ID, USER_SOURCE_ID } from '@/features/mcp/mcpFormState';
import {
  REPOSITORY_SELECT_LABEL,
  SCOPE_FILE,
  SCOPE_LEGEND,
  SCOPE_LOCAL,
  SCOPE_REPOSITORY,
  SCOPE_USER,
  SCOPE_WORKSPACE_NOTE,
} from '@/features/mcp/mcpFormTexts';
import type { McpSource } from '@/lib/bindings/McpSource';

interface McpScopeCardsProps {
  sources: readonly McpSource[];
  sourceId: string;
  onChange: (sourceId: string) => void;
}

/** „Wo soll der Server gelten?“: Benutzer, ein Repository oder nur ich. Die `.mcp.json` des
 *  Vorhaben-Ordners ist keine Wahl; ein Eintrag von dort steht mit einem Satz darunter. */
export function McpScopeCards({ sources, sourceId, onChange }: McpScopeCardsProps): ReactElement {
  const repositories: McpSource[] = sources.filter(
    (source: McpSource) => source.kind === 'repository',
  );
  const isRepository: boolean = repositories.some((source: McpSource) => source.id === sourceId);
  // Das zuletzt gewählte Repository bleibt in der Auswahl, auch während eine andere Karte gilt.
  const [pickedId, setPickedId] = useState<string>(
    isRepository ? sourceId : (repositories[0]?.id ?? ''),
  );

  function renderCard(
    title: string,
    note: string,
    value: string,
    isChecked: boolean,
    extra: ReactNode,
  ): ReactElement {
    return (
      <label className="mcp-form__scope">
        <input
          type="radio"
          name="mcp-scope"
          className="mcp-form__scope-radio"
          checked={isChecked}
          onChange={() => {
            onChange(value);
          }}
        />
        <span className="mcp-form__scope-title">{title}</span>
        <span className="mcp-form__scope-note">{note}</span>
        {extra}
      </label>
    );
  }

  const file: ReactElement = <span className="mcp-form__scope-file">{SCOPE_FILE}</span>;

  return (
    <fieldset className="mcp-form__fieldset">
      <legend className="mcp-form__label">{SCOPE_LEGEND}</legend>
      <div className="mcp-form__scopes">
        {renderCard(
          SCOPE_USER.title,
          SCOPE_USER.note,
          USER_SOURCE_ID,
          sourceId === USER_SOURCE_ID,
          file,
        )}
        {repositories.length > 0 &&
          renderCard(
            SCOPE_REPOSITORY.title,
            SCOPE_REPOSITORY.note,
            pickedId,
            isRepository,
            <select
              className="mcp-form__repository"
              aria-label={REPOSITORY_SELECT_LABEL}
              value={isRepository ? sourceId : pickedId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setPickedId(event.target.value);
                onChange(event.target.value);
              }}
            >
              {repositories.map((source: McpSource) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>,
          )}
        {renderCard(
          SCOPE_LOCAL.title,
          SCOPE_LOCAL.note,
          LOCAL_SOURCE_ID,
          sourceId === LOCAL_SOURCE_ID,
          file,
        )}
      </div>
      {sourceId === 'workspace' && (
        <span className="mcp-form__message">{SCOPE_WORKSPACE_NOTE}</span>
      )}
    </fieldset>
  );
}
