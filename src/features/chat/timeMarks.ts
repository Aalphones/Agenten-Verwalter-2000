import type { ChatBlock } from '@/features/chat/buildBlocks';

/** Ab so vielen Minuten zwischen zwei benachbarten Blöcken steht eine Pausenlinie. */
export const GAP_MINUTES = 30;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;

const WEEKDAY_SHORT: readonly string[] = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const WEEKDAY_LONG: readonly string[] = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

export interface TimeSeparator {
  kind: 'day' | 'gap';
  label: string;
}

/** Was zu einem Block gehört: seine Zeit (falls sie angezeigt wird) und die Linie davor. */
export interface BlockTime {
  /** Zeit des Blocks; `null`, wenn der Eintrag keine hat (Bestand). */
  at: number | null;
  /** Nur der erste Block je Minute zeigt die Zeit. */
  showsTime: boolean;
  separator: TimeSeparator | null;
}

/** Die Zeit, zu der der Block begann. Ein Werkzeug-Block trägt die Zeit seines ersten Aufrufs. */
export function blockAt(block: ChatBlock): number | null {
  if (block.kind === 'background') {
    return block.tool.at;
  }
  if (block.kind === 'tools') {
    return block.tools[0]?.at ?? block.purpose?.at ?? null;
  }
  if (block.entry.kind === 'user') {
    return block.entry.sentAt;
  }
  return block.entry.at;
}

/**
 * Zeit und Trennlinie je Block. Die Minuten-Prüfung geht gegen den letzten Block mit Zeit, die Pause nur
 * gegen den unmittelbaren Vorgänger: ein Eintrag ohne Zeit dazwischen verhindert die Linie.
 */
export function buildTimeMarks(blocks: readonly ChatBlock[], now: number): BlockTime[] {
  const marks: BlockTime[] = [];
  let lastTimed: number | null = null;
  let previous: number | null = null;
  for (const block of blocks) {
    const at: number | null = blockAt(block);
    if (at === null) {
      marks.push({ at: null, showsTime: false, separator: null });
      previous = null;
      continue;
    }
    marks.push({
      at,
      showsTime: lastTimed === null || minuteKey(lastTimed) !== minuteKey(at),
      separator: separatorBefore(lastTimed, previous, at, now),
    });
    lastTimed = at;
    previous = at;
  }
  return marks;
}

function separatorBefore(
  lastTimed: number | null,
  previous: number | null,
  at: number,
  now: number,
): TimeSeparator | null {
  if (lastTimed === null || dayKey(lastTimed) !== dayKey(at)) {
    return { kind: 'day', label: formatDay(at, now) };
  }
  if (previous !== null && at - previous >= GAP_MINUTES * MS_PER_MINUTE) {
    return { kind: 'gap', label: formatGap(at - previous) };
  }
  return null;
}

/** „09:47“ in der Ortszeit. */
export function formatClock(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** „Montag, 23.11.2026 · 09:47:05“ für den Tooltip der Zeit. */
export function formatTooltip(at: number): string {
  const date = new Date(at);
  const weekday: string = WEEKDAY_LONG[date.getDay()] ?? '';
  const seconds: string = pad(date.getSeconds());
  return `${weekday}, ${formatDate(date)} · ${formatClock(at)}:${seconds}`;
}

/** „Heute“, „Gestern“, sonst „Fr., 20.11.2026“. */
export function formatDay(at: number, now: number): string {
  const date = new Date(at);
  const daysAgo: number = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / MS_PER_DAY);
  if (daysAgo === 0) {
    return 'Heute';
  }
  if (daysAgo === 1) {
    return 'Gestern';
  }
  return `${WEEKDAY_SHORT[date.getDay()] ?? ''}, ${formatDate(date)}`;
}

/** „34 Min. Pause“, ab einer Stunde „2 Std. 9 Min. Pause“. */
export function formatGap(milliseconds: number): string {
  const minutes: number = Math.round(milliseconds / MS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) {
    return `${String(minutes)} Min. Pause`;
  }
  const hours: number = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${String(hours)} Std. ${String(minutes % MINUTES_PER_HOUR)} Min. Pause`;
}

function formatDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
}

function dayKey(at: number): string {
  const date = new Date(at);
  return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
}

function minuteKey(at: number): string {
  return `${dayKey(at)} ${formatClock(at)}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
