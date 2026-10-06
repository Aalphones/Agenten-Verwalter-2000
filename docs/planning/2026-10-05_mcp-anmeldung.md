# MCP-Anmeldung: Server mit „Anmeldung nötig“ aus dem Dialog heraus anmelden

Ziel: Steht ein MCP-Server im Dialog „MCP-Server“ auf „Anmeldung nötig“, bietet seine Zeile einen Knopf „Anmelden“. Ein Klick öffnet die Anmeldeseite im Standard-Browser; nach der Anmeldung verbindet sich der Server (bei eigenen Servern von selbst, bei claude.ai-Connectoren nach „Neu verbinden“). Heute sagt der Dialog nur, man solle sich in einem Claude-Code-Terminal anmelden.

Kontext für den Umsetzer: [AGENTS.md](../../AGENTS.md), [docs/code-map.md](../code-map.md) (Zeile „MCP-Server“), [docs/glossary.md](../glossary.md), [ADR 013](../decisions/013-mcp-server-im-dialog.md) (Steueranfragen, Zuordnung über Request-ID, Nachfragen alle 2 s), [docs/knowledge/claude-stream-json.md](../knowledge/claude-stream-json.md) Abschnitt „MCP-Server steuern“, [ADR 023](../decisions/023-dateiverweise-im-chat.md) (Öffnen über `tauri_plugin_opener` im Core), [docs/conventions/rust.md](../conventions/rust.md), [docs/conventions/react.md](../conventions/react.md), [docs/conventions/typescript.md](../conventions/typescript.md), [docs/conventions/linting.md](../conventions/linting.md). Vault-Fehlerklassen geprüft (React, TypeScript; für Rust und Tauri gibt es keine Entity): keine einschlägig.

## Phasen

| # | Phase | Rating | Wave | Status |
|---|---|---|---|---|
| 1 | Anmelden: Steueranfrage, Öffnen im Core, Knopf + Hinweis im Dialog, ADR 024, Doku | heikel | 1 | complete (Smoke offen) |

Eine Phase, weil nur das Ganze etwas Klickbares liefert; „heikel“, weil der Core eine Adresse aus der Ausgabe der Kommandozeile im Browser öffnet. Umsetzung auf `feature/mcp-anmeldung` im Arbeitsbaum `Agenten-Verwalter-2000-wt-mcp-anmeldung`, ein Commit, Scope `mcp`. Vor dem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine automatisierten Tests (Projektprofil); geprüft wird mit der Smoke-Checkliste.

**Schätzung:** ~2 h.

## Scope

- **Drin:** Steueranfrage `mcp_authenticate` für einen Server der Liste; Anmeldeseite im Standard-Browser öffnen; Hinweis im Dialog mit „Seite erneut öffnen“ und (bei claude.ai) „Neu verbinden“; Nachfragen alle 2 s, solange eine Anmeldung offen ist; Texte für „Anmeldung nötig“ neu.
- **Draußen:** Abmelden (`mcp_clear_auth`); das Einfügen einer Rücksprung-Adresse von Hand (`mcp_oauth_callback_url`) — nur nötig, wenn der Browser `localhost` nicht erreicht, was auf dem eigenen Rechner nicht vorkommt; Anmeldung ohne laufenden Agenten; automatisches „Neu verbinden“ für claude.ai-Connectoren.

## Messungen und Belege (2026-10-05, Claude Code 2.1.287)

