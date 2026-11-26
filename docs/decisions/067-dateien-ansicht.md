# 067 — Dateien-Ansicht: ein Baum je Repository, Gesamtübersicht je Vorhaben

**Status:** angenommen · **Datum:** 2026-11-18

Teilweise abgelöst durch ADR 071: PDF und Bilder öffnen im Betrachter-Rahmen statt im Standardprogramm bzw. per `data:`-Adresse mit 2-MB-Grenze.

## Kontext

Die Changes-Ansicht zeigt je Checkout einen eigenen Block (Haupt-Checkout, jeder Ticket-Worktree, jedes innere Repository), darin nur die geänderten Dateien, rechts eine Tabelle je Checkout und den Git-Verlauf des ausgecheckten Branches. Wer nachvollziehen will, was ein Vorhaben geändert hat, sieht weder die Umgebung einer Änderung noch, welche Session sie wann gemacht hat, und liest Worktree-Ordnernamen statt eines Gesamtbilds. Gemessen am 2026-11-18 an einem Ordner mit acht inneren Repositories: 79 Vorhaben mit 1.088 gespeicherten Commits, davon 1.058 von einem Ref erreichbar; in 5 von 173 Paaren aus Vorhaben und Repository hat dieselbe Datei auf zwei offenen Linien unterschiedlichen Inhalt.

## Optionen

- **Ort:** (a) ein Reiter „Dateien“ ersetzt „Changes“ — gewählt; (b) „Changes“ bleibt, „Dateien“ kommt dazu — verworfen: eine geänderte Datei stünde an zwei Orten; (c) eine linke Spalte mit den Sichten Dateien, Verlauf, Git — verworfen: der Verlauf ist in einer schmalen Spalte nicht lesbar.
- **Einheit im Baum:** (a) ein Knoten je Repository, Einträge zusammengelegt — gewählt; (b) ein Knoten je Checkout wie bisher — verworfen: das ist der bemängelte Zustand; (c) ein Knoten je Branch — verworfen: der Branch ist für die Frage „was hat das Vorhaben geändert“ Nebensache.
- **Woher die Gesamtübersicht kommt:** (a) die Einträge der Reichweite `Project` zusammenlegen, lose Commits nur im Verlauf — gewählt; (b) alle gespeicherten Commits unabhängig von jedem Checkout neu auswerten — verworfen: die Zuordnung je Datei (ADR 014) setzt eine Commit-Folge von der Basis bis `HEAD` voraus und müsste für verzweigte Linien neu erfunden werden, für 30 von 1.088 Commits.
- **Umfang von „Alle Dateien“:** (a) nur was Git kennt und neue Dateien; (b) zusätzlich Ignoriertes, grau und erst beim Aufklappen gelesen — gewählt.
- **Dateien bearbeiten:** verworfen; das Nicht-Ziel „kein permanenter Code-Editor“ bleibt. Die Ansicht liest nur und öffnet auf Wunsch VS Code.

## Entscheidung

- Der Reiter „Dateien“ ersetzt „Changes“. Feature `files` in allen Schichten; die Changes bleiben die Quelle der Änderungen und der Diffs.
- **Ein Knoten je Repository.** `Source`, `RepositoryChanges` tragen `group`, `group_name`, `is_main`; die Oberfläche legt Einträge gleicher Gruppe zusammen. Worktree-Ordnernamen erscheinen nur noch in der Git-Seite, wo Git-Befehle je Checkout wirken.
- **Dieselbe Datei in zwei Einträgen:** gleiche Fassung (gleicher letzter eigener Commit, nichts offen) zählt einmal; unterschiedliche Fassungen erscheinen als eine Zeile mit der jüngsten vorn, die andere ist in der Datei wählbar.
- **Standard ist das ganze Vorhaben**, auch in einer Session; die einzelne Session ist ein Filter.
- **Verlauf aus `session_commits`:** je Session ihre Commits mit Betreff, Zeit und Dateien. Ein Commit, der in keinem Eintrag zwischen Basis und `HEAD` liegt, steht nur im Verlauf (mit Diff), nicht im Baum; ein nicht mehr vorhandener wird gezählt.
- **Baum „Alle Dateien“** aus `git ls-files` (versioniert und neu) plus ignorierte Einträge aus `git status --ignored`; ein ignorierter Ordner mit eigenem `.git` entfällt, weil er als Repository oder Arbeitsbaum schon einen Platz hat.
- **Dateilinks im Chat** führen in die Ansicht, HTML und PDF weiter ins Standardprogramm. Die Sicherheitsgrenze von ADR 023 bleibt; nur die Endungsliste gilt nicht mehr für das Ansehen in der App, weil dort nichts ausgeführt wird.
- **Kommentieren** an Diff-Zeilen ist erlaubt, sobald eine Session sichtbar ist, unabhängig vom Filter; im Diff eines einzelnen Schritts nicht (seine Zeilennummern gehören zu einem alten Stand).

Löst ab: in ADR 015 „Kommentieren nur in der Changes-Ansicht einer Session“ (jetzt: in der Dateien-Ansicht einer Session); in ADR 020 die Anzeigenamen `"<Repository> · <Worktree-Ordner>"` für die Dateien-Ansicht; in ADR 023 „Ein Klick … öffnet die Datei mit dem Standardprogramm“ für alles außer HTML, PDF und Dateien außerhalb der Repositories; in ADR 025 den Ort der Git-Werkzeuge und des Verlaufs.

## Konsequenzen

- Lose Commits (in der Messung 18 von 1.088) fehlen im Baum und in den Kennzahlen; die Übersicht nennt ihre Zahl.
- Der Baum „Alle Dateien“ zeigt den Ordner des Ankers; bei zwei offenen Linien ist das die zuletzt geänderte.
- Je aufgeklapptem Repository läuft mit jedem Nachladen der Changes ein `git ls-files` und ein `git status --ignored`.
- Die Suche findet nur Dateinamen und Pfade; ignorierte Einträge und Dateiinhalt durchsucht sie nicht.
- Pfade im Kern werden nicht mehr generell kleingeschrieben verglichen; unter Linux bleiben `Readme.md` und `README.md` zwei Dateien.
