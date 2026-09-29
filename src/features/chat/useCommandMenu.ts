import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  buildCommandSections,
  moveHighlight,
  pickableRows,
  rowKey,
} from '@/features/chat/commandMenuRows';
import type { CommandRow, CommandScope, CommandSection } from '@/features/chat/commandMenuRows';
import { useSkills } from '@/features/skills/useSkills';
import type { SkillSource } from '@/features/skills/useSkills';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

const SLASH_AT_START = /^\/(\S*)$/;

interface UseCommandMenuOptions {
  draft: string;
  /** Der Knopf `/` hat das Menü geöffnet (Zustand liegt beim Aufrufer, weil die Menüs sich gegenseitig schließen). */
  isButtonOpen: boolean;
  /** Ein anderes Menü ist offen oder das Feld gesperrt: `/` am Feldanfang öffnet nichts. */
  isSuppressed: boolean;
  buttonScope: CommandScope;
  slashScope: CommandScope;
  skillSource: SkillSource;
  session: SessionSummary | null;
}

export interface CommandMenuState {
  isOpen: boolean;
  isSlashOpen: boolean;
  /** Filterfeld nur beim Knopf-Menü; im Slash-Menü filtert das Textfeld selbst. */
  showFilter: boolean;
  filter: string;
  setFilter: (text: string) => void;
  resetFilter: () => void;
  sections: CommandSection[];
  highlighted: CommandRow | null;
  setHighlighted: (row: CommandRow) => void;
  /** Hält das Slash-Menü zu, bis der Entwurf nicht mehr mit `/` beginnt. */
  dismissSlash: () => void;
  /** ↑/↓/Enter des offenen Slash-Menüs im Textfeld; `true`, wenn die Taste verbraucht wurde. */
  handleSlashKeyDown: (
    event: KeyboardEvent<HTMLTextAreaElement>,
    onPick: (row: CommandRow) => void,
  ) => boolean;
  /** Bewegt die Markierung; `onPick` für Enter, wenn ein Eingabefeld des Menüs die Taste bekam. */
  handleNavigationKey: (
    event: KeyboardEvent<HTMLElement>,
    onPick: (row: CommandRow) => void,
  ) => boolean;
}

export function useCommandMenu({
  draft,
  isButtonOpen,
  isSuppressed,
  buttonScope,
  slashScope,
  skillSource,
  session,
}: UseCommandMenuOptions): CommandMenuState {
  const [buttonFilter, setButtonFilter] = useState<string>('');
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [isSlashDismissed, setIsSlashDismissed] = useState<boolean>(false);

  const slashMatch: RegExpExecArray | null = SLASH_AT_START.exec(draft);
  if (slashMatch === null && isSlashDismissed) {
    setIsSlashDismissed(false);
  }
  const isSlashOpen: boolean =
    slashMatch !== null && !isSlashDismissed && !isButtonOpen && !isSuppressed;
  const isOpen: boolean = isButtonOpen || isSlashOpen;
  const scope: CommandScope = isButtonOpen ? buttonScope : slashScope;
  const filter: string = isButtonOpen ? buttonFilter : (slashMatch?.[1] ?? '');

  const { skills } = useSkills(skillSource, isOpen);
  const sections: CommandSection[] = buildCommandSections(scope, filter, skills, session);
  const rows: CommandRow[] = pickableRows(sections);
  // Ohne (noch gültige) Markierung gilt die erste wählbare Zeile als markiert.
  const highlighted: CommandRow | null =
    rows.find((row: CommandRow) => rowKey(row) === highlightedKey) ?? rows[0] ?? null;

  function handleNavigationKey(
    event: KeyboardEvent<HTMLElement>,
    onPick: (row: CommandRow) => void,
  ): boolean {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next: CommandRow | null = moveHighlight(
        rows,
        highlighted,
        event.key === 'ArrowDown' ? 1 : -1,
      );
      setHighlightedKey(next === null ? null : rowKey(next));
      return true;
    }
    if (event.key === 'Enter' && !event.ctrlKey && highlighted !== null) {
      event.preventDefault();
      onPick(highlighted);
      return true;
    }
    return false;
  }

  return {
    isOpen,
    isSlashOpen,
    showFilter: isButtonOpen,
    filter,
    setFilter: setButtonFilter,
    resetFilter: (): void => {
      setButtonFilter('');
    },
    sections,
    highlighted,
    setHighlighted: (row: CommandRow): void => {
      setHighlightedKey(rowKey(row));
    },
    dismissSlash: (): void => {
      setIsSlashDismissed(true);
    },
    handleSlashKeyDown: (event, onPick): boolean =>
      isSlashOpen ? handleNavigationKey(event, onPick) : false,
    handleNavigationKey,
  };
}
