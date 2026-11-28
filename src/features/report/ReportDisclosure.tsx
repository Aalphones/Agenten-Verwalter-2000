import { useLayoutEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ReportIcon, type ReportIconName } from '@/features/report/ReportIcon';
import './ReportDisclosure.css';

interface ReportDisclosureProps {
  icon: ReportIconName;
  title: string;
  /** Kurzer Zusatz rechts vom Titel, etwa „4 Etappen“. */
  summary: string;
  /** Beim ersten Zeichnen aufgeklappt; danach gehört das Auf- und Zuklappen dem Browser. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Eingeklappter Abschnitt der Phasen-Seite (Weg, Lücken); das Aufklappen merkt sich der Browser am Element. */
export function ReportDisclosure({
  icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: ReportDisclosureProps): ReactElement {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const initiallyOpen = useRef<boolean>(defaultOpen);

  useLayoutEffect(() => {
    if (initiallyOpen.current && detailsRef.current !== null) {
      detailsRef.current.open = true;
    }
  }, []);

  return (
    <details ref={detailsRef} className="report-disclosure">
      <summary className="report-disclosure__summary">
        <ReportIcon name={icon} />
        <b>{title}</b>
        <span>{summary}</span>
      </summary>
      <div className="report-disclosure__body">{children}</div>
    </details>
  );
}
