# Unveränderte Zeilen aufklappen

Ziel: Die Diff-Ansicht der Changes bleibt kompakt (drei Zeilen Umgebung je Änderung), zeigt aber zwischen den Änderungen, vor der ersten und nach der letzten einen grauen Balken mit Pfeilen. Ein Klick auf einen Pfeil blendet bis zu 20 unveränderte Zeilen an dieser Stelle ein, ein Klick auf den Text im Balken die ganze Lücke. Im Dateikopf klappt „Ganze Datei“ alle Balken auf. Eingeblendete Zeilen sind echte Zeilen: Nummern, Farben, Syntaxfärbung und Review-Kommentare wie überall. Vorbild: Bitbucket. Entwurf: [artifacts/entwurf-unveraenderte-zeilen.html](artifacts/entwurf-unveraenderte-zeilen.html), vom User am 2026-10-29 freigegeben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeile „Changes“), [docs/glossary.md](../../glossary.md), [docs/conventions/](../../conventions/) (Rust, TypeScript, React, Tailwind), [ADR 006](../../decisions/006-changes-und-diff.md) (Core liefert Diff-Zeilen, eigene virtualisierte Ansicht, höchstens 20.000 Zeilen), [ADR 015](../../decisions/015-changes-review.md) (Syntaxfärbung, Review-Kommentare je Zeile, kommentierbar auch unveränderte Zeilen). Fehlerklassen geprüft: im Vault liefert ein Glob über `sprachen`, `frameworks`, `werkzeuge` keine Dateien; keine einschlägige Fehlerklasse belegt, also keine geprüft (Lücke, kein Negativbefund).

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: erster Versuch zurückbauen, Zeilenzahl im Diff, Befehl für Zeilenbereiche; ADR 043 | standard | complete |
| 2 | Oberfläche: Balken, Aufklappen, „Ganze Datei“, Kommentare auf eingeblendeten Zeilen; Doku-Abschluss | heikel | complete (Lauf in der echten App offen) |

**Rahmen:** strikt 1 → 2 (Phase 2 braucht die erzeugten Bindings aus Phase 1; zwei Phasen, deshalb keine Parallelspur), direkt auf `main`, ein Commit pro Phase, Scope `changes`. `pnpm check` grün vor jedem Commit, `cargo` im PATH (Prüfkette auf diesem Rechner: siehe [STATE.md](../../../STATE.md), „Nächster Schritt“), keine neuen Abhängigkeiten, Bindings mitcommitten. Keine automatisierten Tests (Projektregel, [linting.md](../../conventions/linting.md)), keine Smoke-Checkliste. Planabschluss mit Versions-Tag (Minor-Version).

## Festgelegte Entscheidungen

- **Nachladen statt große Umgebung.** Der Diff bleibt bei `-U3`. Die versteckten Zeilen holt die Oberfläche bereichsweise über einen neuen Befehl. Der erste Versuch („Ganze Datei“ als Umschalter, der den Diff mit `-U1000000` neu lädt) ist **nicht** committet und wird in Phase 1 und 2 vollständig zurückgebaut.
- **Nur die neue Fassung.** Unveränderte Zeilen sind in alter und neuer Fassung gleich; geladen wird die neue (Arbeitsverzeichnis bzw. bei Blickwinkel „Committet“ der letzte eigene Commit der Datei). Die alte Nummer ergibt sich aus der neuen minus einem festen Abstand je Lücke.
- **Zeilenzahl kommt mit dem Diff.** `FileDiff` bekommt `new_line_count`, damit der Balken nach der letzten Änderung seine Größe kennt. Fehlt sie (binär, gelöscht, nicht lesbar, über 8 MB), gibt es keinen Balken nach der letzten Änderung. Neue Datei: Zahl = Zeilen der Datei, es entstehen keine Balken.
- **Lücken ergeben sich aus den Abschnittsköpfen.** Die Oberfläche liest `@@ -a,b +c,d @@` (kein neues Feld in `DiffLine`). Nicht lesbarer Kopf → für diese Lücke kein Balken.
- **Eingeblendete Zeilen bilden immer einen Anfang und ein Ende der Lücke** (Pfeil nach unten hängt an, Pfeil nach oben stellt voran; Text holt den Rest). Gespeichert je Lücke als `{ head, tail }`.
- **Schritt: 20 Zeilen** (Annahme; für Bitbucket Cloud nicht belegt). Ist der Rest kleiner, kommt der ganze Rest und der Balken verschwindet.
- **Zustand ist flüchtig und gilt für genau einen Diff.** Lädt der Diff neu (Zahlen der Datei haben sich geändert), sind alle Aufklappungen weg — abgeleitet, nicht per Effekt: der Zustand merkt sich das `FileDiff`-Objekt, für das er gilt.
- **Färbung der eingeblendeten Zeilen:** je Block (ein Klick) als zusammenhängender Text mit `highlightLines`. Ein mehrzeiliger Kommentar, der an der Blockgrenze beginnt, kann am Rand ungefärbt bleiben — dieselbe Grenze gibt es heute zwischen zwei Abschnitten.
- **Entfällt gegenüber dem Entwurf:** das kurze Aufblinken neu eingeblendeter Zeilen. Virtualisierte Zeilen würden beim Zurückscrollen erneut blinken. Alles andere im Entwurf gilt.
- **ADR:** 043 (034, 037, 038 sind in anderen Plänen reserviert; 042 ist die höchste vergebene).

