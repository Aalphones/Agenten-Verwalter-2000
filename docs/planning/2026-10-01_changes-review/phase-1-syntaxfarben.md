# Phase 1 — Syntaxfarben im Diff, ADR 015

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Messungen“, „Festgelegte Entscheidungen“ (erster Punkt).
- [Design-README](../../design/2026-10-01_changes-review/README.md), Zeile „Diff-Zeilen“.
- `src/features/changes/DiffView.tsx` + `DiffView.css` (Zeilen-Rendering, `renderLine`, `diff-view__text`).
- `src/components/CodeBlock.css` (Abschnitt „Farben der Syntaxhervorhebung“ — wird verschoben), `src/components/Markdown.tsx` (nutzt `rehype-highlight`, bleibt unverändert).
- `src/main.tsx` (Import von `@/styles/theme.css`).
- `src/lib/bindings/DiffLine.ts`, `DiffLineKind.ts`.
- [docs/conventions/typescript.md](../../conventions/typescript.md), [react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md).
- [ADR 006](../../decisions/006-changes-und-diff.md) (Abschnitt „Konsequenzen“), Format-Vorbild für das neue ADR: [ADR 012](../../decisions/012-einstellungen-farbschema-und-listen.md).
- Fehlerklassen geprüft (Vault `sprachen/typescript`, `frameworks/react`): keine einschlägig.

## Abnahmekriterien

- Diffs von `.ts`, `.tsx`, `.rs`, `.css`, `.json`, `.md` zeigen Syntaxfarben über die Tokens `--color-code-*`, in Hell und Dunkel.
- Ein mehrzeiliger Block-Kommentar oder String innerhalb eines Abschnitts ist auf **allen** seinen Zeilen gefärbt; eine gelöschte Zeile wird im Zusammenhang der alten Fassung gefärbt, eine hinzugefügte im Zusammenhang der neuen.
- Text innerhalb eines nicht gefärbten verschachtelten Bereichs (z. B. `${a}` in einem Template-String) übernimmt die Farbe des nächsten gefärbten äußeren Bereichs — genau wie CSS-Vererbung bei verschachtelten Spans.
- Dateien mit unbekannter Endung (`.ps1`, `.lock`, ohne Endung) zeigen den Diff wie bisher ungefärbt, ohne Fehler in der Konsole.
- Codeblöcke im Chat sehen unverändert aus (Farbzuordnung nur verschoben).
- `docs/decisions/015-changes-review.md` existiert; ADR 006 verweist bei „Keine Syntaxfarben im Diff“ auf ADR 015.

## Checkliste

### Farbzuordnung verschieben

- [x] Neue Datei `src/styles/syntax.css`: Kopfkommentar aus `CodeBlock.css` übernehmen („highlight.js vergibt nur Klassen …“), danach **alle** `.hljs-*`-Regeln aus `CodeBlock.css` (von `.hljs-keyword` bis `.hljs-strong`) **ohne** den umschließenden Selektor `.code-block__body` — global, denn die Klassen kommen nur in gefärbtem Inhalt vor.
- [x] In `src/components/CodeBlock.css` den Block `.code-block__body { .hljs-… }` samt Kommentar entfernen.
- [x] `src/main.tsx`: direkt unter `import '@/styles/theme.css';` die Zeile `import '@/styles/syntax.css';`.

### Färben

- [x] Neue Datei `src/lib/syntax.ts`:
  - `const lowlight = createLowlight(common);` (Import `{ createLowlight, common }` aus `lowlight`).
  - `export interface SyntaxSegment { text: string; className: string | null; }` und `export type SyntaxLine = readonly SyntaxSegment[];`
  - `export function languageOf(path: string): string | null` — Endung = Teil nach dem letzten `.` im Dateinamen (nach dem letzten `/`), kleingeschrieben; keine Endung → `null`; `lowlight.registered(endung)` → die Endung, sonst `null`.
  - `const COLORED_CLASSES: ReadonlySet<string>` — genau die Klassen, die `syntax.css` färbt oder stylt (`hljs-keyword`, `hljs-literal`, `hljs-built_in`, `hljs-tag`, `hljs-name`, `hljs-selector-tag`, `hljs-bullet`, `hljs-string`, `hljs-regexp`, `hljs-link`, `hljs-comment`, `hljs-quote`, `hljs-meta`, `hljs-number`, `hljs-title`, `hljs-selector-class`, `hljs-selector-id`, `hljs-section`, `hljs-type`, `hljs-variable`, `hljs-attr`, `hljs-attribute`, `hljs-property`, `hljs-params`, `hljs-addition`, `hljs-deletion`, `hljs-emphasis`, `hljs-strong`), mit Kommentar „muss zu `src/styles/syntax.css` passen“.
  - `export function highlightLines(text: string, language: string | null): SyntaxLine[]` — liefert genau `text.split('\n').length` Zeilen. `language === null` → je Zeile ein Segment `{ text, className: null }`. Sonst `lowlight.highlight(language, text)` in `try`/`catch` (Fehler → wie `null`) und den Baum rekursiv ablaufen: Element-Knoten legen ihren `properties.className` (Array → mit Leerzeichen verbinden) auf einen Stapel; ein Text-Knoten wird an `\n` geteilt — jedes Teilstück geht als Segment in die aktuelle Zeile, jeder `\n` beginnt eine neue Zeile. `className` eines Segments = die Klassenkette des **innersten** Stapel-Elements, das mindestens eine Klasse aus `COLORED_CLASSES` trägt; keins → `null`. Leere Teilstücke nicht als Segment aufnehmen. Gleiche `className` direkt nacheinander zu einem Segment zusammenfassen.
  - `export function highlightLine(text: string, language: string | null): SyntaxLine` → `highlightLines(text, language)[0] ?? []` (für Phase 4).
