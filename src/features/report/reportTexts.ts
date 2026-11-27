import type { ReportNoteKind } from '@/lib/bindings/ReportNoteKind';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { DiagramMode } from '@/stores/report';

export const REPORT_TITLE = 'Review-Bericht';
export const OVERVIEW_TITLE = 'Überblick';
export const TOC_BUTTON_LABEL = 'Inhalt';
export const TOC_SHEET_TITLE = 'Inhalt des Berichts';
export const TOC_LABEL = 'Inhalt';
export const NOT_STARTED_TITLE = 'Noch nicht begonnen';
export const RUNNING_TITLE = 'Läuft gerade';
export const FRESH_TITLE = 'Neu seit deinem letzten Blick';
export const LOADING_TEXT = 'Der Bericht wird gelesen …';
export const EMPTY_TEXT =
  'Noch nichts zu lesen: der Bericht füllt sich, sobald eine Phase Stopps anlegt oder fertig wird.';
export const NOT_STARTED_PAGE_TEXT = 'Diese Phase ist noch nicht begonnen.';
export const RUNNING_BANNER_TITLE = 'Läuft.';
export const RUNNING_BANNER_TEXT =
  'Stopps entstehen beim Schreiben, Ergebnis und Weg ordnet Haiku am Phasenende.';
export const NO_RESULT_TEXT = 'Zu dieser Phase gibt es noch kein geordnetes Ergebnis.';
export const RETIDY_LABEL = 'Neu ordnen';
export const RETIDY_HINT_TITLE = 'Ordnen fehlgeschlagen.';
export const RETIDY_FINISHED_CONFIRM =
  'Beim Neuordnen einer fertigen Phase werden auch die Prüfwerte neu gelesen. Liegen die Berichtsdateien nicht mehr vor, werden sie leer oder kleiner. Trotzdem neu ordnen?';
export const FILES_BUTTON_LABEL = 'Im Reiter Dateien';
export const PREVIOUS_LABEL = '← zurück';
export const NEXT_LABEL = 'weiter →';
export const WAY_TITLE = 'Weg';
export const GAPS_TITLE = 'Lücken';
export const REVIEW_TITLE = 'Review';
export const SCREENS_TITLE = 'Sichtabnahme';
export const DIAGRAM_TAG = 'Mermaid';
export const DIAGRAM_LOADING_TEXT = 'Schaubild wird gezeichnet …';
export const DIAGRAM_FAILED_TITLE = 'Schaubild nicht lesbar:';
export const SOURCE_LABEL = 'Quelltext';
export const ZOOM_LABEL = 'Vergrößern';
export const CLOSE_LABEL = 'Schließen';
export const IMAGE_MISSING_TEXT = 'Bild nicht verfügbar';
export const SHOT_CAPTION = 'Umsetzung';
export const DESIGN_CAPTION = 'Entwurf';
export const COMPARE_LABEL = 'Entwurf daneben';
export const NO_DESIGN_TEXT = 'kein Entwurfsbild';
export const DEVIATION_LABEL = 'Abweichung vom Entwurf';
export const AS_DESIGNED_TEXT = 'wie im Entwurf';
export const STEPS_TITLE = 'Klickpfad';
export const STEP_COLUMNS = ['#', 'Öffnen', 'Tun', 'Erwartet', 'Bild'] as const;
export const BEFORE_LABEL = 'vorher';
export const AFTER_LABEL = 'nachher';
export const LOOK_TITLE = 'Genau hinsehen';
export const RISKS_TITLE = 'Risiken';
export const PHASES_TITLE = 'Phasen';
export const MOVED_TITLE = 'Stelle geändert';
export const MOVED_HINT =
  'Diese Anmerkungen ließen sich im Endstand der Datei nicht mehr an ihrer Zeile finden.';
export const NO_CODE_TEXT = 'Der Code zu diesem Stopp liegt nicht vor (Vorhaben nicht geladen).';
export const UNCOVERED_TITLE = 'Von keinem Test ausgeführt';
export const FALLBACK_STATION_LABEL = 'Umsetzung';
export const REMOVED_FOLD_MIN = 6;

const KIND_LABEL: Readonly<Record<string, string>> = {
  data: 'Datenmodell',
  sec: 'Sicherheit',
  flow: 'Ablauf',
  ui: 'Oberfläche',
};

const NOTE_KIND_LABEL: Record<ReportNoteKind, string> = {
  why: '',
  risk: 'Risiko',
  finding: 'Review',
  mutant: 'Mutant überlebt',
};

const DIAGRAM_MODE_LABEL: Readonly<Record<DiagramMode, string>> = {
  diff: 'Unterschied',
  before: 'Vorher',
  after: 'Nachher',
};

export function diagramModeLabel(mode: DiagramMode): string {
  return DIAGRAM_MODE_LABEL[mode];
}

export function stopKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/** Vorsatz einer Anmerkung am Rand; leer für ein schlichtes „Warum“. */
export function noteKindLabel(kind: ReportNoteKind): string {
  return NOTE_KIND_LABEL[kind];
}

const stampFormat: Intl.DateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** „26.11. 11:02“. */
export function formatStamp(milliseconds: number): string {
  const parts: Intl.DateTimeFormatPart[] = stampFormat.formatToParts(new Date(milliseconds));
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part: Intl.DateTimeFormatPart) => part.type === type)?.value ?? '';
  return `${value('day')}.${value('month')}. ${value('hour')}:${value('minute')}`;
}

export function phaseStamp(phase: ReportPhase): string {
  if (phase.finishedAt === null) {
    return 'läuft';
  }
  return formatStamp(phase.finishedAt);
}

export function phaseHeading(phase: ReportPhase): string {
  return `Phase ${phase.key} · ${phase.stationLabel} · ${phaseStamp(phase)}`;
}

/** Die Kurzfassung der gelesenen Berichtsdateien: ein oder zwei Namen, sonst die Anzahl. */
export function summarizeSources(sources: readonly string[]): string {
  const names: string[] = [];
  for (const source of sources) {
    const name: string = source.slice(source.lastIndexOf('/') + 1);
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  const MAX_NAMES = 2;
  if (names.length <= MAX_NAMES) {
    return names.join(', ');
  }
  return `${String(sources.length)} Berichtsdateien`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}