## Kontrakt

```rust
// src-tauri/src/changes/model.rs, camelCase, derive(TS)
pub struct FileDiff {
    pub lines: Vec<DiffLine>,
    pub binary: bool,
    pub truncated: bool,
    /// Zeilen der neuen Fassung; fehlt bei Binärem, Gelöschtem, nicht Lesbarem und Dateien über 8 MB.
    pub new_line_count: Option<u32>,
}

/// Die Zeilen `from..=to` der neuen Fassung (1-basiert, an die Dateigröße gekürzt, höchstens
/// `MAX_DIFF_LINES`), ohne Zeilenende.
pub struct FileLines {
    pub lines: Vec<String>,
}
```

Befehl (`src-tauri/src/commands/changes.rs`, Muster wie `changes_file_diff`):

```rust
changes_file_lines(session_id: String, reach: ChangesReach, key: String, path: String,
                   scope: ChangeScope, from: u32, to: u32) -> Result<FileLines, CommandError>
```

Fehler: `from == 0` oder `to < from` → `Internal("Ungültiger Zeilenbereich: von–bis")`; Pfad, Schlüssel und Ordner prüft wie bei `changes_file_diff` `validate_path` und `sources::find`; kein Text (binär, über 8 MB, Datei fehlt) → `Internal("Kein Text: Binärdatei, größer als 8 MB oder nicht mehr vorhanden.")`. Wrapper in `src/lib/changes.ts`: `loadFileLines(sessionId, reach, key, path, scope, from, to): Promise<FileLines>`.

Lücken (Oberfläche, `diffRows.ts`): je Abschnitt mit Kopf `@@ -a,b +c,d @@` gilt `firstNew = d === 0 ? c + 1 : c`, `lastNew = firstNew + d - 1`, `firstOld = b === 0 ? a + 1 : a`, `lastOld = firstOld + b - 1`.

- Lücke vor einem Abschnitt: `from = (Vorgänger-lastNew oder 0) + 1`, `to = firstNew - 1`, `delta = firstOld - firstNew` (alte Nummer = neue + delta). Ist `to < from`: keine Lücke. Liegt sie vor dem ersten Abschnitt: Position `top`, sonst `middle`.
- Lücke nach dem letzten Abschnitt (nur wenn `newLineCount` gesetzt und der Diff nicht gekürzt ist): `from = lastNew + 1`, `to = newLineCount`, `delta = lastOld - lastNew`, Position `bottom`.
- Arme: `top` nur Pfeil nach oben, `bottom` nur Pfeil nach unten, `middle` beide (Pfeil nach unten oben, Pfeil nach oben unten, wie im Entwurf). Der Pfeil nach unten holt `[from', min(to', from' + 19)]` und hängt an `head`; der nach oben `[max(from', to' - 19), to']` und stellt `tail` voran; der Text `[from', to']` an `head`. Dabei sind `from' = from + head.length`, `to' = to - tail.length`.

