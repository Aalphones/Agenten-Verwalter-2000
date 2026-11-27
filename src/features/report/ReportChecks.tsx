import type { ReactElement } from 'react';
import { ReportDisclosure } from '@/features/report/ReportDisclosure';
import { ReportIcon } from '@/features/report/ReportIcon';
import { stopOfFile } from '@/features/report/reportDigest';
import { GAPS_TITLE, pluralize, summarizeSources } from '@/features/report/reportTexts';
import type { CheckGap } from '@/lib/bindings/CheckGap';
import type { PhaseChecks } from '@/lib/bindings/PhaseChecks';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportStop } from '@/lib/bindings/ReportStop';
import './ReportChecks.css';

const PERCENT = 100;
const MUTANT_PREFIX = 'Mutant überlebt: ';

interface ReportChecksProps {
  checks: PhaseChecks;
  phase: ReportPhase;
  onJumpToStop: (index: number) => void;
  onOpenFile: (repositoryKey: string, path: string, line: number | null) => void;
}

function percentOf(part: number, whole: number): number {
  if (whole === 0) {
    return 0;
  }
  return Math.round((part / whole) * PERCENT);
}

function gapPlace(gap: CheckGap): string {
  const name: string = gap.path.slice(gap.path.lastIndexOf('/') + 1);
  if (gap.to > gap.from) {
    return `${name}:${String(gap.from)}–${String(gap.to)}`;
  }
  return `${name}:${String(gap.from)}`;
}

/** Prüfzeile der Phase: Prüfkette, Tests, abgedeckte neue Zeilen, Mutation — nur Zahlen aus den Berichtsdateien,
 *  rot nur bei fehlgeschlagenen Tests oder roter Prüfkette. */
export function ReportChecks({
  checks,
  phase,
  onJumpToStop,
  onOpenFile,
}: ReportChecksProps): ReactElement {
  const chain = checks.chain;
  const tests = checks.tests;
  const coverage = checks.coverage;
  const mutation = checks.mutation;

  function renderChain(): ReactElement {
    if (chain === null) {
      return (
        <span className="report-checks__chip report-checks__chip--none">
          Prüfkette nicht erkannt
        </span>
      );
    }
    if (chain.ok) {
      return (
        <span className="report-checks__chip report-checks__chip--ok" title={chain.command}>
          <ReportIcon name="check" />
          Prüfkette grün
        </span>
      );
    }
    return (
      <span className="report-checks__chip report-checks__chip--bad" title={chain.command}>
        <ReportIcon name="flag" />
        Prüfkette rot
      </span>
    );
  }

  function renderTests(): ReactElement {
    if (tests === null) {
      return (
        <span className="report-checks__chip report-checks__chip--none">
          keine Tests für diese Phase
        </span>
      );
    }
    return (
      <span className={`report-checks__chip${tests.failed > 0 ? ' report-checks__chip--bad' : ''}`}>
        Tests <b>{tests.passed}</b> bestanden
        {tests.failed > 0 && (
          <>
            {' · '}
            <b>{tests.failed}</b> fehlgeschlagen
          </>
        )}
        {tests.skipped > 0 && ` · ${String(tests.skipped)} übersprungen`}
      </span>
    );
  }

  function openGap(gap: CheckGap): void {
    const stop: ReportStop | undefined = stopOfFile(phase, gap.repositoryKey, gap.path);
    if (stop === undefined) {
      onOpenFile(gap.repositoryKey, gap.path, gap.from);
      return;
    }
    onJumpToStop(stop.index);
  }

  return (
    <>
      <div className="report-checks">
        {renderChain()}
        {renderTests()}
        {coverage !== null && (
          <span className="report-checks__chip">
            neue Zeilen <b>{percentOf(coverage.covered, coverage.total)} %</b> abgedeckt{' '}
            <small>
              {coverage.covered} von {coverage.total}
            </small>
          </span>
        )}
        {mutation !== null && (
          <span className="report-checks__chip">
            Mutation <b>{percentOf(mutation.killed, mutation.killed + mutation.survived)} %</b>{' '}
            <small>
              {mutation.killed} erkannt · {mutation.survived} überlebt
            </small>
          </span>
        )}
        <span className="report-checks__source">
          {checks.by}
          {checks.sources.length > 0 && ` · ${summarizeSources(checks.sources)}`}
        </span>
      </div>
      {checks.gaps.length > 0 && (
        <ReportDisclosure
          icon="flag"
          title={GAPS_TITLE}
          summary={`${pluralize(checks.gaps.length, 'Stelle', 'Stellen')} im Code markiert`}
        >
          <ul className="report-checks__gaps">
            {checks.gaps.map((gap: CheckGap) => (
              <li
                key={`${gap.kind}:${gap.path}:${String(gap.from)}`}
                className="report-checks__gap"
              >
                <span>
                  {gap.kind === 'mutant' ? MUTANT_PREFIX : ''}
                  {gap.text}
                </span>
                <button
                  type="button"
                  className="report-checks__gap-link"
                  onClick={(): void => {
                    openGap(gap);
                  }}
                >
                  <code>{gapPlace(gap)}</code>
                </button>
              </li>
            ))}
          </ul>
        </ReportDisclosure>
      )}
    </>
  );
}
