# Code-Map

Feature → Ordner. Bewusst grob, keine Zeilennummern. Stand: Meilenstein 5 — die Changes-Ansicht (Reiter, Dateibaum, Übersicht, Diff-Ansicht in `src/features/changes/`) steht, ihr Core liest die Änderungen aus Git (`src-tauri/src/changes/`); App-Rahmen, Tokens und Typ-Pipeline stehen (`src/app/`, `src/lib/`, `src/styles/`, `src-tauri/src/commands/`, `src-tauri/src/bin/`), dazu die Claude-Anbindung im Core (`src-tauri/src/agents/`) und die Sessions samt Chat-Verlauf im Speicher des Core (`src-tauri/src/sessions/`, bis M4 die Datenbank übernimmt); die Oberfläche steht für App-Rahmen, Sessions, Chat-Verlauf und Eingabeleiste (`src/features/sessions/`, `src/features/chat/`, `src/stores/sessions.ts`, `src/stores/chat.ts`, `src/components/`); die übrigen Features und `src-tauri/src/<feature>/` außer `sessions/` folgen — die Tabelle beschreibt dort die Zielstruktur und wird mit dem Code nachgeführt.

## Namensschema (parallel über die Schichten)

Ein Feature heißt in jeder Schicht gleich. Wer den Feature-Namen kennt, kennt die Dateien:

```text
src/features/<feature>/           React-Komponenten und Hooks des Features
src/stores/<feature>.ts           Zustand-Slice (nur flüchtiger UI-Zustand)
src-tauri/src/commands/<feature>.rs   Tauri Commands, die die UI aufruft
src-tauri/src/<feature>/          Fachlogik im Core
src-tauri/src/db/<feature>.rs     SQLite-Zugriffe
```

Features: `sessions`, `chat`, `attachments`, `skills`, `background`, `changes`, `repositories`, `settings`. Querschnitt ohne Feature-Bezug: `agents` (Provider), `git`, `worktrees`, `processes`, `filesystem` — nur im Core.

## Tabelle

