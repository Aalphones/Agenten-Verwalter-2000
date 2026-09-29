# Kontext und Kontingent in der Kopfzeile

Ziel: In der Session-Kopfzeile öffnet ein Klick auf den Kontext-Balken eine Aufschlüsselung, was den Kontext der Session belegt (Systemprompt, Werkzeuge, Memory-Dateien, Skills, Nachrichten, freier Platz, Memory-Dateien einzeln). Daneben zeigt eine neue kleine Anzeige „5h 80 %“ das Kontingent des Claude-Abos; ein Klick öffnet 5-Stunden- und Wochen-Kontingent mit Reset-Zeit und „Was treibt den Verbrauch?“ (Tag/Woche). Vorbild sind die Fenster „Context usage“ und „Account & Usage“ der VS-Code-Erweiterung; die Screenshots dazu liegen nicht im Repo, der Aufbau ist unten und in Phase 3 vollständig beschrieben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [ADR 003](../../decisions/003-claude-anbindung.md) (Anbindung), [claude-stream-json.md](../../knowledge/claude-stream-json.md) — **alle Protokoll-Fakten dieses Plans stehen dort im Abschnitt „Kontext und Kontingent abfragen“** (gemessen am 2026-09-29 mit Claude Code 2.1.284), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Kontext-Aufschlüsselung je Session | [phase-1-kontext-core.md](phase-1-kontext-core.md) | standard | pending |
| 2 | Core: Kontingent über einen Hilfsprozess | [phase-2-kontingent-core.md](phase-2-kontingent-core.md) | heikel | pending |
| 3 | Oberfläche: zwei Fenster in der Kopfzeile, Doku-Abschluss | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | pending |

Reihenfolge fest: 1 → 2 → 3. Umsetzung direkt auf `main`, ein Commit pro Phase (Scopes: Phase 1 `context`, Phase 2 `usage`, Phase 3 `ui`; die Scopes `context` und `usage` trägt Phase 1 bzw. 2 in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus ADR 008 „Kontext und Kontingent anzeigen“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen).

- **Quelle sind zwei Steueranfragen der Claude-Kommandozeile**, nicht eigene Rechnungen: `get_context_usage` (Kontext) und `get_usage` (Kontingent). Beide antworten ohne gesendete Nachricht. `get_usage` ist im SDK als experimentell markiert — jedes Feld wird nachsichtig gelesen, ein unlesbares Feld ist leer, nie ein Fehler der ganzen Antwort.
- **Kontext kommt vom Agenten der Session.** Der Core fragt ihn automatisch am Ende jeder Antwort (`TurnEnded`, außer nach Abbrechen) und zusätzlich, wenn die Oberfläche das Fenster öffnet und der Agent läuft. Die letzte Aufschlüsselung liegt nur im Speicher des Core (`SessionState`), nicht in SQLite: sie ist ein Zwischenstand, nach einem App-Neustart zeigt das Fenster bis zur nächsten Antwort nur die Zahlen des Balkens. Läuft der Agent nicht (Ruhe-Timer, Neustart), zeigt das Fenster den letzten Stand mit Uhrzeit.
- **Kontingent kommt von einem Hilfsprozess**, unabhängig von jeder Session: ein kurz gestarteter `claude.exe` mit den Schaltern aus der Wissensdatei (`--strict-mcp-config --no-session-persistence`, Arbeitsverzeichnis `<Benutzerordner>\.verwalter`), der eine einzige Anfrage `get_usage` beantwortet und dann beendet wird (rund 1,4 s). Zeitlimit 20 s. Nie zwei Abrufe gleichzeitig; ohne `force` höchstens ein Abruf je 30 s. Die Oberfläche fragt beim Einblenden der Kopfzeile, beim Öffnen des Fensters und alle 5 Minuten, solange das Fenster der App sichtbar ist.
- **Alternative verworfen:** das Kontingent aus dem Agenten einer laufenden Session holen (spart den Hilfsprozess). Verworfen, weil es ohne laufenden Agenten gar nichts liefert und einen zweiten Weg für dieselbe Zahl bräuchte. Ebenso verworfen: die `rate_limit_event`-Zeilen mitlesen — ihr Inhalt ist nicht belegt.
- **Namen:** Feature `context` (Kontext-Aufschlüsselung je Session) und Feature `usage` (Kontingent des Abos), in allen Schichten nach dem Namensschema der Code-Map. In der Oberfläche heißt Usage „Kontingent“.
- **Uhrzeiten:** `resets_at` bleibt ein ISO-8601-Text bis in die Oberfläche (kein Datums-Crate im Core); `Date.parse` liest die sechs Nachkommastellen samt Zeitzone (geprüft: `Date.parse('2026-09-29T14:40:00.294426+00:00')` = `1790692800294`).

## Kontrakt

### Typen (Rust, `derive(Serialize, TS)`, `serde(rename_all = "camelCase")`, in `gen-bindings.rs` eintragen)

`src-tauri/src/context/model.rs`:

```rust
pub struct ContextCategory { pub name: String, pub tokens: u32, pub is_free: bool }
pub struct ContextFile { pub path: String, pub tokens: u32 }
pub struct ContextBreakdown {
    pub model: String,
    pub total_tokens: u32,
    pub max_tokens: u32,
    /// Nur `kind` `used` und `free`, in der Reihenfolge der Kommandozeile; `deferred` fällt weg.
    pub categories: Vec<ContextCategory>,
    pub memory_files: Vec<ContextFile>,
    /// `None`, wenn `isAutoCompactEnabled` nicht `true` ist oder der Wert fehlt.
    pub auto_compact_threshold: Option<u32>,
    /// Millisekunden seit 1970; gesetzt beim Eintreffen im Core.
    pub fetched_at: f64,
}
pub struct SessionContext { pub breakdown: Option<ContextBreakdown>, pub is_agent_running: bool }
pub struct ContextChangedEvent { pub session_id: String }
```

