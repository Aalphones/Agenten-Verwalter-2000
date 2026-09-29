import { useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { EffortDots } from '@/components/EffortDots';
import { Popover } from '@/components/Popover';
import { rowKey, rowText } from '@/features/chat/commandMenuRows';
import type { CommandRow, CommandSection } from '@/features/chat/commandMenuRows';
import type { Effort } from '@/lib/bindings/Effort';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './CommandMenu.css';

const EMPTY_SKILLS_HINT =
  'Keine Skills gefunden. Skills liegen in .claude\\skills deines Benutzerordners oder eines Repositorys.';

interface CommandMenuProps {
  sections: CommandSection[];
  highlighted: CommandRow | null;
  onHighlight: (row: CommandRow) => void;
  onPick: (row: CommandRow) => void;
  showFilter: boolean;
  filter: string;
  onFilterChange: (text: string) => void;
  /** ↑/↓/Enter des Filterfelds; `true`, wenn die Taste verbraucht wurde. */
  onNavigationKey: (event: KeyboardEvent<HTMLElement>) => boolean;
  onClose: () => void;
  session: SessionSummary | null;
  onEffortChange: (effort: Effort) => void;
  /** Nur Skills im Menü: dann erklärt der leere Zustand, wo Skills liegen. */
  isSkillsOnly: boolean;
  /** Wohin das Menü aufklappt; oben im Fenster (Neue Session) nach unten, damit nichts abgeschnitten wird. */
  placement?: 'above' | 'below';
}

/** Das `/`-Menü: als Knopf-Menü mit Filterfeld, als Slash-Menü ohne (das Textfeld behält den Fokus). */
export function CommandMenu({
  sections,
  highlighted,
  onHighlight,
  onPick,
  showFilter,
  filter,
  onFilterChange,
  onNavigationKey,
  onClose,
  session,
  onEffortChange,
  isSkillsOnly,
  placement = 'above',
}: CommandMenuProps): ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  const highlightedKey: string | null = highlighted === null ? null : rowKey(highlighted);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightedKey]);

  function renderRow(row: CommandRow): ReactElement {
    if (row.kind === 'effort') {
      return (
        <div key="effort" className="command-menu__effort">
          {session !== null && <EffortDots value={session.effort} onChange={onEffortChange} />}
        </div>
      );
    }
    const key: string = rowKey(row);
    const { label, description } = rowText(row, session);
    const isHighlighted: boolean = key === highlightedKey;
    return (
      <button
        key={key}
        type="button"
        className={`command-menu__row${isHighlighted ? ' command-menu__row--highlighted' : ''}`}
        aria-current={isHighlighted}
        tabIndex={showFilter ? 0 : -1}
        onMouseEnter={(): void => {
          onHighlight(row);
        }}
        onClick={(): void => {
          onPick(row);
        }}
      >
        <span
          className={`command-menu__label${row.kind === 'skill' || row.kind === 'session' ? ' command-menu__label--command' : ''}`}
        >
          {label}
        </span>
        <span className="command-menu__description">{description}</span>
        <span className="command-menu__origin">{rowOrigin(row)}</span>
      </button>
    );
  }

  function renderEmpty(): ReactElement {
    const text: string =
      isSkillsOnly && filter.trim() === '' ? EMPTY_SKILLS_HINT : `Nichts passt zu „${filter}“.`;
    return <div className="command-menu__empty">{text}</div>;
  }

  return (
    <Popover
      label="Befehle und Skills"
      placement={placement}
      align="start"
      width="anchor"
      autoFocus={showFilter}
      className="command-menu"
      onClose={onClose}
    >
      {showFilter && (
        <div className="command-menu__filter">
          <input
            type="text"
            className="command-menu__filter-input"
            aria-label="Befehle und Skills filtern"
            placeholder="Filtern …"
            value={filter}
            onChange={(event: ChangeEvent<HTMLInputElement>): void => {
              onFilterChange(event.target.value);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
              onNavigationKey(event);
            }}
          />
        </div>
      )}
      <div
        ref={listRef}
        className="command-menu__list"
        onMouseDown={(event): void => {
          // Im Slash-Menü darf ein Klick dem Textfeld den Fokus nicht nehmen.
          if (!showFilter) {
            event.preventDefault();
          }
        }}
      >
        {sections.map((section: CommandSection) => (
          <div key={section.title} className="command-menu__section">
            <div className="command-menu__title">{section.title}</div>
            {section.rows.map(renderRow)}
          </div>
        ))}
        {sections.length === 0 && renderEmpty()}
      </div>
    </Popover>
  );
}

function rowOrigin(row: CommandRow): string {
  if (row.kind === 'attach') {
    return 'Ctrl U';
  }
  if (row.kind !== 'skill') {
    return '';
  }
  return row.skill.origin.kind === 'user' ? 'Benutzer' : `aus ${row.skill.origin.name}`;
}
