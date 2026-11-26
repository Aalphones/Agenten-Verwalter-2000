import { useState } from 'react';
import type { ReactElement } from 'react';
import { NotePane } from '@/features/notes/NotePane';
import './NoteView.css';

interface NoteViewProps {
  projectId: string;
}

/** Hauptfläche des Reiters „Notiz“ (Einstellung „Als Reiter oben“): die Notiz mit eigener Fehlerzeile. */
export function NoteView({ projectId }: NoteViewProps): ReactElement {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="note-view">
      {error !== null && (
        <p className="note-view__error" role="alert">
          {error}
        </p>
      )}
      <NotePane key={projectId} projectId={projectId} onError={setError} />
    </div>
  );
}
