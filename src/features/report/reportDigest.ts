import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import type { ReportBlock } from '@/lib/bindings/ReportBlock';
import type { ReportFinding } from '@/lib/bindings/ReportFinding';
import type { ReportNote } from '@/lib/bindings/ReportNote';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportPhaseState } from '@/lib/bindings/ReportPhaseState';
import type { ReportStop } from '@/lib/bindings/ReportStop';
import type { ReportView } from '@/lib/bindings/ReportView';
import type { StationState } from '@/lib/bindings/StationState';
import type { StationView } from '@/lib/bindings/StationView';
import { formatStamp } from '@/features/report/reportTexts';

/** Zustände der Abnahme-Station, in denen der Benutzer sie schon erwartet. */
const ACCEPTANCE_WAITING: readonly StationState[] = [
  'ready',
  'countdown',
  'starting',
  'running',
  'asking',
  'waitsForYou',
];

export type BarTone = 'work' | 'grow' | 'ready' | 'done';

export interface BarState {
  tone: BarTone;
  label: string;
}

/** Eine Phase des Berichts mit ihrer Stelle in der Plan-Folge. */
export function phasesBegun(report: ReportView): ReportPhase[] {
  return report.phases.filter((phase: ReportPhase) => phase.state !== 'notStarted');
}

/** Reihenfolge der Seiten: `null` ist der Überblick, danach die begonnenen Phasen. */
export function pageOrder(report: ReportView): (string | null)[] {
  return [null, ...phasesBegun(report).map((phase: ReportPhase) => phase.key)];
}

/** Der Stopp mit dieser Nummer; die Nummern haben Lücken, die Stelle im Array ist nicht die Nummer. */
export function stopByIndex(phase: ReportPhase, index: number): ReportStop | undefined {
  return phase.stops.find((stop: ReportStop) => stop.index === index);
}

function hasStarted(phase: PhaseView): boolean {
  return phase.stations.some(
    (station: StationView) => station.startedAt !== null || station.completedAt !== null,
  );
}

/** Wie `report::assemble::phase_state`: Stationen des Benutzers zählen nicht, solange die Phase andere hat. */
export function phaseStateOf(phase: PhaseView): ReportPhaseState {
  if (!hasStarted(phase)) {
    return 'notStarted';
  }
  const hasAgents: boolean = phase.stations.some((station: StationView) => !station.byUser);
  const isDone: boolean = phase.stations
    .filter((station: StationView) => !hasAgents || !station.byUser)
    .every((station: StationView) => station.completedAt !== null);
  return isDone ? 'done' : 'running';
}

/** „Review“ erscheint, sobald eine Phase begonnen hat. */
export function hasBegunPhase(implementation: ImplementationView): boolean {
  return implementation.phases.some((phase: PhaseView) => phaseStateOf(phase) !== 'notStarted');
}

/** Fertige Phasen, deren Seite noch nicht offen war. */
export function freshPhaseIds(
  implementation: ImplementationView,
  visited: readonly string[],
): string[] {
  return implementation.phases
    .filter((phase: PhaseView) => phaseStateOf(phase) === 'done' && !visited.includes(phase.id))
    .map((phase: PhaseView) => phase.id);
}

export function runningPhase(report: ReportView): ReportPhase | undefined {
  return report.phases.find((phase: ReportPhase) => phase.state === 'running');
}

