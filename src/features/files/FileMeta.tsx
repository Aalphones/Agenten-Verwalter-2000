import type { ReactElement } from 'react';
import { ExecutableLockHint } from '@/components/ExecutableLockHint';
import { clockLabel } from '@/features/artifacts/artifactTexts';
import { sizeText } from '@/features/files/fileFacts';
import './FileMeta.css';

interface FileMetaProps {
  /** Ordner der Datei; der volle Pfad steht im Tooltip, die Zeile kürzt links. */
  folder: string;
  bytes: number | null;
  /** Letzte Änderung, ms seit 1970. */
  modifiedAt: number | null;
  /** Bei Session-Dateien die Herkunft („erstellt von #3“). */
  origin: string | null;
  /** Mit Zeile, die den gesperrten Knopf „Mit Standardprogramm öffnen“ erklärt; `lockId` nennt der Knopf. */
  executable: boolean;
  lockId: string;
}

/** Die Zeile unter dem Kopf der Datei-Ansicht: Ordner, Größe, Änderungszeit, Herkunft und der Grund einer Sperre. */
export function FileMeta({
  folder,
  bytes,
  modifiedAt,
  origin,
  executable,
  lockId,
}: FileMetaProps): ReactElement {
  return (
    <div className="file-meta">
      <span className="file-meta__where" title={folder}>
        {folder}
      </span>
      {bytes !== null && <span>{sizeText(bytes)}</span>}
      {modifiedAt !== null && <span>{clockLabel(modifiedAt)}</span>}
      {origin !== null && <span>{origin}</span>}
      {executable && <ExecutableLockHint id={lockId} />}
    </div>
  );
}
