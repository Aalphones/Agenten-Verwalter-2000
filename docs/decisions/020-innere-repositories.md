# 020 — Innere Repositories: Changes für Repositories in einem angehängten Ordner

**Status:** angenommen · **Datum:** 2026-10-02

## Kontext

Manche Arbeitsordner sind ein Dach über weiteren Git-Repositories. Beispiel facepass: ein Dach-Repo, darin `app\`, `android\` … mit eigener Historie, daneben im selben Ordner ihre Ticket-Worktrees `app-wt-*`, `android-wt-*`; das Dach-Repo blendet alle per `.gitignore` aus. Am Vorhaben hängt nur das Dach. Die Changes zeigten dort nichts: Die App kannte nur das angehängte Repository, suchte eigene Commits nur darin und erwartete Ticket-Worktrees als `facepass-wt-*` neben ihm. Was die Sessions in den inneren Repositories und deren Ticket-Worktrees committet und geschrieben hatten, war unsichtbar.

## Optionen

- **Woher die App die inneren Repositories kennt:** (a) aus Aussagen des Agenten oder seinen `cd`-Befehlen; (b) aus dem Dateisystem, beliebig tief; (c) aus dem Dateisystem, nur die direkten Unterordner.
- **Workaround ohne Code:** jedes innere Repository einzeln ans Vorhaben hängen.
- **Wo die Ticket-Worktrees eines inneren Repositorys liegen:** (i) neben dem inneren Repository, also im angehängten Ordner; (ii) neben dem angehängten Ordner.

## Entscheidung

- **(c).** Ein **inneres Repository** ist ein direkter Unterordner eines angehängten Repositorys (Haupt-Checkout) oder Ordners ohne Git, in dem `.git` ein **Ordner** ist. Unterordner mit `.git`-**Datei** sind Worktrees, keine inneren Repositories; Namen mit führendem `.` zählen nicht. Sessions mit App-Worktree (vor ADR 010) bekommen keine. Gegen (a): unzuverlässig. Gegen (b): kostet bei großen Ordnern Sekunden und findet Klone in `node_modules`.
- **Kein Workaround.** Jede Session müsste die inneren Repositories von Hand anhängen, und die Zuordnung der Ticket-Worktrees hinge davon ab, wann das passiert ist.
- **(i): Ticket-Worktrees innerer Repositories** heißen `<inneres Repo>-wt-<Name>` und liegen im angehängten Ordner, neben dem inneren Repository (Muster facepass). Erkannt werden sie wie bisher am Text der Werkzeug-Aufrufe, gespeichert wie bisher in `session_ticket_worktrees` als `(Position des angehängten Ordners, Ordnername)` — **keine Migration**. Wem ein gespeicherter Ordner gehört, entscheidet sein Präfix; das längste passende gewinnt (`admin-app-wt-x` gehört zu `admin-app`, nicht zu `app`).
- **Erkennung beim Anlegen, Laden und jedem Agent-Start.** Je angehängtem Ordner wird dabei einmal das Verzeichnis gelesen. Der Agent-Start rechnet neu, damit ein später geklontes inneres Repository erkannt wird; das ist ein Dateisystem-Zugriff unter der Session-Sperre wie die Prüfung der Arbeitsordner an derselben Stelle.
- **Auch rückwirkend aus geschriebenen Dateien.** Die Ticket-Worktrees einer Reichweite sind die gemerkten plus die, die in den Pfaden der geschriebenen Dateien vorkommen. So zeigen laufende Sessions ihre offenen Dateien in inneren Ticket-Worktrees sofort.
- **Basis eines inneren Repositorys** ist der letzte Commit vor dem Beginn der Reichweite auf dem First-Parent-Pfad von `HEAD`: in der Reichweite „Session“ der Anlegezeitpunkt der Session, in „Vorhaben“ der des Vorhabens, in der Commit-Suche der der Session. Gibt es davor keinen Commit, der ausgecheckte Stand. Die App merkt sich das Ergebnis je Ordner und Sekunde, solange sie läuft.
- **Ein inneres Repository erscheint nur, wenn es etwas zeigt:** Dateien oder eigene Commits, oder die Reichweite hat darin eine Datei geschrieben (dann auch mit Fehler). facepass hat acht innere Repositories, die meisten unberührt (AGENTS.md Regel 1). Ticket-Worktrees innerer Repositories erscheinen wie die bisherigen, sobald sie zur Reichweite gehören.
- **Schlüsselform `"<Position>:<Ordner>"`** für ein inneres Repository (Ordner = sein Name) und für einen Ticket-Worktree eines inneren Repositorys (Ordner = Worktree-Ordner); beide liegen direkt im angehängten Ordner. `"<Position>"` und `"<Position>/<Ordner>"` bleiben unverändert; die Oberfläche behandelt Schlüssel als undurchsichtig.
- **Eine Stelle löst Schlüssel auf** und baut alle Einträge einer Reichweite; Laden, Diff und Commit-Suche benutzen sie. Der Diff akzeptiert nur Schlüssel, die diese Stelle für dieselbe Reichweite liefert — ein Ordnername aus der Oberfläche wird so nie ungeprüft zum Pfad (AGENTS.md Regel 5).
- **Anzeigenamen:** inneres Repository `"<angehängter Name>/<innerer Ordner>"` (z. B. `facepass/app`), sein Ticket-Worktree `"<angehängter Name>/<innerer Ordner> · <Worktree-Ordner>"` (z. B. `facepass/app · app-wt-gymid-2288`).
- **Ordner ohne Git mit inneren Repositories:** Der Ordner selbst bleibt ohne Eintrag (ADR 018), seine inneren Repositories bekommen Einträge.
- **Keine neuen Freigaben:** Innere Repositories und ihre Ticket-Worktrees liegen im angehängten Ordner, der schon per `--add-dir` freigegeben ist.

## Konsequenzen

- Je inneres Repository läuft beim Nachladen der Changes und nach jedem Git-Befehl des Agenten ein `rev-list`; bei facepass acht, am 2026-10-02 gemessen zusammen gut 1 s nacheinander — deshalb laufen sie parallel.
- Eigene Commits in inneren Repositories von vor dieser Änderung bleiben unbekannt (ADR 014: kein Nachtragen); offene geschriebene Dateien erscheinen dagegen sofort.
- Wechselt im inneren Repository der ausgecheckte Branch, bleibt die gemerkte Basis bis zum Neustart der App die alte.
- Ein Repository mit `.git`-Ordner zwei Ebenen tief bleibt unsichtbar.
- **Löst ab:** in ADR 018 die Folge „`git` läuft für ihn nie“ — jetzt: `git` läuft nie im Ordner ohne Git selbst, nur in seinen inneren Repositories. Auch „für einen Ordner ohne Git gibt es keine Erkennung von Ticket-Worktrees“ gilt nur noch für ihn selbst, nicht für seine inneren Repositories.
