# Agenten Verwalter 2000 — Kontext

Ausführliches Produkt- und Technikkonzept: [konzept.md](konzept.md). Diese Datei ist die verdichtete, verbindliche Fassung; wo sie vom Konzept abweicht, gilt diese Datei (Abweichungen stehen in [decisions/001-stack-und-plattform.md](decisions/001-stack-und-plattform.md)).

## Ziel & Vision

Agenten Verwalter 2000 ist eine minimalistische lokale Desktop-Kommandozentrale für Coding-Agenten. Eine Session steht für eine Aufgabe und kann beliebig viele Git-Repositories umfassen, jedes in einem eigenen Worktree. Der Chat mit dem Agenten ist die Hauptarbeitsfläche, die Changes-Ansicht (Dateien, Diffs) die Prüfebene. Zielgruppe sind Entwickler, die mehrere Agenten parallel über mehrere Repositories laufen lassen und dabei den Überblick verlieren — der Engpass ist der Mensch, nicht die Rechenleistung.

Leitsatz: **Chat first. Changes second.** Was nicht aktiv beim Agent-Workflow hilft, gehört nicht dauerhaft auf den Bildschirm.

## Scope

MVP (Version 1):

- **Navigation:** Session-Liste, neue Session (drei Schritte: Aufgabe → Repositories → Agent), Session archivieren
- **Chat:** Nachrichten von User und Agent, eingeklappte Tool-Aktivität, Agent-Status, Unterbrechen, Fortsetzen, Rückfragen direkt im Chat beantworten
- **Workspace:** mehrere Repositories pro Session, automatisch angelegte Worktrees und Branches
- **Changes:** Repository-Filter, geänderte Dateien, Unified Diff, Trennung committed/uncommitted gegen eine konfigurierbare Basis
- **Agent:** Claude als einziger Provider
- **Persistenz:** SQLite, Session-Wiederherstellung nach App-Neustart
- **Desktop:** Tauri-App für Windows

Danach (Reihenfolge laut Konzept, Abschnitt 66): OpenCode- und LM-Studio-Provider, Modellwechsel, Skills, Rechte-Oberfläche, Suche, Command Palette → Multi-Agent, „Ask about this change“, Commit-Automatik → PR-Workflow, Agent-Pipelines, Session-Vorlagen.

## Nicht-Ziele

Keine IDE, kein VS-Code-Ersatz, kein vollständiger Git-Client, kein Ticket-System, kein CI/CD-Dashboard, kein Cloud-Dienst, kein LSP-Host, kein Debugger, kein Dev-Container-Manager, kein allgemeiner LLM-Chat-Client, keine Workflow-DSL. Kein permanenter Code-Editor, keine KPI-Dashboards, keine Toast-Flut bei Statuswechseln.

## Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Desktop-Shell | Tauri 2 | Kleine Shell, native Prozesse und Dateisystem direkt — passt zu „leichte Shell, schwerer Worker“ |
| UI | React + TypeScript (strict) | |
| Styling | Tailwind v4 als Token-Pipeline (`@theme`), Komponenten mit BEM-Klassen und eigener CSS-Datei | Einheitliche Tokens für Hell/Dunkel ohne Utility-Klassen-Wildwuchs, siehe [conventions/tailwind.md](conventions/tailwind.md) |
| UI-State | Zustand, nur für flüchtigen UI-Zustand | Persistente Daten liegen in SQLite, nicht im React-State |
| Native Core | Rust | |
| Datenbank | SQLite über rusqlite | Synchron, schlank, keine Datenbank beim Kompilieren nötig |
| Gemeinsame Typen | aus Rust nach TypeScript generiert | Eine Quelle für Session-, Event- und Status-Typen; Werkzeug offen (s.u.) |
| Git | native Git-Kommandozeile, vom Rust-Kern aufgerufen | Deterministisch, unabhängig von der KI-Logik |
| Diff | Monaco Diff Editor, lazy geladen | Nur die aktive Datei, keine Instanz pro Datei |
| Agent | Claude (Anbindungsweg offen, s.u.) | |
| IPC | Tauri Commands + Events | |
| Paketmanager | pnpm | |
| Projektform | eine App (`src/` + `src-tauri/`), kein Monorepo | Monorepo erst, wenn ein zweites Paket echten Bedarf hat |

