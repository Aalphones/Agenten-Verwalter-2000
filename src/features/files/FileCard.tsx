import type { ReactElement } from 'react';
import { clockLabel } from '@/features/artifacts/artifactTexts';
import { sizeText } from '@/features/files/fileFacts';
import './FileCard.css';

interface FileCardProps {
  name: string;
  /** „Typ“ der Karte („HTML-Seite“, „BAK-Datei“). */
  typeText: string;
  bytes: number | null;
  modifiedAt: number | null;
  /** Satz unter dem Namen. */
  text: string;
  /** Primärer Knopf; `null` ohne. */
  action: { label: string; onClick: () => void } | null;
}

/** Karte für eine Datei ohne Ansicht: Name, Typ, Größe, Änderung (Entwurf `.rest`). */
export function FileCard({
  name,
  typeText,
  bytes,
  modifiedAt,
  text,
  action,
}: FileCardProps): ReactElement {
  return (
    <div className="file-card">
      <h3 className="file-card__name">{name}</h3>
      <p className="file-card__text">{text}</p>
      <dl className="file-card__facts">
        <dt>Typ</dt>
        <dd>{typeText}</dd>
        {bytes !== null && (
          <>
            <dt>Größe</dt>
            <dd>{sizeText(bytes)}</dd>
          </>
        )}
        {modifiedAt !== null && (
          <>
            <dt>Geändert</dt>
            <dd>{clockLabel(modifiedAt)}</dd>
          </>
        )}
      </dl>
      {action !== null && (
        <button
          type="button"
          className="files-button files-button--primary"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
