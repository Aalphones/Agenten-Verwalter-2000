import { useEffect, useEffectEvent, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { Attachment } from '@/lib/bindings/Attachment';
import { addAttachmentBytes, addAttachmentFiles } from '@/lib/attachments';
import { commandErrorText } from '@/lib/errors';
import { useAttachmentsStore } from '@/stores/attachments';

interface UseAttachmentInputOptions {
  /** Schlüssel im Anhang-Store: Session-ID oder `NEW_SESSION_KEY`. */
  key: string;
  enabled: boolean;
  onError: (message: string) => void;
}

interface AttachmentInput {
  openPicker: () => void;
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  isDragging: boolean;
}

/** Die drei Wege zu einem Anhang: Dateidialog, Hineinziehen ins Fenster, Einfügen aus der Zwischenablage. */
export function useAttachmentInput({
  key,
  enabled,
  onError,
}: UseAttachmentInputOptions): AttachmentInput {
  const [isDraggingRaw, setIsDragging] = useState<boolean>(false);

  function addFiles(paths: string[]): void {
    if (paths.length === 0) {
      return;
    }
    addAttachmentFiles(paths)
      .then((attachments: Attachment[]) => {
        useAttachmentsStore.getState().add(key, attachments);
      })
      .catch((reason: unknown) => {
        onError(commandErrorText(reason));
      });
  }

  function addPasted(files: File[]): void {
    for (const file of files) {
      readAsBase64(file)
        .then((dataBase64: string) => addAttachmentBytes(file.name, dataBase64))
        .then((attachment: Attachment) => {
          useAttachmentsStore.getState().add(key, [attachment]);
        })
        .catch((reason: unknown) => {
          onError(commandErrorText(reason));
        });
    }
  }

  const addDroppedFiles = useEffectEvent((paths: string[]): void => {
    addFiles(paths);
  });

  // Mit aktivem Drag-and-Drop des Fensters kommen HTML-`drop`-Ereignisse ohne Pfade an;
  // Pfade liefert nur das Tauri-Ereignis.
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let isDisposed = false;
    let unlisten: (() => void) | null = null;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === 'enter' || payload.type === 'over') {
          setIsDragging(true);
        } else if (payload.type === 'leave') {
          setIsDragging(false);
        } else {
          setIsDragging(false);
          addDroppedFiles(payload.paths);
        }
      })
      .then((stop: () => void) => {
        if (isDisposed) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch((reason: unknown) => {
        console.error('Hineinziehen nicht verfügbar', reason);
      });
    return (): void => {
      isDisposed = true;
      unlisten?.();
    };
  }, [enabled]);

  function openPicker(): void {
    if (!enabled) {
      return;
    }
    open({ multiple: true, directory: false, title: 'Bilder und Dateien anhängen' })
      .then((selection: string | string[] | null) => {
        if (selection === null) {
          return;
        }
        addFiles(typeof selection === 'string' ? [selection] : selection);
      })
      .catch((reason: unknown) => {
        onError(commandErrorText(reason));
      });
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    if (!enabled || event.clipboardData.files.length === 0) {
      return;
    }
    event.preventDefault();
    addPasted(Array.from(event.clipboardData.files));
  }

  return { openPicker, handlePaste, isDragging: isDraggingRaw && enabled };
}

function readAsBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result: string | ArrayBuffer | null = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Datei nicht lesbar'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error('Datei nicht lesbar'));
    };
    reader.readAsDataURL(file);
  });
}
