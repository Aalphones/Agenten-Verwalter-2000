# Claude Code mit lokalem Modell (Betriebsart „Claude Code + LM Studio“)

Ziel: In den Einstellungen wählt man die Betriebsart „Claude Code + LM Studio“ und ein in LM Studio geladenes Modell. Ab der nächsten Nachricht startet jede Session ihren Agenten weiter über die Claude-Kommandozeile — mit denselben Werkzeugen, Skills, Hooks und Anweisungen wie sonst —, die Modellanfragen gehen aber an LM Studio statt an Anthropic. Zweck: weiterarbeiten, wenn das Kontingent des Claude-Abos aufgebraucht ist. Gebaut wird der einfachste Weg: Umgebungsvariablen am Agent-Prozess. Keine eigene Kopie der Kommandozeile, keine Firewall-Sperre.

Der Verwalter kennt danach zwei von drei Betriebsarten: **Claude** (wie bisher), **Claude Code + LM Studio** (dieser Plan). Die dritte, **Autark** (eigener Agent im Verwalter, ohne Claude-Kommandozeile), baut der Plan [2026-10-01_autarker-agent](../2026-10-01_autarker-agent/README.md) auf diesem auf.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 003](../../decisions/003-claude-anbindung.md) (Claude-Kommandozeile als Agent), [ADR 008](../../decisions/008-kontext-und-kontingent.md) (Kontingent über Hilfsprozess), [ADR 012](../../decisions/012-einstellungen-farbschema-und-listen.md) (Einstellungen), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md). ADR 016 entsteht in Phase 2 aus „Festgelegte Entscheidungen“.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Messung an der nackten Kommandozeile (Netzverkehr, Kontextfenster, Tempo, TL;DR) | [phase-1-messung.md](phase-1-messung.md) | standard | pending |
| 2 | Core: Betriebsart, LM-Studio-Abfrage, Umgebung am Agenten, TL;DR, Kontingent, ADR 016 | [phase-2-core.md](phase-2-core.md) | standard | pending |
| 3 | Oberfläche: Einstellungen, Eingabeleiste, Neues Vorhaben, Kontingent; Doku, Release | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | pending |

**Reihenfolge:** Phasen strikt 1 → 2 → 3. Keine Abhängigkeit zu den geparkten Plänen „MCP-Dialog“, „Changes-Review“ und „Session-Changes“; der Plan „Autarker Agent“ setzt diesen voraus. Phase 1 stoppt den Plan nicht, sie legt aber fest, welche TL;DR-Variante Phase 2 baut (siehe dort). Umsetzung direkt auf `main`, ein Commit pro Phase: Phase 1 `docs(agents)`, Phase 2 `feat(agents)`, Phase 3 `feat(settings)`. Neuer Scope `lmstudio` wird nicht gebraucht — die LM-Studio-Abfrage gehört zu `agents`/`settings`. Vor jedem Code-Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md).

## Messungen (2026-10-01)

Probe mit `claude -p "Lies die Datei STATE.md mit dem Read-Werkzeug und nenne in einem Satz den naechsten Schritt." --model google/gemma-4-12b-qat --max-turns 4 --output-format json` im Repo, Umgebung `ANTHROPIC_BASE_URL=http://localhost:1234`, `ANTHROPIC_AUTH_TOKEN=lmstudio`, `CLAUDE_CODE_ATTRIBUTION_HEADER=0`, LM Studio mit Kontext 64 000:

- Das Modell hat `Read` aufgerufen, die Kommandozeile hat die Datei gelesen, die Antwort war inhaltlich richtig (2 Turns). Werkzeuge, Hooks und Anweisungen des Benutzers galten unverändert.
- 112 243 Eingabe-Token für 2 Anfragen, also rund 56 000 je Anfrage. Erstes Token nach 166 s, Gesamtdauer 9 min 37 s.
- `stop_reason: max_tokens` nach 65 Ausgabe-Token: der Kontext von 64 000 war voll, die Antwort brach mitten im Satz ab.
- `modelUsage.<modell>.contextWindow` = 200 000 — die Annahme der Kommandozeile für ein unbekanntes Modell, nicht das Fenster von LM Studio.
- Nebenanfrage `generate_session_title` scheiterte mit `unrecognized_model`, weil sie einen Claude-Modellnamen an LM Studio schickte.
- Hinweis der Kommandozeile: claude.ai-Connectoren sind abgeschaltet, sobald eine andere Anmeldung gesetzt ist.
- `GET http://localhost:1234/api/v0/models/<id>` liefert `id`, `type` (`llm`, `vlm`, `embeddings`), `state` (`loaded`, `not-loaded`), `max_context_length` und nur bei geladenem Modell `loaded_context_length`. `GET /api/v0/models` liefert dieselben Objekte als Liste unter `data`.

