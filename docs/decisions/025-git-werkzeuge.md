# 025 — Git-Werkzeuge in den Changes

**Status:** angenommen · **Datum:** 2026-10-06

## Kontext

Bisher zeigt der Verwalter nur, was sich geändert hat; committen, pushen, pullen oder den Branch wechseln geht nur über den Agenten oder ein zweites Programm. Gewünscht ist die Bedienung von „Source Control“ aus VS Code im Verwalter. Dabei teilen alle Sessions eines Vorhabens dieselben Ordner, und der Agent kann jederzeit selbst Git benutzen. Der Zustand, den die Oberfläche zeigt, muss aus Git kommen, nie aus Aussagen des Agenten (AGENTS.md, Regel 2).

## Optionen

- Ort: (a) eigenes Panel rechts neben dem Chat — erster Entwurf, verworfen: es zeigte dieselben Dateien wie die Changes ein zweites Mal; (b) in den Changes einer Session, je Eintrag (Repository, Ticket-Worktree, inneres Repository), die Kopfzeile bekommt nur eine Branch-Pille.
- Auswahl für den Commit: (a) Staging-Bereich von Git in der Oberfläche (stage/unstage je Datei) — ein zweiter Zustand neben dem des Agenten, der ihn jederzeit verändern kann; (b) Häkchen nur im UI-Zustand, der Commit nimmt genau die angehakten Pfade.
- Reichweite: (a) auch in den Changes der Vorhaben-Übersicht; (b) nur in den Changes einer Session.

## Entscheidung

- **In den Changes einer Session (b), nicht in der Vorhaben-Übersicht (b).** Ein Commit aus der Übersicht wüsste nicht, welcher Session er gehört.
- **Feature `git` in allen Schichten**: `src-tauri/src/git/` bleibt der einzige Ort, der `git` startet (`model.rs` Typen, `status.rs` Zustand, später `actions.rs` und `log.rs`), Commands in `commands/git.rs`. Jeder Befehl nimmt `session_id` und den Schlüssel des Eintrags und löst den Ordner über `changes::sources::find` auf — nie einen Pfad aus der Oberfläche.
- **Häkchen statt Staging-Bereich (b).** Der Commit läuft als `git add -A -- <pfade>` und `git commit -F - --only -- <pfade>`; anderes schon Gestagtes bleibt unberührt. Angehakt sind anfangs die eigenen uncommitteten Dateien der Session, fremde nur von Hand.
- **Ein Commit aus der App gehört der Session**: der Core trägt die neue Commit-ID in `session_commits` ein — sonst erkennte die Zuordnung (ADR 014) die Dateien nicht als committet.
- **Fremde Änderungen** — uncommittete Dateien im Ordner, die nicht zu den eigenen Changes gehören — zeigt der Status getrennt.
- **Sperre**: Befehle, die Dateien im Arbeitsordner ändern (Branch wechseln, Pull, Verwerfen, Stash, Merge, Rebase), sind gesperrt, solange eine Session des Vorhabens im Status `Starting`, `Running` oder `Waiting` ist. Der Core prüft das in jedem dieser Befehle selbst, die Oberfläche graut nur aus. Commit, Push, Fetch, Branch anlegen ohne Wechsel und Branch löschen bleiben frei.
- **Lesen ohne Sperre** wie bisher (ADR 006): Plumbing-Befehle, Konflikt-Dateien über `diff-files`, laufender Merge/Rebase über `rev-parse --git-path`. Ein schreibender Befehl, der an `index.lock` des Agenten scheitert, wird einmal nach 500 ms wiederholt.
- **Fetch nur von Hand, nach Pull/Push und beim ersten Öffnen je App-Lauf**, kein Zeitgeber. ↓/↑ zeigen den Stand des letzten Fetch; der Zeitpunkt wird mitgeführt.
- **Anmeldung** über den Git Credential Manager wie bei jedem Git-Aufruf ohne Konsole (`GIT_TERMINAL_PROMPT=0`).

## Konsequenzen

- `git` wird in der Code-Map vom Querschnitt zum Feature.
- ↓/↑ sind ohne Fetch beliebig alt; die Oberfläche nennt die Uhrzeit des letzten Fetch.
- Der Agent und die Oberfläche können gleichzeitig committen; schlimmstenfalls kommt einmal „Git ist gerade beschäftigt“.
- Konflikte nach Pull oder Merge bleiben im Arbeitsordner; die Oberfläche bietet „In VS Code öffnen“ und „abbrechen“, löst aber selbst nichts.
- Verlauf nur für den aktuellen Branch, die letzten 50 Commits plus eingehende; die Marken (Branch, Remote-Branch, Tag) kommen mit vollen Ref-Namen aus dem Core, weil nur so ein Branch `feature/x` von `origin/x` zu unterscheiden ist.
- Der Nachrichtenvorschlag ✦ ist ein Einmal-Aufruf von Haiku mit dem gekürzten Diff der angehakten Dateien (20 000 Zeichen) und der Commit-Konvention des Ordners; in der Betriebsart „Autark“ ist er ausgegraut.
- Ticket-Worktrees kann jetzt auch die App anlegen (Ergänzung zu [ADR 010](010-worktrees-durch-den-agenten.md)); sie gehören dann der Session, die sie angelegt hat, und erscheinen als eigener Eintrag in deren Changes.
- App-Commits landen in `session_commits` der Session, die committet hat — auch fremde Dateien, die man bewusst angehakt hat, zählen danach als ihre.
