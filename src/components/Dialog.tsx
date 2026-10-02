import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FOCUSABLE_SELECTOR } from '@/lib/focus';
import './Dialog.css';

interface DialogProps {
  /** `id` der Überschrift im Inhalt; benennt den Dialog für Screenreader. */
  labelledBy: string;
  /** Setzt die Breite (und was sonst das Feld braucht); die Hülle gibt nur die Form vor. */
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modale Hülle für Dialoge mittig über der App; Gegenstück zu `Popover` für Inhalte,
 *  die nicht an einem Auslöser hängen. Der Fokus bleibt im Feld und kehrt beim Schließen zurück. */
export function Dialog({ labelledBy, className, onClose, children }: DialogProps): ReactElement {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef<() => void>(onClose);

  // Der Listener-Effekt läuft nur einmal; über die Ref sieht er stets den aktuellen Callback,
  // ohne dass ein neuer Callback pro Render den Fokus erneut auf das erste Element setzt.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel: HTMLElement | null = panelRef.current;
    if (panel === null) {
      return undefined;
    }
    const previouslyFocused: Element | null = document.activeElement;
    panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function focusableElements(): HTMLElement[] {
      return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element: HTMLElement) => !element.matches(':disabled'),
      );
    }

    function trapTab(event: KeyboardEvent): void {
      const elements: HTMLElement[] = focusableElements();
      const first: HTMLElement | undefined = elements[0];
      const last: HTMLElement | undefined = elements[elements.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Capture-Phase und preventDefault: der Esc-Listener des Chats prüft `defaultPrevented`
    // und pausiert die Session nicht zusätzlich, wenn der Dialog das Esc verbraucht hat.
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        trapTab(event);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div className="dialog" onPointerDown={handleBackdropPointerDown}>
      <section
        ref={panelRef}
        className={`dialog__panel ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
