# MCP-Server im Dialog verwalten

Der Dialog „MCP-Server“ zeigt Server auch ohne laufenden Agenten, gruppiert sie nach Ablageort und kann Server hinzufügen, bearbeiten, entfernen, testen und ihre Werkzeuge samt Server-Anweisungen zeigen. Entscheidungen: [ADR 070](../../decisions/070-mcp-server-verwalten.md). Entwurf (verbindlich): [artifacts/mcp-dialog-entwurf.html](artifacts/mcp-dialog-entwurf.html).

## Overview

| Phase | Titel | Rating | Modell | Status |
|---|---|---|---|---|
| 1 | Core: Konfiguration lesen | heikel | opusplan | pending |
| 2 | Core: Konfiguration schreiben, Neustart bei Änderung | heikel | opusplan | pending |
| 3 | Core: Verbindung testen, Werkzeuge und Anweisungen lesen | standard | sonnet | pending |
| 4 | Oberfläche: Liste nach Ablageort | standard | sonnet | pending |
| 5 | Oberfläche: Formular, Test, Werkzeug-Ansicht | standard | sonnet | pending |

## Kontrakt (Core ↔ Oberfläche)

Typen in `src-tauri/src/mcp/model.rs` (ts-rs, `camelCase`, erzeugt nach `src/lib/bindings/`), Wrapper in `src/lib/mcp.ts`.

```rust
pub enum McpSourceKind { User, Local, Repository, Workspace }

pub struct McpSource {
    pub id: String,            // "user" | "local" | "repo:<Repository-Name>" | "workspace"
    pub kind: McpSourceKind,
    pub label: String,         // Repository-Name; bei den anderen leer
    pub file: String,          // Anzeigepfad, Benutzerordner als "~": "~/.claude.json", "gymid/.mcp.json"
    pub servers: Vec<McpConfigEntry>,
    pub error: Option<String>, // Datei nicht lesbar/kein JSON: ein Satz ohne Dateiinhalt
}

pub enum McpTransport { Stdio, Http, Sse, Other }

pub struct McpConfigEntry {
    pub name: String,
    pub transport: McpTransport,
    pub target: String,              // URL oder Befehl mit Argumenten, durch Leerzeichen getrennt
    pub command: Option<String>,     // nur Stdio
    pub args: Vec<String>,           // nur Stdio
    pub url: Option<String>,         // nur Http/Sse
    pub pairs: Vec<McpPair>,         // Header (Http/Sse) bzw. env (Stdio)
    pub enabled: bool,               // false, wenn in disabledMcpServers des Workspace
    pub shadowed_by: Option<String>, // id der Quelle, deren gleichnamiger Server gewinnt
}

pub struct McpPair { pub key: String, pub value: Option<String> } // None = verborgen (kein reiner ${VAR}-Verweis)

pub struct McpConfigView { pub sources: Vec<McpSource>, pub config_changed: bool }

pub struct McpDraft {
    pub source_id: String,
    pub original_name: Option<String>, // Some = Bearbeiten
    pub name: String,
    pub transport: McpTransport,       // Stdio | Http | Sse
    pub url: Option<String>,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub pairs: Vec<McpPairDraft>,
}
pub struct McpPairDraft { pub key: String, pub value: Option<String> } // None = bisherigen Wert behalten

pub struct McpToolInfo { pub name: String, pub description: String }
pub struct McpProbeResult { pub tools: Vec<McpToolInfo>, pub instructions: Option<String>, pub error: Option<String> }
```

Commands (`src-tauri/src/commands/mcp.rs`), alle mit `session_id`:

| Command | Ergebnis | Phase |
|---|---|---|
| `mcp_config_load(sessionId)` | `McpConfigView` | 1 |
| `mcp_config_save(sessionId, draft)` | `()`; Fehler `CommandError::Invalid` mit Satz | 2 |
| `mcp_config_remove(sessionId, sourceId, name)` | `()` | 2 |
| `mcp_toggle(sessionId, server, enabled)` | wie heute; ohne Agent schreibt der Core die Datei und gibt `true` zurück | 2 |
| `mcp_probe(sessionId, draft)` | `McpProbeResult` | 3 |
| `mcp_inspect(sessionId, sourceId, name)` | `McpProbeResult` | 3 |

