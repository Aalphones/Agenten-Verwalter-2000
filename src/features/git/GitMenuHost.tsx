import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './GitMenuHost.css';

interface GitMenuHostProps {
  anchor: HTMLElement;
  children: ReactNode;
}

/** Hängt ein Menü an einen Knopf im scrollenden Dateibaum. Der Baum würde ein Menü in seinem Inneren abschneiden,
 *  deshalb sitzt es am Dokument — an der Stelle des Knopfes, die beim Öffnen gemessen wird. */
export function GitMenuHost({ anchor, children }: GitMenuHostProps): ReactElement | null {
  if (!anchor.isConnected) {
    return null;
  }
  const rect: DOMRect = anchor.getBoundingClientRect();
  return createPortal(
    <div
      className="git-menu-host"
      style={{
        top: `${String(rect.top)}px`,
        left: `${String(rect.left)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
