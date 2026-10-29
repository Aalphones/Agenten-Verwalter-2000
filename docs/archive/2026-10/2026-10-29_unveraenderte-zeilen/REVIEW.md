# Code Review — feature/unveraenderte-zeilen — 2026-10-29

**Scope:** Branch `feature/unveraenderte-zeilen` (3 Commits, 21 Dateien, +997/−124), Schwerpunkt Scroll-Anker der Diff-Ansicht beim Aufklappen
**Base:** `main...HEAD` (`793dafd...c4e8878`)

## Phase 1 — Prüfkette

Vor und nach den Fixes gleich:

- `eslint . --max-warnings 0`: 0 Befunde
- `tsc -p tsconfig.json --noEmit` (zusätzlich `--noUnusedLocals --noUnusedParameters`) und `tsc -p tsconfig.node.json`: 0 Fehler
- `prettier --check src`: sauber
- `vite build`: grün
- `cargo fmt --check`: sauber
- `cargo clippy --all-targets -- -D warnings`: ohne Befund

## Phase 2 — Struktur

- Zuschnitt passt: `diffRows.ts` rein (keine React-Importe), `useGapExpansion.ts` hält den flüchtigen Zustand, `DiffView.tsx` rendert. `checked_dir` zieht die bisher doppelte Prüfung aus `file_diff` heraus, `text_lines` die Zeilenzerlegung aus `untracked_diff`.
- `DiffView.tsx` ist von 391 auf 560 Zeilen gewachsen und liegt über der 400-Zeilen-Grenze (offen, siehe Befund 6).

## Phase 3 — Manuell

### Correctness

- **Befund 1 (WARNING, behoben) — Ansicht springt beim Aufklappen am oberen Rand.** Steht ein Balken bündig am oberen Rand oder ist er oben angeschnitten, und brechen die eingeblendeten Zeilen um, springt die Ansicht nach einem Klick auf den Pfeil nach unten um 400 px (20 Zeilen) weiter, nach einem Klick auf den Text um 600 px; man landet mitten im eingeblendeten Block. Ursache: Die Bibliothek gleicht beim ersten Messen jede Zeile aus, deren geschätzter Anfang über dem Rand liegt, misst aber gegen den Rand, den die vorige Zeile schon verschoben hat — das läuft als Kaskade durch alle neu gemessenen Zeilen. Bei breiter Ansicht ohne Umbruch stimmen Schätzung und Messung überein, deshalb fiel es im Prüfstand der Umsetzung nicht auf. Fix: ausgeglichen werden nur Zeilen über der obersten sichtbaren (`DiffView.tsx`, nach `useVirtualizer`).
- Lücken-Formeln für reine Einfügung (`@@ -5,0 +6,2 @@`) und reine Löschung (`@@ -6,2 +5,0 @@`) nachgerechnet: Abstand vor und nach dem Abschnitt stimmt in beiden Fällen.
- **Befund 4 (MINOR, behoben) — Bereichsprüfung zu spät.** `changes_file_lines` prüfte den Zeilenbereich erst nach der Session-Abfrage und `sources::find` (das die Worktrees aufzählt); AK 3 aus Phase 1 verlangt den Fehler, bevor Git oder das Dateisystem berührt werden. Fix: `check_line_range` als erster Schritt des Befehls; `file_lines` prüft weiter selbst (für die Probe).

### Security

- Pfad: `validate_path` lehnt `..`, absolute Pfade und `:` ab, damit lässt sich über `<rev>:<path>` kein anderer Stand einschleusen; `rev` stammt aus den eigenen Commits. Git läuft ohne Shell, Argumente einzeln.
- Bereich: `from ≥ 1` vor `from − 1`, Anzahl auf 20.000 Zeilen gedeckelt. Keine Befunde.

### Zerbrechlichkeit

- **Befund 2 (WARNING, behoben) — große Commit-Stände ganz gelesen.** Im Blickwinkel „Committet“ holte `git show` die ganze Datei, bevor die 8-MB-Grenze griff; der Plan verlangte die Größenprüfung wie bei `read_text` vorher. Jede Diff-Anzeige einer großen eingecheckten Datei (auch binär) zog sie komplett durch die Leitung und durch die UTF-8-Umwandlung. Fix: `show_file` fragt die Größe vorher mit `git cat-file -s` ab; binäre Diffs lesen die neue Fassung gar nicht mehr (sie hat dort keine Zeilenzahl).
- Wahrscheinlichster Bruch in drei Monaten: ein Update von `@tanstack/react-virtual`, das den Ausgleich anders rechnet oder `range` anders pflegt. Der Fix aus Befund 1 hängt an `virtualizer.range` aus dem letzten Rendern. Prüfung nach jedem Update dieser Bibliothek: schmale Diff-Ansicht, Balken bündig an den oberen Rand scrollen, Pfeil nach unten — die erste eingeblendete Zeile muss dort stehen, wo der Balken stand.

### Dead Code

- `is_text` wurde durch Befund 2 überflüssig und ist entfernt. Sonst nichts.

### Readability

- **Befund 5 (MINOR, behoben):** In `renderGap` verdeckte die lokale `error` den Ladefehler des Diffs aus `useFileDiff`; heißt jetzt `gapError`.

### Framework Patterns

