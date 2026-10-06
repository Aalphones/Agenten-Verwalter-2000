import type { GitLogCommit } from '@/lib/bindings/GitLogCommit';

/** Abstand der Spuren im Graphen und Lage der ersten Spur, in Pixeln. */
export const LANE_SPACING = 10;
export const LANE_ORIGIN = 9;
const GRAPH_PADDING_RIGHT = 6;
const LANE_COLOR_COUNT = 7;

/** Eine Zeile des Graphen. Eine Spur trägt die ID des Commits, den sie als Nächstes erwartet, oder `null`, wenn sie
 *  frei ist. */
export interface GraphRow {
  lane: number;
  lanesBefore: readonly (string | null)[];
  lanesAfter: readonly (string | null)[];
  /** Spuren, die in dieser Zeile in den Commit münden (weitere Kinder desselben Commits). */
  mergingIn: readonly number[];
  /** Spuren der weiteren Eltern eines Merge-Commits. */
  branchingOut: readonly number[];
  width: number;
}

function firstFreeLane(lanes: (string | null)[]): number {
  const free: number = lanes.indexOf(null);
  if (free >= 0) {
    return free;
  }
  lanes.push(null);
  return lanes.length - 1;
}

function trimTrailingFree(lanes: readonly (string | null)[]): (string | null)[] {
  const trimmed: (string | null)[] = [...lanes];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === null) {
    trimmed.pop();
  }
  return trimmed;
}

function layoutRow(commit: GitLogCommit, lanes: (string | null)[]): GraphRow {
  const lanesBefore: (string | null)[] = trimTrailingFree(lanes);
  const known: number = lanes.indexOf(commit.id);
  const lane: number = known >= 0 ? known : firstFreeLane(lanes);
  const mergingIn: number[] = [];
  lanes.forEach((expected: string | null, index: number) => {
    if (index !== lane && expected === commit.id) {
      mergingIn.push(index);
      lanes[index] = null;
    }
  });
  lanes[lane] = commit.parents[0] ?? null;
  const branchingOut: number[] = [];
  for (const parent of commit.parents.slice(1)) {
    const running: number = lanes.indexOf(parent);
    if (running >= 0) {
      branchingOut.push(running);
      continue;
    }
    const free: number = firstFreeLane(lanes);
    lanes[free] = parent;
    branchingOut.push(free);
  }
  const lanesAfter: (string | null)[] = trimTrailingFree(lanes);
  const laneCount: number = Math.max(lanesBefore.length, lanesAfter.length, lane + 1);
  return {
    lane,
    lanesBefore,
    lanesAfter,
    mergingIn,
    branchingOut,
    width: LANE_ORIGIN + LANE_SPACING * laneCount + GRAPH_PADDING_RIGHT,
  };
}

/** Legt die Commits (neueste zuerst) auf Spuren. Reine Funktion: dieselbe Eingabe, dieselbe Zeichnung. */
export function layoutGraph(commits: readonly GitLogCommit[]): GraphRow[] {
  const lanes: (string | null)[] = [];
  return commits.map((commit: GitLogCommit) => layoutRow(commit, lanes));
}

export function laneX(lane: number): number {
  return LANE_ORIGIN + LANE_SPACING * lane;
}

/** Farbe einer Spur, zyklisch über die Diagrammfarben. */
export function laneColor(lane: number): string {
  return `var(--color-chart-${String((lane % LANE_COLOR_COUNT) + 1)})`;
}
