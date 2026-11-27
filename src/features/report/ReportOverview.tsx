import type { ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import {
  checksSummary,
  lookItems,
  openFindings,
  overviewFacts,
  riskItems,
  type ChecksSummary,
  type LookItem,
  type OpenFinding,
  type OverviewFacts,
  type RiskItem,
} from '@/features/report/reportDigest';
import {
  LOOK_TITLE,
  OVERVIEW_TITLE,
  PHASES_TITLE,
  REPORT_TITLE,
  RISKS_TITLE,
  phaseStamp,
  pluralize,
} from '@/features/report/reportTexts';
import { formatCount } from '@/features/changes/changesScope';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportView } from '@/lib/bindings/ReportView';
import './ReportOverview.css';

const NOT_YET_TEXT = 'folgt';
const SCREENS_LINK_LABEL = 'Sichtabnahme';

interface ReportOverviewProps {
  report: ReportView;
  implementationTitle: string;
  onShowPage: (key: string | null) => void;
  onJumpToStop: (phaseKey: string, stopIndex: number) => void;
}

interface Fact {
  label: string;
  value: string;
  detail: string;
}

function factsOf(facts: OverviewFacts): Fact[] {
  const phasesDetail: string = facts.hasRunning
    ? `von ${String(facts.phasesTotal)}, eine läuft`
    : `von ${String(facts.phasesTotal)}`;
  return [
    { label: 'Phasen', value: String(facts.phasesBegun), detail: phasesDetail },
    { label: 'Stopps', value: formatCount(facts.stops), detail: 'im Bericht' },
    { label: 'Commits', value: formatCount(facts.commits), detail: 'aus Git' },
    { label: 'Dateien', value: formatCount(facts.files), detail: 'je Phase gezählt' },
    {
      label: 'Zeilen',
      value: `+${formatCount(facts.added)} −${formatCount(facts.removed)}`,
      detail: 'aus Git',
    },
  ];
}

/** „Prüfkette grün in 3 von 4 Phasen · Tests 12 bestanden, 0 fehlgeschlagen · Phase 2 ohne Tests“. */
function checksLine(summary: ChecksSummary): string {
  const parts: string[] = [
    `Prüfkette grün in ${String(summary.chainGreen)} von ${String(summary.phases)} Phasen`,
    `Tests ${String(summary.testsPassed)} bestanden, ${String(summary.testsFailed)} fehlgeschlagen`,
  ];
  if (summary.withoutTests.length > 0) {
    parts.push(`Phase ${summary.withoutTests.join(', ')} ohne Tests`);
  }
  return parts.join(' · ');
}

/** Überblick: Kennzahlen, Prüfwerte, worauf zu achten ist, Risiken und die Phasen mit ihrem Ergebnis. */
export function ReportOverview({
  report,
  implementationTitle,
  onShowPage,
  onJumpToStop,
}: ReportOverviewProps): ReactElement {
  const facts: Fact[] = factsOf(overviewFacts(report));
  const checks: ChecksSummary = checksSummary(report);
  const looks: LookItem[] = lookItems(report);
  const risks: RiskItem[] = riskItems(report);
  const findings: OpenFinding[] = openFindings(report);

  function renderPhase(phase: ReportPhase): ReactElement {
    if (phase.state === 'notStarted') {
      return (
        <li key={phase.phaseId} className="report-overview__phase report-overview__phase--later">
          <span className="report-overview__key">{phase.key}</span>
          <b>{phase.title}</b>
          <span className="report-overview__by">{NOT_YET_TEXT}</span>
        </li>
      );
    }
    const isRunning: boolean = phase.state === 'running';
    const text: string = isRunning
      ? `${pluralize(phase.stops.length, 'Stopp', 'Stopps')} bisher · Ergebnis folgt`
      : (phase.result ?? '');
    return (
      <li key={phase.phaseId} className="report-overview__phase">
        <span className="report-overview__key">{phase.key}</span>
        <button
          type="button"
          className="report-overview__link"
          onClick={(): void => {
            onShowPage(phase.key);
          }}
        >
          {phase.title}
        </button>
        <span className="report-overview__by">
          {phase.stationLabel} · {phaseStamp(phase)}
          {phase.commits.length > 0 && <code>{phase.commits.join(' · ')}</code>}
        </span>
        <p className="report-overview__text">
          {text}
          {phase.screens.length > 0 && (
            <button
              type="button"
              className="report-overview__link report-overview__link--inline"
              onClick={(): void => {
                onShowPage(phase.key);
              }}
            >
              <ReportIcon name="image" />
              {SCREENS_LINK_LABEL}: {pluralize(phase.screens.length, 'Bildschirm', 'Bildschirme')}
              {phase.screens.some((screen) => screen.deviation !== null) &&
                `, ${String(phase.screens.filter((screen) => screen.deviation !== null).length)} mit Abweichung`}
            </button>
          )}
        </p>
      </li>
    );
  }

  return (
    <div className="report-overview">
      <p className="report-overview__kicker">
        {REPORT_TITLE} · Umsetzung {implementationTitle}
      </p>
      <h2 className="report-overview__title">{OVERVIEW_TITLE}</h2>
      <dl className="report-overview__facts">
        {facts.map((fact: Fact) => (
          <div key={fact.label} className="report-overview__fact">
            <dt>{fact.label}</dt>
            <dd className="report-overview__value">{fact.value}</dd>
            <dd className="report-overview__detail">{fact.detail}</dd>
          </div>
        ))}
      </dl>
      {checks.phases > 0 && (
        <p className="report-overview__checks">
          <ReportIcon name="check" />
          <span>{checksLine(checks)}</span>
        </p>
      )}
      <div className="report-overview__grid">
        <section>
          <h3 className="report-overview__heading">{LOOK_TITLE}</h3>
          <ul className="report-overview__look">
            {looks.map((item: LookItem) => (
              <li key={`${item.phaseKey}-${String(item.stop.index)}`}>
                <button
                  type="button"
                  className="report-overview__look-link"
                  onClick={(): void => {
                    onJumpToStop(item.phaseKey, item.stop.index);
                  }}
                >
                  <ReportIcon name="eye" />
                  <b>{item.stop.title}</b>
                  <small>{item.stop.look}</small>
                  <span className="report-overview__go">Phase {item.phaseKey} ›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="report-overview__heading">{RISKS_TITLE}</h3>
          <ul className="report-overview__risks">
            {risks.map((item: RiskItem, position: number) => (
              <li key={`risk-${item.phaseKey}-${String(item.stop.index)}-${String(position)}`}>
                <span>
                  <button
                    type="button"
                    className="report-overview__link report-overview__link--inline"
                    onClick={(): void => {
                      onJumpToStop(item.phaseKey, item.stop.index);
                    }}
                  >
                    {item.stop.title}
                  </button>{' '}
                  — {item.text}
                </span>
              </li>
            ))}
            {findings.map((item: OpenFinding) => (
              <li key={`finding-${item.phase.key}-${String(item.finding.entry)}`}>
                <span>
                  <button
                    type="button"
                    className="report-overview__link report-overview__link--inline"
                    onClick={(): void => {
                      onShowPage(item.phase.key);
                    }}
                  >
                    Review {item.by} · offen
                  </button>{' '}
                  — {item.finding.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <h3 className="report-overview__heading">{PHASES_TITLE}</h3>
      <ol className="report-overview__phases">{report.phases.map(renderPhase)}</ol>
    </div>
  );
}
