# Phase 7 — Git-Seite, „Changes“ entfernen, Doku

Rating: standard. Die Git-Werkzeuge ziehen in den Reiter „Dateien“: „Git“ am Repository-Knoten öffnet rechts die Git-Seite dieses Repositorys. Danach verschwindet der Reiter „Changes“ mit seinen drei Rahmen-Bauteilen. Aussehen: Entwurf, Bild `06-git-seite.png` (zeigt den Ort und die Gliederung; die Bedienelemente selbst sind die vorhandenen).

## Kontext (lesen)

- [README.md](README.md) → Finale AK 7, Kontrakt (Begriffe)
- [ADR 025](../../decisions/025-git-werkzeuge.md), [ADR 067](../../decisions/067-dateien-ansicht.md)
- `src/features/changes/ChangesView.tsx`, `ChangesToolbar.tsx`, `ChangesOverview.tsx`, `FileTree.tsx`, `buildFileRows.ts` — was sie heute tun (unten „Was entfällt“)
- `src/features/git/` — `GitEntryBar.tsx`, `GitHistory.tsx`, `GitLockHint.tsx`, `GitCommitBox.tsx`, `GitOperationRow.tsx`, `useGitStatus.ts`, `gitTexts.ts` (`entryKindLabel`)
- `src/stores/git.ts` (`open`, `showForeign` je Session), `src/stores/changes.ts`
- `src/app/App.tsx`, `src/stores/sessions.ts`, `src/app/SessionHeader.tsx`, `src/app/ProjectHeader.tsx`
- `src/features/files/` aus Phase 3 bis 6
- `docs/code-map.md`, `docs/glossary.md`, `docs/PROJECT.md`, `docs/conventions/releases.md`
- Fehlerklassen geprüft (Vault `werkzeuge/git`): „Etikettenliste alphabetisch gelesen“ → beim Versions-Tag die höchste Version mit `git tag --list "v*" --sort=-v:refname` lesen, nicht am Ende der unsortierten Liste.

## Was entfällt — und wozu es da war

| Bauteil | Zweck heute | Verbleib |
|---|---|---|
| `ChangesView.tsx` | Rahmen aus Leiste, Dateiliste, Übersicht oder Diff | ersetzt durch `FilesView` |
| `ChangesToolbar.tsx` | Reiter je Eintrag als Filter, Blickwinkel-Segment, Summe, „gegen <Basis>“ | Blickwinkel und Summe in `FilesToolbar`; Filter je Eintrag entfällt (ein Knoten je Repository); Basis steht am Knoten |
| `ChangesOverview.tsx` | Tabelle je Eintrag (Branch, Commits, offen, Abgleich), Hinweis auf `untrackedBefore`, Namen der Ordner ohne Git, Git-Verlauf des gewählten Eintrags, Sperr-Hinweis | Tabelle „Codebasis“ in `FilesOverview`; die beiden Hinweise wandern dorthin (Checkliste); Git-Verlauf und Sperr-Hinweis in die Git-Seite |
| `FileTree.tsx`, `buildFileRows.ts` | Dateiliste je Eintrag samt Git-Zeilen (Vorgang, Commit-Kasten, Gruppen „Uncommitted“ und „Committed“ mit Häkchen, fremde Änderungen, eigene Commits) | bleiben und stehen in der Git-Seite |
| `stores/changes.ts` | gewählter Eintrag, Blickwinkel, offene Datei der Changes | bleibt für die Git-Seite (Blickwinkel fest `all`, `repositoryFilter` = Eintrag) |

## Aufbau der Git-Seite (verbindlich)

- Kopf: „← Übersicht“, Git-Symbol, „Git · <Name des Repositorys>“.
- Oben, falls eine Session des Vorhabens arbeitet: der vorhandene Sperr-Hinweis (`GitLockHint`).
- Je Eintrag der Gruppe, den der Git-Zustand der Session kennt, ein Abschnitt; bei mehr als einem Eintrag mit Überschrift „<Art des Eintrags> · <Ordnername>“ (`entryKindLabel`; nur hier erscheint der Ordner eines Ticket-Worktrees). Im Abschnitt von oben nach unten: `GitEntryBar`, die vorhandene Dateiliste dieses Eintrags mit allen Git-Zeilen (`FileTree` mit den Zeilen aus `buildFileRows`, gefiltert auf den Eintrag, Reichweite `session`), `GitHistory`.
- Ein Klick auf eine Datei der Liste öffnet sie im `FileViewer` (mit dem Blickwinkel der Zeile).
- Kennt der Git-Zustand der Session keinen Eintrag der Gruppe: „In diesem Repository hat diese Session nicht gearbeitet. Die Git-Werkzeuge stehen in der Session, die es getan hat.“

## AK

