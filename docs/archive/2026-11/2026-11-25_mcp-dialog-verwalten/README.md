# MCP-Server im Dialog verwalten

Der Dialog „MCP-Server“ zeigt Server auch ohne laufenden Agenten, gruppiert sie nach Ablageort und kann Server hinzufügen, bearbeiten, entfernen, testen und ihre Werkzeuge samt Server-Anweisungen zeigen. Entscheidungen: [ADR 070](../../../decisions/070-mcp-server-verwalten.md). Entwurf (verbindlich): [artifacts/mcp-dialog-entwurf.html](artifacts/mcp-dialog-entwurf.html).

## Overview

| Phase | Titel | Rating | Modell | Status |
|---|---|---|---|---|
| 1 | Core: Konfiguration lesen | heikel | opusplan | complete |
| 2 | Core: Konfiguration schreiben, Neustart bei Änderung | heikel | opusplan | complete |
| 3 | Core: Verbindung testen, Werkzeuge und Anweisungen lesen | standard | sonnet | complete |
| 4 | Oberfläche: Liste nach Ablageort | standard | sonnet | complete |
| 5 | Oberfläche: Formular, Test, Werkzeug-Ansicht | standard | sonnet | complete |

**Status:** abgeschlossen am 2026-11-28.

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

pub struct McpConfigView {
    pub sources: Vec<McpSource>,
    pub config_changed: bool,
    pub disabled_everywhere: Vec<String>, // Namen, die der Verwalter in allen Vorhaben aus hält
}

