# Phase 3 — Reiter „Dateien“: Baum, Leiste, Übersicht mit Verlauf

Rating: heikel (neue Hauptansicht, Zusammenlegen der Einträge, Zustand je Session). Der Reiter „Dateien“ entsteht neben „Changes“: Leiste mit Session-Filter und Blickwinkel, links der feste Eintrag „Übersicht · Verlauf“ und der Baum, rechts die Übersicht. Ein Klick auf eine Datei öffnet in dieser Phase ihren Diff mit der vorhandenen `DiffView`; die eigene Datei-Ansicht kommt in Phase 4, die Suche in Phase 5. Aussehen: [artifacts/entwurf-repository-ansicht.html](artifacts/entwurf-repository-ansicht.html), Bilder `01-uebersicht.png` und `02-aenderung.png` (linke Spalte und Leiste).

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Begriffe, Zusammenlegen der Einträge, Blickwinkel und Session-Filter, `NARROW_WIDTH_PX`), Wackelstellen (Session-Filter)
- [artifacts/README.md](artifacts/README.md) und der Entwurf: im Quelltext `renderTree`, `renderStart`, `renderFacts`, `renderBasis`, `renderVerlauf`, `renderTb`, `renderPop`, `renderLeft` und der zugehörige CSS-Block (Klassen `.repo`, `.row`, `.home`, `.facts`, `.vl__*`, `.tb`, `.pop`)
- `src/app/App.tsx` — die drei Stellen, die `ChangesView` zeigen (Übersicht des Vorhabens, Übersicht einer Umsetzung, Session), `isChangesView`, `useSessionChanges`, `useGitStatus`
- `src/stores/sessions.ts` — `SESSION_VIEWS`, `PROJECT_VIEWS`, `showView`, `showProjectView`, `viewBySession`
- `src/app/SessionHeader.tsx` (`VIEW_LABEL`, Reiter und Zähler), `src/app/ProjectHeader.tsx` (Reiter der Übersicht)
- `src/features/changes/` — `ChangesView.tsx`, `ChangesToolbar.tsx`, `FileTree.tsx` (Tastatur und Virtualisierung als Muster), `changesScope.ts` (`statOf`, `sumLines`), `useSessionChanges.ts`, `DiffView.tsx` (Props)
- `src/stores/changes.ts` (Muster für einen Zustand je Session), `src/lib/usePanelWidth.ts`, `src/components/ResizeHandle.tsx`, `src/lib/bindings/PanelId.ts`
- `src/lib/files.ts` (Phase 1 und 2), `src/lib/bindings/RepositoryChanges.ts`, `FileChange.ts`, `ProjectHistory.ts`
- `src/styles/theme.css` (Tokens), `docs/conventions/react.md`, `typescript.md`, `tailwind.md`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## Aufbau (verbindlich)

