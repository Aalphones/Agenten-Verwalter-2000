import type { ReactElement } from 'react';
import { clockLabel } from '@/features/artifacts/artifactTexts';
import type { Artifact } from '@/lib/bindings/Artifact';
import './ArtifactCard.css';

const MISSING_TITLE = 'Artefakt nicht vorhanden';

interface ArtifactCardProps {
  file: string;
  /** Eintrag der Liste mit gleichem Dateinamen; `undefined`, solange die Datei dort nicht steht. */
  item: Artifact | undefined;
  onOpen: () => void;
}

/** Karte im Verlauf, nachdem der Agent ein Artefakt geschrieben hat. */
export function ArtifactCard({ file, item, onOpen }: ArtifactCardProps): ReactElement {
  const meta: string =
    item === undefined
      ? `Artefakt · ${file}`
      : `Artefakt · ${file} · ${clockLabel(item.modifiedAt)}`;
  return (
    <div className="artifact-card">
      <span className="artifact-card__icon">
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
          <path d="M1.5 5h11M4 7.5h3M4 9.5h5" />
        </svg>
      </span>
      <span className="artifact-card__text">
        <span className="artifact-card__title">{item === undefined ? file : item.title}</span>
        <span className="artifact-card__meta">{meta}</span>
      </span>
      <button
        type="button"
        className="artifact-card__button"
        disabled={item === undefined}
        title={item === undefined ? MISSING_TITLE : undefined}
        onClick={onOpen}
      >
        In der Session ansehen
      </button>
    </div>
  );
}
