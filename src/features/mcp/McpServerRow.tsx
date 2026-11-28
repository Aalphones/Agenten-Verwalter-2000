import type { ReactElement } from 'react';
import { ChevronIcon, EditIcon, LockIcon, ReconnectIcon, TrashIcon } from '@/features/mcp/McpIcons';
import { McpServerDetails } from '@/features/mcp/McpServerDetails';
import { McpStateSwitch } from '@/features/mcp/McpStateSwitch';
import {
  EDIT_LABEL,
  FIXED_LABEL,
  fixedOrigin,
  LOGIN_LABEL,
  LOGIN_TITLE,
  RECONNECT_LABEL,
  RECONNECT_TITLE_DISABLED,
  REMOVE_LABEL,
  rowMeta,
  rowStatusText,
} from '@/features/mcp/mcpTexts';
import type { McpRow, McpRowGroup, McpRowStatus, McpSwitchPosition } from '@/features/mcp/mcpTexts';
import './McpServerRow.css';

interface McpServerRowProps {
  row: McpRow;
  group: McpRowGroup;
  position: McpSwitchPosition;
  status: McpRowStatus;
  isExpanded: boolean;
  /** Für den Server läuft gerade eine Aktion; Neu verbinden und Schalter sind dann gesperrt. */
  isBusy: boolean;
  isAgentRunning: boolean;
  /** Der Agent läuft, hat aber noch keine Liste gemeldet; geschaltet wird erst danach. */
  isAgentLoading: boolean;
  onToggleExpanded: () => void;
  onReconnect: () => void;
  onAuthenticate: () => void;
  onSwitch: (position: McpSwitchPosition) => void;
  onRemove: () => void;
}

export function McpServerRow({
  row,
  group,
  position,
  status,
  isExpanded,
  isBusy,
  isAgentRunning,
  isAgentLoading,
  onToggleExpanded,
  onReconnect,
  onAuthenticate,
  onSwitch,
  onRemove,
}: McpServerRowProps): ReactElement {
  const canReconnect: boolean = isAgentRunning && row.live !== null && position === 'on' && !isBusy;
  const classNames: string = [
    'mcp-server',
    isExpanded ? 'mcp-server--expanded' : '',
    position === 'on' ? '' : 'mcp-server--off',
    status === 'fresh' ? 'mcp-server--fresh' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const statusWord: string = rowStatusText(status);

  function renderEditActions(): ReactElement {
    if (row.entry === null) {
      return (
        <span
          className="mcp-server__lock"
          title={row.live === null ? undefined : fixedOrigin(row.live.scope)}
        >
          <LockIcon />
          <span>{FIXED_LABEL}</span>
        </span>
      );
    }
    return (
      <>
        {/* Das Formular dazu gibt es noch nicht. */}
        <button
          type="button"
          className="mcp-server__action"
          aria-label={`${row.name} bearbeiten`}
          title={EDIT_LABEL}
          disabled
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="mcp-server__action mcp-server__action--danger"
          aria-label={`${row.name} entfernen`}
          title={REMOVE_LABEL}
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </>
    );
  }

  return (
    <li className={classNames}>
      <div className="mcp-server__head">
        <button
          type="button"
          className="mcp-server__toggle"
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          <span className="mcp-server__chevron">
            <ChevronIcon />
          </span>
          <span className={`mcp-server__dot mcp-server__dot--${status}`} />
          <span className="mcp-server__text">
            <span className="mcp-server__name">{row.name}</span>
            <span className="mcp-server__sub">
              <span className={`mcp-server__sub-status mcp-server__tone--${status}`}>
                {statusWord} ·{' '}
              </span>
              {rowMeta(row, status)}
            </span>
          </span>
        </button>
        <span className={`mcp-server__status mcp-server__tone--${status}`} title={statusWord}>
          {statusWord}
        </span>
        <span className="mcp-server__actions">
          {status === 'needsAuth' && (
            <button
              type="button"
              className="mcp-server__login"
              title={LOGIN_TITLE}
              disabled={isBusy}
              onClick={onAuthenticate}
            >
              {LOGIN_LABEL}
            </button>
          )}
          <button
            type="button"
            className="mcp-server__action"
            aria-label={`${row.name} neu verbinden`}
            title={canReconnect || isBusy ? RECONNECT_LABEL : RECONNECT_TITLE_DISABLED}
            disabled={!canReconnect}
            onClick={onReconnect}
          >
            <ReconnectIcon isSpinning={isBusy} />
          </button>
          {renderEditActions()}
        </span>
        <span className="mcp-server__switch">
          <McpStateSwitch
            server={row.name}
            position={position}
            isDisabled={isBusy || isAgentLoading}
            onChange={onSwitch}
          />
        </span>
      </div>
      {isExpanded && (
        <McpServerDetails row={row} group={group} position={position} status={status} />
      )}
    </li>
  );
}
