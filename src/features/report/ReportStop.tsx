import type { ReactElement } from 'react';
import { ReportCodeBlock } from '@/features/report/ReportCode';
import { ReportCommentButton } from '@/features/report/ReportCommentButton';
import { ReportCommentCards } from '@/features/report/ReportCommentCards';
import { ReportFigureBlock } from '@/features/report/ReportFigure';
import { ReportIcon, type ReportIconName } from '@/features/report/ReportIcon';
import {
  useReportCommenting,
  type EntryTarget,
  type ReportCommenting,
} from '@/features/report/reportCommentsContext';
import { stopKindLabel } from '@/features/report/reportTexts';
import type { ReportBlock } from '@/lib/bindings/ReportBlock';
import type { ReportStop as ReportStopData } from '@/lib/bindings/ReportStop';
import './ReportStop.css';

const KIND_ICONS: readonly ReportIconName[] = ['data', 'sec', 'flow', 'ui'];
const SECURITY_KIND = 'sec';
const LOOK_LABEL = 'Worauf achten';

interface ReportStopProps {
  /** Bereich der Phase (`scopeOf`). */
  scope: string;
  stop: ReportStopData;
  isFlashing: boolean;
  hasMargin: boolean;
  onOpenFile: (repositoryKey: string, path: string, line: number | null) => void;
}

function kindIcon(kind: string): ReportIconName | null {
  return KIND_ICONS.find((name: ReportIconName) => name === kind) ?? null;
}

/** Ein Stopp als Abschnitt der Phasen-Seite: Titel, Art und Urheber, Worauf achten, Lead, dann die Blöcke. */
export function ReportStop({
  scope,
  stop,
  isFlashing,
  hasMargin,
  onOpenFile,
}: ReportStopProps): ReactElement {
  const icon: ReportIconName | null = kindIcon(stop.kind);
  const commenting: ReportCommenting = useReportCommenting();
  const target: EntryTarget = {
    entry: stop.lead?.entry ?? null,
    label: stop.title,
    slot: `s${String(stop.index)}`,
  };
  return (
    <section
      className={`report-stop${isFlashing ? ' report-stop--flash' : ''}`}
      data-stop={stop.index}
    >
      <h3 className="report-stop__title">{stop.title}</h3>
      <p className="report-stop__meta">
        <span
          className={`report-stop__kind${stop.kind === SECURITY_KIND ? ' report-stop__kind--security' : ''}`}
        >
          {icon !== null && <ReportIcon name={icon} />}
          {stopKindLabel(stop.kind)}
        </span>
        <span>{stop.by}</span>
        {commenting.isEnabled && (
          <span className="report-stop__comment">
            <ReportCommentButton
              ariaLabel={`Kommentar zum Stopp ${stop.title}`}
              onComment={(anchor: Element): void => {
                commenting.commentOnEntry(anchor, target);
              }}
            />
          </span>
        )}
      </p>
      {stop.look !== null && (
        <p className="report-stop__look">
          <ReportIcon name="eye" />
          <b>{LOOK_LABEL}</b>
          <span>{stop.look}</span>
        </p>
      )}
      {stop.lead !== null && <p className="report-stop__lead">{stop.lead.text}</p>}
      {stop.blocks.map((block: ReportBlock, position: number) => {
        if (block.type === 'code') {
          return (
            <ReportCodeBlock
              key={`${block.repositoryKey}:${block.path}:${String(position)}`}
              code={block}
              hasMargin={hasMargin}
              onOpenFile={onOpenFile}
            />
          );
        }
        return (
          <ReportFigureBlock key={`figure-${String(block.entry)}`} scope={scope} figure={block} />
        );
      })}
      <ReportCommentCards comments={commenting.commentsOfEntry(target)} />
    </section>
  );
}
