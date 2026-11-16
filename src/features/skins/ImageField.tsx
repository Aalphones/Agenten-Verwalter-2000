import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { skinImageUrl } from '@/features/skins/skinImage';
import { SkinThumb } from '@/features/skins/SkinThumb';
import { ToolName } from '@/features/skins/ToolName';
import type { ImageSource } from '@/lib/bindings/ImageSource';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import { commandErrorText } from '@/lib/errors';
import './ImageField.css';

const FIGURE_EXTENSIONS: string[] = ['gif', 'png', 'webp'];
const ICON_EXTENSIONS: string[] = ['png', 'ico'];
const HTTPS_PREFIX = 'https://';
const NOT_HTTPS_SENTENCE = 'Nur https-Adressen.';

interface ImageFieldProps {
  label: string;
  pack: SkinPack;
  /** Dateiname im Bildordner des Pakets; `null` = noch kein Bild. */
  fileName: string | null;
  /** `icon` erlaubt PNG und ICO, `figure` GIF, PNG und WebP. */
  kind: 'figure' | 'icon';
  /** Legt das Bild ab; liefert den Fehlersatz des Kerns oder `null`. */
  onSource: (source: ImageSource) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}

/** Ein Bildfeld: Vorschau, „Datei wählen“, https-Adresse, Hineinziehen und „Entfernen“. */
export function ImageField({
  label,
  pack,
  fileName,
  kind,
  onSource,
  onRemove,
}: ImageFieldProps): ReactElement {
  const [urlText, setUrlText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isOver, setIsOver] = useState<boolean>(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  async function run(operation: () => Promise<string | null>): Promise<boolean> {
    setIsBusy(true);
    setError(null);
    const problem: string | null = await operation();
    setIsBusy(false);
    setError(problem);
    return problem === null;
  }

  async function applySource(source: ImageSource): Promise<void> {
    const isSaved: boolean = await run(() => onSource(source));
    if (isSaved && source.kind === 'url') {
      setUrlText('');
    }
  }

  const applyDropped = useEffectEvent((paths: string[]): void => {
    const first: string | undefined = paths[0];
    if (first !== undefined) {
      applySource({ kind: 'path', path: first }).catch(() => undefined);
    }
  });

  const isInsideZone = useEffectEvent((position: { x: number; y: number }): boolean => {
    const zone: HTMLDivElement | null = zoneRef.current;
    if (zone === null) {
      return false;
    }
    // Tauri meldet physische Pixel des Fensters, das Layout rechnet in CSS-Pixeln.
    const x: number = position.x / window.devicePixelRatio;
    const y: number = position.y / window.devicePixelRatio;
    const rect: DOMRect = zone.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });

  // Mit aktivem Drag-and-Drop des Fensters kommen HTML-`drop`-Ereignisse ohne Pfade an;
  // Pfade liefert nur das Tauri-Ereignis (Muster wie beim Anhängen im Chat).
  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | null = null;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === 'leave') {
          setIsOver(false);
          return;
        }
        const isInside: boolean = isInsideZone(payload.position);
        if (payload.type === 'drop') {
          setIsOver(false);
          if (isInside) {
            applyDropped(payload.paths);
          }
          return;
        }
        setIsOver(isInside);
      })
      .then((stop: () => void) => {
        if (isDisposed) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch((reason: unknown) => {
        // Nur das Hineinziehen fehlt; „Datei wählen“ und die Adresse gehen weiter.
        console.error('Hineinziehen nicht verfügbar', reason);
      });
    return (): void => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  function pick(): void {
    const extensions: string[] = kind === 'icon' ? ICON_EXTENSIONS : FIGURE_EXTENSIONS;
    open({
      multiple: false,
      directory: false,
      title: `${label}: Bild wählen`,
      filters: [{ name: 'Bilder', extensions }],
    })
      .then((path: string | null) => {
        if (path !== null) {
          return applySource({ kind: 'path', path });
        }
        return undefined;
      })
      .catch((reason: unknown) => {
        console.error('Dateiauswahl nicht geöffnet', reason);
        setError(`Dateiauswahl nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  function loadUrl(): void {
    const url: string = urlText.trim();
    if (!url.toLowerCase().startsWith(HTTPS_PREFIX)) {
      setError(NOT_HTTPS_SENTENCE);
      return;
    }
    applySource({ kind: 'url', url }).catch(() => undefined);
  }

  function remove(): void {
    run(onRemove).catch(() => undefined);
  }

  return (
    <div className="image-field" role="group" aria-label={label}>
      <span className="image-field__label">
        {label}
        <ToolName action="imageSet" />
      </span>
      <div className="image-field__line">
        <SkinThumb
          src={fileName === null ? null : skinImageUrl(pack, fileName)}
          emptyText="leer"
          alt={`Bild: ${label}`}
        />
        <button type="button" className="settings-view__button" disabled={isBusy} onClick={pick}>
          Datei wählen
        </button>
        <input
          type="url"
          className="image-field__url"
          aria-label={`${label}: Bildadresse`}
          placeholder="https://… (höchstens 2 MB)"
          value={urlText}
          disabled={isBusy}
          onChange={(event) => {
            setUrlText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              loadUrl();
            }
          }}
        />
        <button
          type="button"
          className="settings-view__button"
          disabled={isBusy || urlText.trim() === ''}
          onClick={loadUrl}
        >
          Laden
        </button>
        {fileName !== null && (
          <button
            type="button"
            className="settings-view__button image-field__remove"
            disabled={isBusy}
            onClick={remove}
          >
            Entfernen
          </button>
        )}
      </div>
      <div ref={zoneRef} className={`image-field__drop${isOver ? ' image-field__drop--over' : ''}`}>
        {isBusy ? 'Bild wird abgelegt …' : 'oder Bild hierher ziehen'}
      </div>
      {error !== null && (
        <p className="image-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