- Gemessen mit der Kommandozeile im Druckmodus, `--input-format stream-json`: `mcp_status` meldet die claude.ai-Connectoren Gamma und Atlassian Rovo als `"status":"needs-auth"`, `scope` `claudeai`, `config.type` `claudeai-proxy` — der Zustand ist damit erstmals gemessen (ADR 013 nannte ihn ungemessen).
- `{"subtype":"mcp_authenticate","serverName":"claude.ai Gamma"}` → `success` mit `response` `{"authUrl":"https://claude.ai/api/organizations/<org>/mcp/start-auth/<server>","requiresUserAction":true,"callbackExpected":false}`.
- Unbekannter Name → `error` `"Server not found: <name>"`.
- Aus dem Programmcode der Kommandozeile gelesen, **nicht gemessen** (kein eigener OAuth-Server eingerichtet): für eigene HTTP-Server öffnet die Kommandozeile den Browser nicht selbst (`skipBrowserOpen`), lauscht auf einem lokalen Port und antwortet `{"authUrl":…,"requiresUserAction":true,"callbackExpected":true,"redirectScheme":"localhost","state":…,"callbackPort":…}`; nach dem Rücksprung verbindet sie den Server selbst neu. Liegt schon ein gültiges Token vor: `{"requiresUserAction":false,"callbackExpected":false}` ohne `authUrl`. Für claude.ai-Connectoren verbindet sie **nicht** selbst neu.

## Festgelegte Entscheidungen

Daraus entsteht [ADR 024](../decisions/024-mcp-anmeldung.md) „MCP-Anmeldung im Dialog“. Vergeben: 001–023 auf der Platte, in geparkten Plänen ist keine weitere reserviert; dieser Plan schreibt 024.

- **Der Core öffnet den Browser, nicht die Oberfläche.** Kommt die Antwort mit `authUrl`, legt die Registry die Adresse in die Outbox; beim Abarbeiten der Outbox öffnet `app.opener().open_url(url, None::<&str>)` sie (Muster: `src-tauri/src/commands/file_links.rs`). Grund: die Antwort kommt asynchron; die Oberfläche müsste erkennen, dass eine Adresse neu ist, und genau einmal öffnen — das geht bei mehrfachem Laden und geschlossenem Dialog schief. Verworfen: Öffnen im Frontend beim Wechsel von `auth`.
- **Nur `https://`.** Eine `authUrl`, die nicht mit `https://` beginnt, wird nicht geöffnet; die Aktion endet als Fehler „Anmeldeadresse nicht geöffnet: kein https“. Grund: die Adresse kommt aus der Ausgabe eines Prozesses; ein Klick darf nichts anderes als eine Webseite öffnen (kein `file:`, kein Programm). Eigene Server, deren Anmeldeserver `http://` verwendet, gehen damit nicht — bewusst, bis jemand so einen hat.
- **Anfrage ohne `redirectUri`.** Die Kommandozeile nimmt dann den lokalen Rücksprung auf `localhost`.
- **Neue Aktion `McpAction::Authenticate`** in der bestehenden Zuordnung über Request-ID (ADR 013). Die Antwort mit Inhalt erkennt die Übersetzung am Feld `requiresUserAction` (bool) und meldet sie als neues Ereignis `AgentEvent::McpAuthStarted`; leere Bestätigungen und Fehler laufen wie bisher über `ControlSucceeded`/`ControlFailed` → `mcp_answered`.
- **Offene Anmeldung als Zustand `mcp_auth: Option<McpAuthWait>`** in `SessionState`, gemeldet in `SessionMcp.auth`. Gesetzt bei `McpAuthStarted` mit `authUrl`; gelöscht, sobald `mcp_status` den Server mit einem anderen Status als `needs-auth` meldet, oder ihn gar nicht mehr meldet, sowie in `forget_mcp`. Eine neue Anmeldung ersetzt die alte. Nur im Speicher wie die Liste (ADR 013).
- **Nachfragen:** solange der Dialog offen ist und `auth !== null`, fragt `useSessionMcp` alle 2 s nach (zusätzliche Bedingung in `needsPolling`). Die Kommandozeile meldet den Abschluss der Anmeldung nicht von selbst.
- **Bedienung:** In einer Zeile mit Status `needsAuth` steht im Kopf ein Textknopf „Anmelden“ links vom Neu-verbinden-Symbol; gesperrt, wenn der Agent nicht zuhört oder für den Server eine Aktion läuft. Ist eine Anmeldung offen, steht über der Liste (unter dem Filter, an der Stelle der Fehlermeldung, beide können gleichzeitig stehen — Hinweis zuerst) ein Hinweis:
  - `callbackExpected: true`: „Anmeldung für „<Server>“ im Browser geöffnet. Nach der Anmeldung verbindet sich der Server von selbst.“ + Link „Seite erneut öffnen“.
  - `callbackExpected: false`: „Anmeldung für „<Server>“ auf claude.ai im Browser geöffnet. Danach hier neu verbinden.“ + Knopf „Neu verbinden“ (ruft dieselbe Aktion wie das Symbol in der Zeile) + Link „Seite erneut öffnen“.
  - „Seite erneut öffnen“ nutzt `ExternalLink` (`src/components/ExternalLink.tsx`), das nur `http:`/`https:` öffnet.

