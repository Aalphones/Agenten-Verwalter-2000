import type { DiagramMode } from '@/stores/report';

/** Zeile mit Marker: `+ ` neu, `- ` entfällt, `~ ` geändert, davor beliebig Einrückung. */
const MARKER_LINE = /^(\s*)([+~-]) (.*)$/;
const HEX_COLOR = /^#([0-9a-f]{6})$/i;
const HEX_CHANNELS = 2;

type DiffKind = 'add' | 'del' | 'chg';

const KIND_OF: Readonly<Record<string, DiffKind>> = { '+': 'add', '-': 'del', '~': 'chg' };

/** Farben der drei Arten; aus den Tokens der App gelesen, damit Hell und Dunkel stimmen. */
export type DiffColors = Readonly<Record<DiffKind, string>>;

const COLOR_TOKENS: Readonly<Record<DiffKind, string>> = {
  add: '--color-status-completed',
  del: '--color-status-error',
  chg: '--color-status-waiting',
};

/** Deckkraft der Füllung eines Knotens bzw. des Streifens einer Sequenz-Nachricht. */
const FILL_ALPHA: Readonly<Record<DiffKind, number>> = { add: 0.18, del: 0.12, chg: 0.16 };
const RECT_ALPHA = 0.16;
const DASHED = 'stroke-dasharray:5 3';

export function readDiffColors(): DiffColors {
  const style: CSSStyleDeclaration = getComputedStyle(document.documentElement);
  const read = (kind: DiffKind): string => style.getPropertyValue(COLOR_TOKENS[kind]).trim();
  return { add: read('add'), del: read('del'), chg: read('chg') };
}

/** Farbe mit Deckkraft. `#rrggbbaa` für `classDef` (dort trennen Kommas die Eigenschaften), `rgba(…)` für `rect`.
 *  Ein Wert, der kein `#rrggbb` ist, bleibt unverändert und ohne Deckkraft. */
function withAlpha(color: string, alpha: number, form: 'hex8' | 'rgba'): string {
  const match: RegExpMatchArray | null = HEX_COLOR.exec(color);
  const digits: string | undefined = match?.[1];
  if (digits === undefined) {
    return color;
  }
  if (form === 'hex8') {
    return `#${digits}${Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')}`;
  }
  const channels: number[] = [0, 2, 4].map((start: number) =>
    parseInt(digits.slice(start, start + HEX_CHANNELS), 16),
  );
  return `rgba(${channels.join(',')},${String(alpha)})`;
}

/** Hat der Mermaid-Text mindestens eine Zeile mit Marker? Nur dann gibt es Unterschied, Vorher und Nachher. */
export function hasDiff(code: string): boolean {
  return code.split('\n').some((line: string) => MARKER_LINE.test(line));
}

interface ParsedLine {
  body: string;
  kind: DiffKind | null;
  marker: string | null;
}

function parseLine(line: string): ParsedLine {
  const match: RegExpExecArray | null = MARKER_LINE.exec(line);
  if (match === null) {
    return { body: line, kind: null, marker: null };
  }
  const marker: string = match[2] ?? '';
  return { body: `${match[1] ?? ''}${match[3] ?? ''}`, kind: KIND_OF[marker] ?? null, marker };
}

function isDropped(marker: string | null, mode: DiagramMode): boolean {
  return (mode === 'before' && marker === '+') || (mode === 'after' && marker === '-');
}

/** Sequenzdiagramm: gefärbte Nachrichten als `rect`-Block um die zusammenhängenden Zeilen einer Art. */
function sequenceView(lines: readonly ParsedLine[], mode: DiagramMode, colors: DiffColors): string {
  const out: string[] = [];
  let open: DiffKind | null = null;
  for (const line of lines) {
    if (isDropped(line.marker, mode)) {
      continue;
    }
    const kind: DiffKind | null = mode === 'diff' ? line.kind : null;
    if (kind !== open) {
      if (open !== null) {
        out.push('  end');
      }
      if (kind !== null) {
        out.push(`  rect ${withAlpha(colors[kind], RECT_ALPHA, 'rgba')}`);
      }
      open = kind;
    }
    out.push(line.body);
  }
  if (open !== null) {
    out.push('  end');
  }
  return out.join('\n');
}

