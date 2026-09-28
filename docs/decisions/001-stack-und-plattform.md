# 001 — Stack, Plattform und Name

**Status:** angenommen · **Datum:** 2026-09-28

## Kontext

Das Konzept ([../konzept.md](../konzept.md)) lässt beim Stack mehrere Optionen offen (SQLx oder rusqlite, Zustand oder eigener State, CSS oder Tailwind), schlägt einen Monorepo-Baum vor, nennt macOS als erstes Ziel und verwendet für Pfade und Ordner den Namen „forge“. Entwickelt wird auf Windows 11.

## Entscheidung

- **Plattform:** Windows zuerst. macOS und Linux bleiben Ziel, werden vor dem MVP aber nicht geprüft.
- **Name in Code und Pfaden:** `verwalter` — Paket/Crate `verwalter`, Datenordner `~/.verwalter/`, Worktrees unter `~/.verwalter/workspaces/`. In der Oberfläche heißt das Produkt „Agenten Verwalter 2000“. Die `forge`-Pfade im Konzept sind damit ersetzt.
- **Datenbank-Schicht:** rusqlite (synchron, keine Datenbank beim Kompilieren nötig).
- **UI-State:** Zustand, ausschließlich für flüchtigen UI-Zustand.
- **Styling:** Tailwind v4 als Token-Pipeline, Komponenten mit BEM-Klassen und eigener CSS-Datei.
- **Projektform:** eine App (`src/` für React, `src-tauri/` für Rust), kein Monorepo mit `apps/` und `packages/`. Gemeinsame Typen werden aus Rust nach TypeScript generiert statt in einem eigenen Paket gepflegt.
- **Paketmanager:** pnpm.
- **Repo-Hosting:** GitHub, Build-Prüfung per GitHub Actions.

## Konsequenzen

- Pfad- und Prozesslogik wird zuerst gegen Windows gebaut (Laufwerksbuchstaben, Backslashes, Pfadlänge, Prozess-Beendigung ohne POSIX-Signale). Plattformunterschiede gehören in den Rust-Kern, nicht in die UI.
- Ein späterer Wechsel auf ein Monorepo bleibt möglich, sobald ein zweites Paket echten Bedarf hat.
- rusqlite läuft synchron; Datenbankzugriffe, die länger dauern können, laufen außerhalb des Tauri-Haupt-Threads.
