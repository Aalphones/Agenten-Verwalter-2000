import { useState } from 'react';
import type { ReactElement } from 'react';
import { Switch } from '@/components/Switch';
import { ReportIcon } from '@/features/report/ReportIcon';
import { ReportLightbox, type ReportZoom } from '@/features/report/ReportLightbox';
import { ReportMarkLegend } from '@/features/report/ReportMarkLegend';
import { ReportPicture } from '@/features/report/ReportPicture';
import { ReportSteps } from '@/features/report/ReportSteps';
import { entryKey } from '@/features/report/reportDigest';
import {
  AS_DESIGNED_TEXT,
  COMPARE_LABEL,
  DESIGN_CAPTION,
  DEVIATION_LABEL,
  NO_DESIGN_TEXT,
  SHOT_CAPTION,
  ZOOM_LABEL,
  pluralize,
} from '@/features/report/reportTexts';
import type { ReportScreen as ReportScreenData } from '@/lib/bindings/ReportScreen';
import type { ReportShot } from '@/lib/bindings/ReportShot';
import { useReportStore } from '@/stores/report';
import './ReportScreen.css';

interface ReportScreenProps {
  /** Bereich der Phase (`scopeOf`) für gewählte Ansicht und Schalter. */
  scope: string;
  screen: ReportScreenData;
}

/** Ein Bildschirm der Sichtabnahme: Ansichten der Station, daneben der Entwurf, Abweichung, Klickpfad. */
export function ReportScreen({ scope, screen }: ReportScreenProps): ReactElement {
  const [hotMark, setHotMark] = useState<number | null>(null);
  const [zoom, setZoom] = useState<ReportZoom | null>(null);
  const key: string = entryKey(scope, screen.entry);
  const storedView: number = useReportStore((state) => state.screenViewByEntry[key] ?? 0);
  const storedCompare: boolean = useReportStore((state) => state.screenCompareByEntry[key] ?? true);
  const setScreenView = useReportStore((state) => state.setScreenView);
  const setScreenCompare = useReportStore((state) => state.setScreenCompare);
  const viewIndex: number = Math.min(storedView, screen.shots.length - 1);
  const shot: ReportShot | undefined = screen.shots[viewIndex];
  if (shot === undefined) {
    return <section className="report-screen" />;
  }
  const design = shot.design;
  const isComparing: boolean = design !== null && storedCompare;
  const hasAnyDesign: boolean = screen.shots.some((other: ReportShot) => other.design !== null);
  const shotTitle = `${screen.name} · ${shot.label}`;

  function selectView(index: number): void {
    setHotMark(null);
    setScreenView(key, index);
  }

  function renderViews(): ReactElement {
    if (screen.shots.length === 1) {
      return <span className="report-screen__label">{shot?.label}</span>;
    }
    return (
      <span className="report-screen__views" role="group" aria-label="Ansicht">
        {screen.shots.map((other: ReportShot, index: number) => (
          <button
            key={other.label}
            type="button"
            className="report-screen__view"
            aria-pressed={index === viewIndex}
            onClick={(): void => {
              selectView(index);
            }}
          >
            {other.label}
          </button>
        ))}
      </span>
    );
  }

  function renderCompareSwitch(): ReactElement {
    if (design === null) {
      return <span className="report-screen__nodesign">{NO_DESIGN_TEXT}</span>;
    }
    return (
      <label className="report-screen__compare">
        <Switch
          checked={storedCompare}
          label={COMPARE_LABEL}
          onChange={(isOn: boolean): void => {
            setScreenCompare(key, isOn);
          }}
        />
        {COMPARE_LABEL}
      </label>
    );
  }

  function renderDeviation(): ReactElement | null {
    if (screen.deviation !== null) {
      return (
        <p className="report-screen__deviation">
          <ReportIcon name="flag" />
          <b>{DEVIATION_LABEL}</b>
          <span>{screen.deviation}</span>
        </p>
      );
    }
    if (hasAnyDesign) {
      return (
        <p className="report-screen__deviation report-screen__deviation--ok">
          <ReportIcon name="check" />
          <span>{AS_DESIGNED_TEXT}</span>
        </p>
      );
    }
    return null;
  }

  function renderDesign(): ReactElement | null {
    if (design === null || !isComparing) {
      return null;
    }
    return (
      <figure className="report-screen__figure">
        <figcaption>{DESIGN_CAPTION}</figcaption>
        <ReportPicture
          image={design}
          marks={[]}
          alt={`${DESIGN_CAPTION}: ${screen.name}`}
          isNarrow={shot?.narrow ?? false}
          hotMark={null}
          onHotMark={setHotMark}
          onOpen={(): void => {
            setZoom({ title: `${DESIGN_CAPTION}: ${shotTitle}`, image: design, marks: [] });
          }}
        />
      </figure>
    );
  }

  return (
    <section className="report-screen">
      <h4 className="report-screen__name">{screen.name}</h4>
      <p className="report-screen__meta">
        <span>{screen.by}</span>
        <span>{pluralize(screen.shots.length, 'Ansicht', 'Ansichten')}</span>
        {screen.steps.length > 0 && (
          <span>{pluralize(screen.steps.length, 'Klickpfad', 'Klickpfade')}</span>
        )}
      </p>
      {screen.text !== null && <p className="report-screen__text">{screen.text}</p>}
      <div className="report-screen__block">
        <div className="report-screen__head">
          <ReportIcon name="image" />
          {renderViews()}
          <span className="report-screen__spacer" />
          {renderCompareSwitch()}
          <button
            type="button"
            className="report-figure__action"
            onClick={(): void => {
              setZoom({ title: shotTitle, image: shot.image, marks: shot.marks });
            }}
          >
            <ReportIcon name="max" />
            {ZOOM_LABEL}
          </button>
        </div>
        <div
          className={`report-screen__view-grid${isComparing ? ' report-screen__view-grid--compare' : ''}${shot.narrow ? ' report-screen__view-grid--narrow' : ''}`}
        >
          <figure className="report-screen__figure">
            <figcaption>{SHOT_CAPTION}</figcaption>
            <ReportPicture
              image={shot.image}
              marks={shot.marks}
              alt={shotTitle}
              isNarrow={shot.narrow}
              hotMark={hotMark}
              onHotMark={setHotMark}
              onOpen={(): void => {
                setZoom({ title: shotTitle, image: shot.image, marks: shot.marks });
              }}
            />
          </figure>
          {renderDesign()}
        </div>
        <ReportMarkLegend marks={shot.marks} hotMark={hotMark} onHotMark={setHotMark} />
        {renderDeviation()}
      </div>
      {screen.steps.length > 0 && (
        <ReportSteps
          steps={screen.steps}
          screenName={screen.name}
          onOpenImage={(next: ReportZoom): void => {
            setZoom(next);
          }}
        />
      )}
      {zoom !== null && (
        <ReportLightbox
          zoom={zoom}
          onClose={(): void => {
            setZoom(null);
          }}
        />
      )}
    </section>
  );
}