const DIRECTIVE_LINE = /^\s*(classDef|class|click|style|linkStyle|%%)/;
const CLICK_LINE = /^\s*click/;
const EDGE_TOKEN = /--|==|-\./;
const NODE_AFTER_EDGE = /([A-Za-z_]\w*)\s*\[\]/g;
const LEADING_NODE = /^([A-Za-z_]\w*)/;

/** Text ohne Beschriftungen, damit Pfeile und Knoten-IDs der Zeile sichtbar bleiben. */
function stripLabels(body: string): string {
  return body.replace(/"[^"]*"|\[[^\]]*\]|\{[^}]*\}|\([^)]*\)/g, '[]');
}

function nodesOfLine(bare: string, isEdge: boolean): string[] {
  if (isEdge) {
    return [...bare.matchAll(NODE_AFTER_EDGE)].flatMap((found: RegExpMatchArray) =>
      found[1] === undefined ? [] : [found[1]],
    );
  }
  const id: string | undefined = LEADING_NODE.exec(bare.trim())?.[1];
  return id === undefined ? [] : [id];
}

function styleLines(
  nodes: Readonly<Record<DiffKind, ReadonlySet<string>>>,
  edges: readonly (readonly [number, DiffKind])[],
  colors: DiffColors,
): string[] {
  const out: string[] = [
    `  classDef add fill:${withAlpha(colors.add, FILL_ALPHA.add, 'hex8')},stroke:${colors.add},stroke-width:2px`,
    `  classDef del fill:${withAlpha(colors.del, FILL_ALPHA.del, 'hex8')},stroke:${colors.del},stroke-width:2px,${DASHED}`,
    `  classDef chg fill:${withAlpha(colors.chg, FILL_ALPHA.chg, 'hex8')},stroke:${colors.chg},stroke-width:2px`,
  ];
  for (const kind of ['add', 'del', 'chg'] as const) {
    if (nodes[kind].size > 0) {
      out.push(`  class ${[...nodes[kind]].join(',')} ${kind}`);
    }
  }
  for (const [index, kind] of edges) {
    out.push(
      `  linkStyle ${String(index)} stroke:${colors[kind]},stroke-width:2px${kind === 'del' ? `,${DASHED}` : ''}`,
    );
  }
  return out;
}

/** Flussdiagramm: Knoten per `classDef`/`class`, Kanten per `linkStyle` (Index = Reihenfolge der Kantenzeilen). */
function flowchartView(
  lines: readonly ParsedLine[],
  mode: DiagramMode,
  colors: DiffColors,
): string {
  const out: string[] = [];
  const nodes: Record<DiffKind, Set<string>> = {
    add: new Set<string>(),
    del: new Set<string>(),
    chg: new Set<string>(),
  };
  const edges: [number, DiffKind][] = [];
  let edgeCount = 0;
  for (const line of lines) {
    if (isDropped(line.marker, mode)) {
      continue;
    }
    const kind: DiffKind | null = mode === 'diff' ? line.kind : null;
    const bare: string = stripLabels(line.body);
    const isEdge: boolean = EDGE_TOKEN.test(bare) && !DIRECTIVE_LINE.test(bare);
    if (kind !== null && !CLICK_LINE.test(bare)) {
      nodesOfLine(bare, isEdge).forEach((id: string) => nodes[kind].add(id));
    }
    if (isEdge) {
      if (kind !== null) {
        edges.push([edgeCount, kind]);
      }
      edgeCount += 1;
    }
    out.push(line.body);
  }
  if (mode === 'diff') {
    out.push(...styleLines(nodes, edges, colors));
  }
  return out.join('\n');
}

/** Der Mermaid-Text in einer der drei Ansichten. Vorher lässt `+ `-Zeilen weg, Nachher lässt `- `-Zeilen weg, beide
 *  entfernen die Marker; Unterschied behält alle Zeilen und färbt sie. */
export function mermaidView(
  code: string,
  mode: DiagramMode,
  colors: DiffColors = readDiffColors(),
): string {
  const lines: ParsedLine[] = code.split('\n').map(parseLine);
  const first: string = code.split('\n')[0] ?? '';
  if (/^\s*sequenceDiagram/.test(first)) {
    return sequenceView(lines, mode, colors);
  }
  return flowchartView(lines, mode, colors);
}