## Phase 1 — Core

Lesen: `src-tauri/src/changes/mod.rs` (`file_diff`, `untracked_diff`, `read_text`, `MAX_UNTRACKED_BYTES`), `src-tauri/src/changes/model.rs` (`FileDiff`), `src-tauri/src/changes/parse.rs` (`MAX_DIFF_LINES`), `src-tauri/src/git/mod.rs` (`run_raw`, `diff_tree_patch`), `src-tauri/src/commands/changes.rs`, `src-tauri/examples/changes-probe.rs`, [docs/conventions/rust.md](../../conventions/rust.md).

AK:
1. `git diff` im Repository zeigt keinen Rest des ersten Versuchs mehr: kein `PatchContext`, kein `whole_file`, kein `wholeFile`, `-U3` fest wie vor dem Versuch.
2. `changes_file_diff` liefert `newLineCount` gleich der Zeilenzahl der neuen Fassung (Blickwinkel „Committet“: Fassung des letzten eigenen Commits; „Alles“ und „Nicht committet“: Arbeitsverzeichnis). Für eine binäre, gelöschte oder über 8 MB große Datei ist sie leer, für eine neue (untracked) Datei gleich ihrer Zeilenzahl.
3. `changes_file_lines` liefert für eine Datei mit 100 Zeilen und `from = 90, to = 120` genau die Zeilen 90–100, für `from = 5, to = 7` genau drei Zeilen; `from = 0` und `to < from` ergeben einen Fehler, bevor Git oder das Dateisystem berührt wird.
4. Beide Befehle prüfen Pfad und Schlüssel wie bisher (`../x` ergibt „Ungültiger Pfad“).

Checkliste:
- [x] Rückbau: `git status` prüfen — dürfen nur die Dateien des ersten Versuchs geändert sein (`src-tauri/examples/changes-probe.rs`, `src-tauri/src/changes/mod.rs`, `src-tauri/src/commands/changes.rs`, `src-tauri/src/git/actions.rs`, `src-tauri/src/git/mod.rs`, `src/lib/changes.ts`, `src/features/changes/useFileDiff.ts`, `src/features/changes/DiffView.tsx`, `src/features/changes/DiffView.css`); steht dort etwas anderes, 🔴 an den User, nicht draufschreiben. Dann diese Dateien bis auf `DiffView.tsx` und `DiffView.css` mit `git checkout -- <Dateien>` zurücksetzen. `DiffView.tsx`/`.css` räumt Phase 2 auf (Schalter und `__whole`-Stil werden weiterverwendet).
- [x] `model.rs`: `FileDiff.new_line_count: Option<u32>` und `FileLines` nach Kontrakt, Doc-Kommentare wie dort.
- [x] `changes/mod.rs`: aus `untracked_diff` die Zeilenzerlegung (`split('\n')`, `\r` abschneiden, letztes leeres Stück weg) in `fn text_lines(content: &str) -> Vec<&str>` herausziehen und von dort mitbenutzen. Neue `fn new_side(source, path, scope, own) -> Result<Option<String>, CommandError>`: Blickwinkel `Committed` → `git::show_file(&worktree, &file.to, path)` mit `file` aus `own_file`, sonst `read_text(&worktree.join(native_path(path)))`; liefert `None` für binär, über 8 MB, nicht lesbar. `file_diff` setzt `new_line_count` aus `new_side` (Fehler dabei sind kein Fehler des Diffs: dann `None`); `untracked_diff` setzt die Zeilenzahl aus `text_lines`; `parse::unified` setzt zunächst `None`.
- [x] `git/mod.rs`: `pub fn show_file(worktree, rev, path) -> Option<String>` (`git show <rev>:<path>` über `run_raw`; jeder Git-Fehler ergibt `None`, weil der Diff dieselbe Datei kurz zuvor schon gelesen hat; Größe und Binärprobe wie `read_text`).
- [x] `changes/mod.rs`: `pub fn file_lines(source, path, scope, own, from, to) -> Result<FileLines, CommandError>` — Prüfung wie `file_diff` (`validate_path`, Quelle, Repository vorhanden), Bereichsprüfung, dann `new_side` → `text_lines` → Ausschnitt, höchstens `MAX_DIFF_LINES` Zeilen.
- [x] `commands/changes.rs`: `changes_file_lines` nach Kontrakt; in `lib.rs` neben `changes_file_diff` eintragen.
- [x] `changes-probe.rs`: bei `[<Schlüssel> <Pfad>]` zusätzlich `neue Zeilen: <n|—>` ausgeben und optional `[<von> <bis>]` anhängen, das die Zeilen über `file_lines` druckt.
- [x] `pnpm bindings`; `pnpm check` grün; Bindings (`FileDiff.ts`, `FileLines.ts`) mitcommitten.
- [x] ADR `docs/decisions/043-unveraenderte-zeilen.md` (10 Zeilen): Kontext (ADR 006 liefert nur Diff-Zeilen), Optionen (a) Umgebung vergrößern und Diff neu laden — verworfen, weil kein Aufklappen an der Stelle, Kürzung bei 20.000 Zeilen, Neuladen; (b) beide Fassungen vollständig laden — verworfen wie in ADR 006; (c) Zeilen der neuen Fassung bereichsweise nachladen — gewählt. Konsequenzen: ein Befehl mehr, `FileDiff` um `new_line_count` erweitert, ADR 006 bleibt gültig.
- [x] Doku: `docs/code-map.md` Zeile „Changes“ um `changes_file_lines`, `file_lines`, `FileLines`, ADR 043 ergänzen; `AGENTS.md` Zeile `changes-probe` um die neue Ausgabe und die Bereichsangabe; `docs/glossary.md` Eintrag **Lücke** („unveränderte Zeilen zwischen zwei Änderungen einer Datei, als Balken im Diff, aufklappbar“, ADR 043).
- [x] Verifikation selbst ausführen und im Report-Back festhalten: Probe gegen eine Kopie der Datenbank (nie gegen `%USERPROFILE%\.verwalter\verwalter.db`) für drei Fälle — geänderte Datei (Zeilenzahl, Bereich innerhalb und über das Ende hinaus), neue Datei, gelöschte Datei; je Aufruf und Ausgabe.