1. „Git“ steht an jedem Repository-Knoten, sobald eine Session sichtbar ist; in den Übersichten von Vorhaben und Umsetzung fehlt der Knopf. Auch die Zeile der Tabelle „Codebasis“ öffnet die Git-Seite.
2. In der Git-Seite geht alles, was `src/lib/git.ts` anbietet, wie vorher im Reiter „Changes“: Commit (mit Häkchen je Datei und Nachrichtenvorschlag), Ergänzen, Push, Pull, Pull mit Rebase, Fetch, Branch wechseln, anlegen und löschen, Verwerfen, Stash anlegen und zurückholen, Merge, Abbrechen eines Vorgangs, Ticket-Worktree anlegen, „Im Explorer öffnen“, „In VS Code öffnen“ und der Verlauf mit eingehenden Commits.
3. Nach einer Git-Aktion sind Git-Zustand, Changes, Baum und Verlauf des Reiters neu gelesen.
4. Der Reiter „Changes“ existiert in Session, Vorhaben-Übersicht und Umsetzungs-Übersicht nicht mehr; eine Session, deren gemerkter Reiter „Changes“ war, zeigt „Dateien“.
5. `FilesOverview` zeigt den Hinweis auf `untrackedBefore` und nennt die Ordner ohne Git, beides mit dem Wortlaut, den `ChangesOverview.tsx` heute benutzt.
6. `ChangesView.tsx`, `ChangesToolbar.tsx`, `ChangesOverview.tsx` und ihre CSS-Dateien sind gelöscht; kein Import zeigt mehr darauf.
7. Code-Map, Glossar und `docs/PROJECT.md` nennen die Dateien-Ansicht; kein Verweis auf den Reiter „Changes“ außer in Entscheidungen und im Archiv.
8. `pnpm check` grün.

## Checkliste

- [ ] `src/features/files/GitPage.tsx` + `.css` nach „Aufbau“; Daten: `useGitStatus` der sichtbaren Session, Changes der Reichweite `session` (das vorhandene `useSessionChanges(session, 'session', …)` aus `App.tsx` weiterreichen), `buildFileRows` je Eintrag.
- [ ] `RepoTree.tsx`: Knopf „Git“ in der Kopfzeile des Knotens (setzt `page: { git: <Gruppe> }`), nur mit sichtbarer Session; `FilesOverview`: Zeile der Tabelle anklickbar.
- [ ] `FilesView.tsx`: `page` mit `git` zeigt `GitPage`; `onChanged` lädt Git-Zustand, beide Changes, Bäume und Verlauf neu.
- [ ] `FilesOverview.tsx`: die zwei Hinweise aus AK 5.
- [ ] `src/stores/sessions.ts`: `'changes'` aus `SESSION_VIEWS` und `PROJECT_VIEWS` entfernen; wird der gemerkte Reiter irgendwo gespeichert und wieder gelesen (in `src/` nach `viewBySession` suchen), dort `'changes'` als `'files'` behandeln; lebt er nur im Zustand der laufenden App, entfällt das.
- [ ] `App.tsx`, `SessionHeader.tsx`, `ProjectHeader.tsx`: alle Zweige für „Changes“ entfernen; `onOpenChanges` und ähnliche Sprünge (in `SessionHeader.tsx` suchen) führen in den Reiter „Dateien“.
- [ ] Dateien aus AK 6 löschen; danach mit dem Grep-Werkzeug nach `ChangesView`, `ChangesToolbar`, `ChangesOverview`, `'changes'` in `src/` suchen und Reste entfernen. `PanelId` `changesTree` bleibt für die Breite der Liste in der Git-Seite.
- [ ] Texte: in `src/` nach dem Wort „Changes“ in sichtbaren Beschriftungen suchen (Tooltips, Hinweise, Fehlermeldungen, Systemprompt-Absätze in `src-tauri/src/agents/`) und auf „Dateien“ umstellen, wo der Reiter gemeint ist; der Begriff „Changes“ für die Daten bleibt.
- [ ] `pnpm check`.
- [ ] Doku: `docs/code-map.md` (Zeilen „Changes“ auf den verbliebenen Umfang kürzen, „Dateien“ vollständig), `docs/glossary.md` („Changes-Ansicht“ → „Dateien-Ansicht“; „Übersicht (Vorhaben)“: Reiter „Übersicht · Dateien“; „Verlauf (Git)“: Ort Git-Seite), `docs/PROJECT.md` (Zeile zum Diff in der Stack-Tabelle und Critical Rule 1 im Wortlaut „Chat first, Changes second“ bleiben; ein Satz zur Dateien-Ansicht in der Beschreibung), `AGENTS.md` (Satz „Changes/Diffs die Prüfebene“ um die Dateien-Ansicht ergänzen), in ADR 006, 015, 020, 025 je die Zeile „Geändert durch ADR 067“ unter dem Titel.
- [ ] Abschluss nach `docs/conventions/releases.md` und AGENTS.md Regel 6: Plan archivieren, Version anheben (Minor), Commit `chore(release)`, Tag setzen und pushen.

## Report-Back