pub struct McpDraft {
    pub source_id: String,
    pub original_name: Option<String>, // Some = Bearbeiten
    pub original_source_id: Option<String>, // Some = Verschieben: der Eintrag steht noch dort
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
| `mcp_toggle(sessionId, server, enabled, everywhere)` | wie heute; ohne Agent schreibt der Core die Datei und gibt `true` zurück. `everywhere: true` beim Ausschalten nimmt den Namen in die Liste „überall aus“; Einschalten und „hier aus“ (`enabled: false, everywhere: false`) nehmen ihn heraus | 2 |
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
9. Jeder Server hat einen dreistufigen Schalter: an · aus in diesem Vorhaben · überall aus. „Überall“ bleibt im Verwalter gespeichert und gilt auch in Vorhaben, die danach entstehen, bis der Server irgendwo wieder eingeschaltet wird; dann ist er in allen Vorhaben des Verwalters wieder an.
10. Handy-Breite (390 px): Dialog als Blatt von unten, alle Aktionen erreichbar, keine waagerechte Bildlaufleiste.

## Von mir gesetzt

- „Nur ich“ heißt „Nur ich, in diesem Vorhaben“: der Arbeitsordner der Claude-Kommandozeile ist der Workspace, nicht das Repository.
- Neuer Server-Name: `^[A-Za-z0-9._-]{1,64}$`; gleicher Name in derselben Quelle ist ein Fehler, in einer anderen Quelle erlaubt (Hinweis „überdeckt“).
- Als Ziel beim Hinzufügen wählbar: Benutzer, je Repository, nur ich. Die Workspace-`.mcp.json` ist nur bearbeitbar, kein Ziel für Neues.
- Kein „Agent neu starten“-Knopf: der Neustart passiert mit der nächsten Nachricht (bestehendes Muster für neue Repositories).
- Header-Werte werden nicht angezeigt, auch nicht auf Klick (abweichend vom ersten Entwurf mit „zeigen“).
- `serde_json` bekommt das Feature `preserve_order`, damit `~/.claude.json` nicht umsortiert wird.
- Codex-Sessions: nicht Teil des Plans.
- „Überall aus“ gilt nur für Vorhaben des Verwalters (Workspaces unter seinem Workspace-Ordner), nicht für Claude-Sitzungen außerhalb.
- Einschalten eines „überall aus“-Servers wirkt überall, ohne Rückfrage: die Liste ist ein Wunsch des Benutzers, kein Vorhaben-Zustand.
- Ablage als Einstellung `mcp_disabled_everywhere` (JSON-Liste) in der bestehenden Einstellungstabelle — keine Migration.

## Konfidenz

- 🟡 Gleichzeitiges Schreiben von `~/.claude.json` durch eine laufende Kommandozeile kann eine Änderung des Verwalters überschreiben. Check (Phase 2): in Session A einen Server ausschalten, während Session B arbeitet; nach Bs nächster Antwort `projects[<Workspace A>].disabledMcpServers` in `~/.claude.json` prüfen.
- 🟡 Ob `mcp_status` für Repository-Server bei `scope` `dynamic` bleibt und ob die Namen eindeutig zuordenbar sind. Check (Phase 4): Dialog in einer laufenden Session mit Repository-`.mcp.json` öffnen, Zuordnung ansehen.
- 🟡 Initialize-Antwort mit `instructions`: nicht jeder Server liefert sie. Check (Phase 3) gefahren: `dispatch` und `garage` liefern sie, eine Attrappe ohne ergibt `None`.

Fehlerklassen geprüft (Vault: typescript, react, claude-code; rust und tauri ohne Eintrag): keine einschlägig.

## Summary

Der Dialog „MCP-Server“ zeigt alle Server aus den Konfigurationsdateien nach Ablageort, auch ohne Agent. Server lassen sich hinzufügen (Felder oder JSON), bearbeiten, zwischen Quellen verschieben, mit Rückgängig entfernen, dreistufig schalten und ohne Agent testen; die Details zeigen Werkzeuge mit Beschreibung und die Server-Anweisungen.

## Files touched

- Core: `src-tauri/src/mcp/` (`model.rs`, `config_files.rs`, `probe.rs`), `src-tauri/src/commands/mcp.rs`, `src-tauri/src/sessions/registry.rs`, `registry/mcp.rs`
- Oberfläche: `src/features/mcp/`, `src/lib/mcp.ts`, `src/lib/bindings/`, `src/components/Dialog.tsx` (`onEscape`)
- Doku: ADR 070, `docs/code-map.md`

## Commits

- Phase 1: `17e3ff3` · Phase 2: `935367c` · Phase 3: `95f038e` · Phase 4: `a9f11fd`
- Phase 5: der Commit, der diesen Plan archiviert

## Deviations from plan

- Phase 4, Core: `toggle_mcp` schickt eine Steueranfrage nur noch für Server, die der laufende Agent meldet; neu angelegte gehen wie ohne Agent in die Datei (vorher `internal`-Fehler).
- Phase 4: Die Fußzeile zeigt nur „Schalter: links überall aus · Mitte hier aus · rechts an.“ (AK 11 und Entwurf) statt des Satzes aus Phasen-AK 9; ausgeschaltet heißt „Aus hier“/„Aus überall“ (AK 11) statt „Aus“.
- Phase 4: zusätzliche Zustände „Überdeckt“ (eingeschalteter, überdeckter Eintrag) und „Lädt …“ (Agent läuft, Liste fehlt noch; Schalter gesperrt).
- Phase 4: `mergeServers` bekommt zusätzlich die hier entfernten Namen; bei geänderter Konfiguration stehen sie und verschwundene Datei-Server nicht unter „Fest eingebunden“. Grenze: ein von außen gelöschter Repository-Server steht dort bis zum Neustart des Agenten.
- Phase 4: Lesefehler einer Quelle stehen als Zeile in ihrer Gruppe; „Vorhaben-Ordner“ nennt „nur dieses Vorhaben“.
- Phase 4, bis Phase 5: „Server hinzufügen“, „Hier hinzufügen“ und „Bearbeiten“ gesperrt, Werkzeugnamen bleiben in den Details, der Leerzustand nennt „Oder JSON einfügen“ noch nicht. Mit Phase 5 erledigt.
- Phase 5, Core: `McpDraft.original_source_id`; ohne das Feld ließ sich ein Server mit verborgenen Werten nicht verschieben, weil die Oberfläche die Werte nicht kennt.
- Phase 5: Das Öffnen des Formulars schreibt eine noch offene Entfernung sofort, statt die 6 s abzuwarten (AK 4).
- Phase 5: „Verbindung testen“ meldet wie im Entwurf nur die Anzahl der Werkzeuge; Namen, Beschreibungen und Anweisungen zeigt die Werkzeug-Ansicht (AK 7).
- Phase 5: zusätzliche Fehler „Namensformat“ und „verborgener Wert muss neu eingegeben werden“ (Schlüssel oder Art geändert); `Dialog` bekommt `onEscape`, damit Esc im Formular zur Liste führt.
- Phase 5: neue Texte in `mcpFormTexts.ts`; zusätzlich zur Checkliste `McpScopeCards`, `McpPairRows`, `mcpFormState.ts`.
- Phase 5: Die Geheimnis-Warnung gilt nur im Felder-Modus und nur bei angehaktem „geheim“; JSON einfügen übernimmt nur `type`, `url`, `command`, `args`, `headers`, `env`.

## Follow-ups

- Konfidenz-Check offen: gleichzeitiges Schreiben von `~/.claude.json` (siehe „Konfidenz“, erster Punkt).
- Konfidenz-Check offen: Zuordnung von `mcp_status` zu Repository-Servern bei laufendem Agenten.
- Nicht in der laufenden App gelaufen: Liste, Schalten, Formular, Verschieben (Core), Test und Werkzeug-Ansicht; die Oberfläche ist auf einer Prüfseite mit nachgestelltem Core geprüft.
- Möglich: Geheimnis-Warnung auch für eingefügtes JSON und für nicht angehakte Werte.
