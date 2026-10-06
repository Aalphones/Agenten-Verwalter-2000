import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ArtifactFrame } from '@/features/artifacts/ArtifactFrame';
import { ArtifactFullscreen } from '@/features/artifacts/ArtifactFullscreen';
import {
  ARTIFACTS_HEADING,
  ARTIFACTS_INFO,
  JUST_UPDATED,
  clockLabel,
  metaLine,
} from '@/features/artifacts/artifactTexts';
import { mentionInChat } from '@/features/background/mention';
import { openArtifactInBrowser } from '@/lib/artifacts';
import type { Artifact } from '@/lib/bindings/Artifact';
import type { ArtifactList } from '@/lib/bindings/ArtifactList';
import { commandErrorText } from '@/lib/errors';
import { useArtifactsStore } from '@/stores/artifacts';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import './ArtifactsView.css';

const JUST_UPDATED_MS = 2500;

interface ArtifactsViewProps {
  /** Für Commands und Adresse; in der Übersicht die neueste Session des Vorhabens. */
  sessionId: string;
  projectId: string;
  /** `null` in der Übersicht: dort gibt es weder „diese Session“ noch „Im Chat besprechen“. */
  currentSessionId: string | null;
  list: ArtifactList;
}

export function ArtifactsView({
  sessionId,
  projectId,
  currentSessionId,
  list,
}: ArtifactsViewProps): ReactElement | null {
  const [reloadToken, setReloadToken] = useState<number>(0);
  const [isJustUpdated, setIsJustUpdated] = useState<boolean>(false);
  const lastModified = useRef<Record<string, number>>({});
  const selectedFile: string | undefined = useArtifactsStore((state) => state.selected[projectId]);
  const select = useArtifactsStore((state) => state.select);
  const isFullscreen: boolean = useArtifactsStore((state) => state.fullscreen);
  const setFullscreen = useArtifactsStore((state) => state.setFullscreen);
  const reportSessionError = useSessionErrorsStore((state) => state.report);
  const clearSessionError = useSessionErrorsStore((state) => state.clear);

  // Verschwindet das gewählte Artefakt, gilt das neueste.
  const selected: Artifact | undefined =
    list.items.find((item: Artifact) => item.file === selectedFile) ?? list.items[0];
  const selectedKey: string | undefined = selected?.file;
  const selectedModifiedAt: number | undefined = selected?.modifiedAt;

  useEffect(() => {
    if (selectedKey === undefined || selectedModifiedAt === undefined) {
      return undefined;
    }
    const previous: number | undefined = lastModified.current[selectedKey];
    lastModified.current[selectedKey] = selectedModifiedAt;
    const hasChanged: boolean = previous !== undefined && previous !== selectedModifiedAt;
    setIsJustUpdated(hasChanged);
    if (!hasChanged) {
      return undefined;
    }
    const timer: number = window.setTimeout(() => {
      setIsJustUpdated(false);
    }, JUST_UPDATED_MS);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [selectedKey, selectedModifiedAt]);

  // Ein Wechsel von Reiter, Session oder Vorhaben hängt die Ansicht aus und beendet damit das Vollbild.
  useEffect(() => {
    return (): void => {
      setFullscreen(false);
    };
  }, [setFullscreen]);

  if (selected === undefined) {
    return null;
  }

  function openInBrowser(item: Artifact): void {
    openArtifactInBrowser(sessionId, item.file)
      .then(() => {
        clearSessionError(sessionId);
      })
      .catch((reason: unknown) => {
        console.error('Artefakt nicht geöffnet', reason);
        reportSessionError(sessionId, `Artefakt nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  function renderDiscussButton(item: Artifact): ReactElement | null {
    if (currentSessionId === null) {
      return null;
    }
    return (
      <button
        type="button"
        className="artifacts__button"
        onClick={(): void => {
          mentionInChat(currentSessionId, `Artefakt „${item.title}“ (${list.dir}\\${item.file})`);
        }}
      >
        Im Chat besprechen
      </button>
    );
  }

  return (
    <div className="artifacts">
      <nav className="artifacts__list" aria-label="Artefakte">
        <div className="artifacts__heading">
          <span>{ARTIFACTS_HEADING}</span>
          <span className="artifacts__info" title={ARTIFACTS_INFO}>
            ?
          </span>
        </div>
        {list.items.map((item: Artifact) => (
          <button
            key={item.file}
            type="button"
            className={`artifacts__entry${item.file === selected.file ? ' artifacts__entry--selected' : ''}`}
            aria-current={item.file === selected.file ? 'true' : undefined}
            onClick={(): void => {
              select(projectId, item.file);
            }}
          >
            <span className="artifacts__entry-icon">
              <svg
                width="14"
                height="14"
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
            <span className="artifacts__entry-text">
              <span className="artifacts__entry-title">{item.title}</span>
              <span
                className={`artifacts__entry-meta${item.sessionId !== null && item.sessionId === currentSessionId ? ' artifacts__entry-meta--own' : ''}`}
              >
                {metaLine(item, currentSessionId)}
              </span>
            </span>
          </button>
        ))}
      </nav>
      <section className="artifacts__preview" aria-label="Vorschau">
        <header className="artifacts__head">
          <div className="artifacts__head-text">
            <h2 className="artifacts__title">{selected.title}</h2>
            <span
              className={`artifacts__subtitle${isJustUpdated ? ' artifacts__subtitle--fresh' : ''}`}
            >
              {isJustUpdated
                ? JUST_UPDATED
                : `${selected.file} · ${clockLabel(selected.modifiedAt)}`}
            </span>
          </div>
          <div className="artifacts__actions">
            <button
              type="button"
              className="artifacts__button artifacts__button--icon"
              title="Neu laden"
              aria-label="Neu laden"
              onClick={(): void => {
                setReloadToken((token: number) => token + 1);
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 8a5 5 0 1 1-1.5-3.6" />
                <path d="M13 2.5V5h-2.5" />
              </svg>
            </button>
            <button
              type="button"
              className="artifacts__button artifacts__button--icon"
              title="Vollbild"
              aria-label="Vollbild"
              onClick={(): void => {
                setFullscreen(true);
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
            {renderDiscussButton(selected)}
            <button
              type="button"
              className="artifacts__button"
              onClick={(): void => {
                openInBrowser(selected);
              }}
            >
              Im Browser öffnen
              <svg
                width="11"
                height="11"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5.5 2.5h6v6M11.5 2.5 4 10" />
              </svg>
            </button>
          </div>
        </header>
        <div className="artifacts__stage">
          <ArtifactFrame baseUrl={list.baseUrl} item={selected} reloadToken={reloadToken} />
        </div>
      </section>
      {isFullscreen ? (
        <ArtifactFullscreen
          baseUrl={list.baseUrl}
          item={selected}
          onClose={(): void => {
            setFullscreen(false);
          }}
        />
      ) : null}
    </div>
  );
}
