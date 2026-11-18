import type { ReactElement } from 'react';
import { fileTypeOf, type FileType } from '@/features/files/fileTypes';
import './FileTypeIcon.css';

interface FileTypeIconProps {
  path: string;
}

/** Typ-Kürzel einer Datei in Farbe; ohne bekannte Endung ein schlichtes Datei-Symbol. Rein schmückend. */
export function FileTypeIcon({ path }: FileTypeIconProps): ReactElement {
  const type: FileType | null = fileTypeOf(path);
  if (type === null) {
    return (
      <span className="file-type file-type--mut" aria-hidden="true">
        <svg width="18" height="14" viewBox="0 0 18 14">
          <path
            d="M5.5 1.5h4.6l2.4 2.4v8.6h-7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className={`file-type file-type--${type.tone}`} aria-hidden="true">
      {type.label}
    </span>
  );
}
