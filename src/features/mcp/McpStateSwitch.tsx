import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import { SWITCH_LABELS } from '@/features/mcp/mcpTexts';
import type { McpSwitchPosition } from '@/features/mcp/mcpTexts';
import './McpStateSwitch.css';

/** Von links nach rechts. */
const POSITIONS: readonly McpSwitchPosition[] = ['all', 'here', 'on'];

interface McpStateSwitchProps {
  server: string;
  position: McpSwitchPosition;
  isDisabled: boolean;
  onChange: (position: McpSwitchPosition) => void;
}

/** Dreistufiger Schalter: überall aus · aus in diesem Vorhaben · an. Gesperrt nur per
 *  `aria-disabled`, damit der Fokus während einer laufenden Aktion stehen bleibt. */
export function McpStateSwitch({
  server,
  position,
  isDisabled,
  onChange,
}: McpStateSwitchProps): ReactElement {
  const groupRef = useRef<HTMLSpanElement>(null);

  function select(next: McpSwitchPosition): void {
    if (!isDisabled && next !== position) {
      onChange(next);
    }
  }

  // Gerechnet ab der fokussierten Stellung: `position` hinkt bei schnellen Tasten hinterher.
  function handleKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    focused: McpSwitchPosition,
  ): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step: number = event.key === 'ArrowLeft' ? -1 : 1;
    const index: number = POSITIONS.indexOf(focused) + step;
    const next: McpSwitchPosition | undefined = POSITIONS[index];
    if (next === undefined || isDisabled) {
      return;
    }
    groupRef.current?.querySelectorAll('button')[index]?.focus();
    select(next);
  }

  return (
    <span
      ref={groupRef}
      className={`mcp-switch mcp-switch--${position}`}
      role="radiogroup"
      aria-label={`${server}: Zustand`}
      aria-disabled={isDisabled}
    >
      {POSITIONS.map((option: McpSwitchPosition) => (
        <button
          key={option}
          type="button"
          role="radio"
          className="mcp-switch__option"
          aria-checked={option === position}
          aria-label={SWITCH_LABELS[option]}
          title={SWITCH_LABELS[option]}
          tabIndex={option === position ? 0 : -1}
          onClick={() => {
            select(option);
          }}
          onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
            handleKeyDown(event, option);
          }}
        />
      ))}
    </span>
  );
}
