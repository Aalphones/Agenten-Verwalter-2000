import type { ReactElement } from 'react';
import { CommitField } from '@/features/skins/CommitField';
import { FiguresEditor } from '@/features/skins/FiguresEditor';
import { nameError } from '@/features/skins/limits';
import { StyleEditor } from '@/features/skins/StyleEditor';
import { useSkinPack } from '@/features/skins/useSkinPack';
import { useSkinsStore } from '@/stores/skins';
import './SkinPackEditor.css';

interface SkinPackEditorProps {
  packId: string;
}

/** Die Unteransicht der Seite „Skins“: ein Paket bearbeiten, mit „‹ Skins“ zurück zur Liste. */
export function SkinPackEditor({ packId }: SkinPackEditorProps): ReactElement {
  const setEditingPackId = useSkinsStore((state) => state.setEditingPackId);
  const { pack, loadError, actions } = useSkinPack(packId);

  function back(): void {
    setEditingPackId(null);
  }

  const backButton: ReactElement = (
    <button type="button" className="settings-view__button" onClick={back}>
      ‹ Skins
    </button>
  );

  if (loadError !== null) {
    return (
      <div className="skin-pack-editor">
        <div className="skin-pack-editor__back">{backButton}</div>
        <p className="skin-pack-editor__error" role="alert">
          {loadError}
        </p>
      </div>
    );
  }
  if (pack === null) {
    return (
      <div className="skin-pack-editor">
        <div className="skin-pack-editor__back">{backButton}</div>
        <p className="skin-pack-editor__hint">Paket wird geladen …</p>
      </div>
    );
  }

  const isFigures: boolean = pack.data.kind === 'figures';
  return (
    <div className="skin-pack-editor">
      <div className="skin-pack-editor__back">
        {backButton}
        <b className="skin-pack-editor__name">{pack.name}</b>
        <span className="skin-pack-editor__kind">{isFigures ? 'Figurenpaket' : 'Stilpaket'}</span>
      </div>
      <div className="skin-pack-editor__rename">
        <CommitField
          label="Name"
          toolAction="rename"
          value={pack.name}
          validate={(raw: string): string | null => nameError(raw, 'Der Name eines Pakets')}
          onCommit={(raw: string): Promise<string | null> => actions.rename(raw.trim())}
        />
      </div>
      {isFigures ? (
        <FiguresEditor pack={pack} actions={actions} />
      ) : (
        <StyleEditor pack={pack} actions={actions} />
      )}
    </div>
  );
}