Report-Back: Probe-Ausgaben der drei Fälle, `pnpm check`-Ergebniszeile, Commit-Hash.

## Phase 2 — Oberfläche

Lesen: `src/features/changes/DiffView.tsx` und `DiffView.css` (Zeilenliste, `commentTargetOf`, `renderLine`, virtualisierte Liste, Kommentarknöpfe), `src/features/changes/highlightDiff.ts`, `src/features/changes/useFileDiff.ts`, `src/lib/syntax.ts` (`highlightLines`, `plainLine`, `languageOf`), `src/lib/changes.ts`, `src/stores/review.ts` (`lineIdOf`), `src/features/review/reviewLabels.ts` (`lineLabel`), den Entwurf [artifacts/entwurf-unveraenderte-zeilen.html](artifacts/entwurf-unveraenderte-zeilen.html) (Abschnitt „Zum Ausprobieren“ ist die Vorlage für Aufbau und Verhalten), [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md), [docs/decisions/043-unveraenderte-zeilen.md](../../decisions/043-unveraenderte-zeilen.md).

Neue Dateien und Zuschnitt:
- `src/features/changes/diffRows.ts` — reine Funktionen, keine React-Importe: `hunkRange(text)` (Kopf lesen, `null` wenn nicht lesbar), `buildRows(diff, expansions)` → `DiffRow[]` mit den Lücken-Formeln aus dem Kontrakt.
- `src/features/changes/useGapExpansion.ts` — Hook: `expansions` (je Lücken-Kennung `{ head, tail }` mit `{ line, text, segments }`), `expand(gap, 'down' | 'up' | 'all')`, `expandAll()`, `collapseAll()`, `busyGap`, `errorGap`; ruft `loadFileLines`; färbt jeden geladenen Block mit `highlightLines(text.join('\n'), language)`.
- `src/lib/changes.ts` — `loadFileLines` nach Kontrakt, JSDoc mit `@throws` wie bei `loadFileDiff`.

