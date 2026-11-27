import type { ReactElement } from 'react';
import { ReportDisclosure } from '@/features/report/ReportDisclosure';
import { WAY_TITLE, pluralize } from '@/features/report/reportTexts';
import type { ReportWayStep } from '@/lib/bindings/ReportWayStep';
import './ReportWay.css';

const DETOUR_LABEL = 'Umweg';
const TO_STOP_LABEL = 'zum Stopp ↓';

interface ReportWayProps {
  way: readonly ReportWayStep[];
  /** Springt zum Stopp mit dieser Nummer; nur für Stopps, die die Phase wirklich hat. */
  hasStop: (index: number) => boolean;
  onJumpToStop: (index: number) => void;
}

/** Der Weg der Phase: die Etappen in der Reihenfolge, in der die Station sie ging, Umwege hervorgehoben. */
export function ReportWay({ way, hasStop, onJumpToStop }: ReportWayProps): ReactElement | null {
  if (way.length === 0) {
    return null;
  }
  const detours: number = way.filter((step: ReportWayStep) => step.detour).length;
  const summary: string =
    detours === 0
      ? pluralize(way.length, 'Etappe', 'Etappen')
      : `${pluralize(way.length, 'Etappe', 'Etappen')} · ${pluralize(detours, 'Umweg', 'Umwege')}`;
  return (
    <ReportDisclosure icon="route" title={WAY_TITLE} summary={summary}>
      <ol className="report-way">
        {way.map((step: ReportWayStep, position: number) => (
          <li
            key={`${String(position)}-${step.text}`}
            className={`report-way__step${step.detour ? ' report-way__step--detour' : ''}`}
          >
            <span className="report-way__text">
              {step.detour && <b className="report-way__detour">{DETOUR_LABEL}</b>}
              {step.text}
            </span>
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
                  {TO_STOP_LABEL}
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </ReportDisclosure>
  );
}
