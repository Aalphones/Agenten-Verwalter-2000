import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, SyntheticEvent, ReactElement } from 'react';
import { BackIcon, CheckIcon, ClockIcon, CloseIcon, WarnIcon } from '@/features/mcp/McpIcons';
import { McpPairRows } from '@/features/mcp/McpPairRows';
import { McpScopeCards } from '@/features/mcp/McpScopeCards';
import {
  draftFromFields,
  fieldErrors,
  initialFormState,
  nameError,
  originOf,
  putsSecretIntoRepository,
} from '@/features/mcp/mcpFormState';
import type {
  McpFieldErrors,
  McpFormMode,
  McpFormState,
  McpFormTarget,
} from '@/features/mcp/mcpFormState';
import {
  ADDRESS_LABEL,
  ADDRESS_NOTE,
  BACK_LABEL,
  CANCEL_LABEL,
  COMMAND_LABEL,
  COMMAND_NOTE,
  FORM_TITLE_ADD,
  FORM_TITLE_EDIT,
  JSON_LABEL,
  JSON_ONE_WHEN_EDITING,
  JSON_PLACEHOLDER,
  MODE_FIELDS,
  MODE_JSON,
  moveLeftoverText,
  NAME_NOTE,
  savedSoFarText,
  SUBMIT_ADD,
  SUBMIT_EDIT,
  TEST_LABEL,
  TEST_RUNNING,
  testSuccessText,
} from '@/features/mcp/mcpFormTexts';
import { parseMcpJson } from '@/features/mcp/parseMcpJson';
import type { McpJsonResult } from '@/features/mcp/parseMcpJson';
import { forgetRemovedName, rememberRemovedName } from '@/features/mcp/useUndoableRemoval';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpDraft } from '@/lib/bindings/McpDraft';
import type { McpProbeResult } from '@/lib/bindings/McpProbeResult';
import type { McpTransport } from '@/lib/bindings/McpTransport';
import { commandErrorText } from '@/lib/errors';
import { probeMcpServer, removeMcpServer, saveMcpServer } from '@/lib/mcp';
import './McpServerForm.css';

const FORM_ID = 'mcp-server-form';

const MODES: readonly { value: McpFormMode; label: string }[] = [
  { value: 'fields', label: MODE_FIELDS },
  { value: 'json', label: MODE_JSON },
];

const TRANSPORTS: readonly { value: McpTransport; label: string }[] = [
  { value: 'http', label: 'HTTP(S)' },
  { value: 'stdio', label: 'Programm' },
  { value: 'sse', label: 'SSE' },
];

/** Ein Testlauf; er gilt nur, solange das Formular noch den getesteten Stand zeigt. */
type TestState = { tested: McpFormState; result: McpProbeResult | null } | null;

interface McpServerFormProps {
  sessionId: string;
  titleId: string;
  /** Untertitel beim Hinzufügen; beim Bearbeiten steht dort der Servername. */
  sessionLabel: string;
  config: McpConfigView;
  target: McpFormTarget;
  onCancel: () => void;
  /** `key`: die Zeile, die in der Liste aufklappt. `leftover`: der alte Eintrag blieb stehen. */
  onSaved: (key: string, leftover: string | null) => void;
  onClose: () => void;
}

