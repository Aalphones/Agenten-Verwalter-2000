import { convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { changedByText, relativeTime } from '@/features/skins/formatChanged';
import { MAX_NAME_CHARS } from '@/features/skins/limits';
import { SkinThumb } from '@/features/skins/SkinThumb';
import { SkinUndoBar } from '@/features/skins/SkinUndoBar';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinKind } from '@/lib/bindings/SkinKind';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SkinPackSummary } from '@/lib/bindings/SkinPackSummary';
import { commandErrorText } from '@/lib/errors';
import { createSkin, deleteSkin, exportSkin, importSkin, undeleteSkin } from '@/lib/skins';
import { useSkinsStore } from '@/stores/skins';
import './SkinPackList.css';

const COPY_SUFFIX = ' (Kopie)';
const EMPTY_TEXT = 'Noch keine Pakete. Lege eins an oder importiere eine ZIP-Datei.';
const ZIP_FILTERS = [{ name: 'ZIP', extensions: ['zip'] }];
/** Zeichen, die ein Windows-Dateiname nicht trägt. */
const FORBIDDEN_FILE_CHARS = /[\\/:*?"<>|]/g;

interface SkinPackListProps {
  packs: readonly SkinPackSummary[] | null;
  loadError: string | null;
  /** Ob das Paket gerade als Figuren- oder Stilpaket gewählt ist. */
  isActive: (pack: SkinPackSummary) => boolean;
  /** Hebt die Wahl auf (vor dem Löschen) bzw. stellt sie wieder her. */
  onDeactivate: (pack: SkinPackSummary) => Promise<void>;
  onReactivate: (pack: SkinPackSummary) => Promise<void>;
}

interface DeletedPack {
  pack: SkinPackSummary;
  wasActive: boolean;
}

function kindLabel(kind: SkinKind): string {
  return kind === 'figures' ? 'Figuren' : 'Stil';
}

function newPackName(kind: SkinKind): string {
  return kind === 'figures' ? 'Neues Figurenpaket' : 'Neues Stilpaket';
}

/** Der Name einer Kopie; auf die erlaubte Länge gekürzt, damit der Kern sie annimmt. */
function copyName(name: string): string {
  const base: string = Array.from(name)
    .slice(0, MAX_NAME_CHARS - COPY_SUFFIX.length)
    .join('');
  return `${base}${COPY_SUFFIX}`;
}

function thumbSource(pack: SkinPackSummary): string | null {
  if (pack.thumb === null) {
    return null;
  }
  // Der Zeitpunkt der Änderung als Parameter, damit ein neues Vorschaubild nicht aus dem Cache kommt.
  return `${convertFileSrc(pack.thumb)}?v=${encodeURIComponent(pack.changedAt)}`;
}

/** Die Paketliste der Seite „Skins“: Anlegen, Bearbeiten, Duplizieren, Löschen mit Rückgängig. */
export function SkinPackList({
  packs,
  loadError,
  isActive,
  onDeactivate,
  onReactivate,
}: SkinPackListProps): ReactElement {
  const setEditingPackId = useSkinsStore((state) => state.setEditingPackId);
  const setOpenSlot = useSkinsStore((state) => state.setOpenSlot);
  const [deleted, setDeleted] = useState<DeletedPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Ein Satz zu Export und Import (Erfolg oder Ablehnung), 8 Sekunden ohne Knopf. */
  const [notice, setNotice] = useState<string | null>(null);

  function edit(id: string): void {
    setOpenSlot(null);
    setEditingPackId(id);
  }

  function create(kind: SkinKind, name: string, copyOf: string | null): void {
    setError(null);
    createSkin(kind, name, copyOf)
      .then((pack: SkinPack) => {
        edit(pack.id);
      })
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht angelegt', reason);
        setError(commandErrorText(reason));
      });
  }

  function exportPack(pack: SkinPackSummary): void {
    setError(null);
    setNotice(null);
    save({
      defaultPath: `${pack.name.replace(FORBIDDEN_FILE_CHARS, '-')}.zip`,
      filters: ZIP_FILTERS,
    })
      .then((destination: string | null) => {
        if (destination === null) {
          return undefined;
        }
        return exportSkin(pack.id, destination).then(() => {
          setNotice(`„${pack.name}“ exportiert.`);
        });
      })
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht exportiert', reason);
        setNotice(commandErrorText(reason));
      });
  }

  function importPack(): void {
    setError(null);
    setNotice(null);
    open({ multiple: false, directory: false, filters: ZIP_FILTERS })
      .then((picked: string | null) => {
        if (picked === null) {
          return undefined;
        }
        return importSkin(picked).then((pack: SkinPack) => {
          setNotice(`„${pack.name}“ importiert.`);
        });
      })
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht importiert', reason);
        setNotice(commandErrorText(reason));
      });
  }

  function remove(pack: SkinPackSummary): void {
    setError(null);
    const wasActive: boolean = isActive(pack);
    (wasActive ? onDeactivate(pack) : Promise.resolve())
      .then(() => deleteSkin(pack.id))
      .then(() => {
        setDeleted({ pack, wasActive });
      })
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht gelöscht', reason);
        setError(commandErrorText(reason));
      });
  }

  function undo(): void {
    if (deleted === null) {
      return;
    }
    const { pack, wasActive } = deleted;
    setDeleted(null);
    undeleteSkin(pack.id)
      .then(() => (wasActive ? onReactivate(pack) : undefined))
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht zurückgeholt', reason);
        setError(commandErrorText(reason));
      });
  }

  function renderThumb(pack: SkinPackSummary): ReactElement {
    if (pack.kind === 'style' && pack.swatches.length > 0) {
      return (
        <span className="skin-pack-list__swatches" aria-hidden="true">
          {pack.swatches.map((color: string, index: number) => (
            <i key={`${color}-${String(index)}`} style={{ background: color }} />
          ))}
        </span>
      );
    }
    return <SkinThumb src={thumbSource(pack)} emptyText="Text" />;
  }

  function renderRow(pack: SkinPackSummary): ReactElement {
    const isByAgent: boolean = pack.changedBy !== null;
    return (
      <li key={pack.id} className="skin-pack-list__row">
        {renderThumb(pack)}
        <span className="skin-pack-list__info">
          <span className="skin-pack-list__name">
            {pack.name}
            <span className="skin-pack-list__mark">{kindLabel(pack.kind)}</span>
            {isActive(pack) && <span className="skin-pack-list__mark">aktiv</span>}
          </span>
          <span className="skin-pack-list__meta">
            {isByAgent && <span className="skin-pack-list__dot" aria-hidden="true" />}
            zuletzt geändert: {changedByText(pack.changedBy)} · {relativeTime(pack.changedAt)}
          </span>
        </span>
        <span className="skin-pack-list__actions">
          <button
            type="button"
            className="settings-view__button"
            onClick={(): void => {
              edit(pack.id);
            }}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            className="settings-view__button"
            onClick={(): void => {
              create(pack.kind, copyName(pack.name), pack.id);
            }}
          >
            Duplizieren
          </button>
          <button
            type="button"
            className="settings-view__button"
            onClick={(): void => {
              exportPack(pack);
            }}
          >
            Als ZIP exportieren
          </button>
          <button
            type="button"
            className="settings-view__button skin-pack-list__delete"
            onClick={(): void => {
              remove(pack);
            }}
          >
            Löschen
          </button>
        </span>
      </li>
    );
  }

  return (
    <div className="skin-pack-list">
      <div className="skin-pack-list__toolbar">
        <button
          type="button"
          className="settings-view__button"
          onClick={(): void => {
            create('figures', newPackName('figures'), null);
          }}
        >
          Neues Figurenpaket
        </button>
        <button
          type="button"
          className="settings-view__button"
          onClick={(): void => {
            create('style', newPackName('style'), null);
          }}
        >
          Neues Stilpaket
        </button>
        <ToolName action="create" />
        <button type="button" className="settings-view__button" onClick={importPack}>
          ZIP importieren …
        </button>
        <ToolName action="import" />
      </div>
      {packs !== null && packs.length === 0 && (
        <p className="skin-pack-list__empty">{EMPTY_TEXT}</p>
      )}
      {packs !== null && packs.length > 0 && (
        <ul className="skin-pack-list__list">{packs.map(renderRow)}</ul>
      )}
      {(error ?? loadError) !== null && (
        <p className="skin-pack-list__error" role="alert">
          {error ?? loadError}
        </p>
      )}
      {notice !== null && (
        <SkinUndoBar
          message={notice}
          onExpire={(): void => {
            setNotice(null);
          }}
        />
      )}
      {deleted !== null && (
        <SkinUndoBar
          message={`Paket „${deleted.pack.name}“ gelöscht.`}
          onUndo={undo}
          onExpire={(): void => {
            setDeleted(null);
          }}
        />
      )}
    </div>
  );
}