## Kontrakt

### Rust: `src-tauri/src/agents/claude/protocol.rs`

```rust
/// Startet die Anmeldung bei einem MCP-Server; die Antwort trägt die Anmeldeadresse (ADR 024).
pub fn mcp_authenticate(server: &str) -> Value {
    json!({ "subtype": "mcp_authenticate", "serverName": server })
}
```

### Rust: `src-tauri/src/agents/claude/mcp.rs`

```rust
/// Liest die Antwort auf `mcp_authenticate`; `None`, wenn `requiresUserAction` fehlt (dann ist es keine).
pub fn mcp_auth(body: &Value) -> Option<McpAuthAnswer>;

pub struct McpAuthAnswer {
    /// Fehlt, wenn schon ein gültiges Token vorliegt.
    pub auth_url: Option<String>,
    pub callback_expected: bool,
}
```

`McpAuthAnswer` liegt in `mcp.rs` (nur Core-intern, kein `TS`). `callback_expected` fehlt → `false`; `authUrl` leer → `None`.

### Rust: `src-tauri/src/agents/event.rs`

```rust
/// Antwort auf `mcp_authenticate` mit Inhalt.
McpAuthStarted {
    request_id: String,
    auth_url: Option<String>,
    callback_expected: bool,
},
```

In `translate.rs` `control_answered`: nach dem `mcp_servers`-Zweig `if let Some(answer) = mcp::mcp_auth(&response) { return vec![AgentEvent::McpAuthStarted { request_id, auth_url: answer.auth_url, callback_expected: answer.callback_expected }]; }`. Den Doc-Kommentar über `control_answered` um „`mcp_authenticate` trägt `requiresUserAction`“ ergänzen.

### Rust: `src-tauri/src/mcp/model.rs`

```rust
// McpAction: neue Variante
Authenticate,

/// Eine gestartete Anmeldung, deren Abschluss noch nicht in `mcp_status` zu sehen ist.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct McpAuthWait {
    pub server: String,
    /// Die Anmeldeseite; immer `https://`.
    pub url: String,
    /// `true`: die Kommandozeile wartet auf den Rücksprung und verbindet selbst neu. `false` (claude.ai): danach neu verbinden.
    pub callback_expected: bool,
}

