import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { switchQuestion } from '@/features/git/gitTexts';
import './GitDialog.css';

const TITLE_ID = 'git-switch-title';
const LISTED_PATHS = 5;

interface GitSwitchDialogProps {
  branch: string;
  entryName: string;
  /** Alle ungecommitteten Pfade des Eintrags, eigene und fremde. */
  paths: readonly string[];
  onCancel: () => void;
  onTake: () => void;
  onStash: () => void;
}

/** Wechsel mit offenen Änderungen: mitnehmen oder beiseitelegen — oder lassen. */
export function GitSwitchDialog({
  branch,
  entryName,
  paths,
  onCancel,
  onTake,
  onStash,
}: GitSwitchDialogProps): ReactElement {
  const rest: number = paths.length - LISTED_PATHS;
  return (
    <Dialog labelledBy={TITLE_ID} className="git-dialog" onClose={onCancel}>
      <h3 id={TITLE_ID} className="git-dialog__title">
        Wechsel auf „{branch}“
      </h3>
      <p className="git-dialog__text">{switchQuestion(paths.length, entryName)}</p>
      <ul className="git-dialog__paths">
        {paths.slice(0, LISTED_PATHS).map((path: string) => (
          <li key={path}>{path}</li>
        ))}
        {rest > 0 && <li>… und {String(rest)} weitere</li>}
      </ul>
      <div className="git-dialog__actions">
        <button type="button" className="git-dialog__button" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="git-dialog__button" onClick={onTake}>
          Mitnehmen
        </button>
        <button
          type="button"
          className="git-dialog__button git-dialog__button--primary"
          onClick={onStash}
        >
          Beiseitelegen und wechseln
        </button>
      </div>
    </Dialog>
  );
}