Laut [Claude-Code-Doku, Umgebungsvariablen](https://code.claude.com/docs/en/env-vars) (gelesen 2026-10-01): `ANTHROPIC_DEFAULT_{FABLE,OPUS,SONNET,HAIKU}_MODEL` legen fest, worauf die Modellnamen zeigen (Haiku auch für Hintergrundarbeit wie Titel), `CLAUDE_CODE_SUBAGENT_MODEL` das Modell der Subagenten, `CLAUDE_CODE_MAX_CONTEXT_TOKENS` das angenommene Kontextfenster bei Umleitung über `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` schaltet Updates, Telemetrie, Fehlerberichte und Feature-Flags ab, die automatische Installation des offiziellen Plugin-Marktplatzes deckt es nicht ab (dafür `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`). Gemessen ist davon nichts — das macht Phase 1.

## Festgelegte Entscheidungen

Phase 2 schreibt daraus [ADR 016](../../decisions/016-betriebsarten-und-lokales-modell.md) „Betriebsarten und lokales Modell über LM Studio“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Vergeben sind 001–012 auf der Platte, 013 im Plan „MCP-Dialog“, 014 im Plan „Session-Changes“, 015 im Plan „Changes-Review“; dieser Plan schreibt 016, der Plan „Autarker Agent“ 017.

- **Begriff „Betriebsart“**, nicht „Modus“ — „Modus“ ist im Glossar für Manuell/Automatisch bearbeiten/Planen/Auto vergeben. Code: `OperatingMode`, Werte `Claude` und `ClaudeCodeLocal` (TS `'claude'`, `'claudeCodeLocal'`). Der Plan „Autarker Agent“ ergänzt `Standalone`.
- **Global in den Einstellungen, nicht je Session.** Das Kontingent gilt fürs ganze Claude-Konto; ist es aufgebraucht, hängen alle Claude-Sessions zugleich. Verworfen: Auswahl je Session (mischt Betriebsarten, „nichts geht an Anthropic“ hinge an der Aufmerksamkeit des Benutzers).
- **Wirkt ab dem nächsten Agent-Start, laufende Prozesse laufen weiter.** Muster wie beim Denkaufwand: `send` startet den Agenten neu, wenn sich das gewünschte Modell-Backend vom laufenden Prozess unterscheidet (`process_backend`). Ruhende Sessions starten ohnehin bei der nächsten Nachricht. Die Kommandozeile setzt den Verlauf mit `--resume` fort, auch mit anderem Modell (Phase 1 misst das, M5).
- **Das gespeicherte Claude-Modell der Session bleibt unangetastet.** Im lokalen Betrieb wird es ignoriert und gilt wieder, sobald man auf „Claude“ zurückschaltet. Sidebar und Session-Karten zeigen deshalb weiter das Claude-Modell; Eingabeleiste und „Neues Vorhaben“ zeigen das lokale.
- **Das lokale Modell wählt man nur in den Einstellungen.** Nur geladene Modelle sind wählbar; die Eingabeleiste zeigt den Namen ohne Menü.
- **Kontextfenster = `loaded_context_length` beim Agent-Start.** Es geht an `CLAUDE_CODE_MAX_CONTEXT_TOKENS` und wird `context_window` der Session.
- **LM Studio wird bei jedem Agent-Start einmal gefragt** (`GET /api/v0/models/<id>`, Zeitlimit 3 s), und zwar vor der Session-Sperre. Nicht erreichbar oder Modell nicht geladen → `CommandError::LocalModelUnavailable` mit einem Satz; der Agent startet nicht, die Nachricht bleibt im Eingabefeld.
- **Adresse:** Umgebungsvariable `VERWALTER_LMSTUDIO_URL`, Standard `http://localhost:1234`, ohne Schrägstrich am Ende. Keine Einstellungszeile dafür. Token fest `lmstudio` (LM Studio prüft ohne „Require Authentication“ keinen Schlüssel).
- **Denkaufwand:** `--effort` entfällt im lokalen Betrieb; Eingabeleiste und Modus-Menü blenden den Denkaufwand aus. Der gespeicherte Wert bleibt.
- **Kontingent:** im lokalen Betrieb keine Abfrage — der Core lehnt `usage_refresh` stumm ab, die Kopfzeile zeigt die Anzeige nicht.
- **TL;DR:** im lokalen Betrieb mit derselben Umgebung und dem lokalen Modell; Variante nach Messung M4 (Phase 2).
- **Nicht nötiger Netzverkehr aus:** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` und `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1`. Das ist keine Garantie, dass nichts an Anthropic geht — verworfen wurde die harte Variante (eigene Kopie der Kommandozeile plus Windows-Firewall-Sperre), weil der Benutzer den einfachsten Weg will. Was Phase 1 misst, steht im ADR.
- **Kein Provider-Trait.** Es bleibt dieselbe Kommandozeile; nur Umgebung und `--model` ändern sich ([ADR 003](../../decisions/003-claude-anbindung.md): der Trait entsteht mit dem zweiten Anbieter — das ist erst der autarke Agent).

## Kontrakt

### Typen (Rust, `derive(Debug, Clone, Serialize, Deserialize, TS)`, `serde(rename_all = "camelCase")`, neue in `src-tauri/examples/gen-bindings.rs` eintragen)

`src-tauri/src/settings/model.rs`:

```rust
#[derive(Copy, PartialEq, Eq)]
pub enum OperatingMode { Claude, ClaudeCodeLocal }

pub struct Settings {
    pub color_scheme: ColorScheme,
    pub default_model: ModelId,
    pub default_effort: Effort,
    pub default_mode: Mode,
    pub operating_mode: OperatingMode,
    /// Kennung des Modells in LM Studio, z. B. `google/gemma-4-12b-qat`; `None`, solange keins gewählt ist.
    pub local_model: Option<String>,
}

pub enum SettingsChange {
    ColorScheme { value: ColorScheme },
    DefaultModel { value: ModelId },
    DefaultMode { mode: Mode, effort: Effort },
    OperatingMode { value: OperatingMode },
    LocalModel { value: String },
}
```

`src-tauri/src/lmstudio/model.rs`:

```rust
#[derive(Copy, PartialEq, Eq)]
pub enum LocalModelKind { Llm, Vlm }

pub struct LocalModel {
    pub id: String,
    /// `Vlm` versteht Bilder.
    pub kind: LocalModelKind,
    pub is_loaded: bool,
    /// Nur bei geladenem Modell.
    pub loaded_context_length: Option<u32>,
    pub max_context_length: u32,
}

/// Was die Einstellungsseite zeigt. Ein nicht erreichbares LM Studio ist kein Command-Fehler, sondern `error`.
pub struct LocalModels {
    pub base_url: String,
    pub models: Vec<LocalModel>,
    pub error: Option<String>,
}
```

`src-tauri/src/error.rs`: neue Variante `#[error("{0}")] LocalModelUnavailable(String)` — der Inhalt ist ein ganzer Satz.

### Command (`src-tauri/src/commands/settings.rs`, `async`, Wrapper in `src/lib/settings.ts`)

| Command | Parameter | Rückgabe | Wrapper |
|---|---|---|---|
| `settings_local_models` | — | `LocalModels` (nie Fehler) | `loadLocalModels()` |

### Modell-Backend am Agenten (`src-tauri/src/agents/claude/local.rs`)

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalBackend {
    pub base_url: String,
    pub model: String,
    pub context_window: u32,
}

/// `Ok(None)` in der Betriebsart Claude. Fragt LM Studio (höchstens 3 s) — nie unter einer Session-Sperre aufrufen.
pub fn resolve(settings: &Settings) -> Result<Option<LocalBackend>, CommandError>;

/// Setzt die Umgebung des Kindprozesses für LM Studio.
pub fn apply(command: &mut Command, backend: &LocalBackend);
```

`apply` setzt genau: `ANTHROPIC_BASE_URL` = `base_url`, `ANTHROPIC_AUTH_TOKEN` = `lmstudio`, `CLAUDE_CODE_ATTRIBUTION_HEADER` = `0`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` = `1`, `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` = `1`, `ANTHROPIC_DEFAULT_FABLE_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL` = `model`, `CLAUDE_CODE_MAX_CONTEXT_TOKENS` = `context_window`; und entfernt `ANTHROPIC_API_KEY` (`env_remove`), damit kein geerbter Schlüssel Vorrang bekommt.

## Finale Abnahmekriterien

1. Einstellungen → Abschnitt „Agent“ zeigt oben die Zeile „Betriebsart“ mit den Knöpfen „Claude“ und „Claude Code + LM Studio“; ein i-Symbol erklärt beide in zwei Sätzen.
2. Bei „Claude Code + LM Studio“ erscheint darunter „Lokales Modell“. Das Menü listet die Sprach- und Bildmodelle aus LM Studio mit Kontextlänge; nicht geladene sind ausgegraut mit „Nicht geladen — in LM Studio laden“, Modelle eines anderen Typs als `llm`/`vlm` (z. B. Embedding-Modelle) fehlen. Welchen Typ LM Studio für Whisper-Modelle meldet, ist nicht geprüft — tauchen sie auf, FINDINGS-Eintrag. Läuft LM Studio nicht, steht dort ein Satz mit der Adresse statt einer leeren Liste.
3. Mit gewähltem, geladenem Modell antwortet eine **ruhende** Session auf die nächste Nachricht über LM Studio (sichtbar im Server-Log von LM Studio), mit Werkzeug-Aufrufen im Chat wie bei Claude. Eine Session, deren Agent noch mit Claude lief, wechselt bei der nächsten Nachricht.
4. Die Eingabeleiste zeigt statt „Opus · Hoch“ den Namen des lokalen Modells (Teil nach dem letzten `/`), ohne Menü und ohne Denkaufwand; das Modus-Menü zeigt keine Denkaufwand-Punkte. „Neues Vorhaben“ zeigt im Schritt „Agent“ „LM Studio · <Name>“ ohne Modellmenü.
5. Die Kontingent-Anzeige in der Kopfzeile ist im lokalen Betrieb weg; zurück auf „Claude“ ist sie wieder da.
6. Der Kontext-Donut rechnet gegen die geladene Kontextlänge aus LM Studio, nicht gegen 1 000 000.
7. Ist LM Studio aus oder das Modell nicht geladen, erscheint beim Senden unter der Eingabeleiste ein Satz, der das sagt; die Nachricht bleibt im Feld.
8. TL;DR funktioniert im lokalen Betrieb über das lokale Modell — oder, falls M4 scheitert, sagt der TL;DR-Knopf in einem Satz, dass TL;DR im lokalen Betrieb nicht verfügbar ist.
9. Zurück auf „Claude“: die nächste Nachricht jeder Session läuft wieder über Claude mit ihrem gespeicherten Modell und Denkaufwand.
10. `pnpm check` grün, lokal und in der GitHub-Prüfung (`check.yml`), Bindings unverändert nach `pnpm bindings`.

## Smoke-Checkliste

Vorbereitung: in LM Studio `google/gemma-4-12b-qat` mit Kontext ≥ 64 000 laden, lokalen Server starten.

Wackelstellen zuerst:

1. **Wechsel mitten in einer Claude-Session (AK 3, M5):** Session mit zwei, drei Claude-Nachrichten, dann Betriebsart umschalten, nächste Nachricht. Erwartung: Antwort über LM Studio, der bisherige Verlauf ist dem Modell bekannt (fragen: „Worüber haben wir gerade gesprochen?“). Ist der Claude-Verlauf größer als das lokale Fenster, Ergebnis in FINDINGS notieren.
2. **Kontextfenster (AK 6, M2):** nach der ersten lokalen Antwort zeigt das Kontext-Fenster die geladene Kontextlänge als Maximum; eine Aufgabe mit mehreren Werkzeug-Aufrufen bricht nicht mit abgeschnittenem Satz ab.
3. **TL;DR lokal (AK 8, M4):** TL;DR-Knopf einer Session im lokalen Betrieb.
4. Betriebsart umschalten, während ein Agent arbeitet → er arbeitet zu Ende; erst die nächste Nachricht wechselt.
5. LM Studio-Server stoppen, Nachricht senden → Satz aus AK 7; Server starten, erneut senden → läuft.
6. Modell in LM Studio entladen → Einstellungen zeigen es ausgegraut; Senden → Satz „nicht geladen“.
7. Bild anhängen bei einem `vlm`-Modell → das Modell beschreibt das Bild.
8. Zurück auf „Claude“ → AK 5 und AK 9.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