| Feature | Oberfläche | Core |
|---|---|---|
| Sessions (Liste, Anlegen, Archivieren, Status) | `src/features/sessions/` (Leerzustand, Neue Session, Status-Tabellen, Abo auf `session://changed`), `src/stores/sessions.ts` (aktive Session, Ansicht „Neue Session“, `activeView` Chat/Changes), Wrapper `src/lib/sessions.ts` | `src-tauri/src/commands/sessions.rs`, `src-tauri/src/sessions/` (`model.rs` Typen, `registry.rs` Zustand und Prozess-Anbindung), `src-tauri/src/db/sessions.rs` (mit M4) |
| Chat (Nachrichten, Tool-Aktivität, Rückfragen) | `src/features/chat/` (`ChatView` Spalte, `ChatTimeline` virtualisierter Verlauf mit Ziffern-Tasten, Block-Komponenten je Eintragsart, `useChatEntries` geladener Ausschnitt + Abo auf `chat://entry`, `buildBlocks` Werkzeug-Gruppen, `toolSummary`, `questionDraft` Auswahl und Antwort einer Rückfrage, `Composer` Eingabeleiste mit Modell-/Modus-Menü, Esc-Pause in `ChatView`), `src/stores/chat.ts` (Entwurf je Session), Wrapper `src/lib/chat.ts` | `src-tauri/src/commands/chat.rs`, `src-tauri/src/sessions/registry.rs` (Verlauf im Speicher), `src-tauri/src/db/messages.rs`, `src-tauri/src/db/events.rs` (mit M4) |
| Anhänge (Zwischenordner, Verschieben in den Workspace, Inhaltsblöcke an den Agenten) | Wrapper `src/lib/attachments.ts` | `src-tauri/src/attachments/` (Zwischenordner `<Benutzerordner>\.verwalter\attachments`, beim Start geleert; `take_for_workspace` nach `<Workspace>\.anhaenge`; `message_content`), `src-tauri/src/commands/attachments.rs`; Asset-Protokoll in `src-tauri/tauri.conf.json` |
| Session-Arbeitsordner | — | `src-tauri/src/filesystem/workspace.rs` (`data_dir`, `new_session_workspace` für neue Sessions, `stored_session_workspace` für gespeicherte) |
| Persistenz (SQLite) | — | `src-tauri/src/db/` (`mod.rs` Verbindung und Text-Helfer, `migrations.rs` + `migrations/*.sql`, `sessions.rs`, `chat_entries.rs`, `session_repositories.rs`, `background.rs`; Migration 2 = Repositories und Worktrees, Migration 3 = Hintergrund-Einträge und Scratchpad-Spalte), Datei `<Benutzerordner>\.verwalter\verwalter.db`, geöffnet in `src-tauri/src/lib.rs` |
| Changes (Repo-Filter, Dateien, Diff) | `src/features/changes/` (`ChangesView`, `ChangesToolbar`, `FileTree` virtualisiert, `buildFileRows`, `ChangesOverview`, `DiffView` virtualisierte Zeilen, `useFileDiff` Nachladen ohne Flackern, `useSessionChanges` Nachladen, `changesScope`), `src/stores/changes.ts` (Filter, Blickwinkel, geöffnete Datei je Session), Wrapper `src/lib/changes.ts` | `src-tauri/src/changes/` (`model.rs` Typen, `parse.rs` Git-Ausgaben lesen inkl. `parse::unified`, `mod.rs` drei Blickwinkel je Repository, ein Thread je Repository, `file_diff`), `src-tauri/src/commands/changes.rs` (`changes_load`, `changes_file_diff`), `SessionRegistry::repositories_of` |
| Skills und Befehle (Liste fürs `/`-Menü, Skill-Marke an der Nachricht) | Wrapper `src/lib/skills.ts` | `src-tauri/src/skills/` (`frontmatter.rs`; `collect`, `match_invocation`), `src-tauri/src/commands/skills.rs`; `skill_roots` in `sessions/registry.rs` |
| Hintergrund (Prozesse, Subagenten, Scratchpad) | Wrapper `src/lib/background.ts` (inkl. Abo auf `background://changed`) | `src-tauri/src/background/` (`model.rs` Typen, `output.rs` Ausgaben kürzen/lesen, Adresse und Exit-Code, `scratchpad.rs` Liste und Lesen mit Pfadprüfung), `src-tauri/src/commands/background.rs`, `src-tauri/src/db/background.rs`; Ereignisse aus `agents/claude/translate.rs`, Zustand in `sessions/registry.rs` |
| Repositories (bekannte Repos verwalten) | `src/features/repositories/` (`RepositoryPicker`, `useKnownRepositories`), Wrapper `src/lib/repositories.ts` | `src-tauri/src/repositories/` (Liste, Hinzufügen, Skill-Zahl), `src-tauri/src/commands/repositories.rs`, `src-tauri/src/db/repositories.rs` |
| Git-Aufrufe | — | `src-tauri/src/git/` (einziger Ort, der `git` startet; lesend nur Plumbing: `diff-index`, `diff-tree`, `ls-files`, `rev-list`) |
| Prozesse ohne Konsolenfenster | — | `src-tauri/src/processes/` (`hide_console`) |
| Settings | `src/features/settings/` | `src-tauri/src/commands/settings.rs`, `src-tauri/src/db/settings.rs` |
| Agent-Provider | — | `src-tauri/src/agents/event.rs` (anbieterneutrale Typen: Chat-Einträge, Modell, Modus, Denkaufwand, Agent-Ereignisse), `src-tauri/src/agents/claude/` (Claude-Kommandozeile: Programm finden, Prozess mit `--add-dir` je Worktree, Zeilenformate, Übersetzung) — ein Modul pro Provider |
| Worktrees anlegen/aufräumen | — | `src-tauri/src/worktrees/` (Branch-Name, Ordnernamen, Anlegen mit Rückbau, Prüfen und Neuanlegen vor jedem Agent-Start (`ensure`), Aufräumen nach dem Archivieren (`remove_clean`)) |
| Agent-Prozesse, Wiederherstellung | — | `src-tauri/src/sessions/registry.rs` (Wiederherstellung nach Neustart, ruhende Agenten beenden) |
| Generierte Typen Rust → TS | `src/lib/bindings/` (generiert, nicht von Hand ändern) | Quelle: Typen im Core; Export-Liste `src-tauri/src/bin/gen-bindings.rs` (`pnpm bindings`) |
| Aufruf-Wrapper für Tauri Commands | `src/lib/<feature>.ts` | `src-tauri/src/commands/<feature>.rs`, registriert in `src-tauri/src/lib.rs` |
| Fehler am Command-Rand | — | `src-tauri/src/error.rs` |
| Fehlertexte aus dem Core | `src/lib/errors.ts` (`isCommandError`, `commandErrorText`) | — |
| App-Info (Name, Version) | `src/lib/app.ts` | `src-tauri/src/commands/app.rs` |
| Design-Tokens (roh + semantisch, Hell/Dunkel) | `src/styles/theme.css`; BEM-Verschachtelung (`&__x`) löst `postcss-nested` in `vite.config.ts` auf | — |
| App-Rahmen (Layout, Sidebar, Session-Kopfzeile) | `src/app/` (`App.tsx`, `Sidebar.tsx`, `SessionHeader.tsx` mit den Reitern Chat/Changes) | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` |
| Geteilte UI-Bausteine | `src/components/` (`StatusIcon`, `Popover`, `ModelMenu`, `ModeMenu`, `EffortDots`, `Markdown`, `CodeBlock`, `ExternalLink`) | — |
| Sidebar-Zeile (Umbenennen, Archivieren) | `src/app/SidebarItem.tsx` | — |
| Anzeige-Texte für Modell, Modus, Denkaufwand | `src/lib/labels.ts` | — |

## Wo was wohnt — Faustregeln

- Braucht es Dateisystem, Git, einen Prozess oder die Datenbank? → Core, nie direkt aus React.
- Überlebt der Wert einen App-Neustart? → SQLite über den Core, nicht Zustand.
- Nur für die aktuelle Ansicht (aktive Session, gewählte Datei, offene Ansicht)? → `src/stores/<feature>.ts`.
- Neuer Agenten-Typ? → neues Modul in `src-tauri/src/agents/`, das denselben Provider-Vertrag erfüllt; die UI ändert sich nicht.
- Ein Typ, den UI und Core beide kennen? → im Core definieren, nach `src/lib/bindings/` generieren.
- Neuer Typ über die Tauri-Grenze? → `derive(TS)` im Core, in `gen-bindings.rs` eintragen, `pnpm bindings`.
- Git-Aufruf? → ausschließlich über `src-tauri/src/git/`, nie verstreut `Command::new("git")`.
