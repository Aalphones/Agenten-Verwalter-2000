import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { FOCUSABLE_SELECTOR } from '@/lib/focus';
import './Popover.css';

/** Mindestabstand des Menüs zum Fensterrand in px. */
const VIEWPORT_MARGIN = 8;

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

  const [side, setSide] = useState<'above' | 'below'>(placement);

  // Das Menü hängt am Auslöser und weiß nichts vom Fenster: Reicht der Platz auf der gewünschten
  // Seite nicht, klappt es auf die andere, und die Höhe wird auf den verfügbaren Platz begrenzt.
  useLayoutEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    const anchor: HTMLElement | null = root?.parentElement ?? null;
    if (root === null || anchor === null) {
      return undefined;
    }
    function fit(): void {
      if (root === null || anchor === null) {
        return;
      }
      root.style.removeProperty('--popover-max-height');
      const anchorRect: DOMRect = anchor.getBoundingClientRect();
      const gap: number = parseFloat(getComputedStyle(root).getPropertyValue('--space-md')) || 8;
      const spaceBelow: number = window.innerHeight - anchorRect.bottom - gap - VIEWPORT_MARGIN;
      const spaceAbove: number = anchorRect.top - gap - VIEWPORT_MARGIN;
      const height: number = root.offsetHeight;
      const preferredSpace: number = placement === 'below' ? spaceBelow : spaceAbove;
      const otherSpace: number = placement === 'below' ? spaceAbove : spaceBelow;
      const useOther: boolean = height > preferredSpace && otherSpace > preferredSpace;
      const chosen: 'above' | 'below' = useOther
        ? placement === 'below'
          ? 'above'
          : 'below'
        : placement;
      const space: number = useOther ? otherSpace : preferredSpace;
      root.style.setProperty('--popover-max-height', `${String(Math.max(120, Math.floor(space)))}px`);
      setSide(chosen);
    }
    fit();
    const observer: ResizeObserver = new ResizeObserver(fit);
    observer.observe(root);
    window.addEventListener('resize', fit);
    return (): void => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [placement]);

  const classNames: string = [
    'popover',
    `popover--${side}`,
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
