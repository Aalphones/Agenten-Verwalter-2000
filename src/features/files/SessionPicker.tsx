import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { fileCountLabel, formatCount } from '@/features/changes/changesScope';
import './SessionPicker.css';

export interface PickerSession {
  id: string;
  number: number;
  name: string;
  /** Dateien ihrer Commits laut Verlauf; `null`, solange der Verlauf nicht gelesen ist. */
  fileCount: number | null;
}

interface SessionPickerProps {
  /** Jüngste zuerst. */
  sessions: readonly PickerSession[];
  selectedId: string | null;
  onSelect: (sessionId: string | null) => void;
  onClose: () => void;
}

interface Option {
  id: string | null;
  label: string;
  number: number | null;
  detail: string;
}

/** Aufklapper „Ganzes Vorhaben · Session #n“ mit Suchfeld; Pfeiltasten wählen, Enter übernimmt, Esc schließt. */
export function SessionPicker({
  sessions,
  selectedId,
  onSelect,
  onClose,
}: SessionPickerProps): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      const target: EventTarget | null = event.target;
      if (target instanceof Node && rootRef.current?.contains(target) !== true) {
        onClose();
      }
    }
    // Erst nach dem Klick, der den Aufklapper geöffnet hat.
    const timer: number = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);
    return (): void => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  const needle: string = query.trim().toLowerCase();
  const options: Option[] = [
    {
      id: null,
      label: 'Ganzes Vorhaben',
      number: null,
      detail: sessions.length === 1 ? '1 Session' : `${formatCount(sessions.length)} Sessions`,
    },
    ...sessions
      .filter(
        (session: PickerSession) =>
          needle === '' ||
          `#${String(session.number)} ${session.name}`.toLowerCase().includes(needle),
      )
      .map((session: PickerSession): Option => ({
        id: session.id,
        label: session.name,
        number: session.number,
        detail: session.fileCount === null ? '' : fileCountLabel(session.fileCount),
      })),
  ];
  const active: number = Math.min(activeIndex, options.length - 1);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(Math.min(options.length - 1, active + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(0, active - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option: Option | undefined = options[active];
      if (option !== undefined) {
        onSelect(option.id);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div ref={rootRef} className="session-picker">
      <input
        className="session-picker__search"
        type="text"
        placeholder="Session suchen"
        aria-label="Session suchen"
        aria-controls="session-picker-list"
        aria-activedescendant={`session-picker-option-${String(active)}`}
        autoComplete="off"
        spellCheck={false}
        // Der Aufklapper öffnet auf Klick und soll sofort tippbar sein.
        autoFocus
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      <div
        id="session-picker-list"
        className="session-picker__list"
        role="listbox"
        aria-label="Sessions"
      >
        {options.map((option: Option, index: number) => (
          <div
            key={option.id ?? 'all'}
            id={`session-picker-option-${String(index)}`}
            role="option"
            tabIndex={-1}
            aria-selected={option.id === selectedId}
            className={`session-picker__option${option.id === selectedId ? ' session-picker__option--selected' : ''}${
              index === active ? ' session-picker__option--active' : ''
            }`}
            title={
              option.number === null ? option.label : `#${String(option.number)} ${option.label}`
            }
            onClick={(): void => {
              onSelect(option.id);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(option.id);
              }
            }}
            onPointerEnter={(): void => {
              setActiveIndex(index);
            }}
          >
            {option.number !== null && (
              <span className="session-picker__number">#{option.number}</span>
            )}
            <span className="session-picker__label">{option.label}</span>
            <span className="session-picker__detail">{option.detail}</span>
          </div>
        ))}
        {options.length === 1 && needle !== '' && (
          <p className="session-picker__empty">Keine Session passt zur Suche.</p>
        )}
      </div>
    </div>
  );
}
