import type { ReactElement, ReactNode } from 'react';
import { ReportIcon, type ReportIconName } from '@/features/report/ReportIcon';
import './ReportDisclosure.css';

interface ReportDisclosureProps {
  icon: ReportIconName;
  title: string;
  /** Kurzer Zusatz rechts vom Titel, etwa „4 Etappen“. */
  summary: string;
  children: ReactNode;
}

/** Eingeklappter Abschnitt der Phasen-Seite (Weg, Lücken); das Aufklappen merkt sich der Browser am Element. */
export function ReportDisclosure({
  icon,
  title,
  summary,
  children,
}: ReportDisclosureProps): ReactElement {
  return (
    <details className="report-disclosure">
      <summary className="report-disclosure__summary">
        <ReportIcon name={icon} />
        <b>{title}</b>
        <span>{summary}</span>
      </summary>
      <div className="report-disclosure__body">{children}</div>
    </details>
  );
}