function stationById(
  implementation: ImplementationView,
  stationId: string,
): StationView | undefined {
  for (const phase of implementation.phases) {
    const found: StationView | undefined = phase.stations.find(
      (station: StationView) => station.id === stationId,
    );
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** Zustand in der Leiste: wächst, wartet auf Abnahme, abgenommen oder in Arbeit. */
export function barState(report: ReportView, implementation: ImplementationView): BarState {
  const acceptance = report.acceptance;
  if (acceptance !== null && acceptance.state === 'done') {
    const station: StationView | undefined = stationById(implementation, acceptance.stationId);
    const completedAt: number | null = station?.completedAt ?? null;
    const stamp: string = completedAt === null ? '' : ` · ${formatStamp(completedAt)}`;
    return { tone: 'done', label: `abgenommen${stamp}` };
  }
  const running: ReportPhase | undefined = runningPhase(report);
  if (running !== undefined) {
    return { tone: 'grow', label: `wächst · Phase ${running.key} läuft` };
  }
  if (acceptance !== null && ACCEPTANCE_WAITING.includes(acceptance.state)) {
    return { tone: 'ready', label: 'wartet auf Abnahme' };
  }
  return { tone: 'work', label: 'in Arbeit' };
}

/** „Umsetzung X · 3 von 5 Phasen · zuletzt 26.11. 10:12 von #11 Umsetzung“. */
export function barMeta(
  report: ReportView,
  implementationTitle: string,
  phasesTotal: number,
): string {
  const begun: ReportPhase[] = phasesBegun(report);
  const head = `Umsetzung ${implementationTitle} · ${String(begun.length)} von ${String(phasesTotal)} Phasen`;
  const running: ReportPhase | undefined = runningPhase(report);
  if (running !== undefined) {
    return `${head} · Phase ${running.key} schreibt gerade mit`;
  }
  const last: ReportPhase | undefined = begun[begun.length - 1];
  if (last === undefined || last.finishedAt === null) {
    return head;
  }
  return `${head} · zuletzt ${formatStamp(last.finishedAt)} von ${last.stationLabel}`;
}

export interface OverviewFacts {
  phasesBegun: number;
  phasesTotal: number;
  hasRunning: boolean;
  stops: number;
  commits: number;
  files: number;
  added: number;
  removed: number;
}

export function overviewFacts(report: ReportView): OverviewFacts {
  const begun: ReportPhase[] = phasesBegun(report);
  const commits = new Set<string>();
  let stops = 0;
  let files = 0;
  let added = 0;
  let removed = 0;
  for (const phase of begun) {
    stops += phase.stops.length;
    files += phase.files;
    added += phase.added;
    removed += phase.removed;
    for (const commit of phase.commits) {
      commits.add(commit);
    }
  }
  return {
    phasesBegun: begun.length,
    phasesTotal: report.phases.length,
    hasRunning: runningPhase(report) !== undefined,
    stops,
    commits: commits.size,
    files,
    added,
    removed,
  };
}

export interface ChecksSummary {
  /** Fertige Phasen mit Prüfwerten. */
  phases: number;
  chainGreen: number;
  testsPassed: number;
  testsFailed: number;
  withoutTests: string[];
}

/** Prüfwerte über die fertigen Phasen; eine laufende Phase zählt nicht, ihr Prüfketten-Aufruf kann noch laufen. */
export function checksSummary(report: ReportView): ChecksSummary {
  const summary: ChecksSummary = {
    phases: 0,
    chainGreen: 0,
    testsPassed: 0,
    testsFailed: 0,
    withoutTests: [],
  };
  for (const phase of report.phases) {
    if (phase.state !== 'done' || phase.checks === null) {
      continue;
    }
    summary.phases += 1;
    if (phase.checks.chain?.ok === true) {
      summary.chainGreen += 1;
    }
    if (phase.checks.tests === null) {
      summary.withoutTests.push(phase.key);
    } else {
      summary.testsPassed += phase.checks.tests.passed;
      summary.testsFailed += phase.checks.tests.failed;
    }
  }
  return summary;
}

export interface LookItem {
  phaseKey: string;
  stop: ReportStop;
}

export function lookItems(report: ReportView): LookItem[] {
  const items: LookItem[] = [];
  for (const phase of phasesBegun(report)) {
    for (const stop of phase.stops) {
      if (stop.look !== null) {
        items.push({ phaseKey: phase.key, stop });
      }
    }
  }
  return items;
}

export function notesOfBlock(block: ReportBlock): readonly ReportNote[] {
  if (block.type === 'code') {
    return block.notes;
  }
  return [];
}

export interface RiskItem {
  phaseKey: string;
  stop: ReportStop;
  text: string;
}

/** Risiko-Anmerkungen am Code, gesammelt über alle Stopps. */
export function riskItems(report: ReportView): RiskItem[] {
  const items: RiskItem[] = [];
  for (const phase of phasesBegun(report)) {
    for (const stop of phase.stops) {
      for (const block of stop.blocks) {
        for (const note of notesOfBlock(block)) {
          if (note.kind === 'risk') {
            items.push({ phaseKey: phase.key, stop, text: note.text });
          }
        }
      }
    }
  }
  return items;
}

export interface OpenFinding {
  phase: ReportPhase;
  by: string;
  finding: ReportFinding;
}

export function openFindings(report: ReportView): OpenFinding[] {
  const items: OpenFinding[] = [];
  for (const phase of phasesBegun(report)) {
    if (phase.review === null) {
      continue;
    }
    for (const finding of phase.review.open) {
      items.push({ phase, by: phase.review.by, finding });
    }
  }
  return items;
}

/** Eine Stelle, an die der Code-Block eines Stopps springen kann: der erste Stopp der Phase mit dieser Datei. */
export function stopOfFile(
  phase: ReportPhase,
  repositoryKey: string,
  path: string,
): ReportStop | undefined {
  return phase.stops.find((stop: ReportStop) =>
    stop.blocks.some(
      (block: ReportBlock) =>
        block.type === 'code' && block.repositoryKey === repositoryKey && block.path === path,
    ),
  );
}