```ts
// diffRows.ts
export type GapPosition = 'top' | 'middle' | 'bottom';
export type DiffRow =
  | { kind: 'line'; index: number }                       // Zeile aus diff.lines, nie ein Abschnittskopf
  | { kind: 'revealed'; line: number; oldLine: number; text: string; segments: SyntaxLine }
  | { kind: 'gap'; id: number; from: number; to: number; delta: number; position: GapPosition }
  | { kind: 'truncated' };                                 // Kürzungs-Meldung wie bisher
```

`id` einer Lücke ist ihr ursprüngliches `from`; `from`/`to` in der Zeile sind das, was noch versteckt ist. Beim Aufbau stehen eingeblendete Anfangszeilen (`head`) vor dem Balken, eingeblendete Endzeilen (`tail`) dahinter.

AK:
1. **Kein `@@`-Kopf mehr sichtbar.** An seiner Stelle steht, wo Zeilen fehlen, ein Balken: oben (vor der ersten Änderung) nur mit Pfeil nach oben, unten nur mit Pfeil nach unten, dazwischen mit beiden. Eine Datei, die ab Zeile 1 beginnt und bis zum Ende reicht, hat keinen Balken.
2. **Aufbau des Balkens** (Entwurf): Spalte links so breit wie die beiden Nummernspalten (2 × 48 px) mit den Pfeilknöpfen übereinander, rechts der Text „<n> unveränderte Zeilen anzeigen“ (bei 1: „Zeile“), mindestens 26 px hoch; Hintergrund `--color-diff-hunk-bg`, oben und unten eine Linie `--color-border-subtle`, Text `--font-sans`, `--font-size-xs`, `--color-fg-muted`; Pfeilknopf bei Hover `--color-bg-hover`, Fokus mit `outline: 2px solid var(--color-accent)`.
3. **Erklärung:** jeder Pfeilknopf hat `title` („Zeilen darunter anzeigen“ / „Zeilen darüber anzeigen“) und `aria-label` mit der Zahl der Zeilen, die er holt; der Text im Balken ist ein Knopf mit dem Zustand „<n> unveränderte Zeilen anzeigen“.
4. **Verhalten:** Pfeil = bis zu 20 Zeilen an der Seite des Pfeils, Text = die ganze Lücke; ist der Rest kleiner als 20, wird alles geholt und der Balken verschwindet. Während des Ladens sind die Knöpfe dieses Balkens gesperrt.
5. **Eingeblendete Zeilen** zeigen beide Nummern (alt = neu + `delta`), Syntaxfarben und den „+“-Knopf für Review-Kommentare. Ein Kommentar auf Zeile n hat dieselbe Kennung wie ein Kommentar auf der unveränderten Zeile n aus dem Diff (`lineIdOf(scope, key, path, 'context', n)`) und erscheint unter der Zeile samt Kommentarfeld und Karte wie bisher.
6. **Scrollposition bleibt:** Nach einem Klick ändert sich `scrollTop` des Diff-Körpers nicht; die geklickte Stelle bleibt sichtbar und springt nicht an den Anfang.
7. **„Ganze Datei“** im Dateikopf (Stil `diff-view__whole` aus dem ersten Versuch) holt mit **einem** Aufruf `loadFileLines(1, min(newLineCount, 20000))` und füllt alle Lücken; der Knopf heißt dann „Nur Änderungen“ und klappt alle wieder zu. Er fehlt, wenn der Diff keinen Balken hat (neue, gelöschte, binäre Datei, Änderung über die ganze Datei). `aria-pressed` ist wahr, wenn kein Balken mehr übrig ist.
8. **Fehler beim Nachladen** (Datei zwischenzeitlich verschwunden): Meldung im Balken in `--color-status-error`, Balken bleibt, Knöpfe wieder frei.
9. **Neuladen des Diffs** (Zahlen der Datei ändern sich) setzt alle Aufklappungen zurück, ohne dass dafür ein Effekt nötig ist.
10. **Rückbau abgeschlossen:** in `src/` kommen `wholeFile` und `whole` nur noch als Teil von „Ganze Datei“ vor; `useFileDiff` und `loadFileDiff` haben wieder ihre ursprünglichen Parameter.

