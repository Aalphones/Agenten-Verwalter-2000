# Phase 2 — Mini-Retro-Läufe, `befunde.md`, Command `retro_run`

## Kontext (vor dem Start lesen)

- `README.md` dieses Plans (Kontrakt), `phase-1-transkript-und-aufruf.md` (gebaute Bausteine)
- `src-tauri/src/sessions/registry/tldr.rs` — Vorbild: `begin_missing_tldr` (Verlauf mit `lock_loaded` laden), `project_members`, Sperr-Reihenfolge (Session-Sperre → Datenbank; nie zwei Session-Sperren zugleich, nie unter der Vorhaben-Sperre), `print_program` vor jeder Sperre
- `src-tauri/src/sessions/registry/artifacts.rs` — Muster für eine Registry-Erweiterung in eigener Datei, `session.workspace`
- `src-tauri/src/tldr/prompt.rs` — Vorbild für Anweisung, Schema und Zeitlimit
- `src-tauri/src/commands/tldr.rs` — Vorbild für `async`-Commands
- `docs/decisions/027-session-uebergabe.md` — Vorbild fürs ADR
- Fehlerklassen geprüft (TypeScript, React, SQLite, Claude Code): keine einschlägig für diese Phase.

## Abnahmekriterien der Phase

1. `retro_run` erfüllt den Kontrakt der README (Rückgabe, Fehlertexte, Ereignis, Ordner).
2. Höchstens drei Einmal-Aufrufe laufen gleichzeitig; keine Session-Sperre wird während eines Aufrufs gehalten.
3. `befunde.md` hat exakt das Format unten.
4. ADR 028 liegt vor. `pnpm check` grün.

## Anweisung und Schema (`src-tauri/src/retro/prompt.rs`)

```rust
/// Noch nicht gemessen — Smoke 1 der README prüft es; TL;DR-Obergrenze brauchte mit Haiku 17 s.
pub const RETRO_TIMEOUT: Duration = Duration::from_secs(300);
pub const RETRO_PARALLEL: usize = 3;

pub const SESSION_SYSTEM_PROMPT: &str = "Du liest den Verlauf einer Arbeitssitzung zwischen einem Entwickler (Nutzer) und einem Coding-Agenten (Claude) und sammelst Rohbefunde für eine spätere Retrospektive. Du bewertest nichts, ziehst keine Lehren und schlägst nichts vor. Jeder Befund trägt ein wörtliches Kurzzitat aus dem Verlauf (höchstens 200 Zeichen); was du nicht zitieren kannst, lässt du weg. corrections: Stellen, an denen der Nutzer den Agenten korrigiert, zurückgepfiffen oder eine Vorliebe geäußert hat; about = worauf sich das bezog, ein Satz. failures: fehlgeschlagene Werkzeug-Aufrufe, Fehlversuche, Wiederholungen derselben Sache; what = was schiefging, ein Satz. unbackedClaims: Tatsachenbehauptungen des Agenten, für die im Verlauf kein Beleg (Werkzeug-Ergebnis, Zitat aus einer Datei) steht. facts: neue technische Fakten über Werkzeuge, Bibliotheken oder Systeme, die über diese Sitzung hinaus gelten; fact = der Fakt, ein Satz. open: was am Ende offen blieb, je ein Satz. Leere Listen sind erlaubt. Antworte auf Deutsch, erfinde nichts.";

pub const SESSION_SCHEMA: &str = r#"{"type":"object","properties":{"corrections":{"type":"array","items":{"type":"object","properties":{"quote":{"type":"string"},"about":{"type":"string"}},"required":["quote","about"],"additionalProperties":false}},"failures":{"type":"array","items":{"type":"object","properties":{"what":{"type":"string"},"quote":{"type":"string"}},"required":["what","quote"],"additionalProperties":false}},"unbackedClaims":{"type":"array","items":{"type":"object","properties":{"quote":{"type":"string"}},"required":["quote"],"additionalProperties":false}},"facts":{"type":"array","items":{"type":"object","properties":{"fact":{"type":"string"},"quote":{"type":"string"}},"required":["fact","quote"],"additionalProperties":false}},"open":{"type":"array","items":{"type":"string"}}},"required":["corrections","failures","unbackedClaims","facts","open"],"additionalProperties":false}"#;
```

Antworttyp in `retro/model.rs` (nur Core, kein `TS`): `SessionFindings` mit `corrections: Vec<Correction>`, `failures: Vec<Failure>`, `unbacked_claims: Vec<Claim>`, `facts: Vec<Fact>`, `open: Vec<String>`, `#[derive(Deserialize)]`, `#[serde(rename_all = "camelCase")]`; Feldnamen der Untertypen wie im Schema.

## Format `befunde.md` (`src-tauri/src/retro/findings.rs`, `pub fn render(project_name: &str, sessions: &[SessionResult]) -> String`)

