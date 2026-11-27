import type { ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import { SCREENS_PLACEHOLDER, SCREENS_TITLE } from '@/features/report/reportTexts';
import type { ReportScreen } from '@/lib/bindings/ReportScreen';
import './ReportScreens.css';

const DEVIATION_LABEL = 'Abweichung vom Entwurf';

interface ReportScreensProps {
  screens: readonly ReportScreen[];
}

/** Platz für die Sichtabnahme einer Phase: je Bildschirm ein Rahmen mit Name und Abweichung. Die Bilder und der
 *  Vergleich mit dem Entwurf kommen in einer späteren Phase in diese Rahmen. */
export function ReportScreens({ screens }: ReportScreensProps): ReactElement {
  return (
    <section className="report-screens" id="report-screens">
      <h3 className="report-screens__title">{SCREENS_TITLE}</h3>
      {screens.map((screen: ReportScreen) => (
        <figure key={`screen-${String(screen.entry)}`} className="report-screens__screen">
          <figcaption className="report-screens__head">
            <ReportIcon name="image" />
            <b>{screen.name}</b>
            <span className="report-screens__by">{screen.by}</span>
          </figcaption>
          <div className="report-screens__body">
            {screen.text !== null && <p className="report-screens__text">{screen.text}</p>}
            {screen.deviation !== null && (
              <p className="report-screens__deviation">
                <b>{DEVIATION_LABEL}</b> {screen.deviation}
              </p>
            )}
            <p className="report-screens__placeholder">{SCREENS_PLACEHOLDER}</p>
          </div>
        </figure>
      ))}
    </section>
  );
}
