import { useState } from 'react';
import type { ReactElement } from 'react';
import { DISCARD_LOCKED_TITLE, DISCARD_TITLE, FAILURE } from '@/features/git/gitTexts';
import { GitDiscardDialog } from '@/features/git/GitDiscardDialog';
import { UndoIcon } from '@/features/git/GitIcons';
import { useGitActions } from '@/features/git/useGitActions';
import { gitDiscard } from '@/lib/git';

interface GitDiscardButtonProps {
  sessionId: string;
  entryKey: string;
  path: string;
  /** Eine Session des Vorhabens arbeitet: der Core lehnt das Verwerfen ab. */
  isBusy: boolean;
  onChanged: () => void;
}

/** Der Knopf, der beim Überfahren einer uncommitteten Datei die Zahlen ersetzt; fragt vor dem Verwerfen. */
export function GitDiscardButton({
  sessionId,
  entryKey,
  path,
  isBusy,
  onChanged,
}: GitDiscardButtonProps): ReactElement {
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const { run, isRunning } = useGitActions(sessionId, onChanged);

  function discard(): void {
    setIsAsking(false);
    run(() => gitDiscard(sessionId, entryKey, path), FAILURE.discard).catch(() => undefined);
  }

  return (
    <>
      <button
        type="button"
        className="file-tree__discard"
        disabled={isBusy || isRunning}
        title={isBusy ? DISCARD_LOCKED_TITLE : DISCARD_TITLE}
        aria-label={`${path}: ${DISCARD_TITLE}`}
        onClick={(): void => {
          setIsAsking(true);
        }}
      >
        <UndoIcon />
      </button>
      {isAsking && (
        <GitDiscardDialog
          path={path}
          onCancel={(): void => {
            setIsAsking(false);
          }}
          onDiscard={discard}
        />
      )}
    </>
  );
}
