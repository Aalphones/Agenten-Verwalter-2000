import type { ChangeEvent, ReactElement } from 'react';
import { TrashIcon } from '@/features/mcp/McpIcons';
import { emptyRow, keepsHiddenValue } from '@/features/mcp/mcpFormState';
import type { McpFormTarget, McpPairRow } from '@/features/mcp/mcpFormState';
import {
  ADD_ROW_LABEL,
  HIDDEN_VALUE_PLACEHOLDER,
  VALUE_PLACEHOLDER,
} from '@/features/mcp/mcpFormTexts';
import type { McpTransport } from '@/lib/bindings/McpTransport';

interface McpPairRowsProps {
  rows: readonly McpPairRow[];
  transport: McpTransport;
  target: McpFormTarget;
  error: string | null;
  onChange: (rows: McpPairRow[]) => void;
}

/** Header bzw. Umgebungsvariablen als Zeilen Schlüssel · Wert · „geheim“ · Entfernen. */
export function McpPairRows({
  rows,
  transport,
  target,
  error,
  onChange,
}: McpPairRowsProps): ReactElement {
  const isProgram: boolean = transport === 'stdio';
  const title: string = isProgram ? 'Umgebungsvariablen' : 'Header';

  function patch(id: number, change: Partial<McpPairRow>): void {
    onChange(rows.map((row: McpPairRow) => (row.id === id ? { ...row, ...change } : row)));
  }

  function nextId(): number {
    return Math.max(0, ...rows.map((row: McpPairRow) => row.id)) + 1;
  }

  /** Die letzte Zeile wird beim Entfernen durch eine leere ersetzt. */
  function removeRow(id: number): void {
    const remaining: McpPairRow[] = rows.filter((row: McpPairRow) => row.id !== id);
    onChange(remaining.length > 0 ? remaining : [emptyRow(nextId())]);
  }

  return (
    <fieldset className="mcp-form__fieldset">
      <legend className="mcp-form__label">{title}</legend>
      {rows.map((row: McpPairRow, index: number) => {
        const position = String(index + 1);
        const isBlank: boolean = rows.length === 1 && row.key === '' && row.value === '';
        return (
          <div key={row.id} className="mcp-form__pair">
            <input
              type="text"
              className="mcp-form__input mcp-form__input--mono mcp-form__pair-key"
              aria-label={`Schlüssel ${position}`}
              placeholder={isProgram ? 'NAME' : 'Authorization'}
              autoComplete="off"
              spellCheck={false}
              value={row.key}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                patch(row.id, { key: event.target.value });
              }}
            />
            <input
              type={row.isSecret ? 'password' : 'text'}
              className="mcp-form__input mcp-form__input--mono mcp-form__pair-value"
              aria-label={`Wert ${position}`}
              placeholder={
                keepsHiddenValue(row, transport, target)
                  ? HIDDEN_VALUE_PLACEHOLDER
                  : VALUE_PLACEHOLDER
              }
              autoComplete="new-password"
              spellCheck={false}
              value={row.value}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                patch(row.id, { value: event.target.value });
              }}
            />
            <label className="mcp-form__pair-secret">
              <input
                type="checkbox"
                checked={row.isSecret}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  patch(row.id, { isSecret: event.target.checked });
                }}
              />
              geheim
            </label>
            <button
              type="button"
              className="mcp-form__icon mcp-form__icon--danger mcp-form__pair-remove"
              aria-label={`Zeile ${position} entfernen`}
              disabled={isBlank}
              onClick={() => {
                removeRow(row.id);
              }}
            >
              <TrashIcon />
            </button>
          </div>
        );
      })}
      {error !== null && (
        <span className="mcp-form__message mcp-form__message--error" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        className="mcp-dialog__link mcp-form__add-row"
        onClick={() => {
          onChange([...rows, emptyRow(nextId())]);
        }}
      >
        {ADD_ROW_LABEL}
      </button>
    </fieldset>
  );
}
