# Code-Map

Feature → Ordner. Bewusst grob, keine Zeilennummern. Stand: Gerüst angelegt — App-Rahmen, Tokens und Typ-Pipeline stehen (`src/app/`, `src/lib/`, `src/styles/`, `src-tauri/src/commands/`, `src-tauri/src/bin/`), dazu die Claude-Anbindung im Core (`src-tauri/src/agents/`) und die Sessions samt Chat-Verlauf im Speicher des Core (`src-tauri/src/sessions/`, bis M4 die Datenbank übernimmt); die Oberfläche steht für App-Rahmen und Sessions (`src/features/sessions/`, `src/stores/sessions.ts`, `src/components/`); die übrigen Features und `src-tauri/src/<feature>/` außer `sessions/` folgen — die Tabelle beschreibt dort die Zielstruktur und wird mit dem Code nachgeführt.

## Namensschema (parallel über die Schichten)

Ein Feature heißt in jeder Schicht gleich. Wer den Feature-Namen kennt, kennt die Dateien:

```text
src/features/<feature>/           React-Komponenten und Hooks des Features
src/stores/<feature>.ts           Zustand-Slice (nur flüchtiger UI-Zustand)
src-tauri/src/commands/<feature>.rs   Tauri Commands, die die UI aufruft
src-tauri/src/<feature>/          Fachlogik im Core
src-tauri/src/db/<feature>.rs     SQLite-Zugriffe
```

Features: `sessions`, `chat`, `changes`, `repositories`, `settings`. Querschnitt ohne Feature-Bezug: `agents` (Provider), `git`, `worktrees`, `processes`, `filesystem` — nur im Core.

## Tabelle

| Feature | Oberfläche | Core |
|---|---|---|
| Sessions (Liste, Anlegen, Archivieren, Status) | `src/features/sessions/` (Leerzustand, Neue Session, Status-Tabellen, Abo auf `session://changed`), `src/stores/sessions.ts` (aktive Session, Ansicht „Neue Session“), Wrapper `src/lib/sessions.ts` | `src-tauri/src/commands/sessions.rs`, `src-tauri/src/sessions/` (`model.rs` Typen, `registry.rs` Zustand und Prozess-Anbindung), `src-tauri/src/db/sessions.rs` (mit M4) |
| Chat (Nachrichten, Tool-Aktivität, Rückfragen) | `src/features/chat/`, Wrapper `src/lib/chat.ts` | `src-tauri/src/commands/chat.rs`, `src-tauri/src/sessions/registry.rs` (Verlauf im Speicher), `src-tauri/src/db/messages.rs`, `src-tauri/src/db/events.rs` (mit M4) |
| Session-Arbeitsordner | — | `src-tauri/src/filesystem/workspace.rs` |
| Changes (Repo-Filter, Dateien, Diff) | `src/features/changes/` | `src-tauri/src/commands/changes.rs`, `src-tauri/src/git/` |
| Repositories (bekannte Repos verwalten) | `src/features/repositories/` | `src-tauri/src/commands/repositories.rs`, `src-tauri/src/db/repositories.rs` |
| Settings | `src/features/settings/` | `src-tauri/src/commands/settings.rs`, `src-tauri/src/db/settings.rs` |
| Agent-Provider | — | `src-tauri/src/agents/event.rs` (anbieterneutrale Typen: Chat-Einträge, Modell, Modus, Denkaufwand, Agent-Ereignisse), `src-tauri/src/agents/claude/` (Claude-Kommandozeile: Programm finden, Prozess, Zeilenformate, Übersetzung) — ein Modul pro Provider |
| Worktrees anlegen/aufräumen | — | `src-tauri/src/worktrees/` |
| Agent-Prozesse, Wiederherstellung | — | `src-tauri/src/processes/` |
| Generierte Typen Rust → TS | `src/lib/bindings/` (generiert, nicht von Hand ändern) | Quelle: Typen im Core; Export-Liste `src-tauri/src/bin/gen-bindings.rs` (`pnpm bindings`) |
| Aufruf-Wrapper für Tauri Commands | `src/lib/<feature>.ts` | `src-tauri/src/commands/<feature>.rs`, registriert in `src-tauri/src/lib.rs` |
| Fehler am Command-Rand | — | `src-tauri/src/error.rs` |
| App-Info (Name, Version) | `src/lib/app.ts` | `src-tauri/src/commands/app.rs` |
| Design-Tokens (roh + semantisch, Hell/Dunkel) | `src/styles/theme.css` | — |
| App-Rahmen (Layout, Sidebar, Session-Kopfzeile) | `src/app/` (`App.tsx`, `Sidebar.tsx`, `SessionHeader.tsx`) | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` |
| Geteilte UI-Bausteine | `src/components/` (`StatusIcon`, `Popover`, `ModelMenu`, `ModeMenu`, `EffortDots`) | — |
| Anzeige-Texte für Modell, Modus, Denkaufwand | `src/lib/labels.ts` | — |

## Wo was wohnt — Faustregeln

- Braucht es Dateisystem, Git, einen Prozess oder die Datenbank? → Core, nie direkt aus React.
- Überlebt der Wert einen App-Neustart? → SQLite über den Core, nicht Zustand.
- Nur für die aktuelle Ansicht (aktive Session, gewählte Datei, offene Ansicht)? → `src/stores/<feature>.ts`.
- Neuer Agenten-Typ? → neues Modul in `src-tauri/src/agents/`, das denselben Provider-Vertrag erfüllt; die UI ändert sich nicht.
- Ein Typ, den UI und Core beide kennen? → im Core definieren, nach `src/lib/bindings/` generieren.
- Neuer Typ über die Tauri-Grenze? → `derive(TS)` im Core, in `gen-bindings.rs` eintragen, `pnpm bindings`.
- Git-Aufruf? → ausschließlich über `src-tauri/src/git/`, nie verstreut `Command::new("git")`.