- [x] Neue Datei `src/features/changes/highlightDiff.ts`: `export function highlightDiff(lines: readonly DiffLine[], language: string | null): SyntaxLine[]` — gleiche Länge und Reihenfolge wie `lines`. Ablauf je Abschnitt (Zeilen zwischen zwei `hunk`-Zeilen bzw. Anfang/Ende): alte Seite = Texte der `context`- und `deleted`-Zeilen in Reihenfolge, neue Seite = `context` und `added`; beide mit `highlightLines(seite.join('\n'), language)` färben; dann zurückverteilen: `added` → nächste Zeile der neuen Seite, `deleted` → nächste der alten, `context` → nächste der neuen (und den Zeiger der alten ebenfalls einen weiterschieben). `hunk`-Zeilen → `[{ text, className: null }]`.

### Diff-Ansicht

- [x] `DiffView.tsx`: `const language: string | null = useMemo(() => languageOf(file.path), [file.path]);` und `const highlighted: SyntaxLine[] = useMemo(() => highlightDiff(lines, language), [lines, language]);`.
- [x] `RenderedLine.text` wird `segments: SyntaxLine`; `renderLine(line, segments)` bekommt die gefärbte Zeile (`highlighted[item.index]`); für die Kürzungs-Meldung `[{ text: TRUNCATED_TEXT, className: null }]`.
- [x] In `diff-view__text` die Segmente rendern: `className === null` → nackter Text, sonst `<span className={segment.className}>{segment.text}</span>`; als `key` der Index.
- [x] Keine CSS-Änderung an `DiffView.css` nötig (Farbe kommt aus `syntax.css`, Grundfarbe bleibt die der Zeilenart).

### Doku

- [x] `docs/decisions/015-changes-review.md` aus README „Festgelegte Entscheidungen“ (alle Punkte, nicht nur Syntaxfarben) und „Messungen“; Format wie ADR 012 (Titel, Status angenommen · Datum 2026-10-01, Kontext / Optionen / Entscheidung / Konsequenzen).
- [x] ADR 006, Abschnitt „Konsequenzen“: die Zeile „Keine Syntaxfarben im Diff.“ ergänzen um „ — abgelöst durch [ADR 015](015-changes-review.md).“
- [x] `docs/code-map.md`: Zeile „Changes“ um `highlightDiff` ergänzen; Zeile „Design-Tokens“ um `src/styles/syntax.css` (Zuordnung highlight.js-Klassen → `--color-code-*`); Zeile „Geteilte UI-Bausteine“ bzw. neue Zeile „Syntaxfarben“ mit `src/lib/syntax.ts` (`languageOf`, `highlightLines`, `highlightLine`).
- [x] Commit `feat(changes): color diff lines by language`.

## Report-Back

Umgesetzt wie geplant. `plainLine` kommt zu den geplanten Exporten von `src/lib/syntax.ts` dazu (Hunk-Köpfe, Kürzungs-Meldung und Rückfall brauchen eine ungefärbte Zeile). Die hast-Typen sind keine direkte Abhängigkeit und werden aus dem Rückgabetyp von `lowlight.highlight` abgeleitet. Geprüft mit einer Wegwerf-Probe unter Node: ein mehrzeiliger Template-String färbt beide Zeilen als String, `${x}` erbt die String-Farbe, ein mehrzeiliger Block-Kommentar färbt alle Zeilen, `.ps1`/ohne Endung/`.gitignore` liefern `null`. `pnpm check` grün.