// SessionMcp: neues Feld
/// Offene Anmeldung; `None`, wenn keine läuft.
pub auth: Option<McpAuthWait>,
```

Danach `pnpm bindings` (erzeugt `src/lib/bindings/McpAuthWait.ts`, ergänzt `McpAction.ts` und `SessionMcp.ts`).

### Rust: `src-tauri/src/sessions/registry/mcp.rs` und `registry.rs`

- `SessionState` (in `registry.rs` neben `mcp_error`, Initialisierung neben `mcp_error: None`): Feld `mcp_auth: Option<McpAuthWait>`.
- `Outbox` (in `registry.rs`): Feld `open_urls: Vec<String>` mit Doc-Kommentar „Adressen, die nach dem Freigeben der Sperre im Browser geöffnet werden (MCP-Anmeldung)“. Beim Abarbeiten (Block neben `if self.mcp_changed { … }`, `registry.rs` ~Zeile 2386): je Adresse `app.opener().open_url(url, None::<&str>)`; Fehler → `session.log_line(format!("Anmeldeseite nicht geöffnet: {error}"))`. Import `tauri_plugin_opener::OpenerExt`.
- `SessionRegistry::authenticate_mcp(&self, app, session_id, server) -> Result<bool, CommandError>`: wie `reconnect_mcp`, mit `McpAction::Authenticate` und `mcp_authenticate(server)`.
- `SessionState::mcp_auth_started(&mut self, outbox, request_id: &str, auth_url: Option<String>, callback_expected: bool)`:
  1. `self.mcp_actions.remove(request_id)` → `None` oder Aktion ≠ `Authenticate`: zurück ohne Folge.
  2. `auth_url` ist `Some(url)` und beginnt nicht mit `https://` → `self.mcp_error = Some(McpActionError { server, action: Authenticate, text: "Anmeldeadresse nicht geöffnet: kein https".to_owned() })`.
  3. `auth_url` ist `Some(url)` mit `https://` → `outbox.open_urls.push(url.clone())`, `self.mcp_auth = Some(McpAuthWait { server, url, callback_expected })`.
  4. `auth_url` ist `None` → nichts weiter (Token vorhanden, die Kommandozeile verbindet selbst).
  5. `outbox.mcp_changed = true`; `let _ = self.send_control(outbox, mcp_status());`.
- In `registry.rs` beim Ereignis-Dispatch (neben `AgentEvent::McpServers`): `AgentEvent::McpAuthStarted { request_id, auth_url, callback_expected } => self.mcp_auth_started(outbox, &request_id, auth_url, callback_expected)`.
- `apply_mcp_servers`: nach dem Setzen der Liste `mcp_auth` löschen, wenn der Server der offenen Anmeldung nicht mehr mit `NeedsAuth` in der Liste steht.
- `forget_mcp`: `mcp_auth = None`; `had_state` berücksichtigt `mcp_auth.is_some()`.
- `SessionRegistry::mcp`: `auth: state.mcp_auth.clone()`.
- `start_mcp_action` bleibt unverändert (setzt `mcp_error = None`).

### Rust: Befehl `src-tauri/src/commands/mcp.rs`

```rust
/// `false`, wenn der Agent nicht zuhört und deshalb nichts angefragt wurde.
#[tauri::command]
pub async fn mcp_authenticate(app, registry, session_id: String, server: String) -> Result<bool, CommandError>
```

Registrieren in `src-tauri/src/lib.rs` neben `commands::mcp::mcp_toggle`.

### TS: `src/lib/mcp.ts`

