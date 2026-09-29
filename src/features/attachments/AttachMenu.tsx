import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import './AttachMenu.css';

const ATTACH_MENU_WIDTH = 330;

interface AttachMenuProps {
  onPick: () => void;
  onClose: () => void;
  placement?: 'above' | 'below';
}

/** Das `+`-Menü der Eingabeleiste. */
export function AttachMenu({
  onPick,
  onClose,
  placement = 'above',
}: AttachMenuProps): ReactElement {
  return (
    <Popover
      label="Hinzufügen"
      placement={placement}
      align="start"
      width={ATTACH_MENU_WIDTH}
      onClose={onClose}
    >
      <button type="button" className="attach-menu__item" onClick={onPick}>
        <span className="attach-menu__label">Datei oder Bild anhängen …</span>
        <kbd className="attach-menu__key">Ctrl U</kbd>
      </button>
      <div className="attach-menu__foot">
        Bilder, PDFs, Text und Code gehen. Einfach ins Fenster ziehen oder mit Ctrl+V einfügen.
      </div>
    </Popover>
  );
}
