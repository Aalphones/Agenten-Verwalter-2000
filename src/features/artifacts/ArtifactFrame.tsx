import type { ReactElement } from 'react';
import type { Artifact } from '@/lib/bindings/Artifact';
import { artifactUrl } from '@/lib/artifacts';

interface ArtifactFrameProps {
  /** `baseUrl` der Liste. */
  baseUrl: string;
  item: Artifact;
  /** Erhöht sich bei „Neu laden“; neuer Schlüssel = neues iframe. */
  reloadToken: number;
}

// Ohne `allow-same-origin`, `allow-popups` und `allow-top-navigation`: die Seite läuft als eigene, leere
// Herkunft und erreicht weder den Verwalter noch andere Fenster. Kein `srcdoc` — das erbte die App-CSP.
const FRAME_SANDBOX = 'allow-scripts allow-forms allow-modals';

export function ArtifactFrame({ baseUrl, item, reloadToken }: ArtifactFrameProps): ReactElement {
  return (
    <iframe
      key={`${item.file}:${String(reloadToken)}`}
      className="artifacts__frame"
      src={artifactUrl(baseUrl, item.file, item.modifiedAt)}
      sandbox={FRAME_SANDBOX}
      allow="fullscreen"
      title={item.title}
    />
  );
}
