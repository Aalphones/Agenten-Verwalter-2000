# MCP-Dialog: Server ansehen, ausschalten, neu verbinden

Ziel: Ein Dialog „MCP-Server“ zeigt für die aktive Session, welche MCP-Server der Agent geladen hat, mit Status, Herkunft, Verbindung und Werkzeugliste; jeder Server lässt sich dort neu verbinden und aus- bzw. einschalten. Geöffnet wird er über `/mcp` im `/`-Menü und über einen Hinweis „MCP · N Problem(e)“ in der Eingabeleiste, der nur erscheint, wenn ein Server fehlgeschlagen ist oder eine Anmeldung braucht. Der Verwalter spricht dafür kein MCP selbst: er schickt Steueranfragen an die laufende Claude-Kommandozeile der Session, die die Server ohnehin lädt.

Design (verbindlich): [docs/design/2026-10-01_mcp-dialog/](../../../design/2026-10-01_mcp-dialog/README.md) — Quellen in `canvas/`, klickbare Fassung https://claude.ai/artifact/FfQFLxiZfwmsfMQvPUYd7Q.

Kontext für jeden Umsetzer: [AGENTS.md](../../../../AGENTS.md), [docs/code-map.md](../../../code-map.md), [docs/glossary.md](../../../glossary.md), die Konventionen unter [docs/conventions/](../../../conventions/), [ADR 008](../../../decisions/008-kontext-und-kontingent.md) (Vorbild: Kontext-Aufschlüsselung per Steueranfrage), [docs/knowledge/claude-stream-json.md](../../../knowledge/claude-stream-json.md). ADR 013 entsteht in Phase 1 aus „Festgelegte Entscheidungen“.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Typen, Steueranfragen, Antworten zuordnen, Commands, Ereignis | [phase-1-core.md](phase-1-core.md) | standard | complete |
| 2 | Oberfläche: Dialog- und Schalter-Baustein, MCP-Dialog | [phase-2-dialog.md](phase-2-dialog.md) | standard | complete |
| 3 | Einstiege `/mcp` und Hinweis in der Eingabeleiste, Doku, Release | [phase-3-einstiege.md](phase-3-einstiege.md) | mechanisch | complete |

**Reihenfolge:** nach dem aktiven Plan „Meilenstein 6“ (STATE.md). Zum Plan „Sprachdiktat“ gibt es keine Abhängigkeit; beide bauen in die Eingabeleiste ein — wer zuerst kommt, setzt seinen Knopf, der zweite fügt seinen an der dann aktuellen Stelle ein (Phase 3 nennt die Stelle relativ zu Modus-Menü und Senden-Knopf). Phasen strikt 1 → 2 → 3. Umsetzung direkt auf `main`, ein Commit pro Phase, Commit-Scope `mcp` (Phase 1 trägt ihn in [commits.md](../../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md).

## Messungen (2026-10-01, Claude-Kommandozeile im Druckmodus mit `--input-format stream-json`)

Grundlage der Entscheidungen; Phase 1 überträgt sie nach `docs/knowledge/claude-stream-json.md`.

- `{"subtype":"mcp_status"}` → `control_response` `success` mit `response.mcpServers`: je Server `name`, `status`, `scope`, `source`, `config` (`type` `stdio` mit `command`/`args`, `claudeai-proxy` mit `url`), ab `connected` zusätzlich `serverInfo` und `tools` (je `name`, `annotations`), bei `failed` zusätzlich `error` (gemessen `"Connection closed"`). Beobachtete `status`: `pending`, `connected`, `failed`, `disabled`; beobachtete `scope`: `user`, `claudeai`, `dynamic`.
- Direkt nach dem Start stehen claude.ai-Server auf `pending` und wechseln binnen ~10 s auf `connected` — **ohne eigenes Ereignis**; wer den Wechsel sehen will, fragt erneut.
- `{"subtype":"mcp_reconnect","serverName":"<name>"}` → bei Erfolg `success` **ohne** `response`; bei Fehlschlag `{"subtype":"error","error":"Connection closed"}`. Die Antwort kommt erst nach dem Verbindungsversuch.
- `{"subtype":"mcp_toggle","serverName":"<name>","enabled":false|true}` → `success` ohne `response`; unbekannter Name → `error` `"Server not found: <name>"`. Danach meldet `mcp_status` `disabled` bzw. `pending` → `connected`.
- **Ausschalten bleibt gespeichert, pro Arbeitsordner:** ein neuer Prozess im selben Arbeitsordner meldet den Server weiter `disabled`, ein Prozess in einem anderen Ordner `pending`. Im Verwalter ist der Arbeitsordner der Workspace des Vorhabens.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 013](../../../decisions/013-mcp-server-im-dialog.md) „MCP-Server im Dialog“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Vergeben sind 008, 010, 011, 012 auf der Platte und 009 im Plan „Sprachdiktat“; dieser Plan schreibt 013.