`src-tauri/src/usage/model.rs`:

```rust
pub struct UsageLimit { pub kind: String, pub percent: u32, pub severity: String, pub resets_at: Option<String> }
pub struct UsageShare { pub key: String, pub percent: u32 }
pub struct UsageBreakdown { pub request_count: u32, pub session_count: u32, pub behaviors: Vec<UsageShare>, pub skills: Vec<UsageShare> }
pub struct UsageSnapshot {
    /// `subscription_type`, z.B. `pro`.
    pub plan: Option<String>,
    pub limits: Vec<UsageLimit>,
    pub day: Option<UsageBreakdown>,
    pub week: Option<UsageBreakdown>,
    pub fetched_at: f64,
}
pub struct UsageStatus { pub snapshot: Option<UsageSnapshot>, pub error: Option<String>, pub is_loading: bool }
```

### Commands

| Command | Parameter | Rückgabe | Wirkung |
|---|---|---|---|
| `context_load` | `sessionId` | `SessionContext` | letzte Aufschlüsselung; Pfade der Memory-Dateien mit `~` statt Benutzerordner |
| `context_refresh` | `sessionId` | `bool` | fragt den Agenten, falls er zuhört; `false`, wenn nicht |
| `usage_load` | — | `UsageStatus` | Zwischenspeicher, sofort |
| `usage_refresh` | `force: bool` | `()` | startet einen Abruf im Hintergrund (Regeln oben) |

### Ereignisse

| Ereignis | Nutzlast | Wann |
|---|---|---|
| `context://changed` | `ContextChangedEvent` | neue Aufschlüsselung einer Session |
| `usage://changed` | keine | Abruf beginnt oder endet (Erfolg oder Fehler) |

## Finale Abnahmekriterien

1. Klick auf den Kontext-Balken öffnet ein Fenster mit Modell, „belegt / Fenster Tokens (Prozent)“, einem gestapelten Balken, einer Tabelle je Kategorie (Tokens, Prozent) samt „Freier Platz“, der Schwelle fürs automatische Zusammenfassen und der Liste der Memory-Dateien mit Tokens.
2. Nach jeder Antwort des Agenten ist die Aufschlüsselung ohne weiteres Zutun aktuell; bei ruhendem Agenten zeigt das Fenster „Stand HH:MM · Agent ruht“; nach App-Neustart ohne Antwort den Hinweis, dass die Aufschlüsselung mit der nächsten Antwort kommt.
3. Die Kopfzeile zeigt „5h NN %“ für das 5-Stunden-Kontingent; ab 90 % in Warnfarbe.
4. Klick darauf öffnet ein Fenster mit Abo, je Kontingent Balken, Prozent und „Zurückgesetzt in …“, darunter „Was treibt den Verbrauch?“ mit Umschalter Tag/Woche (Anteile lange Kontexte, lange aktive Sessions, parallele Sessions, Skills nach Anteil) und „Stand HH:MM“ mit „Aktualisieren“.
5. Ein fehlgeschlagener Abruf zeigt den Fehlertext im Fenster, lässt den letzten Stand stehen und bietet „Aktualisieren“ an; die App bleibt bedienbar.
6. Kein Abruf hinterlässt einen laufenden `claude.exe`-Prozess; der Hilfsprozess öffnet kein Konsolenfenster.
7. Beide Auslöser haben eine Erklärung als Tooltip; beide Fenster schließen mit Esc und Klick daneben.
8. `pnpm check` grün; ADR 008, Code-Map, Glossar, `commits.md` beschreiben den Stand.

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

1. **Hilfsprozess räumt auf:** Kontingent-Fenster öffnen, „Aktualisieren“ dreimal schnell klicken. Im Task-Manager darf danach kein zusätzlicher `claude.exe` übrig bleiben, und es darf kein Konsolenfenster aufblitzen.
2. **Kontext während einer laufenden Antwort:** Während der Agent arbeitet, das Kontext-Fenster öffnen. Es muss eine Aufschlüsselung kommen, und die Antwort darf dadurch nicht abbrechen oder hängen.
3. **Kopfzeile bei schmalem Fenster:** App-Fenster auf etwa 1000 px Breite ziehen, laufende Session mit „Pause“/„Abbrechen“. Titel, Reiter, Hintergrund, Kontext, Kontingent und Laufzeit dürfen sich nicht überlappen.
4. Kontext-Fenster: Zahlen grob gegen `/context` in einer Claude-Konsole im selben Workspace vergleichen (gleiche Kategorien, gleiche Größenordnung).
5. Kontingent-Fenster: Prozentwerte gegen „Account & Usage“ in VS Code vergleichen (Abweichung nur durch zwischenzeitlichen Verbrauch).
6. Nach 30 min Ruhe (oder `VERWALTER_IDLE_SECONDS=60`): Kontext-Fenster zeigt „Agent ruht“ mit Uhrzeit, kein „Aktualisieren“.
7. App neu starten, Session öffnen, Kontext-Fenster: Hinweis „kommt mit der nächsten Antwort“ und die Balken-Zahlen. Eine Nachricht senden → nach der Antwort ist die Aufschlüsselung da.
8. Netzwerk trennen, im Kontingent-Fenster „Aktualisieren“: Fehlertext, alter Stand bleibt, nach ≤ 20 s ist „Aktualisieren“ wieder klickbar.
9. Hell- und Dunkelmodus: beide Fenster lesbar, Kategorienfarben unterscheidbar.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