/** Hinzufügen und Bearbeiten im selben Dialog: Ziel, Felder oder JSON, Verbindung testen. */
export function McpServerForm({
  sessionId,
  titleId,
  sessionLabel,
  config,
  target,
  onCancel,
  onSaved,
  onClose,
}: McpServerFormProps): ReactElement {
  const [form, setForm] = useState<McpFormState>(() => initialFormState(target));
  // Feldfehler erscheinen erst nach dem ersten Speicherversuch.
  const [isTouched, setTouched] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [isSaving, setSaving] = useState<boolean>(false);
  const [test, setTest] = useState<TestState>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  // Beim Einfügen mehrerer Server: was schon geschrieben ist, überspringt der nächste Versuch.
  const savedRef = useRef(new Map<string, string>());

  // Der Dialog setzt den Fokus nur beim Öffnen; beim Wechsel der Ansicht ginge er verloren.
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const isEdit: boolean = target.kind === 'edit';
  const isProgram: boolean = form.transport === 'stdio';
  const errors: McpFieldErrors | null = isTouched ? fieldErrors(config, form, target) : null;
  const shownTest: TestState = test !== null && test.tested === form ? test : null;

  function update(change: Partial<McpFormState>): void {
    setForm((current: McpFormState) => ({ ...current, ...change }));
    setJsonError(null);
    setSaveFailure(null);
  }

  function runTest(): void {
    const started: Exclude<TestState, null> = { tested: form, result: null };

    // Nur der jüngste Lauf schreibt sein Ergebnis.
    function finish(result: McpProbeResult): void {
      setTest((current: TestState) => (current === started ? { tested: form, result } : current));
    }

    setTest(started);
    probeMcpServer(sessionId, draftFromFields(form, target))
      .then(finish)
      .catch((reason: unknown) => {
        finish({ tools: [], instructions: null, error: commandErrorText(reason) });
      });
  }

  /** Schreibt einen Entwurf und entfernt beim Verschieben den alten Eintrag; liefert den Satz,
   *  falls der stehen blieb. */
  async function persist(draft: McpDraft): Promise<string | null> {
    const renamedFrom: string | null =
      draft.originalName === draft.name ? null : draft.originalName;
    // Vor dem Schreiben: `mcp://changed` kommt an, bevor der Befehl zurückkehrt.
    if (renamedFrom !== null) {
      rememberRemovedName(renamedFrom);
    }
    try {
      await saveMcpServer(sessionId, draft);
    } catch (reason: unknown) {
      if (renamedFrom !== null) {
        forgetRemovedName(renamedFrom);
      }
      throw reason;
    }
    if (draft.originalSourceId === null || draft.originalName === null) {
      return null;
    }
    try {
      await removeMcpServer(sessionId, draft.originalSourceId, draft.originalName);
    } catch (reason: unknown) {
      console.error('Alten MCP-Eintrag nicht entfernt', reason);
      return moveLeftoverText(draft.name, commandErrorText(reason));
    }
    return null;
  }

  async function saveAll(drafts: readonly McpDraft[], namesInFailure: boolean): Promise<void> {
    let leftover: string | null = null;
    setSaving(true);
    setSaveFailure(null);
    for (const draft of drafts) {
      const key = `${draft.sourceId}/${draft.name}`;
      if (savedRef.current.has(key)) {
        continue;
      }
      try {
        leftover = (await persist(draft)) ?? leftover;
        savedRef.current.set(key, draft.name);
      } catch (reason: unknown) {
        const prefix: string = namesInFailure ? `„${draft.name}“: ` : '';
        const saved: string[] = [...savedRef.current.values()];
        const suffix: string = saved.length > 0 ? savedSoFarText(saved) : '';
        setSaveFailure(`${prefix}${commandErrorText(reason)}${suffix}`);
        setSaving(false);
        return;
      }
    }
    const first: McpDraft | undefined = drafts[0];
    if (first !== undefined) {
      onSaved(`${first.sourceId}/${first.name}`, leftover);
    }
  }

  function submitFields(): void {
    setTouched(true);
    const found: McpFieldErrors = fieldErrors(config, form, target);
    if (found.name !== null || found.connection !== null || found.pairs !== null) {
      return;
    }
    void saveAll([draftFromFields(form, target)], false);
  }

  function submitJson(): void {
    const parsed: McpJsonResult = parseMcpJson(form.json, form.sourceId);
    if ('error' in parsed) {
      setJsonError(parsed.error);
      return;
    }
    if (isEdit && parsed.drafts.length !== 1) {
      setJsonError(JSON_ONE_WHEN_EDITING);
      return;
    }
    // Alle Namen vorab, damit nicht erst die Hälfte geschrieben ist.
    for (const draft of parsed.drafts) {
      if (savedRef.current.has(`${draft.sourceId}/${draft.name}`)) {
        continue;
      }
      const problem: string | null = nameError(config, target, form.sourceId, draft.name);
      if (problem !== null) {
        setJsonError(`„${draft.name}“: ${problem}`);
        return;
      }
    }
    const drafts: McpDraft[] = parsed.drafts.map((draft: McpDraft) => ({
      ...draft,
      ...originOf(target, form.sourceId),
    }));
    void saveAll(drafts, true);
  }

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    if (form.mode === 'json') {
      submitJson();
    } else {
      submitFields();
    }
  }

  function renderSegments<Value extends string>(
    label: string,
    options: readonly { value: Value; label: string }[],
    selected: string,
    onSelect: (value: Value) => void,
  ): ReactElement {
    return (
      <div className="mcp-form__segments" role="group" aria-label={label}>
        {options.map((option: { value: Value; label: string }) => (
          <button
            key={option.value}
            type="button"
            className="mcp-form__segment"
            aria-pressed={option.value === selected}
            onClick={() => {
              onSelect(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  function renderTextField(
    id: string,
    label: string,
    value: string,
    placeholder: string,
    note: string,
    error: string | null,
    onValue: (value: string) => void,
  ): ReactElement {
    const messageId = `${id}-message`;
    return (
      <div className="mcp-form__field">
        <label className="mcp-form__label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          type="text"
          className="mcp-form__input mcp-form__input--mono"
          aria-invalid={error !== null}
          aria-describedby={messageId}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onValue(event.target.value);
          }}
        />
        <span
          id={messageId}
          className={`mcp-form__message${error === null ? '' : ' mcp-form__message--error'}`}
        >
          {error ?? note}
        </span>
      </div>
    );
  }

  function renderJson(): ReactElement {
    return (
      <div className="mcp-form__field">
        <label className="mcp-form__label" htmlFor="mcp-form-json">
          {JSON_LABEL}
        </label>
        <textarea
          id="mcp-form-json"
          className="mcp-form__input mcp-form__json"
          aria-invalid={jsonError !== null}
          aria-describedby="mcp-form-json-message"
          placeholder={JSON_PLACEHOLDER}
          spellCheck={false}
          value={form.json}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            update({ json: event.target.value });
          }}
        />
        {jsonError !== null && (
          <span
            id="mcp-form-json-message"
            className="mcp-form__message mcp-form__message--error"
            role="alert"
          >
            {jsonError}
          </span>
        )}
        {jsonError === null && (
          <span id="mcp-form-json-message" className="mcp-form__message">
            Format wie in <span className="mcp-form__mono">.mcp.json</span> oder Claude Desktop;
            mehrere Server auf einmal gehen.
          </span>
        )}
      </div>
    );
  }

  function renderFields(): ReactElement {
    return (
      <>
        <div className="mcp-form__columns">
          {renderTextField(
            'mcp-form-name',
            'Name',
            form.name,
            'z. B. jira',
            NAME_NOTE,
            errors?.name ?? null,
            (name: string) => {
              update({ name });
            },
          )}
          <div className="mcp-form__field">
            <span className="mcp-form__label">Art</span>
            {renderSegments('Art', TRANSPORTS, form.transport, (transport: McpTransport) => {
              update({ transport });
            })}
          </div>
        </div>
        {isProgram &&
          renderTextField(
            'mcp-form-command',
            COMMAND_LABEL,
            form.commandLine,
            'npx -y @modelcontextprotocol/server-github',
            COMMAND_NOTE,
            errors?.connection ?? null,
            (commandLine: string) => {
              update({ commandLine });
            },
          )}
        {!isProgram &&
          renderTextField(
            'mcp-form-url',
            ADDRESS_LABEL,
            form.url,
            'https://example.com/mcp',
            ADDRESS_NOTE,
            errors?.connection ?? null,
            (url: string) => {
              update({ url });
            },
          )}
        <McpPairRows
          rows={form.rows}
          transport={form.transport}
          target={target}
          error={errors?.pairs ?? null}
          onChange={(rows) => {
            update({ rows });
          }}
        />
        {putsSecretIntoRepository(config, form, target) && (
          <p className="mcp-form__warning" role="alert">
            <WarnIcon />
            <span>
              <strong>Geheimnis landet im Repo.</strong>{' '}
              <span className="mcp-form__mono">.mcp.json</span> wird mit dem Team geteilt. Als{' '}
              <span className="mcp-form__mono">{'${VARIABLE}'}</span> verweisen oder „Nur ich, im
              Vorhaben“ wählen.
            </span>
          </p>
        )}
      </>
    );
  }

  function renderTestResult(): ReactElement | null {
    if (shownTest === null || form.mode === 'json') {
      return null;
    }
    if (shownTest.result === null) {
      return (
        <span className="mcp-form__test mcp-form__test--running" role="status">
          <ClockIcon />
          {TEST_RUNNING}
        </span>
      );
    }
    if (shownTest.result.error === null) {
      return (
        <span className="mcp-form__test mcp-form__test--ok" role="status">
          <CheckIcon />
          {testSuccessText(shownTest.result.tools.length)}
        </span>
      );
    }
    return (
      <span className="mcp-form__test mcp-form__test--failed" role="status">
        <WarnIcon />
        <span className="mcp-form__test-error">{shownTest.result.error}</span>
      </span>
    );
  }

  return (
    <>
      <div className="mcp-dialog__head">
        <button
          ref={backRef}
          type="button"
          className="mcp-dialog__close"
          aria-label={BACK_LABEL}
          title={BACK_LABEL}
          onClick={onCancel}
        >
          <BackIcon />
        </button>
        <div className="mcp-dialog__heading">
          <h2 id={titleId} className="mcp-dialog__title">
            {isEdit ? FORM_TITLE_EDIT : FORM_TITLE_ADD}
          </h2>
          <span className="mcp-dialog__subtitle">
            {target.kind === 'edit' ? target.entry.name : sessionLabel}
          </span>
        </div>
        <button
          type="button"
          className="mcp-dialog__close"
          aria-label="Schließen"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <form id={FORM_ID} className="mcp-form" noValidate onSubmit={submit}>
        <McpScopeCards
          sources={config.sources}
          sourceId={form.sourceId}
          onChange={(sourceId: string) => {
            update({ sourceId });
          }}
        />
        {renderSegments('Eingabeart', MODES, form.mode, (mode: McpFormMode) => {
          update({ mode });
        })}
        {form.mode === 'json' ? renderJson() : renderFields()}
      </form>
      {saveFailure !== null && (
        <p className="mcp-form__failure" role="alert">
          {saveFailure}
        </p>
      )}
      <div className="mcp-form__foot">
        <button
          type="button"
          className="mcp-dialog__button"
          disabled={form.mode === 'json' || shownTest?.result === null}
          onClick={runTest}
        >
          {TEST_LABEL}
        </button>
        {renderTestResult()}
        <span className="mcp-form__foot-end">
          <button type="button" className="mcp-dialog__button mcp-form__cancel" onClick={onCancel}>
            {CANCEL_LABEL}
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="mcp-dialog__button mcp-dialog__button--primary"
            disabled={isSaving}
          >
            {isEdit ? SUBMIT_EDIT : SUBMIT_ADD}
          </button>
        </span>
      </div>
    </>
  );
}