Jede Schreib-Aktion sendet danach `mcp://changed` für **alle** Sessions (Benutzer-Server betreffen alle).

## Finale AK

1. Der Dialog öffnet in einer neuen, einer ruhenden und einer laufenden Session und zeigt jedes Mal alle Server aus den Konfigurationsdateien.
2. Gruppen in dieser Reihenfolge, leere Gruppen fehlen (außer „Nur ich, in diesem Vorhaben“ mit Hinweis und Link „Hier hinzufügen“): Mein Benutzer · Projekt `<Repository>` (je Repository) · Vorhaben-Ordner (nur wenn `.mcp.json` im Workspace existiert) · Nur ich, in diesem Vorhaben · Fest eingebunden. Keine Gruppe „Kommandozeile“ mehr für Repository-Server.
3. Hinzufügen, Bearbeiten und Entfernen ändern genau die Datei der gewählten Quelle; andere Schlüssel und die Reihenfolge der Datei bleiben erhalten.
4. Entfernen hat keine Rückfrage, zeigt 6 s „Rückgängig“ (auch Strg+Z) und schreibt erst danach.
5. Ein-/Ausschalten wirkt ohne Agent (Datei) und mit Agent (Steueranfrage wie heute).
6. Nach einer Änderung bei laufendem Agenten steht „Änderung wirkt ab der nächsten Nachricht“; die nächste Nachricht an den ruhenden Agenten startet ihn neu mit Verlauf, ein arbeitender Agent wird nicht unterbrochen.
7. „Verbindung testen“ und „Werkzeuge & Anweisungen ansehen“ funktionieren ohne Agent und zeigen Werkzeugnamen mit Beschreibung sowie die Server-Anweisungen oder einen Fehlersatz.
8. Kein Header- oder Umgebungswert (außer reinen `${VARIABLE}`-Verweisen) erreicht die Oberfläche, das Protokoll oder eine Fehlermeldung.
9. Handy-Breite (390 px): Dialog als Blatt von unten, alle Aktionen erreichbar, keine waagerechte Bildlaufleiste.

## Von mir gesetzt

- „Nur ich“ heißt „Nur ich, in diesem Vorhaben“: der Arbeitsordner der Claude-Kommandozeile ist der Workspace, nicht das Repository.
- Neuer Server-Name: `^[A-Za-z0-9._-]{1,64}$`; gleicher Name in derselben Quelle ist ein Fehler, in einer anderen Quelle erlaubt (Hinweis „überdeckt“).
- Als Ziel beim Hinzufügen wählbar: Benutzer, je Repository, nur ich. Die Workspace-`.mcp.json` ist nur bearbeitbar, kein Ziel für Neues.
- Kein „Agent neu starten“-Knopf: der Neustart passiert mit der nächsten Nachricht (bestehendes Muster für neue Repositories).
- Header-Werte werden nicht angezeigt, auch nicht auf Klick (abweichend vom ersten Entwurf mit „zeigen“).
- `serde_json` bekommt das Feature `preserve_order`, damit `~/.claude.json` nicht umsortiert wird.
- Codex-Sessions: nicht Teil des Plans.

## Konfidenz

- 🟡 Gleichzeitiges Schreiben von `~/.claude.json` durch eine laufende Kommandozeile kann eine Änderung des Verwalters überschreiben. Check (Phase 2): in Session A einen Server ausschalten, während Session B arbeitet; nach Bs nächster Antwort `projects[<Workspace A>].disabledMcpServers` in `~/.claude.json` prüfen.
- 🟡 Ob `mcp_status` für Repository-Server bei `scope` `dynamic` bleibt und ob die Namen eindeutig zuordenbar sind. Check (Phase 4): Dialog in einer laufenden Session mit Repository-`.mcp.json` öffnen, Zuordnung ansehen.
- 🟡 Initialize-Antwort mit `instructions`: nicht jeder Server liefert sie. Check (Phase 3): `mcp_inspect` gegen `dispatch` (liefert Anweisungen) und einen Server ohne.

Fehlerklassen geprüft (Vault: typescript, react, claude-code; rust und tauri ohne Eintrag): keine einschlägig.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
