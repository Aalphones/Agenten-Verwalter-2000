import { useLayoutEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import './OutputPane.css';

const STICK_TO_BOTTOM_TOLERANCE = 24;

interface OutputPaneProps {
  text: string;
  /** Hinweis über dem Text („Gekürzt …“, „Ausgabe nicht mehr verfügbar.“); `null` ohne. */
  notice: string | null;
  /** Wächst der Text nach, bleibt die Ansicht unten, solange der Nutzer nicht hochgescrollt hat. */
  followsEnd: boolean;
}

/** Scrollbare Ausgabe in Festbreitenschrift auf dem Grundton. */
export function OutputPane({ text, notice, followsEnd }: OutputPaneProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef<boolean>(true);

  useLayoutEffect(() => {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element !== null && followsEnd && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [text, followsEnd]);

  function handleScroll(): void {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element === null) {
      return;
    }
    stickToBottomRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - STICK_TO_BOTTOM_TOLERANCE;
  }

  return (
    <div ref={scrollRef} className="output-pane" onScroll={handleScroll}>
      {notice !== null && <p className="output-pane__notice">{notice}</p>}
      <pre className="output-pane__text">{text}</pre>
    </div>
  );
}
