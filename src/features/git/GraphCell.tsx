import type { ReactElement } from 'react';
import { laneColor, laneX, type GraphRow } from '@/features/git/gitGraph';

const ROW_HEIGHT = 22;
const MIDDLE = ROW_HEIGHT / 2;
const LINE_WIDTH = 1.6;
const DOT_RADIUS = 3.6;
const RING_RADIUS = 3.8;
const RING_WIDTH = 1.8;

interface GraphCellProps {
  row: GraphRow;
  commitId: string;
  /** Noch nicht im Upstream: der Punkt wird zum Ring. */
  isUnpushed: boolean;
}

function renderLine(key: string, lane: number, fromY: number, toY: number): ReactElement {
  const x: number = laneX(lane);
  return (
    <line
      key={key}
      x1={x}
      y1={fromY}
      x2={x}
      y2={toY}
      stroke={laneColor(lane)}
      strokeWidth={LINE_WIDTH}
    />
  );
}

function renderCurve(key: string, path: string, lane: number): ReactElement {
  return <path key={key} d={path} stroke={laneColor(lane)} strokeWidth={LINE_WIDTH} fill="none" />;
}

/** Die Graph-Spalte einer Verlaufszeile: durchlaufende Linien, Kurven in Merges und der Punkt des Commits. */
export function GraphCell({ row, commitId, isUnpushed }: GraphCellProps): ReactElement {
  const { lane, lanesBefore, lanesAfter } = row;
  const laneCount: number = Math.max(lanesBefore.length, lanesAfter.length, lane + 1);
  const centerX: number = laneX(lane);
  const elements: ReactElement[] = [];
  for (let index = 0; index < laneCount; index += 1) {
    const isRunning: boolean =
      index !== lane &&
      (lanesBefore[index] ?? null) !== null &&
      (lanesAfter[index] ?? null) !== null;
    if (isRunning) {
      elements.push(renderLine(`run:${String(index)}`, index, 0, ROW_HEIGHT));
    }
  }
  if (lanesBefore[lane] === commitId) {
    elements.push(renderLine('above', lane, 0, MIDDLE));
  }
  if ((lanesAfter[lane] ?? null) !== null) {
    elements.push(renderLine('below', lane, MIDDLE, ROW_HEIGHT));
  }
  for (const source of row.mergingIn) {
    const sourceX: number = laneX(source);
    elements.push(
      renderCurve(
        `in:${String(source)}`,
        `M ${String(sourceX)} 0 C ${String(sourceX)} ${String(MIDDLE)}, ${String(centerX)} 0, ${String(centerX)} ${String(MIDDLE)}`,
        source,
      ),
    );
  }
  for (const target of row.branchingOut) {
    const targetX: number = laneX(target);
    elements.push(
      renderCurve(
        `out:${String(target)}`,
        `M ${String(centerX)} ${String(MIDDLE)} C ${String(centerX)} ${String(ROW_HEIGHT)}, ${String(targetX)} ${String(MIDDLE)}, ${String(targetX)} ${String(ROW_HEIGHT)}`,
        target,
      ),
    );
  }
  return (
    <svg className="git-graph-cell" width={row.width} height={ROW_HEIGHT} aria-hidden="true">
      {elements}
      {isUnpushed ? (
        <circle
          cx={centerX}
          cy={MIDDLE}
          r={RING_RADIUS}
          fill="var(--color-bg-base)"
          stroke="var(--color-accent)"
          strokeWidth={RING_WIDTH}
        />
      ) : (
        <circle cx={centerX} cy={MIDDLE} r={DOT_RADIUS} fill={laneColor(lane)} />
      )}
    </svg>
  );
}
