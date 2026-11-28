import type { ReactElement } from 'react';
import { useNow } from '@/features/background/useNow';
import { ReportDisclosure } from '@/features/report/ReportDisclosure';
import { formatClock, minutesBetween } from '@/features/report/reportTidy';
import { WAY_RUNNING_LABEL, WAY_TITLE, pluralize } from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportWayStep } from '@/lib/bindings/ReportWayStep';
import './ReportWay.css';

const DETOUR_LABEL = 'Umweg';
const TO_STOP_LABEL = 'zum Stopp ↓';
const TO_DIFF_LABEL = 'zum Diff ↓';

interface ReportWayProps {
  phase: ReportPhase;
  /** Springt zum Stopp mit dieser Nummer; nur für Stopps, die die Phase wirklich hat. */
  hasStop: (index: number) => boolean;
  onJumpToStop: (index: number) => void;
}

function stagesText(way: readonly ReportWayStep[]): string {
  return pluralize(way.length, 'Etappe', 'Etappen');
}

function callCount(way: readonly ReportWayStep[]): number {
  return way.reduce(
    (sum: number, step: ReportWayStep) => sum + step.calls.length + step.reads + step.writes,
    0,
  );
}

/** Der Weg der Phase: die Etappen in der Reihenfolge, in der die Station sie ging — aus Haikus Ordnung mit
 *  Umwegen oder, ohne Ordnung, aus dem Verlauf mit Uhrzeit, Ort und Befehlen. */
export function ReportWay({ phase, hasStop, onJumpToStop }: ReportWayProps): ReactElement | null {
  const way: readonly ReportWayStep[] = phase.way;
  const isRunning: boolean = phase.state === 'running';
  const startedAt: number | null = way[0]?.at ?? null;
  const now: number = useNow(isRunning && startedAt !== null);

  if (way.length === 0) {
    return null;
  }

  /** Aus dem Verlauf: Aufrufe und Dauer. Aus Haikus Ordnung: die Umwege. */
  function summaryText(): string {
    if (startedAt === null) {
      const detours: number = way.filter((step: ReportWayStep) => step.detour).length;
      return detours === 0
        ? stagesText(way)
        : `${stagesText(way)} · ${pluralize(detours, 'Umweg', 'Umwege')}`;
    }
    const calls: string = pluralize(callCount(way), 'Aufruf', 'Aufrufen');
    if (isRunning) {
      return `bisher ${stagesText(way)} · ${pluralize(callCount(way), 'Aufruf', 'Aufrufe')} in ${String(minutesBetween(startedAt, now))} min`;
    }
    const end: number = phase.finishedAt ?? startedAt;
    return `${stagesText(way)} · aus ${calls} in ${String(minutesBetween(startedAt, end))} min`;
  }

  function renderCalls(step: ReportWayStep): ReactElement | null {
    if (step.calls.length === 0 && step.reads === 0 && step.writes === 0) {
      return null;
    }
    return (
      <ul className="report-way__calls">
        {step.calls.map((call: string, position: number) => (
          <li key={`${String(position)}-${call}`}>{call}</li>
        ))}
        {step.reads > 0 && <li>+ {step.reads} × gelesen oder gesucht</li>}
        {step.writes > 0 && <li>{step.writes} × geändert</li>}
      </ul>
    );
  }

  return (
    <ReportDisclosure
      icon="route"
      title={WAY_TITLE}
      summary={summaryText()}
      defaultOpen={isRunning}
    >
      <ol className="report-way">
        {way.map((step: ReportWayStep, position: number) => (
          <li
            key={`${String(position)}-${step.text}`}
            className={`report-way__step${step.detour ? ' report-way__step--detour' : ''}`}
          >
            <span className="report-way__text">
              {step.detour && <b className="report-way__detour">{DETOUR_LABEL}</b>}
              <span>{step.text}</span>
              {step.at !== null && <span className="report-way__time">{formatClock(step.at)}</span>}
              {step.location !== null && <span className="report-way__tag">{step.location}</span>}
              {step.commit !== null && <code>{step.commit}</code>}
              {step.running && (
                <span className="report-way__tag report-way__tag--running">
                  {WAY_RUNNING_LABEL}
                </span>
              )}
            </span>
            {renderCalls(step)}
            <span className="report-way__files">
              {step.files.map((file: string) => (
                <code key={file}>{file}</code>
              ))}
              {step.stop !== null && hasStop(step.stop) && (
                <button
                  type="button"
                  className="report-way__link"
                  onClick={(): void => {
                    if (step.stop !== null) {
                      onJumpToStop(step.stop);
                    }
                  }}
                >
                  {step.at === null ? TO_STOP_LABEL : TO_DIFF_LABEL}
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </ReportDisclosure>
  );
}