Checkliste:
- [x] `useFileDiff.ts`, `loadFileDiff`: Zustand wie vor dem ersten Versuch (Phase 1 hat sie zurückgesetzt) — nur prüfen.
- [x] `diffRows.ts`, `useGapExpansion.ts`, `loadFileLines` anlegen; `DiffView.tsx` auf `DiffRow[]` umstellen: `count = rows.length`, Zeile je `kind` rendern (Balken, eingeblendete Zeile wie `context`, Kürzungs-Meldung wie bisher), `commentTargetOf` auf `(kind, Nummer, Text)` verallgemeinern, damit eingeblendete Zeilen kommentierbar sind. `highlightDiff` bleibt unverändert für Diff-Zeilen.
- [x] Schalter „Ganze Datei“ von `wholeFile`-State auf `expandAll`/`collapseAll` umhängen.
- [x] `DiffView.css`: `__gap`, `__gap-arrows`, `__gap-button`, `__gap-label`, `__gap-error` (BEM wie die übrigen Blöcke, Tokens aus AK 2); `__whole` bleibt.
- [x] `pnpm check` grün.
- [ ] Selbstprüfung in der laufenden App (`pnpm tauri dev`, Prüfkette: [STATE.md](../../../STATE.md)): eine Datei mit zwei weit auseinanderliegenden Änderungen öffnen, Pfeile und Text klicken, bis Balken verschwinden, Kommentar auf eingeblendeter Zeile setzen, „Ganze Datei“ und zurück, neue Datei (kein Balken), Scrollposition vor und nach dem Klick. Je Punkt ein Screenshot oder eine Zeile im Report-Back. — **Offen in der echten App:** ein zweiter Verwalter teilt sich mit dem laufenden die Datenbank unter `%USERPROFILE%\.verwalter` (fester Pfad), in dem die Umsetzungs-Session lief. Ersatzweise geprüft im Browser-Prüfstand: echte `DiffView` samt CSS, Virtualisierung und Färbung, nur der Core nachgebaut (`mockIPC`), Edge headless; alle Fälle der Liste plus AK 2–4, 8, 9, siehe Report-Back.
- [x] Doku: `docs/code-map.md` Zeile „Changes“ um `diffRows.ts`, `useGapExpansion.ts`, `loadFileLines` ergänzen; `docs/glossary.md` **Lücke** auf Oberfläche erweitern (Balken, Pfeile, „Ganze Datei“).

Report-Back: Screenshots der Fälle aus der Selbstprüfung, `pnpm check`-Ergebniszeile, Commit-Hash.

**Report-Back Phase 2 (2026-10-29):**
- Prüfstand (Datei mit 200 → 201 Zeilen: alte Zeile 50 gelöscht, nach alter 148 zwei eingefügt; dazu eine neue Datei mit 30 Zeilen): 28 von 28 Prüfungen grün — drei Balken 46/92/49 mit den richtigen Pfeilen, kein `@@`; Pfeil unten in der Mitte holt 53–72, Pfeil oben 125–144, Text den Rest; oben 46 → 26 → 6 → Balken weg; alte Nummer = neue + Abstand auf jeder eingeblendeten Zeile (Mitte +1, unten −1, letzte Zeile 201 = alt 200); `scrollTop` vor und nach dem Klick gleich (auch gescrollt bei 1488 px), die erste eingeblendete Zeile steht genau, wo der Balken stand; Kommentar auf eingeblendeter Zeile 30 hat die Kennung `all|repo1|src/demo.ts|new30` und erscheint als Karte darunter; „Ganze Datei“ = ein Aufruf, danach „Nur Änderungen“ mit `aria-pressed`, zurück ergibt wieder drei Balken; während des Ladens alle Knöpfe gesperrt; Fehler erscheint rot im Balken, Balken und Knöpfe bleiben; Neuladen des Diffs setzt alles zurück; neue Datei ohne Balken und ohne „Ganze Datei“.
- Prüfkette: `eslint` 0 Warnungen, `tsc` (App und Node) 0 Fehler, `prettier --check` sauber, `vite build` grün, kein BEM-Selektor mit `__`/`--` am Anfang im gebauten CSS; `cargo fmt --check` sauber, `cargo clippy --all-targets -- -D warnings` ohne Befund (kein Rust geändert).
- Commit: `66ed0b2` (nach Abnahme des Diffs durch den User).
- Abweichungen: (1) Während eines Nachladens sind die Knöpfe **aller** Balken und „Ganze Datei“ gesperrt, nicht nur die des geklickten Balkens — es lädt immer nur eines, sonst könnten zwei Antworten dieselbe Lücke doppelt füllen. (2) „Ganze Datei“ holt von der ersten bis zur letzten versteckten Zeile (höchstens 20.000) statt `1..min(newLineCount, 20000)`: gleiche Wirkung, weniger Zeilen, geht auch ohne `newLineCount`. (3) Liefert der Core für einen Pfeil weniger Zeilen als angefragt (Pfeil nach oben) oder keine (sonst), steht „Die Datei hat sich seit dem Diff geändert.“ im Balken, statt Zeilen mit falschen Nummern einzublenden. (4) Die virtualisierte Liste hat stabile Schlüssel je Zeile (`rowKey`), sonst hingen gemessene Höhen und der Scroll-Anker nach dem Einfügen an der falschen Zeile.

