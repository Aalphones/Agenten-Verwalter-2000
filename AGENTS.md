# AGENTS.md — Agenten Verwalter 2000

🚧 Aktive Arbeit → [STATE.md](STATE.md)

Lokale Desktop-Kommandozentrale für Coding-Agenten: eine Session = eine Aufgabe über mehrere Git-Repositories mit je eigenem Worktree; der Chat ist die Hauptarbeitsfläche, Changes/Diffs die Prüfebene. Kontext, Scope, Meilensteine und offene Fragen: **[docs/PROJECT.md](docs/PROJECT.md)**. Ausführliches Ursprungskonzept: [docs/konzept.md](docs/konzept.md).

## Code finden — erst hier, dann suchen

**Bevor du im Code suchst, lies [docs/code-map.md](docs/code-map.md).** Ein Feature heißt in jeder Schicht gleich (`src/features/<x>/`, `src/stores/<x>.ts`, `src-tauri/src/commands/<x>.rs`, `src-tauri/src/<x>/`, `src-tauri/src/db/<x>.rs`) — den Pfad kannst du meist raten statt ihn zu suchen. Begriffe: [docs/glossary.md](docs/glossary.md).

## Stack

| Layer | Choice |
|---|---|
| Desktop | Tauri 2 |
| UI | React 19 + TypeScript (strict) |
| Styling | Tailwind v4 als Token-Pipeline + BEM-CSS pro Komponente |
| UI-State | Zustand (nur flüchtig) |
| Core | Rust |
| Datenbank | SQLite (rusqlite) |
| Git | native `git`-Kommandozeile aus dem Core |
| Diff | Monaco Diff Editor (lazy) |
| Paketmanager | pnpm |
| Zielplattform | Windows zuerst |

Begründungen: [docs/decisions/001-stack-und-plattform.md](docs/decisions/001-stack-und-plattform.md).

## Konventionen

| Thema | Datei |
|---|---|
| TypeScript | [docs/conventions/typescript.md](docs/conventions/typescript.md) |
| React | [docs/conventions/react.md](docs/conventions/react.md) |
| Styling / Tailwind | [docs/conventions/tailwind.md](docs/conventions/tailwind.md) |
| Rust | [docs/conventions/rust.md](docs/conventions/rust.md) |
| Linting / Prüfkette | [docs/conventions/linting.md](docs/conventions/linting.md) |
| Commits | [docs/conventions/commits.md](docs/conventions/commits.md) |
| Releases / Versions-Tags | [docs/conventions/releases.md](docs/conventions/releases.md) |

## Befehle

| Befehl | Wirkung |
|---|---|
| `pnpm tauri dev` | App im Entwicklungsmodus |
| `pnpm check` | gesamte Prüfkette (Lint, Typecheck, Format, Build, rustfmt, Clippy) — vor jedem Commit grün |
| `pnpm bindings` | TS-Typen aus Rust neu erzeugen — nach jeder Änderung an Typen, die die Tauri-Grenze überqueren |
| `pnpm format` | Prettier schreibt `src/` neu |
| `pnpm tauri build` | NSIS-Installer unter `src-tauri/target/release/bundle/nsis/`, lose exe unter `src-tauri/target/release/verwalter.exe` |
| `pnpm tauri build --no-bundle` | nur die lose exe, ohne Installer |

Die Prüfkette im Einzelnen und ihre Reihenfolge: [docs/conventions/linting.md](docs/conventions/linting.md).

## Dokumentation

| Datei | Inhalt |
|---|---|
| [docs/PROJECT.md](docs/PROJECT.md) | Ziel, Scope, Nicht-Ziele, Constraints, Meilensteine, offene Fragen |
| [docs/code-map.md](docs/code-map.md) | Feature → Ordner |
| [docs/glossary.md](docs/glossary.md) | Verbindliches Vokabular |
| [docs/decisions/](docs/decisions/) | Architektur-Entscheidungen (ADRs) |
| [docs/planning/](docs/planning/) | Aktive Pläne |
| [docs/archive/](docs/archive/) | Abgeschlossene Pläne |
| [docs/design/](docs/design/) | UI-Entwürfe und Mockups |
| [docs/knowledge/](docs/knowledge/) | Projektwissen (Fakten, Referenzen), offene Recherchefragen |
| [docs/memory/](docs/memory/) | Projekt-Notizen für Agenten |

Nach Code-Änderungen: Code-Map, Glossar und betroffene Konventionen im selben Commit nachziehen.

## Critical Rules

1. **Chat first, Changes second** — keine UI-Elemente, die nicht aktiv beim Agent-Workflow helfen, dauerhaft auf den Bildschirm.
2. **Git-Zustand ist deterministisch** — Git läuft nur über `src-tauri/src/git/`; die UI zeigt den Zustand aus Git, nie aus Aussagen des Agenten.
3. **Persistentes gehört in SQLite, nicht in den UI-State** — der Speicherbedarf der UI wächst mit dem Sichtbaren, nicht mit der Zahl der Sessions oder Events.
4. **Agent-Prozesse überleben die UI** — ein Fenster-Absturz verliert keine Session, keinen Worktree, keinen Agenten.
5. **Der Session-Workspace ist die Sicherheitsgrenze** — Agenten bekommen nur ihre Worktrees, nicht das Benutzerverzeichnis.
6. **Ein vollständig abgeschlossener Plan endet mit einem Versions-Tag** — beim Archivieren Version in den drei Dateien anheben, `chore(release)`-Commit, Tag `vX.Y.Z` setzen und pushen; der Tag baut das Release. Ablauf und Versionsregel: [docs/conventions/releases.md](docs/conventions/releases.md).
