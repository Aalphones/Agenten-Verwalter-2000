# Agenten Verwalter 2000

Eine ruhige, lokale Desktop-Oberfläche, um mehrere Coding-Agenten parallel zu führen. Jede Session steht für eine Aufgabe und kann mehrere Git-Repositories umfassen — die App legt dafür automatisch Worktrees und Branches an, damit sich parallele Agenten nicht in die Quere kommen.

Du arbeitest im Chat mit dem Agenten, beantwortest seine Rückfragen direkt dort und siehst in der Changes-Ansicht mit zwei Klicks, was er über alle betroffenen Repositories geändert hat. Alles läuft lokal: Tauri, React, Rust und SQLite, kein Server, keine Cloud.

**Status:** Konzeptphase — das App-Gerüst entsteht als Nächstes.

## Quickstart

### Voraussetzungen

- Windows 11 (macOS und Linux folgen später)
- [Rust](https://rustup.rs/) (stable) und die Microsoft C++ Build Tools
- Node.js ≥ 22 und [pnpm](https://pnpm.io/)
- Git
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code), angemeldet

### Installieren, starten, prüfen

Die Befehle werden ergänzt, sobald das Gerüst steht. Vorgesehen:

```sh
pnpm install
pnpm tauri dev      # App im Entwicklungsmodus
pnpm lint && pnpm typecheck
```

## Weiterlesen

- [docs/PROJECT.md](docs/PROJECT.md) — Ziel, Umfang, Meilensteine
- [AGENTS.md](AGENTS.md) — Einstieg für Coding-Agenten: Stack, Konventionen, Regeln
