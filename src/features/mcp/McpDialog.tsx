import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { ExternalLink } from '@/components/ExternalLink';
import { McpGroupPlace } from '@/features/mcp/McpGroupPlace';
import { ClockIcon, CloseIcon, GroupIcon, PlusIcon, SearchIcon } from '@/features/mcp/McpIcons';
import { McpServerForm } from '@/features/mcp/McpServerForm';
import { McpServerRow } from '@/features/mcp/McpServerRow';
import { defaultSourceId, LOCAL_SOURCE_ID } from '@/features/mcp/mcpFormState';
import type { McpFormTarget } from '@/features/mcp/mcpFormState';
import {
  actionErrorText,
  ADD_LONG_SUFFIX,
  ADD_SHORT_LABEL,
  AGENT_NEW_TEXT,
  AGENT_RESTING_TEXT,
  AGENT_RUNNING_TEXT,
  authWaitText,
  CONFIG_CHANGED_HINT,
  filterGroups,
  FOOT_NOTE,
  LOADING_TEXT,
  LOCAL_ADD_LABEL,
  LOCAL_EMPTY_TEXT,
  mergeServers,
  NO_SERVERS_TEXT,
  NO_SERVERS_TITLE,
  NO_SERVERS_JSON_HINT,
  OFFLINE_HINT,
  offlineSummaryText,
  RECONNECT_LABEL,
  REOPEN_LABEL,
  rowStatus,
  summaryText,
  switchPosition,
} from '@/features/mcp/mcpTexts';
import type { McpRow, McpRowGroup, McpSwitchPosition } from '@/features/mcp/mcpTexts';
import { McpUndoRow } from '@/features/mcp/McpUndoRow';
import { useSessionMcp } from '@/features/mcp/useSessionMcp';
import { useUndoableRemoval } from '@/features/mcp/useUndoableRemoval';
import type { McpAuthWait } from '@/lib/bindings/McpAuthWait';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpServer } from '@/lib/bindings/McpServer';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { authenticateMcpServer, reconnectMcpServer, toggleMcpServer } from '@/lib/mcp';
import './McpDialog.css';

const TITLE_ID = 'mcp-dialog-title';
const SKELETON_ROWS: readonly number[] = [0, 1, 2, 3, 4];

interface McpDialogProps {
  session: SessionSummary;
  onClose: () => void;
}

/** Dialog „MCP-Server“: die Server der Session nach Ablageort, auch ohne Agenten; Schalten,
 *  Hinzufügen und Bearbeiten, Entfernen mit Rückgängig, Anmelden und Neu verbinden. */