- **Steueranfragen an den Agenten der Session, kein eigener MCP-Client und kein Hilfsprozess.** Betrachtet und verworfen: (a) eigener MCP-Client im Core — zweite Verbindung zu jedem Server, zweite Konfiguration, und der Agent sähe die Wirkung nicht; (b) Hilfsprozess wie beim Kontingent ([ADR 008](../../../decisions/008-kontext-und-kontingent.md)) im Workspace — zeigt auch bei ruhendem Agenten etwas an, aber nicht die Verbindungen, die der Agent tatsächlich hat, und kostet je Abfrage einen Prozessstart plus ~10 s Verbindungsaufbau. Folge der Wahl: ohne laufenden Agenten gibt es keine Liste.
- **Ausschalten speichert die Kommandozeile, nicht der Verwalter.** Gilt damit für alle Sessions des Vorhabens und übersteht Neustarts; der Dialog sagt das in der Fußzeile und im Tooltip des Schalters. Keine eigene Tabelle, keine Migration.
- **Liste nur im Speicher und nur, solange der Agent-Prozess lebt** (wie die Kontext-Aufschlüsselung, ADR 008). Endet oder wechselt der Prozess, wird sie verworfen — eine alte Liste würde Verbindungen zeigen, die es nicht mehr gibt.
- **Wann gefragt wird:** am Ende jeder Antwort des Agenten (neben `get_context_usage`), beim Öffnen des Dialogs, nach jeder beantworteten Aktion, und solange der Dialog offen ist und ein Server `pending` ist oder eine Aktion läuft, alle 2 s.
- **Antworten zuordnen über die Request-ID:** `mcp_reconnect`/`mcp_toggle` antworten ohne Inhalt; nur über die ID weiß der Core, welche Aktion fertig ist oder scheiterte. Die Übersetzung meldet deshalb künftig jede Antwort ohne Inhalt bzw. jeden Fehler mit ihrer ID; die Registry wertet nur IDs aus, die sie selbst für eine MCP-Aktion vergeben hat — alles andere bleibt wie bisher ohne Folge.
- **Problem = `failed` oder `needsAuth`.** Ihre Anzahl trägt die `SessionSummary` (`mcpProblems`), damit Eingabeleiste und `/`-Menü sie ohne eigenes Laden kennen.
- **Name:** Feature `mcp` in allen Schichten nach dem Namensschema der Code-Map. In der Oberfläche „MCP-Server“.

## Kontrakt

### Typen (Rust, `derive(Debug, Clone, Serialize, Deserialize, TS)`, `serde(rename_all = "camelCase")`, in `src-tauri/examples/gen-bindings.rs` eintragen)

`src-tauri/src/mcp/model.rs`:

```rust
/// Zustand eines Servers laut `mcp_status`. Unbekannte Werte der Kommandozeile → `Unknown`.
#[derive(Copy, PartialEq, Eq)]
pub enum McpServerStatus { Connected, Pending, Failed, NeedsAuth, Disabled, Unknown }

pub struct McpServer {
    pub name: String,
    pub status: McpServerStatus,
    /// Herkunft wie von der Kommandozeile gemeldet (`user`, `project`, `local`, `claudeai`, `dynamic` …); leer, wenn sie fehlt.
    pub scope: String,
    /// Kurzform der Verbindung: `stdio · comfy-mcp.exe`, `HTTPS · mcp.alphavantage.co`; leer, wenn nichts davon lesbar ist.
    pub connection: String,
    /// Werkzeugnamen in der Reihenfolge der Kommandozeile; leer, solange der Server nicht verbunden ist.
    pub tools: Vec<String>,
    /// Fehlertext der Kommandozeile bei `Failed`.
    pub error: Option<String>,
}

#[derive(Copy, PartialEq, Eq)]
pub enum McpAction { Reconnect, Enable, Disable }

pub struct McpActionError { pub server: String, pub action: McpAction, pub text: String }

pub struct SessionMcp {
    /// `None`: kein Stand (Agent läuft nicht oder die erste Antwort steht aus).
    pub servers: Option<Vec<McpServer>>,
    /// Namen der Server mit laufender Aktion.
    pub busy: Vec<String>,
    /// Fehler der letzten gescheiterten Aktion; die nächste Aktion löscht ihn.
    pub error: Option<McpActionError>,
    /// Millisekunden seit 1970, gesetzt beim Eintreffen der Liste.
    pub fetched_at: Option<f64>,
    pub is_agent_running: bool,
}

pub struct McpChangedEvent { pub session_id: String }
```

`SessionSummary` (`src-tauri/src/sessions/model.rs`) bekommt `pub mcp_problems: u32` (Anzahl Server mit `Failed` oder `NeedsAuth`; 0 ohne Liste).

### Commands (`src-tauri/src/commands/mcp.rs`, alle `async`, Wrapper in `src/lib/mcp.ts`)

| Command | Parameter | Rückgabe | Wrapper |
|---|---|---|---|
| `mcp_load` | `sessionId` | `SessionMcp` | `loadMcp(sessionId)` |
| `mcp_refresh` | `sessionId` | `bool` — `false`, wenn der Agent nicht zuhört | `refreshMcp(sessionId)` |
| `mcp_reconnect` | `sessionId`, `server` | `bool` wie oben | `reconnectMcpServer(sessionId, server)` |
| `mcp_toggle` | `sessionId`, `server`, `enabled` | `bool` wie oben | `toggleMcpServer(sessionId, server, enabled)` |

Fehler: `sessionNotFound`; ein Servername, der in der aktuellen Liste fehlt → `CommandError::Internal("MCP-Server unbekannt: <name>")`.

### Ereignis

`mcp://changed` mit `McpChangedEvent` — nach jeder neuen Liste, jedem Start, Ende oder Fehler einer Aktion und wenn die Liste verworfen wird. Abo `onMcpChanged(handler)` in `src/lib/mcp.ts`.

### Steueranfragen (`src-tauri/src/agents/claude/protocol.rs`)

`mcp_status()` → `{"subtype":"mcp_status"}` · `mcp_reconnect(server)` → `{"subtype":"mcp_reconnect","serverName":server}` · `mcp_toggle(server, enabled)` → `{"subtype":"mcp_toggle","serverName":server,"enabled":enabled}`.

### Neue `AgentEvent`-Varianten (`src-tauri/src/agents/event.rs`)

`McpServers(Vec<McpServer>)` (Antwort auf `mcp_status`) · `ControlSucceeded { request_id: String }` (Erfolg ohne auswertbaren Inhalt) · `ControlFailed { request_id: String, error: String }`.

## Finale Abnahmekriterien

