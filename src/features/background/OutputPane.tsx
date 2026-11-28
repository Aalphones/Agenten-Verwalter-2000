import type { ReactElement } from 'react';
import { useStickToBottom } from '@/features/background/useStickToBottom';
import './OutputPane.css';

interface OutputPaneProps {
  text: string;
  /** Hinweis über dem Text („Gekürzt …“, „Ausgabe nicht mehr verfügbar.“); `null` ohne. */
  notice: string | null;
  /** Wächst der Text nach, bleibt die Ansicht unten, solange der Nutzer nicht hochgescrollt hat. */
  followsEnd: boolean;
}

/** Scrollbare Ausgabe in Festbreitenschrift auf dem Grundton. */
export function OutputPane({ text, notice, followsEnd }: OutputPaneProps): ReactElement {
  const { scrollRef, handleScroll } = useStickToBottom(text, followsEnd);

  return (
    <div ref={scrollRef} className="output-pane" onScroll={handleScroll}>
      {notice !== null && <p className="output-pane__notice">{notice}</p>}
      <pre className="output-pane__text">{text}</pre>
    </div>
  );
}