```ts
/** Startet die Anmeldung bei einem Server; der Core öffnet die Anmeldeseite im Browser, Beginn und Ende melden `mcp://changed`.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` bei einem Servernamen, der nicht in der Liste steht */
export function authenticateMcpServer(sessionId: string, server: string): Promise<boolean>;
```

### TS: Texte in `src/features/mcp/mcpTexts.ts`

- `ACTION_FAILURE_PREFIXES.authenticate = 'Anmeldung bei'`.
- `DETAIL_NOTES.needsAuth = 'Der Server braucht eine Anmeldung. „Anmelden“ öffnet sie im Browser.'`
- Neu: `LOGIN_LABEL = 'Anmelden'`, `LOGIN_TITLE = 'Anmeldeseite dieses Servers im Browser öffnen'`, `REOPEN_LABEL = 'Seite erneut öffnen'`, `RECONNECT_LABEL = 'Neu verbinden'`, `authWaitText(auth: McpAuthWait): string` (die beiden Sätze aus „Bedienung“).

### TS: Oberfläche

- `McpServerRow`: neue Prop `onAuthenticate: () => void`; bei `server.status === 'needsAuth'` Textknopf (`<button type="button" className="mcp-server__login" title={LOGIN_TITLE} disabled={!canAct || isBusy}>`) vor dem Neu-verbinden-Knopf. CSS in `McpServerRow.css` (BEM, Tokens wie `mcp-server__reconnect`).
- `McpDialog`: Handler `authenticate(name)` analog zu `reconnect(name)` (Zeile ~42, gleiche Fehlerbehandlung über den dortigen Command-Fehler-State); Hinweis-Block `mcp-dialog__auth` (`role="status"`) vor `mcp-dialog__error`, wenn `mcp.auth !== null`. CSS in `McpDialog.css`.
- `useSessionMcp`: `needsPolling` zusätzlich wahr, wenn `current.auth !== null`.

## AK der Phase

1. Ein Server mit Status „Anmeldung nötig“ zeigt in seiner Zeile den Knopf „Anmelden“; andere Status zeigen ihn nicht.
2. Klick auf „Anmelden“ bei einem claude.ai-Connector öffnet im Standard-Browser eine Seite unter `https://claude.ai/`; im Dialog erscheint der Hinweis mit „Neu verbinden“ und „Seite erneut öffnen“.
3. Nach der Anmeldung auf claude.ai und Klick auf „Neu verbinden“ im Hinweis steht der Server auf „Verbunden“, der Hinweis verschwindet ohne Schließen des Dialogs.
4. Schließen und Öffnen des Dialogs öffnet die Anmeldeseite **nicht** erneut.
5. Eine `authUrl` ohne `https://` wird nicht geöffnet und erscheint als Fehlerzeile „Anmeldung bei „<Server>“ fehlgeschlagen: Anmeldeadresse nicht geöffnet: kein https“ (Prüfung im Code-Review an `mcp_auth_started`, Schritt 2 — kein Testserver dafür).
6. Endet der Agent (Ruhe-Timer), verschwindet der Hinweis.
7. `pnpm check` grün.

## Checkliste

- [x] Arbeitsbaum + Branch `feature/mcp-anmeldung` (vom lokalen `main`, siehe Abweichungen)
- [x] Rust: Protokoll, Lesen der Antwort, Ereignis, Übersetzung, Modell, Registry, Outbox-Öffnen, Befehl, Registrierung (Kontrakt oben)
- [x] `pnpm bindings`
- [x] TS: Wrapper, Texte, Zeile, Dialog, Hook
- [x] ADR 024 schreiben (Kontext / Optionen / Entscheidung / Konsequenzen aus „Festgelegte Entscheidungen“)
- [x] `docs/knowledge/claude-stream-json.md`, Abschnitt „MCP-Server steuern“: Zeile „`needs-auth` … nicht gemessen“ durch die Messung oben ersetzen; Zeile zu `mcp_authenticate` (gemessen für claude.ai, gelesen für `localhost`) ergänzen
- [x] ADR 013, Konsequenzen: Satz „Der Zustand `needs-auth` ist nur aus der SDK-Dokumentation bekannt“ → Verweis „gemessen 2026-10-05, Anmeldung: ADR 024“
- [x] `docs/code-map.md` Zeile „MCP-Server“: „Anmelden“ in die Beschreibung, `mcp_authenticate` in die Befehlsliste, ADR 024 verlinken
- [x] `docs/glossary.md`: Eintrag „Anmeldung (MCP)“, falls das Glossar MCP-Begriffe führt; sonst nichts
- [ ] Smoke 1–4 (unten) — fährt Sascha, Ergebnis in „Report-Back“
- [x] `pnpm check` grün, ein Commit `feat(mcp): MCP-Server aus dem Dialog im Browser anmelden`, Push des Branches

## Smoke-Checkliste (Wackelstellen zuerst)