## Finale AK (fürs Ganze)

1. In der Diff-Ansicht öffnet jeder Balken die versteckten Zeilen an Ort und Stelle, ohne den Diff neu zu laden.
2. „Ganze Datei“ zeigt die gesamte Datei und lässt sich wieder auf „Nur Änderungen“ zurückstellen.
3. Auf eingeblendeten Zeilen funktionieren Review-Kommentare wie auf allen anderen.
4. Der erste Versuch (Umschalter mit großer Umgebung) ist restlos entfernt.
5. `pnpm check` ist grün, Code-Map, Glossar, AGENTS.md und ADR 043 sind nachgezogen.

## Risiken

- **Datei ändert sich zwischen Diff und Aufklappen.** Die Zeilen dahinter stimmen dann nicht mehr mit dem Diff überein. Gegenmaßnahme: der Diff lädt bei jeder Änderung der Zahlen neu und setzt die Aufklappungen zurück (AK 9); ein kurzes Fenster bleibt.
- **Scrollverhalten.** Bitbucket Server sprang beim Aufklappen an den Anfang (BSERV-12576). Bei virtualisierter Liste mit gemessenen Zeilenhöhen ist das nicht ausgeschlossen. Prüfung: AK 6 in der laufenden App.
- **Fokus.** Verschwindet ein Balken, verliert der gedrückte Knopf den Fokus. Akzeptiert; Tastaturnutzer tabben weiter.
- **Zeilenende-Zählung.** `text_lines` zählt wie die Untracked-Ansicht (ein abschließender Zeilenumbruch ist keine Zeile). Eine Datei ohne Zeilenumbruch am Ende wird in Git mit dem Vermerk „No newline at end of file“ geführt; der Diff ignoriert den Vermerk, die Zählung stimmt trotzdem. Prüfen in Phase 1 mit einer solchen Datei.

## Konfidenz

Unsicherste Stellen: (1) die Abstandsformeln für Lücken bei Abschnitten ohne alte oder neue Zeilen (`b = 0` oder `d = 0`, reine Einfügung bzw. Löschung) — Check: in Phase 1 eine Datei mit reiner Einfügung und eine mit reiner Löschung durch die Probe laufen lassen und die Nummern am Rand der Lücke gegen `git diff` halten; (2) Scrollsprung beim Einfügen von Zeilen in die virtualisierte Liste — Check: AK 6 in der laufenden App; (3) ob `git show <rev>:<pfad>` für Dateien mit Sonderzeichen im Pfad ohne zusätzliche Maskierung funktioniert — Check: Probe mit einem Pfad mit Leerzeichen.

## Bottom-Sektionen (beim Archivieren füllen)

### Summary

### Files touched

### Commits

### Deviations from plan

### Follow-ups
