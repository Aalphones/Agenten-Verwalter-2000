# 005 — Repositories und Worktrees: Kopie in der Session, Basis = ausgechecktes HEAD, ein Branch-Name für alle

**Status:** für neue Sessions abgelöst durch [ADR 010](010-worktrees-durch-den-agenten.md) · **Datum:** 2026-09-28

## Kontext

Meilenstein 3 macht aus der Session ein Arbeitsumfeld über ein oder mehrere Git-Repositories ([konzept.md](../konzept.md), Abschnitte 20–23 und 52): pro Repository ein Worktree mit eigenem Branch im Session-Workspace, in dem der Agent arbeitet. Zu klären waren: wie die App Repositories kennt, wovon ein Branch abzweigt, wie Branch und Ordner heißen, wie der Agent die Repositories samt Skills und `CLAUDE.md` sieht, was bei Fehlern und beim Archivieren mit den Worktrees passiert. Randbedingungen: Windows-Pfadlänge, Claude legt den Verlauf einer Session unter dem Arbeitsordner ab (`%USERPROFILE%\.claude\projects\<Arbeitsordner>\`) und findet ihn mit `--resume` nur dort.

## Optionen

- **Basis eines Branches:** (a) der aktuell ausgecheckte Stand des Haupt-Checkouts; (b) `origin/<Standard-Branch>` nach `git fetch`.
- **Branch-Name bei Kollision:** (a) Fehlerdialog, der Nutzer wählt einen anderen Namen; (b) die App hängt `-2`, `-3` … an, bis der Name in allen gewählten Repositories frei ist.
- **Workspace-Ordner:** (a) volle Session-ID; (b) die ersten 8 Zeichen der ID, gespeichert in der Session.
- **Repositories dem Agenten zeigen:** (a) Arbeitsverzeichnis ist der Workspace, ohne weitere Angaben; (b) zusätzlich pro Worktree `--add-dir` und `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.
- **Verbindung Session ↔ Repository:** (a) Fremdschlüssel auf die Tabelle der bekannten Repositories; (b) Kopie von Name, Pfad, Branch und Basis in `session_repositories`.
- **Archivieren:** (a) Worktrees bleiben; (b) `git worktree remove` ohne `--force`; (c) mit `--force`.

## Entscheidung

- **(a) Basis = ausgechecktes HEAD.** Gespeichert werden `base_ref` (Branch-Name, bei losgelöstem HEAD die Commit-ID) und `base_commit`. Das ist deterministisch, offline und schnell; Meilenstein 5 misst Changes gegen `base_commit`. `origin/<Standard-Branch>` braucht Netz und Anmeldedaten, und ein Repository ohne Remote hätte keine Basis.
- **(b) Branch `verwalter/<slug>`, in allen Repositories gleich.** Der Slug entsteht aus dem Session-Namen (Kleinbuchstaben, Umlaute aufgelöst, alles außer `a-z0-9` zu `-`, höchstens 40 Zeichen, leer → `session`). „Branch existiert“ ist kein Fehler, den der Nutzer lösen muss; ein gemeinsamer Name hält die Session in jedem Repository wiederfindbar.
- **(b) Workspace `<Benutzerordner>\.verwalter\workspaces\<8 Zeichen>` mit unveränderlichem Arbeitsordner.** Kurze Pfade schonen die Windows-Pfadlänge in tiefen Repositories. Der Ordner steht in `sessions.workspace_dir`; Sessions von vor Meilenstein 3 haben dort `NULL` und behalten `workspaces\<volle ID>`. Der Arbeitsordner einer Session ändert sich nie, sonst findet `--resume` den Verlauf nicht.
- **(b) `--add-dir` je Worktree plus `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.** Belegt am 2026-09-28 mit Claude Code 2.1.220: ohne `--add-dir` findet Claude die Skills eines Unterordners nicht (`system/init` → `skills` leer), mit `--add-dir` schon; die `CLAUDE.md` eines hinzugefügten Ordners lädt Claude nur mit der Variable.
- **(b) Kopie statt Fremdschlüssel.** Wer ein Repository aus der Liste entfernt, zerstört keine Session; sie behält Name, Pfad des Haupt-Checkouts, Unterordner, Branch und Basis.
- **(b) Archivieren räumt Worktrees ohne `--force` weg.** Git verweigert das bei geänderten oder neuen, nicht ignorierten Dateien — solche Worktrees bleiben samt Änderungen liegen. Branches bleiben immer, Commits gehen nie verloren. Der Workspace-Ordner wird gelöscht, wenn er danach leer ist.
- **Anlegen ist alles oder nichts.** Scheitert ein Worktree, baut die App die schon angelegten Worktrees und Branches dieser Session wieder ab; es entsteht keine Session.
- **Git nur über `git/`:** `git` aus dem PATH, ohne Shell und Konsolenfenster, Standardeingabe `null`, `GIT_TERMINAL_PROMPT=0`, Pfade als eigene Argumente.

## Konsequenzen

- Branches `verwalter/…` sammeln sich in den Repositories; das Aufräumen bleibt Handarbeit.
- Ein Haupt-Checkout ohne Commit kann nicht Teil einer Session werden (kein HEAD als Basis).
- Git-ignorierte Dateien wie `.env` fehlen im Worktree, Dev-Server starten dort deshalb oft nicht. Sie zu kopieren berührt die Sicherheitsgrenze und ist eine eigene Entscheidung.
- Präfix, Basis-Regel und Workspace-Wurzel sind feste Werte im Code; Einstellungen folgen in Meilenstein 6.
- Die Bedeutung von „Archivieren“ aus Meilenstein 4 („Arbeitsordner bleiben erhalten“) ändert sich: saubere Worktrees verschwinden.
