# Phase 3 — Oberfläche: Pille, Repository-Zeile, Commit, Häkchen

Ziel: Die Git-Bedienung erscheint in den Changes einer Session nach dem Entwurf — Branch-Pille in der Kopfzeile, je Eintrag Branch-Knopf, Pull, Push, ⋯, Commit-Feld, Häkchen an den Dateien, fremde Änderungen, Gruppen „Uncommitted“/„Committed“ mit den eigenen Commits, Sperr-Hinweis, Branch-Menü und die Dialoge. Danach ist der Kern benutzbar.

## Kontext

- **Entwurf (verbindlich):** [docs/design/2026-10-05_git-werkzeuge/git-werkzeuge.html](../../design/2026-10-05_git-werkzeuge/git-werkzeuge.html) im Browser öffnen, „Neues markieren: an“. Maße und Farben stehen im `<style>`-Block der Datei (Hex-Werte = semantische Tokens; im Code immer `var(--color-…)` aus `src/styles/theme.css`, nie Hex).
- [README.md](README.md): „Festgelegte Entscheidungen“, „Kontrakt“. Phase 1–2: alle Commands und Typen.
- `src/features/changes/` — `ChangesView.tsx` (Aufbau, `reach`), `ChangesToolbar.tsx`, `FileTree.tsx` (virtualisiert, `ESTIMATED_HEIGHT` je Zeilenart, `renderRow`), `buildFileRows.ts` (`FileRow`-Union, `appendRepository`), `useSessionChanges.ts` (Nachladen alle 5 s), `changesScope.ts`. `src/stores/changes.ts` (Filter, Blickwinkel, geöffnete Datei).
- `src/app/SessionHeader.tsx` — Titelbereich `session-header__title` mit Status `session-header__status`.
- `src/components/` — `Popover` (`autoFocus`, `anchor`), `Dialog`; `src/lib/useActionError.ts`, `src/stores/sessionErrors.ts` (Fehlerzeile unter der Kopfzeile); `src/lib/sessions.ts` `pauseSession`.
- Muster für Wrapper: `src/lib/changes.ts`. Konventionen: [react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md) (BEM-CSS pro Komponente), [typescript.md](../../conventions/typescript.md).
- Fehlerklassen: Vault `frameworks/react.md` — alle drei betreffen Tests; keine einschlägig.

## Festlegungen dieser Phase

- **Nur Reichweite `session`.** `ChangesView` mit `reach="project"` rendert exakt wie heute; alle neuen Zeilen und Hooks hängen an `reach === 'session'`.
- **Dateibaum-Breite** 360 px statt 340 px (Platz für Branch-Knopf und Zähler) — gilt für beide Reichweiten; `docs/design/2026-09-28_hauptansichten/README.md` Layout-Maße nachziehen.
- **Rückmeldung:** Erfolg zeigt sich am aktualisierten Zustand (kein Toast). Fehler gehen in die bestehende Fehlerzeile der Session (`sessionErrors`), Satz-Präfix je Aktion, z. B. „Commit fehlgeschlagen: …“, „Push fehlgeschlagen: …“.
- **Nach jeder Aktion** `git_status` und die Changes sofort neu laden (nicht auf die 5 s warten).
- **Gruppen nur in der Session:** Blickwinkel „Alle“ → erst Gruppe „Uncommitted“, dann „Committed“; „Uncommitted“ bzw. „Committed“ → nur die eine Gruppe. In „Uncommitted“ der Dateibaum wie heute (Ordner-Zeilen, Einrückung 14 px je Ebene) mit den `uncommitted`-Zahlen; in „Committed“ je eigenem Commit (aus `GitEntryStatus.commits`) eine Commit-Zeile und darunter dessen Dateien flach (Name + Ordner gedimmt), Klick öffnet den Diff im Blickwinkel `committed`.
- **„Veröffentlichen“:** hat der Branch keinen Upstream, steht statt „↑n“ der Knopf „↑ Veröffentlichen“ (Tooltip „Branch zum ersten Mal pushen“). Nicht im Entwurf; gleiche Gestaltung wie der Push-Zähler.
- **Konflikt-Zeile** (nicht im Entwurf): bei `operation ≠ none` unter der Repository-Zeile eine Zeile wie der Sperr-Hinweis, Rand und Symbol in `--color-status-waiting`: „Merge mit Konflikten in N Dateien“ bzw. „Rebase angehalten“, Knöpfe „In VS Code öffnen“ (ab Phase 4; bis dahin weglassen) und „Merge abbrechen“/„Rebase abbrechen“ (`git_abort_operation`, gesperrt bei `busy`). Das Commit-Feld bleibt nutzbar (Konflikte lösen und committen).

