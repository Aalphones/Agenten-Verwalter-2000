import type { ReactElement } from 'react';
import { formatCount } from '@/features/changes/changesScope';
import type { ChangeKind } from '@/lib/bindings/ChangeKind';
import './ChangeMarks.css';

const KIND: Record<ChangeKind, { letter: string; title: string }> = {
  added: { letter: 'A', title: 'Neu' },
  modified: { letter: 'M', title: 'Geändert' },
  deleted: { letter: 'D', title: 'Gelöscht' },
};

interface ChangeMarksProps {
  added: number;
  deleted: number;
  /** Ohne Art nur die Zeilenzahlen (Summen). */
  kind?: ChangeKind;
  binary?: boolean;
}

/** `+a −d` und, bei einer Datei, der Buchstabe A, M oder D — nie Farbe allein. */
export function ChangeMarks({
  added,
  deleted,
  kind,
  binary = false,
}: ChangeMarksProps): ReactElement {
  return (
    <>
      {binary ? (
        <span className="change-marks__binary" title="Binärdatei – keine Zeilenzahl">
          binär
        </span>
      ) : (
        <span className="change-marks">
          <span className="change-marks__added">+{formatCount(added)}</span>{' '}
          <span className="change-marks__deleted">−{formatCount(deleted)}</span>
        </span>
      )}
      {kind !== undefined && (
        <span
          className={`change-marks__letter change-marks__letter--${kind}`}
          title={KIND[kind].title}
        >
          {KIND[kind].letter}
        </span>
      )}
    </>
  );
}