1. **claude.ai-Connector bis „Verbunden“** (AK 2, 3): Session starten, Dialog öffnen, bei „claude.ai Gamma“ (oder einem anderen Connector auf „Anmeldung nötig“) „Anmelden“ → Browser zeigt claude.ai, Anmeldung durchklicken → im Dialog „Neu verbinden“ im Hinweis → Status „Verbunden“. Wackelt, weil nicht gemessen ist, ob `mcp_reconnect` nach der Anmeldung auf claude.ai reicht oder die Kommandozeile die Connector-Liste erst bei einem Neustart neu holt. Schlägt es fehl: Agent neu starten (Ruhe-Timer oder App-Neustart) und erneut prüfen; das Ergebnis entscheidet, ob der Hinweis statt „Neu verbinden“ einen Neustart nennen muss.
2. **Doppeltes Öffnen** (AK 4): nach Schritt „Anmelden“ den Dialog schließen und öffnen — kein zweiter Browser-Tab.
3. **Eigener Server mit `localhost`-Rücksprung**: nur, wenn ein HTTP-MCP-Server mit OAuth eingerichtet ist (z. B. Atlassian `https://mcp.atlassian.com/v1/sse` per `claude mcp add`); Rücksprung im Browser → Server ohne weiteren Klick „Verbunden“. Wackelt, weil dieser Weg nur aus dem Programmcode gelesen ist.
4. Ruhe-Timer abwarten (oder `VERWALTER_IDLE_SECONDS=30`) → Hinweis weg (AK 6).

## Risiken

- 🟡 Die Antwortform ist nicht als stabil dokumentiert; das Lesen bleibt nachsichtig (fehlende Felder → `None`/`false`).
- 🟡 Die Anfrage stellt nur der Verwalter (Steueranfragen laufen über die Standardeingabe, der Agent kommt nicht heran); die geöffnete Adresse stammt aber aus der Ausgabe der Kommandozeile. Deshalb die `https://`-Grenze.
- 🟡 Bricht der Benutzer die Anmeldung ab, bleibt der Hinweis stehen, bis die Liste den Server anders meldet oder der Agent endet; „Anmelden“ in der Zeile startet eine neue.

## Report-Back

Smoke 1–4: offen.

## Summary

Knopf „Anmelden“ in Zeilen mit „Anmeldung nötig“; der Core stellt `mcp_authenticate`, öffnet eine `https://`-Anmeldeseite einmal im Browser und hält die offene Anmeldung bis zum Statuswechsel oder Agent-Ende; der Dialog zeigt darüber einen Hinweis mit „Seite erneut öffnen“ und bei claude.ai „Neu verbinden“.

## Files touched

- Core: `agents/claude/{protocol,mcp,translate}.rs`, `agents/event.rs`, `mcp/model.rs`, `sessions/registry.rs`, `sessions/registry/mcp.rs`, `commands/mcp.rs`, `lib.rs`, `examples/gen-bindings.rs`
- Oberfläche: `src/lib/mcp.ts`, `src/features/mcp/{McpDialog,McpServerRow}.{tsx,css}`, `mcpTexts.ts`, `useSessionMcp.ts`, Bindings `McpAuthWait`, `McpAction`, `SessionMcp`
- Doku: ADR 024 (neu), ADR 013, `claude-stream-json.md`, `code-map.md`, `glossary.md`

## Commits

`feat(mcp): MCP-Server aus dem Dialog im Browser anmelden` auf `feature/mcp-anmeldung`.

## Deviations from plan

- Branch vom lokalen `main` statt `origin/main`: `main` lag drei Commits (Session-Übergabe) vor `origin/main`; Arbeitsbaum heißt `verwalter-wt-mcp-anmeldung`, weil das Repository `verwalter` heißt.
- `mcp_auth_started`: trägt die Request-ID eine andere Aktion als `Authenticate`, gilt sie trotzdem als beantwortet (Ereignis + Liste neu anfragen) statt „ohne Folge“ — sonst bliebe die Zeile ohne Meldung ihres Endes.

## Follow-ups

- Smoke 1 entscheidet, ob der Hinweis bei claude.ai statt „Neu verbinden“ einen Neustart des Agenten nennen muss.
