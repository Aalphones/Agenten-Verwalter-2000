import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import './Popover.css';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface PopoverProps {
  label: string;
  placement: 'above' | 'below';
  align: 'start' | 'end';
  /** Breite in px oder `'anchor'` für die volle Breite des Elements, das das Menü trägt. */
  width: number | 'anchor';
  onClose: () => void;
  /** `false`: der Fokus bleibt, wo er ist (Menü, das ein Textfeld begleitet). Standard `true`. */
  autoFocus?: boolean;
  className?: string;
  children: ReactNode;
}

/** Hülle für alle Menüs. Wird als Kind eines `position: relative`-Elements gerendert,
 *  das auch den Auslöser enthält — ein Klick auf den Auslöser zählt nicht als „außerhalb“,
 *  damit dessen eigener Klick das Menü umschalten kann. */
export function Popover({
  label,
  placement,
  align,
  width,
  onClose,
  autoFocus = true,
  className,
  children,
}: PopoverProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef<() => void>(onClose);
  const shouldTakeFocusRef = useRef<boolean>(autoFocus);

  // Der Listener-Effekt läuft nur einmal; über die Ref sieht er stets den aktuellen Callback,
  // ohne dass ein neuer Callback pro Render den Fokus erneut auf das erste Element setzt.
  useEffect(() => {
    onCloseRef.current = onClose;
    shouldTakeFocusRef.current = autoFocus;
  });

  useEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    if (root === null) {
      return undefined;
    }
    const previouslyFocused: Element | null = document.activeElement;
    if (shouldTakeFocusRef.current) {
      root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }

    // Capture-Phase und preventDefault: der Esc-Listener des Chats prüft `defaultPrevented`
    // und pausiert die Session nicht zusätzlich, wenn ein Menü das Esc verbraucht hat.
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      onCloseRef.current();
      if (shouldTakeFocusRef.current && previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      const anchor: HTMLElement | null = root?.parentElement ?? null;
      if (anchor !== null && event.target instanceof Node && anchor.contains(event.target)) {
        return;
      }
      onCloseRef.current();
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handlePointerDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const classNames: string = [
    'popover',
    `popover--${placement}`,
    `popover--${align}`,
    width === 'anchor' ? 'popover--anchor' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={classNames}
      role="dialog"
      aria-label={label}
      style={width === 'anchor' ? undefined : { width: `${String(width)}px` }}
    >
      {children}
    </div>
  );
}