## AK der Phase

Struktur nach Entwurf, je Punkt prüfbar:

- **Kopfzeile:** hinter dem Status eine Pille (Höhe 22 px, Radius 11 px, Rand 1 px `--color-border`): Branch-Symbol 13 px, Branch-Name in `--font-mono` 11.5 px, `↓n↑m` in `--color-accent-text` nur wenn ungleich 0, Punkt 6 px in `--color-status-waiting` bei uncommitteten Dateien (eigene in den Changes oder `foreign`), `+N` in `--color-fg-muted` bei weiteren Git-Einträgen. Tooltip: je Eintrag eine Zeile „<Name>: <Branch> ↓n ↑m“, letzte Zeile „Klick: Changes öffnen“. Klick setzt `activeView` auf Changes. Losgelöster HEAD → „losgelöst“. Rechts der Kopfzeile unverändert.
- **Sperr-Hinweis** über dem Dateibaum, solange `busy` nicht leer: Schloss-Symbol, Text „Der Agent arbeitet: **Branch wechseln**, **Pull** und **Verwerfen** warten, bis er ruht. Commit und Push gehen.“, rechts „Pausieren“ (nur wenn die eigene Session in `busy` steht; sonst Text „Session #N „Name“ arbeitet gerade.“ ohne Knopf). Hintergrund `--color-status-running` 12 % (`color-mix`), Rand 35 %, Radius 6 px, Schrift 11.5 px.
- **Repository-Zeile** (30 px): Zuklapp-Pfeil, Name fett 12.5 px (Tooltip = Art: Haupt-Checkout / Ticket-Worktree / inneres Repository), rechts: Branch-Knopf (24 px hoch, Rand 1 px, Radius 6 px, Branch-Symbol + Name mono 11.5 px max. 110 px mit Ellipse + Pfeil), Pull „↓n“ und Push „↑n“ (mono 11.5 px, `--color-fg-muted`, bei n > 0 `--color-accent-text`), ⋯-Knopf 24 px. Tooltips: „Branch wechseln oder anlegen“, „Pull — n eingehend“, „Push — n ausgehend“, „Weitere Befehle“; an ↓/↑ zusätzlich „Stand vom letzten Fetch: HH:MM“ bzw. „noch kein Fetch in dieser Sitzung“. Die bisherige Zeile `branch` entfällt in der Session-Reichweite.
- **Commit-Feld** (Blickwinkel ≠ Committed): Textfeld 32 px, bei Fokus 60 px mit Akzentrand und 3-px-Ring `--color-accent-subtle`; Platzhalter „Nachricht (Strg+Enter committet auf „<branch>“)“; darunter Split-Knopf 28 px in `--color-accent`: „✓ Commit · N Dateien“ (N = angehakte Pfade; 0 → ausgegraut, Text „Commit“), rechts Pfeil-Teil 28 px → Menü „Commit“ (Strg+Enter), „Commit & Push“ (Strg+Umschalt+Enter), Trennlinie, „Letzten Commit ergänzen“ (ausgegraut bei `headPushed`, Hinweiszeile „Ergänzen geht nur, solange der letzte Commit nicht gepusht ist.“). Die Tastenkürzel wirken im Textfeld.
- **Gruppenkopf** 24 px, 11 px Großbuchstaben `--color-fg-muted`: „Uncommitted N“ mit rechts „alle vormerken“/„keine vormerken“ (`--color-accent-text`); „Committed N Commits“ mit rechts „noch nicht gepusht“ in `--color-accent-text`, wenn mindestens ein eigener Commit `pushed: false` ist.
- **Datei-Zeile** in „Uncommitted“: Häkchen (Akzentfarbe) vor dem Namen; Tooltip „Geht in den nächsten Commit“/„Bleibt beim Commit draußen“. Eigene Dateien anfangs angehakt.
- **Fremde Änderungen:** unter den eigenen Dateien ein Knopf mit gestricheltem Rand, Radius 6 px, 11.5 px: „▸ N weitere Änderungen im Ordner — nicht von dieser Session“; aufgeklappt „Ausblenden: …“ und darunter die Dateien mit Häkchen (anfangs aus), Name in `--color-fg-secondary`, Klick öffnet den Diff im Blickwinkel `uncommitted` (belegt: `changes::file_diff` liest in diesem Blickwinkel `HEAD` → Arbeitsverzeichnis für jeden gültigen Pfad, unabhängig von der Reichweite; untracked Dateien als ganzer Inhalt).
- **Commit-Zeile** in „Committed“ (22 px): Ring 9 px (Rand 1.8 px `--color-accent`) bei `pushed: false`, sonst gefüllter Punkt `--color-fg-muted`; Betreff mit Ellipse; rechts `shortId` mono 11 px gedimmt.
- **Branch-Menü** (Popover 360 px, `autoFocus` im Suchfeld): Suchfeld „Branch suchen oder neuen Namen tippen“ (filtert beim Tippen, Groß-/Kleinschreibung egal), bei `busy` Hinweis in `--color-status-running` „Wechseln gesperrt, solange der Agent hier arbeitet.“, „+ Neuer Branch aus <branch> …“ (nimmt den getippten Text; leer → Fokus ins Suchfeld), „+ Neuer Branch als Ticket-Worktree …“ (ab Phase 4, bis dahin weglassen), Gruppen „Lokal“ (Haken am aktuellen, rechts gedimmt `↓n ↑m` am aktuellen bzw. „Worktree <Ordner>“) und „Remote“ (Wolken-Symbol). Gesperrt (ausgegraut): bei `busy` alle außer dem aktuellen; Branches mit `worktree` immer. Enter im Suchfeld: genau ein Treffer → wechseln; kein Treffer → neuen Branch anlegen.
- **⋯-Menü** (Phase 3): „Fetch“; bei `operation ≠ none` zusätzlich „Merge/Rebase abbrechen“. Die übrigen Einträge kommen in Phase 4.
- **Dialog Wechsel mit offenen Änderungen** (eigene oder fremde uncommittete Dateien vorhanden): Titel „Wechsel auf „<branch>““, Satz „N ungecommittete Änderungen in <Name>. Was soll mit ihnen passieren?“, Liste der ersten 5 Pfade mono, Knöpfe „Abbrechen“, „Mitnehmen“, „Beiseitelegen und wechseln“ (primär).
- **Dialog Push abgelehnt** (Push bzw. Commit & Push bei `behind > 0`): „Push abgelehnt“, „origin/<branch> hat N Commit(s), die du noch nicht hast. Erst holen, dann pushen.“, „Abbrechen“, „Pull, dann Push“ (ausgegraut bei `busy`, Tooltip „Pull ist gesperrt, solange der Agent arbeitet“). Bei Commit & Push wird vorher committet, der Dialog betrifft nur den Push.
- Vorhaben-Übersicht → Changes: unverändert.
- `pnpm check` grün.

## Checkliste

### Wrapper `src/lib/git.ts`

- [ ] Je Command aus Phase 1–2 eine `async`-Funktion mit JSDoc `@throws` wie in `src/lib/changes.ts`: `loadGitStatus`, `loadGitBranches`, `gitCommit`, `gitPush`, `gitPull`, `gitFetch`, `gitSwitch`, `gitCreateBranch`, `gitAbortOperation`.

### Zustand `src/stores/git.ts` (Zustand, flüchtig)

- [ ] Je Session: `messages: Record<entryKey, string>`, `checked: Record<entryKey, Record<path, boolean>>` (nur Abweichungen vom Standard; Standard = eigene an, fremde aus), `showForeign: Record<entryKey, boolean>`, `collapsed: Record<entryKey, boolean>`. Aktionen `setMessage`, `toggleChecked`, `setAllOwn(entryKey, paths, value)`, `toggleForeign`, `toggleCollapsed`, `clearEntry(entryKey)` (nach erfolgreichem Commit: Nachricht und Abweichungen löschen).
- [ ] Selektor `checkedPaths(sessionId, entryKey, ownPaths, foreignPaths): string[]`.

### Hook `src/features/git/useGitStatus.ts`

- [ ] Lädt `git_status` beim Mount und alle 5 s (Muster `useSessionChanges`), liefert `{ status, error, reload }`. Beim ersten Erfolg je `sessionId:key` in diesem App-Lauf (Modul-`Set`) für jeden Eintrag ohne `error` einmal `gitFetch`, danach `reload` (Fetch-Fehler still verwerfen).
- [ ] `useSessionChanges` um `reload` ergänzen, falls nicht vorhanden; `ChangesView` reicht beide `reload` an die Git-Bausteine (`onChanged`).

### Bausteine `src/features/git/` (je Komponente eine `.css` nach BEM)

- [ ] `GitBranchPill.tsx` — Pille aus den AK; eingebaut in `SessionHeader.tsx` direkt hinter dem Status-Span; braucht `useGitStatus` — den Hook in `App.tsx` einmal je sichtbarer Session aufrufen und `status` an Kopfzeile und `ChangesView` reichen (nicht zwei Abfragen).
- [ ] `GitLockHint.tsx`, `GitOperationRow.tsx`, `GitEntryBar.tsx` (rechte Seite der Repository-Zeile), `GitCommitBox.tsx` (Feld + Split-Knopf + `GitCommitMenu`), `GitBranchMenu.tsx`, `GitMoreMenu.tsx`, `GitSwitchDialog.tsx`, `GitPushRejectedDialog.tsx`, `gitTexts.ts` (alle Sätze aus den AK an einer Stelle).
- [ ] Commit-Ablauf in `GitCommitBox`: Pfade = `checkedPaths`; „Commit & Push“ mit `behind > 0` → erst `gitCommit(push: false)`, dann `GitPushRejectedDialog`; sonst `gitCommit(push)`. Erfolg → `clearEntry`, `onChanged`.

### Dateibaum `src/features/changes/buildFileRows.ts` und `FileTree.tsx`

- [ ] `buildFileRows(changes, filter, scope, git: GitSessionStatus | null)`; `git === null` (Reichweite Projekt) → Verhalten exakt wie heute.
- [ ] Neue Zeilenarten in `FileRow`: `{ kind: 'operation'; entryKey }`, `{ kind: 'commitBox'; entryKey }`, `{ kind: 'group'; entryKey; group: 'uncommitted' | 'committed' }`, `{ kind: 'foreignToggle'; entryKey; count }`, `{ kind: 'commit'; entryKey; commitId }`; Datei-Zeilen bekommen `checkable: 'own' | 'foreign' | null` und `scope: ChangeScope` (wofür der Diff öffnet). Die Zeile `repository` bekommt `git: true` — `FileTree.renderRow` setzt dann rechts `GitEntryBar` ein und zeigt den Zuklapp-Pfeil; die Zeilenart `branch` entfällt in der Session-Reichweite. Der Sperr-Hinweis ist keine Zeile, sondern steht über der Liste.
- [ ] Reihenfolge je Eintrag: `repository` → `operation` (falls) → `commitBox` (falls Blickwinkel ≠ committed) → `group uncommitted` → Dateien → `foreignToggle` (falls fremde vorhanden) → fremde Dateien (falls aufgeklappt) → `group committed` → je Commit `commit` + Dateien. Zugeklappter Eintrag: nur `repository`. Ein Eintrag mit `error` bleibt wie heute (Kopf, Branch, Fehler).
- [ ] `ESTIMATED_HEIGHT` für alle neuen Arten (Werte aus den AK; `commitBox` 76 px).
- [ ] `FileTree.css`: Breite 360 px.

### Doc-Updates

- [ ] `docs/code-map.md`: Zeile „Git-Werkzeuge“ Oberfläche: `src/features/git/` (Bausteine), `src/stores/git.ts`, `src/lib/git.ts`, Anschluss in `SessionHeader`, `ChangesView`, `buildFileRows`, `FileTree`.
- [ ] `docs/design/2026-09-28_hauptansichten/README.md`: Layout-Maße „Dateiliste 360 px“.
- [ ] `docs/design/2026-10-05_git-werkzeuge/README.md`: Abschnitt „Ergänzungen in der Umsetzung“ mit „Veröffentlichen“ und Konflikt-Zeile.

## Report-Back
