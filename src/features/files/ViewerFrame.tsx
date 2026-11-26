import type { ReactElement } from 'react';
import { FRAME_SANDBOX } from '@/features/artifacts/ArtifactFrame';
import { sizeText } from '@/features/files/fileFacts';
import { KIND_WORDS } from '@/features/files/fileTypes';
import { useViewerUrl } from '@/features/files/useViewerUrl';
import type { ArtifactKind } from '@/lib/bindings/ArtifactKind';
import type { FileRef } from '@/lib/bindings/FileRef';
import './ViewerFrame.css';

interface ViewerFrameProps {
  sessionId: string;
  file: FileRef;
  kind: ArtifactKind;
  /** Größe der Datei, wenn der Core sie kennt (Session-Dateien); sonst fehlt sie in der Leiste. */
  bytes: number | null;
  /** Letzte Änderung der Datei; ändert sie sich, lädt der Rahmen neu. */
  stamp: number;
}

/** Der abgeschottete Betrachter der Artefakte (ADR 047) für eine einzelne Datei: Bild, Video, Ton, PDF und die
 *  Vorschau von Markdown und Daten. Das Bild zeichnet seinen Schachbrett-Grund selbst. */
export function ViewerFrame({
  sessionId,
  file,
  kind,
  bytes,
  stamp,
}: ViewerFrameProps): ReactElement {
  const { url, error, isLoading } = useViewerUrl(sessionId, file);
  const title = `Betrachter · ${KIND_WORDS[kind]}`;

  function renderStage(): ReactElement {
    if (isLoading) {
      return <p className="viewer-frame__notice">Betrachter wird geladen …</p>;
    }
    if (url === null) {
      return (
        <p className="viewer-frame__error">{error ?? 'Der Betrachter ließ sich nicht laden.'}</p>
      );
    }
    return (
      <iframe
        key={`${url}|${String(stamp)}`}
        className="viewer-frame__frame"
        src={url}
        sandbox={FRAME_SANDBOX}
        allow="fullscreen"
        title={title}
      />
    );
  }

  return (
    <section className="viewer-frame" aria-label={title}>
      <div className="viewer-frame__bar">
        <span>{title}</span>
        <span className="viewer-frame__spacer" />
        {bytes !== null && <span>{sizeText(bytes)}</span>}
      </div>
      <div className="viewer-frame__stage">{renderStage()}</div>
    </section>
  );
}
