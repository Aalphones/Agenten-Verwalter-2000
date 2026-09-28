# Rust Conventions — verwalter

> **Stack** (für dieses Projekt festgelegt):
> | Layer | Choice |
> |---|---|
> | Rust | stable, Edition 2024, Toolchain per `rust-toolchain.toml` gepinnt |
> | Desktop | Tauri 2 |
> | Datenbank | SQLite über rusqlite |
> | Git | native `git`-Kommandozeile |
> | Lint | `cargo clippy -- -D warnings`, `cargo fmt --check` |
>
> Projektentscheidungen in dieser Datei haben Vorrang vor allgemeinen Gewohnheiten.

## Project Layout

```text
src-tauri/src/
  main.rs, lib.rs      App-Start, Registrierung der Commands
  commands/<feature>.rs  Tauri Commands (dünn: Eingabe prüfen, Fachlogik aufrufen, Ergebnis zurück)
  <feature>/           Fachlogik (sessions, chat, changes, repositories, settings)
  agents/              ein Modul pro Provider, gemeinsamer Provider-Trait
  git/                 einziger Ort, der `git` aufruft
  worktrees/           Anlegen/Aufräumen von Worktrees
  processes/           Start, Überwachung, Wiederfinden von Agent-Prozessen
  db/<table>.rs        SQLite-Zugriffe, Migrationen
  filesystem/          Pfad-Logik, Workspace-Grenzen
```

## Fehlerbehandlung

- Kein `unwrap()` / `expect()` außerhalb von Programmstart und echten Invarianten; `expect` nennt dann die Invariante.
- Eigener Fehlertyp pro Modul (`thiserror`), am Command-Rand in eine serialisierbare Fehlermeldung für die UI übersetzt.
- Fehler, die der Nutzer sehen soll (Repo fehlt, Branch existiert, Agent abgestürzt), sind eigene Varianten, damit die UI eine passende Aktion anbieten kann — keine generische Textmeldung.

## Git

- Git läuft ausschließlich über das Modul `git/`, das die Kommandozeile mit festen Argumenten aufruft und die Ausgabe in Typen parst (`--porcelain`, `-z`, `--numstat`).
- Nie Nutzereingaben ungeprüft in Git-Argumente — Branch-Namen validieren, Pfade als eigene Argumente übergeben, nie über eine Shell.
- Der Git-Zustand, den die UI zeigt, stammt aus diesem Modul, nie aus Aussagen des Agenten.

## Prozesse

- Agent-Prozesse laufen unabhängig vom Fenster; ein geschlossenes oder abgestürztes Fenster beendet sie nicht.
- Prozess-IDs und Startparameter werden in SQLite gespeichert, damit sie nach einem Neustart wiedergefunden werden.
- Windows zuerst: Beenden ohne POSIX-Signale, Pfade mit Laufwerksbuchstaben, Pfadlänge beachten. Plattformunterschiede gekapselt in `processes/` und `filesystem/`.

## Datenbank

- Schema-Änderungen nur über nummerierte Migrationen in `db/`.
- rusqlite ist synchron: längere Zugriffe laufen nicht auf dem Tauri-Haupt-Thread.
- Chat und Events werden seitenweise gelesen (Cursor), nie vollständig in den Speicher geladen.

## Typen für die UI

Typen, die über die Tauri-Grenze gehen, werden im Core definiert und nach `src/lib/bindings/` generiert. Werkzeug wird beim Gerüst festgelegt.

## Critical Rules

1. **Git nur über `git/`** — eine zweite Stelle, die Git aufruft, zerstört die deterministische Sicht auf den Repository-Zustand.
2. **Kein Shell-Aufruf mit zusammengesetzten Strings** — Agent-Namen, Branch-Namen und Pfade kommen teils aus Nutzereingaben.
3. **Agent-Prozesse überleben die UI** — Session-Verlust nach einem Fenster-Absturz ist der Fehler, den die App verhindern soll.
4. **Kein `unwrap()` in Command-Pfaden** — ein Panic im Core reißt die ganze App mit.
