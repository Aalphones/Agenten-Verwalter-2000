import type { ReactElement, ReactNode } from 'react';
import { fileCountLabel } from '@/features/changes/changesScope';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import './FilesToolbar.css';

const SCOPE_OPTIONS: readonly SegmentOption<ChangeScope>[] = [
  { value: 'all', label: 'Alle', title: 'Alles seit der Codebasis, committed und uncommitted' },
  {
    value: 'uncommitted',
    label: 'Uncommitted',
    title: 'Nur im Arbeitsverzeichnis, noch nicht committed',
  },
  {
    value: 'committed',
    label: 'Committed',
    title: 'Schon als Commit auf dem ausgecheckten Branch',
  },
];

interface FilesToolbarProps {
  /** `null`: das ganze Vorhaben. */
  filterNumber: number | null;
  isPickerOpen: boolean;
  /** Der Aufklapper, solange er offen ist. */
  picker: ReactNode;
  onTogglePicker: () => void;
  onClearFilter: () => void;
  scope: ChangeScope;
  onScope: (scope: ChangeScope) => void;
  fileCount: number;
  added: number;
  deleted: number;
}

/** Leiste über der Ansicht „Dateien“: Session-Filter, Blickwinkel, Summe. */
export function FilesToolbar({
  filterNumber,
  isPickerOpen,
  picker,
  onTogglePicker,
  onClearFilter,
  scope,
  onScope,
  fileCount,
  added,
  deleted,
}: FilesToolbarProps): ReactElement {
  const isFiltered: boolean = filterNumber !== null;
  return (
    <div className="files-toolbar">
      <button
        type="button"
        className={`files-button${isFiltered ? ' files-button--on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isPickerOpen}
        title="Wessen Änderungen gezeigt werden"
        onClick={onTogglePicker}
      >
        {filterNumber === null ? 'Ganzes Vorhaben' : `Session #${String(filterNumber)}`} ▾
      </button>
      {isFiltered && (
        <button
          type="button"
          className="files-button files-button--small files-button--quiet"
          title="Wieder das ganze Vorhaben zeigen"
          onClick={onClearFilter}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Filter entfernen
        </button>
      )}
      <FilesSegment label="Blickwinkel" options={SCOPE_OPTIONS} value={scope} onChange={onScope} />
      <span className="files-toolbar__summary">
        {fileCountLabel(fileCount)} · <ChangeMarks added={added} deleted={deleted} />
      </span>
      {picker}
    </div>
  );
}