export function McpDialog({ session, onClose }: McpDialogProps): ReactElement {
  const [filter, setFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Ein abgelehnter Command (die Aktion kam gar nicht an); Fehler der Aktion beim Agenten stehen in `mcp.error`.
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  // Gesetzt: das Formular ersetzt die Liste.
  const [formTarget, setFormTarget] = useState<McpFormTarget | null>(null);
  // Die gerade gespeicherte Zeile rückt ins Bild und bekommt den Fokus.
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const shouldFocusCloseRef = useRef<boolean>(false);
  const { mcp, config, configFailure, reloadConfig } = useSessionMcp(session.id, true);
  const removal = useUndoableRemoval(reloadConfig, setActionFailure);

  const sessionLabel = `Session #${String(session.number)} ${session.name}`;

  useEffect(() => {
    if (formTarget === null && shouldFocusCloseRef.current) {
      shouldFocusCloseRef.current = false;
      closeRef.current?.focus();
    }
  }, [formTarget]);

  const isAgentRunning: boolean = mcp?.isAgentRunning ?? false;
  const live: McpServer[] | null = isAgentRunning ? (mcp?.servers ?? null) : null;
  const groups: McpRowGroup[] =
    config === null ? [] : mergeServers(config, live, removal.removedNames);
  // Ohne die offene und die gerade geschriebene Entfernung: so zählen Köpfe und Fußzeile.
  const rows: McpRow[] = groups
    .flatMap((group: McpRowGroup) => group.rows)
    .filter((row: McpRow) => !isRemoved(row.key));
  const hasNothing: boolean =
    rows.length === 0 &&
    removal.pendingKey === null &&
    groups.every((group: McpRowGroup) => group.error === null);

  function isRemoved(key: string): boolean {
    return removal.pendingKey === key || removal.committingKeys.has(key);
  }

  function run(action: Promise<boolean>): void {
    // Die Antwort kommt als `mcp://changed`; hier gibt es nichts abzuwarten.
    setActionFailure(null);
    action.catch((reason: unknown) => {
      setActionFailure(commandErrorText(reason));
    });
  }

  function reconnect(name: string): void {
    run(reconnectMcpServer(session.id, name));
  }

  function authenticate(name: string): void {
    // Die Anmeldeseite öffnet der Core, sobald die Antwort da ist.
    run(authenticateMcpServer(session.id, name));
  }

  function setPosition(name: string, position: McpSwitchPosition): void {
    run(toggleMcpServer(session.id, name, position === 'on', position === 'all'));
  }

  function removeRow(row: McpRow): void {
    if (row.sourceId === null) {
      return;
    }
    if (expanded === row.key) {
      setExpanded(null);
    }
    removal.remove({
      key: row.key,
      sessionId: session.id,
      sourceId: row.sourceId,
      name: row.name,
    });
  }

  function openForm(target: McpFormTarget): void {
    // Die Rückgängig-Zeile wäre im Formular unsichtbar, und Strg+Z gehört dort den Feldern.
    removal.flush();
    setActionFailure(null);
    setRevealKey(null);
    setFormTarget(target);
  }

  function addServer(sourceId: string): void {
    openForm({ kind: 'add', sourceId });
  }

  function editRow(row: McpRow): void {
    if (row.sourceId !== null && row.entry !== null) {
      openForm({ kind: 'edit', sourceId: row.sourceId, entry: row.entry });
    }
  }

  function leaveForm(): void {
    shouldFocusCloseRef.current = true;
    setFormTarget(null);
  }

  function showSaved(key: string, leftover: string | null): void {
    void reloadConfig().then(() => {
      setFilter('');
      setExpanded(key);
      setRevealKey(key);
      setActionFailure(leftover);
      setFormTarget(null);
    });
  }

  function toggleExpanded(key: string): void {
    if (expanded === key) {
      setExpanded(null);
    } else {
      setExpanded(key);
    }
  }

  function agentText(): string {
    if (isAgentRunning) {
      return AGENT_RUNNING_TEXT;
    }
    if (session.status === 'new') {
      return AGENT_NEW_TEXT;
    }
    return AGENT_RESTING_TEXT;
  }

  function failureText(): string | null {
    if (actionFailure !== null) {
      return actionFailure;
    }
    if (mcp !== null && mcp.error !== null) {
      return actionErrorText(mcp.error);
    }
    return configFailure;
  }

  function renderBody(): ReactElement {
    if (config === null) {
      return renderLoading();
    }
    if (hasNothing) {
      return renderNoServers(config);
    }
    return renderList(config);
  }

  function renderLoading(): ReactElement {
    if (configFailure !== null) {
      return (
        <p className="mcp-dialog__error" role="alert">
          {configFailure}
        </p>
      );
    }
    return (
      <div className="mcp-dialog__list" aria-hidden="true">
        {SKELETON_ROWS.map((index: number) => (
          <div key={index} className="mcp-dialog__skeleton" />
        ))}
      </div>
    );
  }

  function renderNoServers(loadedConfig: McpConfigView): ReactElement {
    return (
      <div className="mcp-dialog__empty">
        <h3 className="mcp-dialog__empty-title">{NO_SERVERS_TITLE}</h3>
        <span>{NO_SERVERS_TEXT}</span>
        {renderAddButton(loadedConfig, '')}
        <span className="mcp-dialog__empty-note">{NO_SERVERS_JSON_HINT}</span>
      </div>
    );
  }

  /** `suffixClass`: in der Werkzeugzeile fällt „hinzufügen“ auf schmaler Breite weg. */
  function renderAddButton(loadedConfig: McpConfigView, suffixClass: string): ReactElement {
    return (
      <button
        type="button"
        className="mcp-dialog__button mcp-dialog__button--primary"
        onClick={() => {
          addServer(defaultSourceId(loadedConfig));
        }}
      >
        <PlusIcon />
        <span>
          {ADD_SHORT_LABEL} <span className={suffixClass}>{ADD_LONG_SUFFIX}</span>
        </span>
      </button>
    );
  }

  function renderList(loadedConfig: McpConfigView): ReactElement {
    const shown: McpRowGroup[] = filterGroups(
      groups,
      filter,
      removal.committingKeys,
      removal.pendingKey,
    );
    const failure: string | null = failureText();
    return (
      <>
        <div className="mcp-dialog__tools">
          <label className="mcp-dialog__search">
            <span className="mcp-dialog__search-icon">
              <SearchIcon />
            </span>
            <span className="mcp-dialog__search-text">Server filtern</span>
            <input
              type="text"
              className="mcp-dialog__search-input"
              placeholder="Server filtern …"
              value={filter}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setFilter(event.target.value);
              }}
            />
          </label>
          {renderAddButton(loadedConfig, 'mcp-dialog__add-long')}
        </div>
        {isAgentRunning && loadedConfig.configChanged && renderHint(CONFIG_CHANGED_HINT, 'wait')}
        {mcp !== null && !isAgentRunning && renderHint(OFFLINE_HINT, 'quiet')}
        {mcp !== null && mcp.auth !== null && renderAuthWait(mcp.auth, mcp.busy)}
        {failure !== null && (
          <p className="mcp-dialog__error" role="alert">
            {failure}
          </p>
        )}
        <div className="mcp-dialog__list">
          {shown.map((group: McpRowGroup) => renderGroup(loadedConfig, group))}
          {shown.length === 0 && (
            <p className="mcp-dialog__no-match">Kein Server passt zu „{filter.trim()}“.</p>
          )}
        </div>
      </>
    );
  }

  function renderHint(text: string, tone: 'wait' | 'quiet'): ReactElement {
    return (
      <p className={`mcp-dialog__hint mcp-dialog__hint--${tone}`} role="status">
        <ClockIcon />
        <span>{text}</span>
      </p>
    );
  }

  function renderAuthWait(auth: McpAuthWait, busy: readonly string[]): ReactElement {
    return (
      <div className="mcp-dialog__auth" role="status">
        <p className="mcp-dialog__auth-text">{authWaitText(auth)}</p>
        {!auth.callbackExpected && (
          <button
            type="button"
            className="mcp-dialog__button mcp-dialog__button--small"
            disabled={!isAgentRunning || busy.includes(auth.server)}
            onClick={() => {
              reconnect(auth.server);
            }}
          >
            {RECONNECT_LABEL}
          </button>
        )}
        <span className="mcp-dialog__auth-reopen">
          <ExternalLink href={auth.url}>{REOPEN_LABEL}</ExternalLink>
        </span>
      </div>
    );
  }

  function renderGroup(loadedConfig: McpConfigView, group: McpRowGroup): ReactElement {
    const count: number = group.rows.filter((row: McpRow) => !isRemoved(row.key)).length;
    return (
      <section key={group.id} className="mcp-dialog__group">
        <div className="mcp-dialog__group-head">
          <h3 className="mcp-dialog__group-name">
            <GroupIcon kind={group.kind} />
            {group.title}
          </h3>
          {count > 0 && <span className="mcp-dialog__group-count">{count}</span>}
          <span className="mcp-dialog__group-where">
            <McpGroupPlace where={group.where} />
          </span>
        </div>
        {group.error !== null && (
          <p className="mcp-dialog__group-error" role="alert">
            {group.error}
          </p>
        )}
        {group.rows.length > 0 && (
          <ul className="mcp-dialog__servers">
            {group.rows.map((row: McpRow) => renderRow(loadedConfig, group, row))}
          </ul>
        )}
        {group.rows.length === 0 && group.error === null && renderLocalEmpty()}
      </section>
    );
  }

  function renderLocalEmpty(): ReactElement {
    return (
      <div className="mcp-dialog__group-empty">
        {LOCAL_EMPTY_TEXT}
        <button
          type="button"
          className="mcp-dialog__link"
          onClick={() => {
            addServer(LOCAL_SOURCE_ID);
          }}
        >
          {LOCAL_ADD_LABEL}
        </button>
      </div>
    );
  }

  function renderRow(loadedConfig: McpConfigView, group: McpRowGroup, row: McpRow): ReactElement {
    if (removal.pendingKey === row.key) {
      return <McpUndoRow key={row.key} row={row} group={group} onUndo={removal.undo} />;
    }
    const position: McpSwitchPosition = switchPosition(row, loadedConfig.disabledEverywhere);
    return (
      <McpServerRow
        key={row.key}
        sessionId={session.id}
        row={row}
        group={group}
        shouldReveal={revealKey === row.key}
        onRevealed={() => {
          setRevealKey(null);
        }}
        onEdit={() => {
          editRow(row);
        }}
        position={position}
        status={rowStatus(row, position, isAgentRunning, live !== null)}
        isExpanded={expanded === row.key}
        isBusy={mcp?.busy.includes(row.name) ?? false}
        isAgentRunning={isAgentRunning}
        isAgentLoading={isAgentRunning && live === null}
        onToggleExpanded={() => {
          toggleExpanded(row.key);
        }}
        onReconnect={() => {
          reconnect(row.name);
        }}
        onAuthenticate={() => {
          authenticate(row.name);
        }}
        onSwitch={(next: McpSwitchPosition) => {
          setPosition(row.name, next);
        }}
        onRemove={() => {
          removeRow(row);
        }}
      />
    );
  }

  function footSummary(loadedConfig: McpConfigView): string {
    if (live !== null) {
      return summaryText(live);
    }
    const enabled: number = rows.filter(
      (row: McpRow) => switchPosition(row, loadedConfig.disabledEverywhere) === 'on',
    ).length;
    return offlineSummaryText(rows.length, enabled);
  }

  function renderFootText(): ReactElement {
    if (config === null) {
      return (
        <span className="mcp-dialog__foot-text">{configFailure === null && LOADING_TEXT}</span>
      );
    }
    if (hasNothing) {
      return <span className="mcp-dialog__foot-text" />;
    }
    return (
      <span className="mcp-dialog__foot-text">
        <span>{footSummary(config)}</span>
        <span>{FOOT_NOTE}</span>
      </span>
    );
  }

  function renderView(): ReactElement {
    if (formTarget !== null && config !== null) {
      return (
        <McpServerForm
          sessionId={session.id}
          titleId={TITLE_ID}
          sessionLabel={sessionLabel}
          config={config}
          target={formTarget}
          onCancel={leaveForm}
          onSaved={showSaved}
          onClose={onClose}
        />
      );
    }
    return renderListView();
  }

  function renderListView(): ReactElement {
    return (
      <>
        <div className="mcp-dialog__head">
          <div className="mcp-dialog__heading">
            <h2 id={TITLE_ID} className="mcp-dialog__title">
              MCP-Server
            </h2>
            <span className="mcp-dialog__subtitle">{sessionLabel}</span>
            {mcp !== null && (
              <span className="mcp-dialog__agent">
                <span
                  className={`mcp-dialog__agent-dot${isAgentRunning ? ' mcp-dialog__agent-dot--running' : ''}`}
                />
                {agentText()}
              </span>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="mcp-dialog__close"
            aria-label="Schließen"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {renderBody()}
        <div className="mcp-dialog__foot">
          {renderFootText()}
          <button type="button" className="mcp-dialog__button" onClick={onClose}>
            Schließen
          </button>
        </div>
      </>
    );
  }

  return (
    <Dialog
      labelledBy={TITLE_ID}
      className="mcp-dialog"
      onClose={onClose}
      {...(formTarget === null ? {} : { onEscape: leaveForm })}
    >
      {renderView()}
    </Dialog>
  );
}
