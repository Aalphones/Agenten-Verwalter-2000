import type { ReactElement } from 'react';
import { formatClock } from '@/features/context/formatTokens';
import {
  hintCount,
  isPending,
  kindLabel,
  linksText,
  mirroredText,
  mirrorSummary,
  stateText,
} from '@/features/environment/environmentTexts';
import { useEnvironment } from '@/features/environment/useEnvironment';
import { SettingRow } from '@/features/settings/SettingRow';
import type { BrokenLink } from '@/lib/bindings/BrokenLink';
import type { EnvironmentStatus } from '@/lib/bindings/EnvironmentStatus';
import type { MirrorDiff } from '@/lib/bindings/MirrorDiff';
import './EnvironmentRows.css';

interface LibraryMirrorRowProps {
  userSkillsDir: string;
  userSkillCount: number;
}

function skillCountText(count: number): string {
  return count === 1 ? '1 Skill' : `${String(count)} Skills`;
}

function brokenLinkText(link: BrokenLink): string {
  return link.target === null ? link.path : `${link.path} → ${link.target}`;
}

function renderList(diffs: readonly MirrorDiff[]): ReactElement {
  return (
    <ul className="environment-row__list">
      {diffs.map((diff: MirrorDiff) => (
        <li key={`${diff.kind}/${diff.name}`} className="environment-row__item">
          <span className="environment-row__kind">{kindLabel(diff.kind)}</span>
          <span>{diff.name}</span>
          <span
            className={`environment-row__state${isPending(diff) ? ' environment-row__state--pending' : ''}`}
          >
            {stateText(diff)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LibraryMirrorRow({
  userSkillsDir,
  userSkillCount,
}: LibraryMirrorRowProps): ReactElement {
  const { status, error, mirrorError, isChecking, isMirroring, check, mirror } = useEnvironment();

  function renderCheckButton(): ReactElement {
    return (
      <button type="button" className="settings-view__button" disabled={isChecking} onClick={check}>
        Erneut prüfen
      </button>
    );
  }

  function renderMutedLine(text: string): ReactElement {
    return (
      <div className="environment-row__line">
        <span className="environment-row__muted">{text}</span>
        {renderCheckButton()}
      </div>
    );
  }

  function renderEqual(loaded: EnvironmentStatus): ReactElement {
    const hints: MirrorDiff[] = loaded.diffs.filter((diff: MirrorDiff) => !isPending(diff));
    const equalText: string =
      loaded.lastMirror === null ? 'Gleich' : `Gleich · ${mirroredText(loaded.lastMirror)}`;
    return (
      <>
        <div className="environment-row__line">
          <span className="environment-row__ok">{equalText}</span>
          {renderCheckButton()}
        </div>
        {hints.length > 0 && (
          <details className="environment-row__hints">
            <summary>{hintCount(hints.length)}</summary>
            {renderList(hints)}
          </details>
        )}
      </>
    );
  }

  function renderDiffering(loaded: EnvironmentStatus, summary: string): ReactElement {
    return (
      <>
        <div className="environment-row__line">
          <span className="environment-row__warn">{summary}</span>
          <button
            type="button"
            className="settings-view__button environment-row__primary"
            disabled={isMirroring}
            onClick={mirror}
          >
            {isMirroring ? 'Gleicht ab …' : 'Abgleichen'}
          </button>
        </div>
        {renderList(loaded.diffs)}
      </>
    );
  }

  function renderState(): ReactElement {
    if (status === null) {
      return renderMutedLine(isChecking ? 'Lädt …' : '—');
    }
    if (status.masterDir === null) {
      return renderMutedLine('Kein Ordner gewählt');
    }
    if (status.masterError !== null) {
      return renderMutedLine(`Kein Abgleich. ${status.masterError}`);
    }
    const summary: string | null = mirrorSummary(status.diffs);
    if (summary === null) {
      return renderEqual(status);
    }
    return renderDiffering(status, summary);
  }

  function renderLocal(loaded: EnvironmentStatus): ReactElement {
    const hasBrokenLinks: boolean = loaded.links.broken.length > 0;
    return (
      <span className={hasBrokenLinks ? 'environment-row__warn' : 'environment-row__muted'}>
        Lokal{' '}
        <span className="environment-row__mono" title={userSkillsDir}>
          {userSkillsDir}
        </span>
        {` · ${skillCountText(userSkillCount)} · ${linksText(loaded.links)}`}
      </span>
    );
  }

  function renderBrokenLinks(loaded: EnvironmentStatus): ReactElement {
    return (
      <>
        {loaded.links.broken.map((link: BrokenLink) => (
          <span key={link.path} className="environment-row__mono" title={brokenLinkText(link)}>
            {brokenLinkText(link)}
          </span>
        ))}
        <span className="environment-row__muted">
          Ziel fehlt · zuletzt geprüft {formatClock(loaded.checkedAt)}
        </span>
      </>
    );
  }

  return (
    <SettingRow id="libraryMirror">
      <div className="environment-row__stack">
        {renderState()}
        {status !== null && renderLocal(status)}
        {status !== null && status.links.broken.length > 0 && renderBrokenLinks(status)}
        {error !== null && <span className="environment-row__warn">{error}</span>}
        {mirrorError !== null && <span className="environment-row__warn">{mirrorError}</span>}
      </div>
    </SettingRow>
  );
}