```text
# Befunde – <Vorhaben-Name>
Sessions: <Anzahl>, davon gekürzt: <Anzahl Gekürzt ja>, Mini-Retro fehlgeschlagen: <Anzahl>

## Session #<N> – <Name>
Status: <status_label> · Modell: <cli_id> · Werkzeug-Aufrufe: <alle>, fehlgeschlagen: <f>, abgebrochen: <a> · Gekürzt: <ja|nein> · Verlauf: session-<N>.md

### Korrekturen des Nutzers
- „<quote>“ → <about>
### Fehlversuche und Wiederholungen
- <what> · „<quote>“
### Behauptungen ohne Beleg
- „<quote>“
### Neue technische Fakten
- <fact> · „<quote>“
### Offen geblieben
- <Satz>
```

Leere Liste → eine Zeile `- keine`. Fehlgeschlagene Session: nach der Status-Zeile nur `Mini-Retro fehlgeschlagen: <Fehlertext>`, keine Rubriken. `SessionResult` (nur Core): `number`, `name`, `status`, `model`, `counts: (u32, u32, u32)`, `truncated: bool`, `outcome: Result<SessionFindings, String>`.

## Checkliste

- [ ] `retro/prompt.rs` und `retro/findings.rs` wie oben; Modul-Einträge in `retro/mod.rs`.
- [ ] `ProjectState` in `src-tauri/src/sessions/registry.rs` bekommt `retro_running: bool` (in `ProjectState::new` mit `false`), nur im Speicher.
- [ ] `src-tauri/src/sessions/registry/retro.rs` (als Untermodul registrieren wie `artifacts`): `pub fn run_retro(&self, app: &AppHandle, project_id: &str) -> Result<RetroExport, CommandError>`:
  1. `print_program(app)?` — vor jeder Sperre.
  2. Unter der Vorhaben-Sperre: Vorhaben holen (sonst `project_not_found`), läuft `retro_running` → Fehler laut Kontrakt, sonst auf `true` setzen und `name` kopieren. Sperre freigeben.
  3. Ab hier jeden Ausgang über eine Hilfsfunktion `finish_retro(project_id)` führen, die `retro_running` wieder auf `false` setzt — auch bei Fehlern (Muster: Ergebnis in einer inneren Funktion berechnen, danach immer zurücksetzen).
  4. `project_members(project_id)`; je Session nacheinander: Status unter `session.lock()` prüfen (`New` → überspringen), dann `lock_loaded()`; unter dieser Sperre nur `entries` klonen bzw. die Texte bauen (`is_retro_session` → überspringen; sonst `session_file(...)`, `retro_transcript(...)`, `tool_counts(...)`, Name, Status, Modell kopieren), dann freigeben. Lesefehler von `lock_loaded` → diese Session als fehlgeschlagen mit `Verlauf nicht lesbar: <Fehler>`.
  5. Keine Session übrig → Fehler laut Kontrakt, kein Ordner.
  6. Ordner `session.workspace.join(".retro").join(format!("lauf-{}", now_ms() as u64))` mit `create_dir_all`; je Session `session-<N>.md` mit `std::fs::write`. IO-Fehler → `CommandError::Internal("Retro nicht geschrieben: <Fehler>")`.
  7. Ereignis `retro://progress` mit `done = 0`.
  8. Mini-Retros: `std::thread::scope`, Sessions in Blöcken zu `RETRO_PARALLEL`; je Session ein Thread mit `ask_model::<SessionFindings>(app, &program, ModelId::Sonnet, &HaikuRequest { system_prompt: SESSION_SYSTEM_PROMPT, json_schema: SESSION_SCHEMA, input: &transcript, timeout: RETRO_TIMEOUT })`. Nach jedem fertigen Thread `done` erhöhen (`AtomicU32`) und `retro://progress` senden. Keine Sperre der Registry in den Threads.
  9. Alle fehlgeschlagen → Fehler laut Kontrakt (Dateien bleiben). Sonst `befunde.md` mit `findings::render` schreiben (IO-Fehler wie oben).
  10. `RetroExport { folder: format!(".retro/lauf-{zahl}"), session_count, failed_count }`.
- [ ] `src-tauri/src/commands/retro.rs`: `#[tauri::command] pub async fn retro_run(app: tauri::AppHandle, registry: tauri::State<'_, SessionRegistry>, project_id: String) -> Result<RetroExport, CommandError>` → `registry.run_retro(&app, &project_id)`; in `src-tauri/src/lib.rs` registrieren.
- [ ] ADR `docs/decisions/028-vorhaben-retro.md` (Format wie ADR 027): Kontext — Retro je Session zu teuer und verstreut, ein Lauf über alle Sessions in einem Kontext sprengt ihn. Optionen — (a) Sessions wieder aufnehmen und dort retro-n: schreibt in fremde Verläufe; (b) Subagenten im Skill lesen die Verläufe: Modellwahl in „Autark“ wirkungslos, Ablauf hängt am Agenten; (c) der Verwalter sammelt per Einmal-Aufruf mit Sonnet, der Skill urteilt — gewählt. Entscheidung: Kontrakt der README; Verwalter enthält nur die Sammel-Anweisung, keine Regeln des Nutzers. Konsequenzen: Ordner `.retro` wächst ohne Aufräumen; Retro-Sessions werden am Skill-Aufruf erkannt; der Lauf kostet je Session einen Sonnet-Aufruf.
- [ ] `pnpm check`, Commit `feat(retro): Mini-Retros je Session und Befund-Datei`.

## Report-Back