## Constraints

- **Plattform:** Windows 11 zuerst — dort wird entwickelt und ausprobiert. macOS und Linux bleiben Ziele, werden vor dem MVP aber nicht geprüft.
- **Ressourcen:** Zielgerät ist ein Laptop mit rund 16 GB RAM, auf dem die Agenten selbst den Großteil verbrauchen. Der UI-Speicher wächst mit dem sichtbaren Inhalt, nicht mit der Zahl der Sessions oder Events.
- **Lokal:** kein Server, keine Cloud, kein Docker, kein separater Datenbankdienst. Keine Telemetrie, außer später als Opt-in.
- **Sicherheit:** Der Session-Workspace ist die Sicherheitsgrenze; Agenten bekommen nicht standardmäßig das ganze Benutzerverzeichnis.
- **Absturzfestigkeit:** Ein UI-Absturz darf keinen Agenten beenden, keinen Worktree und keine Session verlieren.
- **Team:** Einzelentwickler, keine Deadline.
- **Qualitätssicherung:** keine automatisierten Tests; abgesichert wird über strenge Typen, Lint, Build und eine manuelle Abnahme-Checkliste pro Plan.

## Meilensteine

Reihenfolge nach Entwicklungsrisiko (Konzept, Abschnitt 67) — das Riskanteste zuerst, UI-Politur zuletzt.

1. **Gerüst:** Rust-Toolchain, Tauri-2-App mit React, Lint/Typecheck/Build lokal und als GitHub-Actions-Prüfung.
2. **Agent-Anbindung (Durchstich):** Claude starten, Events empfangen, unterbrechen, fortsetzen, Status erkennen — Entscheidung über den Anbindungsweg fällt hier.
3. **Worktree-Orchestrierung:** mehrere Repositories als eine Session anlegen, aufräumen, Fehlerfälle (Branch existiert, Repo fehlt).
4. **Persistenz & Wiederherstellung:** Sessions, Nachrichten, Events in SQLite; nach Neustart laufende Agenten wiederfinden.
5. **Changes & Diff:** Diffs über mehrere Repositories zusammenfassen, committed/uncommitted, lazy Diff-Ansicht.
6. **UI auf Zielbild:** Chat- und Changes-Ansicht nach Konzept, virtuelle Listen, Zustände konsistent → MVP.

## Offene Fragen

- **Wie wird Claude angebunden?** Das Claude Agent SDK gibt es für TypeScript und Python, nicht für Rust. Möglich sind (a) ein Node-Hilfsprozess mit dem SDK, gesteuert vom Rust-Kern, oder (b) die `claude`-Kommandozeile im JSON-Stream-Modus, direkt vom Rust-Kern gestartet. Das Konzept schließt einen separaten Node-Server aus, meint damit aber einen dauerhaften Server, nicht zwingend einen Hilfsprozess pro Agent. Entscheidung per Durchstich in Meilenstein 2, festgehalten als ADR.
- **Womit werden die Typen von Rust nach TypeScript generiert** (z.B. `ts-rs` oder `tauri-specta`)? Entscheidung beim Gerüst.
- **Wie wird die Rechtegrenze pro Session auf Windows durchgesetzt?** Über die Rechte-Einstellungen des Agenten selbst, über das Arbeitsverzeichnis, oder mehr? Für das MVP reicht voraussichtlich die Agent-eigene Konfiguration.
- **Windows-Pfadlänge:** Worktrees unter einem tiefen Basisordner plus `node_modules` stoßen an die 260-Zeichen-Grenze. Basisordner kurz halten (Vorschlag `~/.verwalter/workspaces/<session>/<repo>`) und `core.longpaths` prüfen.
- **Anmeldung bei Claude:** nutzt die App die vorhandene Anmeldung der installierten Claude-Kommandozeile oder einen eigenen API-Schlüssel?
