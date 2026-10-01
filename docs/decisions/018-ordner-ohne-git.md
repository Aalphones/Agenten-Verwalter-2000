# 018 — Ordner ohne Git als Arbeitsordner: Art aus dem Dateisystem, feste Art in der Session, keine Changes

**Status:** angenommen · **Datum:** 2026-10-01

## Kontext

Der Agent soll auch in einem Ordner arbeiten können, der kein Git-Repository ist (Downloads, Notizen, ein Ordner mit eigener `CLAUDE.md` und eigenen Skills). Bisher lehnte „Repository hinzufügen“ ihn ab (`NotARepository`). Der Ordner soll wie ein Haupt-Checkout per `--add-dir` an den Agenten gehen; die App kann dort aber keine Changes zeigen. Der User kennt und akzeptiert das Risiko: kein Diff, kein Zurück über Git.

## Optionen

- **Woher die Art kommt:** (a) Spalte `kind` in `repositories`; (b) das Dateisystem — `<Pfad>\.git` vorhanden oder nicht.
- **Wann ein gewählter Pfad ein Ordner ohne Git ist:** (1) jeder Git-Fehler heißt „kein Repository“; (2) nur, wenn weder im Pfad noch in einem Ordner darüber ein `.git` liegt.
- **Was die Changes zeigen:** (i) Eintrag mit `error`; (ii) eigene Liste `plain_folders` und eine gedämpfte Zeile.

## Entscheidung

- **(b): keine Migration, die Art steht im Dateisystem.** Ein bekannter Eintrag ist ein Git-Repository, wenn `<Pfad>\.git` existiert (Ordner oder Datei), sonst ein Ordner ohne Git; „nicht gefunden“ heißt nur noch: der Ordner fehlt. Gegen (a) spricht die Migration und dass ein Ordner, in dem später `git init` lief, künstlich „ohne Git“ bliebe.
- **In der Session ist die Art fest.** `session_repositories.checkout` bekommt den Wert `folder` (die Spalte ist `TEXT`); `folder`, `branch`, `base_ref` und `base_commit` sind leer. Ein Ordner, der nach dem Anlegen `git init` bekommt, bleibt in dieser Session ein Ordner ohne Git.
- **(2): das Dateisystem entscheidet, nicht ein Git-Fehler.** Liegt im Pfad oder darüber ein `.git`, ist er ein Repository: die App speichert dessen Wurzel, und scheitert `git rev-parse` (z. B. „dubious ownership“), bleibt das ein Fehler. Gegen (1) spricht, dass ein Repository mit Git-Problem still zum Ordner ohne Changes würde.
- **Zu umfassende Ordner sind gesperrt** (nur für Ordner ohne Git): Laufwerkswurzel, der Benutzerordner und jeder Ordner darüber, der Datenordner der App `<Benutzerordner>\.verwalter` samt Inhalt. Grund: der Agent bekommt nicht das Benutzerverzeichnis (AGENTS.md Regel 5), und im Datenordner liegen Datenbank und alle Workspaces. Fehler: `CommandError::FolderNotAllowed(Pfad)`.
- **(ii): Changes.** Ordner ohne Git liefern keinen Eintrag in `SessionChanges.repositories`, ihre Namen stehen in `SessionChanges.plain_folders`. Die Positions-Schlüssel der übrigen Einträge bleiben (Position = Index in `session_repositories`). Gegen (i) spricht, dass ein gewollter Zustand rot als Alarm erschiene.
- **`CommandError::NotARepository` entfällt.** Einziger Erzeuger war die Ablehnung eines Ordners ohne Git.
- **Begriff:** „Ordner ohne Git“ in Oberfläche, Glossar und Doku; im Code `RepositoryKind::Folder` und `RepositoryCheckout::Folder`.

## Konsequenzen

- Der Agent liest und schreibt im Ordner ohne Rückfrage wie im Haupt-Checkout; die App sieht nicht, was er ändert, und Git kann nichts zurückholen.
- Für einen Ordner ohne Git gibt es weder Freigaben für Ticket-Worktrees noch deren Erkennung, und `git` läuft für ihn nie.
- Ein Repository, dessen `.git` gelöscht wurde, erscheint als Ordner ohne Git statt als „nicht gefunden“.
- Das Anhängen an ein laufendes Vorhaben nutzt `main_checkout_since`; für einen Ordner ohne Git gibt es dabei keine Basis.