- **Leiste** (eine Zeile, bricht um): Knopf „Ganzes Vorhaben ▾“ (mit Filter „Session #n ▾“ und daneben „Filter entfernen“), Segment „Alle · Uncommitted · Committed“, Summe „n Dateien · +a −d“. Rechts bleibt Platz für das Suchfeld aus Phase 5.
- **Session-Auswahl:** Aufklapper mit Suchfeld; erste Zeile „Ganzes Vorhaben“ mit Zahl der Sessions, darunter die Sessions des Vorhabens, jüngste zuerst, je `#Nummer`, Name, Zahl ihrer Dateien aus dem Verlauf. Gewählte Zeile mit Akzentlinie links.
- **Linke Spalte**, Breite ziehbar wie die heutige Dateiliste: oben fest der Eintrag „Übersicht · Verlauf“ mit Zahl der Commits (gewählt, solange keine Datei offen ist: Flächenfarbe `--color-bg-selected`, Akzentlinie links, ohne Radius); darunter das Segment „Geändert n · Alle Dateien n“ und zwei Symbolknöpfe „aufklappen“ und „einklappen“ (`title` und `aria-label` gesetzt); darunter der Baum.
- **Baum:** je Gruppe eine Kopfzeile (bleibt beim Scrollen oben stehen): Pfeil, Repository-Symbol, Name fett, darunter in Monospace `Codebasis <Basis>` und, falls abweichend, ` · <Branch>`; rechts `+a −d` oder „keine Änderungen“. Darunter Ordner und Dateien mit Einzug 14 px je Ebene und Hilfslinien; Zeilenhöhe 24 px. Ordnerketten mit genau einem Unterordner und ohne Dateien stehen in einer Zeile (`app/src/main`). Ordner vor Dateien, je nach Name ohne Groß-/Kleinschreibung sortiert.
- **Datei-Zeile:** Typ-Kürzel in Farbe (zwei bis drei Zeichen, Zuordnung `TYPES` im Entwurf), Name, rechts `+a −d` und der Buchstabe A, M oder D (A grün, D rot, M in Textfarbe; nie Farbe allein). In „Alle Dateien“ sind geänderte Dateien und Ordner mit Änderungen fett, die übrigen in `--color-fg-secondary`; ein Ordner trägt die Zahl seiner geänderten Dateien als Zähler. In „Geändert“ trägt nur ein zugeklappter Ordner den Zähler.
- **Ignorierte Einträge** (nur „Alle Dateien“): grau und kursiv mit dem Wort „ignoriert“ rechts; Ordner laden ihre Kinder erst beim Aufklappen (`loadIgnoredChildren`), Kinder sind wieder aufklappbar.
- **Übersicht** (rechts, solange keine Datei offen ist): Überschrift „Ganzes Vorhaben · was sich geändert hat“ bzw. „Session #n · …“; Kennzahlen als eine Leiste mit Trennlinien (Dateien geändert, neu, bearbeitet, gelöscht, Zeilen, Commits); Tabelle „Codebasis“ mit den Spalten Repository, Codebasis, Geändert, Offen, Abgleich, Branch (Branch zuletzt und gedämpft); „Verlauf · wer wann was geändert hat“: je Session ein Block mit Linie links, Kopf `#Nummer Name`, Zeit des jüngsten Commits, Knopf „Nur diese Session“; je Commit eine aufklappbare Zeile (Kurz-ID, Betreff, bei mehreren Repositories der Name des Repositorys, Zahl der Dateien, `+a −d`); aufgeklappt die Dateien mit Buchstabe.
- **Schmal** (Breite des Reiters unter `NARROW_WIDTH_PX`, Container-Abfrage): erst nur die linke Spalte in voller Breite; „Übersicht · Verlauf“ oder eine Datei wechselt nach rechts, dort führt „← Baum“ zurück. Die Tabelle „Codebasis“ wird unter 640 px Breite der rechten Seite zu Blöcken „Bezeichnung: Wert“.

## AK

1. In jeder Session mit Repository und in den Übersichten von Vorhaben und Umsetzung gibt es den Reiter „Dateien“ mit der Zahl der geänderten Dateien des ganzen Vorhabens; „Changes“ bleibt daneben unverändert bedienbar.
2. Zwei Einträge desselben Repositorys (Haupt-Checkout und Ticket-Worktree) ergeben einen Knoten; der Ordnername des Worktrees steht nirgends im Reiter. Summe, Codebasis und Branch folgen dem Abschnitt „Zusammenlegen der Einträge“ der README.
3. „Alle Dateien“ lädt den Baum einer Gruppe beim ersten Aufklappen ihres Knotens und nach jedem neuen Ergebnis von `useSessionChanges`, solange der Knoten offen ist; ein gelöschter, geänderter Pfad steht zusätzlich im Baum. `truncated` zeigt die Zeile „Nur die ersten 50 000 Dateien“.
4. Der Session-Filter zeigt Baum, Summe, Kennzahlen und Verlauf nur für die gewählte Session; „Filter entfernen“ und „Ganzes Vorhaben“ heben ihn auf. „Nur diese Session“ im Verlauf setzt ihn.
5. Blickwinkel „Uncommitted“ ohne offene Dateien zeigt im Baum „Nichts offen – alles committed.“ und im Verlauf den Leerzustand „Nichts offen“.
6. Der Verlauf nennt lose Commits mit dem Zusatz „nicht auf einem ausgecheckten Branch“ und unter der Liste, falls `missing > 0`: „n Commits gibt es im Repository nicht mehr.“
7. Tastatur im Baum: Pfeil auf/ab wandert, rechts klappt auf, links klappt zu, Enter öffnet; der Fokusrahmen ist sichtbar.
8. Modus, Blickwinkel, Filter, aufgeklappte Ordner, aufgeklappte Commits und die Bildlaufposition der Übersicht bleiben je Session erhalten, solange die App läuft; nach „Übersicht · Verlauf“ steht die Übersicht an derselben Stelle wie vorher.
9. Ein Eintrag mit `error` zeigt seinen Fehlertext als Zeile unter dem Knoten; die übrigen Einträge der Gruppe bleiben sichtbar. Solange die Changes nicht gelesen sind, steht „Dateien werden gelesen …“.
10. Hell und dunkel, bei 390, 860 und 1366 px Breite des Fensters keine waagerechte Bildlaufleiste außerhalb von Code.
11. `pnpm check` grün.

## Checkliste

- [ ] Wackelstelle Session-Filter prüfen (README): `changes-probe` mit der ID einer beendeten Session. Ergebnis im Report-Back; bei `sessionNotFound` bietet die Auswahl nur Sessions aus dem Sessions-Zustand der Oberfläche an.
- [ ] `src/stores/sessions.ts`: `'files'` in `SESSION_VIEWS` und `PROJECT_VIEWS` aufnehmen (nach `'changes'`); `VIEW_LABEL` in `SessionHeader.tsx` und die Reiter in `ProjectHeader.tsx` um „Dateien“ ergänzen, Zähler wie bei „Changes“ aus den Changes der Reichweite `project`.
- [ ] `src/app/App.tsx`: `isFilesView` analog zu `isChangesView`; an den drei Stellen `FilesView` einhängen. Die Changes für „Dateien“ kommen aus einem zweiten `useSessionChanges(session, 'project', isFilesView)`; mit Session-Filter aus `useSessionChanges(<gefilterte Session>, 'session', isFilesView)` (die gefilterte Session aus dem Sessions-Zustand).
- [ ] `src/stores/files.ts` (Muster `stores/changes.ts`): je Session-ID `mode: 'changed' | 'all'`, `scope: ChangeScope`, `sessionFilter: string | null`, `open: OpenTarget | null`, `page: 'overview' | { git: string }`, `expanded: { changed: string[]; all: string[] }` (Einträge `<Gruppe>:<Ordnerpfad>`, der Knoten selbst als `<Gruppe>:`), `openCommits: string[]`, `overviewTop: number`, `query: string`; `OpenTarget = { group: string; entryKey: string; path: string; view: 'diff' | 'file' | null; step: string | 'all'; line: number | null }`. Vorgabe: `mode: 'changed'`, `scope: 'all'`, in „Geändert“ die ersten zwei Ordnerebenen offen, in „Alle Dateien“ nur die Knoten.
- [ ] `src/features/files/mergeGroups.ts`: reine Funktion `mergeGroups(changes: SessionChanges, scope: ChangeScope): RepoGroup[]` nach dem Abschnitt „Zusammenlegen der Einträge“; Typen `RepoGroup`, `MergedFile`, `FileVariant` dort.
- [ ] `src/features/files/buildTreeRows.ts`: reine Funktion, die aus `RepoGroup[]`, Modus, aufgeklappten Ordnern, geladenen Bäumen und geladenen ignorierten Kindern die Zeilenliste baut (Arten `group`, `dir`, `file`, `ignored`, `note`, `error`), samt Ketten-Verkürzung und Zählern.
- [ ] `src/features/files/useRepoTrees.ts`: lädt und hält `RepoTree` je `<Session>|<Anker-Schlüssel>` und die ignorierten Kinder je Ordner; lädt nach AK 3 neu; Fehler als Zeile im Baum.
- [ ] `src/features/files/useHistory.ts`: `loadHistory` beim Öffnen des Reiters und nach jedem neuen Ergebnis der Changes mit geänderter Commit-Zahl.
- [ ] `src/features/files/FilesView.tsx` + `.css`: Rahmen aus Leiste, linker Spalte, `ResizeHandle` (neue `PanelId` `filesTree`, in Rust und TS nachziehen wie `changesTree`), rechter Seite; Container-Abfrage für schmal.
- [ ] `src/features/files/FilesToolbar.tsx`, `SessionPicker.tsx` + `.css`: Leiste und Session-Auswahl nach „Aufbau“.
- [ ] `src/features/files/RepoTree.tsx` + `.css`: virtualisierte Zeilenliste (`@tanstack/react-virtual` wie in `FileTree.tsx`), Tastatur nach AK 7, Typ-Kürzel in `src/features/files/fileTypes.ts` (Tabelle `TYPES` aus dem Entwurf, Farben über vorhandene Tokens `--color-status-*`, `--color-accent-text`, `--color-fg-muted`).
- [ ] `src/features/files/FilesOverview.tsx`, `HistoryList.tsx` + `.css`: Kennzahlen, Codebasis, Verlauf. „Offen“ und „Abgleich“ je Gruppe aus dem Git-Zustand der Session (`useGitStatus`), falls vorhanden: „alles committed“ bzw. „n offen“, „synchron“ bzw. „n eingehend“; ohne Git-Zustand (Übersicht des Vorhabens) entfallen beide Spalten.
- [ ] Datei öffnen in dieser Phase: rechts die vorhandene `DiffView` mit `repository` = Eintrag der gezeigten Fassung, `file` = deren `FileChange`, `scope` = gewählter Blickwinkel, `reach` nach Filter; unveränderte Dateien zeigen bis Phase 4 den Hinweis „Ganze Datei folgt“.
- [ ] `pnpm check`.
- [ ] Doku: Code-Map-Zeile „Dateien (Oberfläche)“ mit `src/features/files/` und `src/stores/files.ts`; Glossar „Dateien-Ansicht“ (ersetzt in Phase 7 „Changes-Ansicht“), „Session-Filter“.

## Report-Back
