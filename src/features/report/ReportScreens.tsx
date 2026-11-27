import type { ReactElement } from 'react';
import { ReportScreen } from '@/features/report/ReportScreen';
import { SCREENS_TITLE, pluralize } from '@/features/report/reportTexts';
import type { ReportScreen as ReportScreenData } from '@/lib/bindings/ReportScreen';
import './ReportScreens.css';

interface ReportScreensProps {
  /** Bereich der Phase (`scopeOf`). */
  scope: string;
  screens: readonly ReportScreenData[];
}

function summaryOf(screens: readonly ReportScreenData[]): string {
  const views: number = screens.reduce(
    (sum: number, screen: ReportScreenData) => sum + screen.shots.length,
    0,
  );
  const deviations: number = screens.filter(
    (screen: ReportScreenData) => screen.deviation !== null,
  ).length;
  const parts: string[] = [
    pluralize(screens.length, 'Bildschirm', 'Bildschirme'),
    pluralize(views, 'Ansicht', 'Ansichten'),
  ];
  if (deviations > 0) {
    parts.push(pluralize(deviations, 'Abweichung', 'Abweichungen'));
  }
  return parts.join(' · ');
}

/** Die Sichtabnahme einer Phase: je Bildschirm die Fotos der Station neben dem Entwurf, in Aufruf-Reihenfolge. */
export function ReportScreens({ scope, screens }: ReportScreensProps): ReactElement {
  return (
    <section className="report-screens" id="report-screens">
      <h3 className="report-screens__title">
        {SCREENS_TITLE}
        <span className="report-screens__summary">{summaryOf(screens)}</span>
      </h3>
      {screens.map((screen: ReportScreenData) => (
        <ReportScreen key={`screen-${String(screen.entry)}`} scope={scope} screen={screen} />
      ))}
    </section>
  );
}