1. `/mcp` im `/`-Menü (getippt und über den Knopf `/`) öffnet den Dialog „MCP-Server“ mittig über der abgedunkelten App; Esc, „Schließen“, das X und ein Klick auf die Abdunklung schließen ihn, ohne die Session zu pausieren.
2. Mit laufendem Agenten listet der Dialog dieselben Benutzer- und claude.ai-Server wie `/mcp` in der VS-Code-Erweiterung (Projekt-Server hängen am Arbeitsordner und dürfen sich unterscheiden), gruppiert nach Herkunft (Benutzer, Projekt, Lokal, claude.ai, …), je mit Status-Punkt und -Wort, Verbindung und Werkzeuganzahl. Ein Klick auf die Zeile klappt Herkunft, Verbindung und alle Werkzeugnamen auf.
3. Server, die beim Öffnen noch „Verbindet …“ zeigen, springen ohne Zutun auf „Verbunden“, sobald die Kommandozeile das meldet (höchstens ~2 s später).
4. „Neu verbinden“ dreht das Symbol, bis die Antwort da ist; danach steht der neue Status. Scheitert es, steht unter dem Filter „Neu verbinden von „<Name>“ fehlgeschlagen: <Text>“, und der aufgeklappte Server zeigt den Fehlerkasten.
5. Schalter aus → Status „Aus“, Zeile gedämpft, keine Werkzeuge; der Agent bietet die Werkzeuge des Servers nicht mehr an. Schalter an → „Verbindet …“ → „Verbunden“. Eine neue Session **desselben** Vorhabens zeigt den Server weiter als „Aus“; eine Session eines **anderen** Vorhabens nicht.
6. Ist ein Server fehlgeschlagen, steht rechts in der Eingabeleiste „MCP · 1 Problem“ (rot gepunktet), ein Klick öffnet den Dialog; ohne Problem ist der Hinweis weg. In der Zeile `/mcp` des Menüs steht dann „1 Problem“ in Fehlerfarbe.
7. Ohne laufenden Agenten erklärt der Dialog in einem Satz, warum keine Liste da ist und wie sie erscheint (Texte in Phase 2); ohne eingerichtete Server sagt er, wo man welche einrichtet.
8. Hell und dunkel sehen aus wie der Entwurf (Tweak `theme`).
9. `pnpm check` grün, lokal und in der GitHub-Prüfung (`check.yml`), Bindings unverändert nach `pnpm bindings`.

## Smoke-Checkliste

Vorbereitung für 2 und 4: einen kaputten Server anlegen — `claude mcp add kaputt -s user -- gibt-es-nicht-xyz` — und nach dem Test mit `claude mcp remove kaputt -s user` wieder entfernen.

Wackelstellen zuerst:

1. **Ausschalten pro Vorhaben (AK 5):** in Vorhaben A `comfy` ausschalten → neue Session in A: „Aus“; Session in Vorhaben B: „Verbunden“. In A wieder einschalten. Gemessen ist das nur an der nackten Kommandozeile, nicht mit `--add-dir` und `--resume` wie im Verwalter.
2. **Zuordnung der Antworten (AK 4):** `kaputt` neu verbinden → Fehlerzeile mit „Connection closed“; gleich danach `comfy` neu verbinden → keine Fehlerzeile, „Verbunden“. Während ein „Neu verbinden“ läuft, eine Nachricht an den Agenten schicken → der Chat läuft normal weiter, der Dialog bekommt danach seinen Status.
3. **Hinweis in der Eingabeleiste (AK 6):** mit `kaputt` erscheint „MCP · 1 Problem“ nach der ersten Antwort des Agenten; nach `claude mcp remove kaputt -s user`, App-Neustart und einer Nachricht ist er weg. Nach 30 min Ruhe (Agent beendet) ist er ebenfalls weg.
4. **„Anmeldung nötig“** ist nur aus der SDK-Doku bekannt, nicht gemessen. Tritt der Zustand auf: gelber Punkt, zählt als Problem. Tritt ein anderer unbekannter Status auf: Zeile zeigt „Unbekannt“ — in FINDINGS notieren.
5. Dialog in einer Session im Status „Neu“ öffnen → Satz „Die MCP-Server starten mit dem Agenten …“, kein Laden ohne Ende.
6. Filter: „drive“ zeigt nur Google Drive; „xyz“ zeigt „Kein Server passt zu „xyz“.“
7. Tastatur: Tab bleibt im Dialog, Enter/Leertaste auf Zeile, „Neu verbinden“ und Schalter lösen aus; nach dem Schließen steht der Fokus wieder dort, wo er vorher war.
8. Esc im Dialog, während der Agent arbeitet → nur der Dialog schließt, der Agent arbeitet weiter.

