import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { snippetSegments } from '@/features/vault/snippetSegments';
import type { SnippetSegment } from '@/features/vault/snippetSegments';
import { FolderIcon, GroupIcon, OpenIcon } from '@/features/vault/VaultIcons';
import { groupLabel, subgroupLabel } from '@/features/vault/vaultGroups';
import type { VaultHit } from '@/lib/bindings/VaultHit';
import { loadVaultImage } from '@/lib/vault';

interface VaultPreviewProps {
  hit: VaultHit | null;
  hasQuery: boolean;
  /** Zurück zur Liste (zweite Stufe unter 1180 px Breite). */
  onBack: () => void;
  onAct: (hit: VaultHit, reveal: boolean) => void;
}

/** Ein Bild des Vault; lädt beim Wechsel des Pfads neu und zeigt bei einem Fehler nichts. */
function PreviewImage({ path, title }: { path: string; title: string }): ReactElement | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    let isActive = true;
    loadVaultImage(path)
      .then((url: string) => {
        if (isActive) {
          setLoaded({ path, url });
        }
      })
      .catch((reason: unknown) => {
        console.error('Vorschaubild nicht geladen', reason);
        if (isActive) {
          setLoaded(null);
        }
      });
    return (): void => {
      isActive = false;
    };
  }, [path]);

  if (loaded === null || loaded.path !== path) {
    return null;
  }
  return <img className="vault-search__image" src={loaded.url} alt={title} />;
}

/** Rechte Spalte: Ort, Titel, Beschreibung, feste Knöpfe, darunter Fundstelle oder Bild und der Pfad. */
export function VaultPreview({ hit, hasQuery, onBack, onAct }: VaultPreviewProps): ReactElement {
  if (hit === null) {
    return <p className="vault-search__none">Nichts gewählt.</p>;
  }
  const subLabel: string = subgroupLabel(hit.group, hit.subgroup);
  const hasWhere: boolean = hit.heading !== '' || hit.line > 1;
  const segments: SnippetSegment[] = snippetSegments(hit.snippet);
  return (
    <>
      <button type="button" className="vault-search__back" onClick={onBack}>
        ← {subLabel}
      </button>
      <div className="vault-search__preview-head">
        <p className="vault-search__crumb">
          <GroupIcon group={hit.group} size={12} />
          {groupLabel(hit.group)} › {subLabel}
        </p>
        <h4 className="vault-search__preview-title">{hit.title}</h4>
        {hit.description !== '' && <p className="vault-search__preview-desc">{hit.description}</p>}
        <div className="vault-search__actions">
          <button
            type="button"
            className="vault-search__button vault-search__button--primary"
            onClick={(): void => {
              onAct(hit, false);
            }}
          >
            <OpenIcon />
            Öffnen
          </button>
          <button
            type="button"
            className="vault-search__button"
            onClick={(): void => {
              onAct(hit, true);
            }}
          >
            <FolderIcon />
            Im Ordner zeigen
          </button>
        </div>
      </div>
      <div className="vault-search__preview-body">
        {hit.kind === 'image' && <PreviewImage path={hit.file} title={hit.title} />}
        {hasQuery && segments.length > 0 && (
          <>
            <p className="vault-search__label">Fundstelle</p>
            {hasWhere && (
              <p className="vault-search__where">
                {hit.heading !== '' && `Abschnitt „${hit.heading}“ · `}Zeile {hit.line}
              </p>
            )}
            <p className="vault-search__excerpt">
              {segments.map((segment: SnippetSegment, index: number) =>
                segment.isMatch ? (
                  <mark key={index} className="vault-search__mark">
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </p>
          </>
        )}
        <p className="vault-search__label">Datei</p>
        <p className="vault-search__file">{hit.file}</p>
      </div>
    </>
  );
}
