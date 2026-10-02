# 014 — Changes je Session: eigene Commits und geschriebene Dateien

**Status:** angenommen · **Datum:** 2026-10-02

## Kontext

Die Changes einer Session zeigten alles seit der Basis des Vorhabens ([ADR 006](006-changes-und-diff.md), [ADR 011](011-vorhaben-und-sessions.md)): auch Commits aus anderen Werkzeugen, Änderungen von Hand im geteilten Haupt-Checkout und die Arbeit anderer Sessions. Gewollt ist: eine Session zeigt nur, was sie selbst geändert hat, die Übersicht des Vorhabens die Summe seiner Sessions.

## Betrachtete Optionen

Eigene Commits erkennen:

- **(a) Die Commit-ID aus der Ausgabe von `git commit` lesen.** Das erfasst kein `git merge`, keinen Rebase und keine Subagenten, deren Ergebnisse die App heute verwirft.
- **(b) HEAD vor und nach jedem Git-Befehl vergleichen.** Der Eingang des Werkzeugaufrufs ist nicht garantiert vor der Ausführung, und ein Rebase brächte Upstream-Commits mit.
- **(c) Zeitfenster der Git-Befehle gegen die Committer-Zeit.**

Uncommittete Änderungen zuordnen:

- **(d) Alles im Arbeitsordner.** Das ist der bisherige Zustand und zeigt fremden Schmutz.
- **(e) Dateien, die der Agent mit `Edit`, `Write`, `MultiEdit` oder `NotebookEdit` geschrieben hat.**
- **(f) Schnappschüsse des Arbeitsverzeichnisses vor und nach jedem Befehl.** Das kostet bei jedem Befehl und ist bei parallelen Sessions im selben Haupt-Checkout trotzdem falsch.

## Entscheidung

**(c) und (e).**

- **Eigene Commits am Zeitfenster.** Jeder Bash- oder PowerShell-Aufruf des Agenten oder eines Subagenten, dessen Befehl `git` enthält und der nicht im Hintergrund läuft, öffnet ein Fenster vom Eingang des Werkzeugaufrufs bis zum Eingang seines Ergebnisses. Dann liest die App in jedem Arbeitsordner der Session die Commits seit der Basis; jeder Commit, dessen Committer-Zeit im Fenster liegt (Anfang 2 s früher, Ende 1 s später), gehört der Session. Gemessen: der Befehl `git add -A && git commit` lief von Sekunde 1790847743 bis 1790847743, der Commit trägt dieselbe Committer-Zeit — er liegt im Fenster, aber auf der Sekunde genau am Rand. Daher die Toleranzen. Commit, Amend, Cherry-Pick, Rebase und Squash setzen die Committer-Zeit auf jetzt und werden erfasst; fremde Commits aus einem Rebase behalten ihre alte Zeit und fallen heraus.
- **Merge-Commits zählen nie** (`--no-merges`). Die Commits eines gemergten Branches erscheinen trotzdem, einzeln als eigene oder fremde Commits.
- **Uncommittete Dateien gehören der Session**, wenn ihr Agent sie geschrieben hat und kein eigener Commit sie in derselben oder einer späteren Sekunde enthält. Pfade stehen normalisiert in `session_files`.
- **Diff aus verstreuten Commits je Datei:** `from` = erster Elternteil des ersten eigenen Commits der Datei, `to` = letzter eigener Commit. Ändert ein fremder Commit oder fremder Schmutz dieselbe Datei dazwischen, trägt der Diff einen Hinweis (`LineStat.foreign`).
- **Reichweite:** `Session` = die Session allein, `Project` = alle Sessions des Vorhabens. Ein Commit, den zwei parallele Sessions im selben Fenster sehen, gehört beiden.
- **Ticket-Worktrees** werden weiter gegen ihre Abzweigung vom Standard-Branch gemessen ([ADR 010](010-worktrees-durch-den-agenten.md)), aber nur mit eigenen Commits. Das Merge-Gate sieht damit nur die Arbeit der Reichweite.
- **Kein Nachtragen:** Sessions vor der Aufzeichnung bekommen `changes_tracked_at`; die Ansicht nennt den Zeitpunkt.
- **Gespeichert** in `session_commits`, `session_files` und `sessions.changes_tracked_at` (Migration 7).

Löst ab: in ADR 011 den Satz „Die Changes gehören dem Vorhaben: …“, in ADR 006 die Definition der drei Blickwinkel gegen `base_commit`.

## Konsequenzen

- Es fehlen: Commits aus Hintergrund-Befehlen, was nur in der Konfliktlösung eines Merge-Commits steckt, per Shell erzeugte uncommittete Dateien (Formatierer, Code-Generator, `git mv`) bis zu ihrem Commit und Commits außerhalb von HEAD (Branch gewechselt).
- Parallele Sessions im selben Fenster teilen sich einen Commit.
- Ein Commit, den Sascha selbst für die Session macht, gehört ihr nicht.
- Die Commit-Suche braucht Git und läuft deshalb in einem eigenen Thread (`sessions/registry/commit_scan.rs`), nicht unter der Session-Sperre. Ein Commit erscheint daher kurz nach dem Ende des Befehls.
