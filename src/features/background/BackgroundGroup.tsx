import type { ReactElement, ReactNode } from 'react';
import './BackgroundGroup.css';

interface BackgroundGroupProps {
  title: string;
  /** Voller Text für den Tooltip, wenn der Titel abgeschnitten wird (Pfade). */
  titleHint?: string | undefined;
  /** Text für die leere Gruppe; `null`, solange sie Zeilen hat. */
  emptyText: string | null;
  children?: ReactNode;
}

export function BackgroundGroup({
  title,
  titleHint,
  emptyText,
  children,
}: BackgroundGroupProps): ReactElement {
  return (
    <section className="background-group">
      <h3 className="background-group__title" title={titleHint}>
        {title}
      </h3>
      {children}
      {emptyText !== null && <p className="background-group__empty">{emptyText}</p>}
    </section>
  );
}