## Summary

Der Dialog „MCP-Server“ zeigt für die aktive Session, welche MCP-Server der Agent geladen hat (gruppiert nach Herkunft, mit Status, Verbindung und Werkzeugliste), verbindet jeden neu und schaltet ihn aus oder ein. Der Verwalter spricht kein MCP selbst: der Core schickt `mcp_status`, `mcp_reconnect` und `mcp_toggle` als Steueranfragen an die laufende Claude-Kommandozeile und ordnet die Antworten über die Request-ID zu ([ADR 013](../../../decisions/013-mcp-server-im-dialog.md)). Geöffnet wird der Dialog über `/mcp` im `/`-Menü und über den Hinweis „MCP · N Problem(e)“ in der Eingabeleiste, der nur bei fehlgeschlagenen oder anmeldepflichtigen Servern erscheint.

## Files touched

- Core (Phase 1): `src-tauri/src/mcp/model.rs`, `src-tauri/src/agents/claude/` (`mcp.rs`, `protocol.rs`, `translate.rs`), `src-tauri/src/agents/event.rs`, `src-tauri/src/sessions/registry/mcp.rs`, `src-tauri/src/sessions/registry.rs`, `src-tauri/src/sessions/model.rs` (`mcpProblems`), `src-tauri/src/commands/mcp.rs`, `src-tauri/examples/gen-bindings.rs`, erzeugte Typen unter `src/lib/bindings/`, ADR 013, `docs/knowledge/claude-stream-json.md`.
- Oberfläche (Phase 2 und 3): `src/features/mcp/` (`McpDialog`, `McpServerRow`, `McpProblemChip`, `useSessionMcp`, `mcpTexts`), `src/components/Dialog` und `Switch`, `src/lib/mcp.ts`, `src/lib/focus.ts`, Einbau in `Composer`, `CommandMenu` und `commandMenuRows`.
- Doku: `code-map.md`, `glossary.md`, `commits.md` (Scope `mcp`), Design-Entwurf (Status „umgesetzt“).

## Commits

- `55cf83f` feat(mcp): MCP-Server einer Session abfragen und steuern
- `e502401` feat(mcp): Dialog MCP-Server
- `33bd4e0` feat(mcp): Einstiege /mcp und Problem-Hinweis

## Deviations from plan

- Phase 1: Die vom übergeordneten Modul aufgerufenen Methoden in `registry/mcp.rs` sind `pub(super)` statt privat, weil ein privates Element eines Untermoduls dort nicht sichtbar ist.
- Phase 2: Der ausgeschaltete Schalter hat einen eigenen Tooltip (`SWITCH_TITLE_OFF`); `.mcp-dialog` setzt `max-height: min(780px, 100%)`; die Filterzeile ohne Treffer heißt `__no-match`.
- Phase 3: keine.

## Follow-ups

- Archiviert, ohne dass ein Smoke-Ergebnis festgehalten ist. Die Smoke-Checkliste (oben) bleibt offen, Wackelstellen zuerst: Ausschalten pro Vorhaben (AK 5), Zuordnung der Antworten (AK 4), Hinweis in der Eingabeleiste (AK 6), Fokus und Esc im Dialog. Ergebnisse hier nachtragen.
- Der Zustand „Anmeldung nötig“ ist nur aus der SDK-Dokumentation bekannt, nicht gemessen; tritt ein anderer unbekannter Status auf, in `docs/knowledge/claude-stream-json.md` nachtragen.