- `shouldAdjustScrollPositionOnItemSizeChange` ist bei der Bibliothek eine Eigenschaft der Instanz, keine Option; die Zuweisung bei jedem Rendern ist gleichbleibend und von ESLint (`react-hooks`) akzeptiert.
- `useGapExpansion` leitet das Zurücksetzen aus dem gemerkten Diff ab statt per Effekt — entspricht `react.md` („Abgeleitetes → `useMemo` oder `const`“).

### Cross-Project Consistency

- **Befund 3 (MINOR, behoben) — doppelte Commit-Suche.** Im Blickwinkel „Committet“ lief `history::read` je Diff zweimal (für den Diff und für die Zeilenzahl). Fix: `file_diff` reicht den letzten eigenen Commit aus dem Diff-Zweig weiter (`new_text`).
- BEM, Tokens und Fehlertexte wie in den übrigen Blöcken von `DiffView.css`.

## Findings Summary

| Severity | Count | Examples |
|---|---|---|
| CRITICAL | 0 | — |
| WARNING | 2 | `DiffView.tsx` Scroll-Sprung bei umbrechenden Zeilen; `git/mod.rs` `show_file` ohne Größenprüfung |
| MINOR | 4 | doppelte Commit-Suche, Bereichsprüfung zu spät, verdeckter Name, `DiffView.tsx` über 400 Zeilen |
| INFO | 2 | angeschnittene erste Zeile, Lauf in der echten App offen |

**INFO:**

- Ist der Balken um 20 px oder mehr angeschnitten, liegt die erste eingeblendete Zeile nach dem Klick ganz über dem Rand (die Stelle bleibt, wie AK 6 verlangt). Bricht diese Zeile um, gleicht die Ansicht ihre Mehrhöhe aus, damit der sichtbare Inhalt stehen bleibt; `scrollTop` ändert sich dann um genau diese Mehrhöhe. Gewollt.
- Der Lauf in der echten App (Plan, Phase 2, letzter Punkt der Checkliste) steht weiter aus. Geprüft ist im Browser-Prüfstand mit Edge headless (dieselbe Engine wie WebView2), nicht in der App.

## Action Items

- [x] Scroll-Ausgleich nur über der obersten sichtbaren Zeile — `src/features/changes/DiffView.tsx`
- [x] Größe vor `git show` prüfen, binäre Diffs ohne neue Fassung — `src-tauri/src/git/mod.rs`, `src-tauri/src/changes/mod.rs`
- [x] letzten eigenen Commit weiterreichen statt neu suchen — `src-tauri/src/changes/mod.rs`
- [x] Bereichsprüfung zuerst im Befehl — `src-tauri/src/commands/changes.rs`
- [x] `error` → `gapError` — `src/features/changes/DiffView.tsx`
- [ ] **Befund 6 (MINOR, offen):** `DiffView.tsx` unter 400 Zeilen bringen. Natürlicher Schnitt: der Balken (`renderGap`, `renderGapArrow`, `GAP_ARROW`, `hiddenLinesLabel`, rund 80 Zeilen) als eigene Komponente mit eigener CSS-Datei; allein reicht das nicht, zweiter Kandidat ist das Kommentar-Rendering je Zeile (bestand schon vorher). Nicht im Review umgesetzt: reine Struktur ohne Verhaltensänderung, verlangt nach `react.md` einen eigenen CSS-Block und gehört in einen eigenen Commit.

## Nachweise

- Scroll-Anker, Prüfstand (echte `DiffView` samt CSS und Virtualisierung, Core per `mockIPC` nachgebaut, Edge headless, echter Mausklick über CDP), Diff-Höhe 180 px, mittlerer Balken: vorher bei 340 px Breite (Zeilen brechen um) bündig +400 px, 10 px angeschnitten +400 px, 20 px angeschnitten +400 px, Text-Klick +600 px; nachher in allen Fällen erste eingeblendete Zeile an der Stelle des Balkens (20 px: sichtbare Zeile bleibt stehen, siehe INFO). Bei 1000 px Breite vorher wie nachher ohne Sprung.
- Die 28 Prüfungen aus dem Report-Back der Phase 2 laufen auf dem Stand nach den Fixes erneut grün.
- `changes-probe` gegen eine Kopie der Datenbank, Session der Umsetzung, `src/features/changes/DiffView.tsx`: „Committet“ 556 Zeilen (= Stand im Commit), „Alles“ 560 (= Arbeitsverzeichnis); Bereich 555–600 liefert 2 bzw. 6 Zeilen bis zum Dateiende; `0 5` ergibt „Ungültiger Zeilenbereich: 0–5“.

## Notes — Konfidenz

1. **Größenprüfung bei großen eingecheckten Dateien** ist nur über den Normalfall belegt (Datei unter 8 MB liefert weiter die richtige Zahl), nicht mit einer Datei über 8 MB. Check: eine Datei über 8 MB in einem eigenen Commit, dann `PROBE_SCOPE=committed changes-probe … <Schlüssel> <Pfad>` — erwartet `neue Zeilen: —`.
2. **Scroll-Anker in der echten App** (WebView2, echte Schriften, echte Breite des Diff-Bereichs) ist nicht gelaufen. Check: in `pnpm tauri dev` eine Datei mit langen Zeilen öffnen, den Diff-Bereich schmal ziehen, einen mittleren Balken bündig an den oberen Rand scrollen, Pfeil nach unten und Text klicken.
