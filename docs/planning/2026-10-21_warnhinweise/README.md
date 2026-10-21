# Warnhinweise

Ziel: Der Verwalter zeigt die Hinweise, die die Claude-Kommandozeile heute schon liefert oder die er selbst ausrechnen kann und bisher wegwirft: Zustand des Prompt-Caches, Warnung vor einer teuren nächsten Nachricht (Cache abgelaufen, Modellwechsel), Zusammenfassung des Verlaufs, Kontingent live, Modell-Ausweichen, allgemeine Hinweise, Moduswechsel, abgelehnte Werkzeugaufrufe und Kosten je Antwort. Jeder Hinweis hat genau einen Ort: die **Kopfzeile** zeigt einen Zustand, der gerade gilt; die **Eingabeleiste** warnt vor den Folgen der nächsten Nachricht; der **Verlauf** hält fest, was passiert ist.

Design: [artifacts/warnhinweise-entwurf.html](artifacts/warnhinweise-entwurf.html) (vom User freigegeben am 2026-10-21, „alles so planen“), Erläuterung in [artifacts/README.md](artifacts/README.md). Die Nummern 1–9 der Hinweise in diesem Plan sind die Nummern des Entwurfs.

**Belegt am 2026-10-21** mit Claude Code 2.1.293, `-p --input-format stream-json --output-format stream-json --verbose --model claude-sonnet-5-5` (Beispielzeilen: [artifacts/beispielzeilen.jsonl](artifacts/beispielzeilen.jsonl)):

- Jede `assistant`-Zeile trägt `message.id` und `message.usage.cache_creation` mit `ephemeral_5m_input_tokens` und `ephemeral_1h_input_tokens`; gemessen war nur `ephemeral_1h_input_tokens` > 0 (Haltedauer 1 Stunde). Grundlast einer frischen Session: rund 64 000 Token (17 509 geschrieben + 46 720 gelesen).
- `rate_limit_event` kommt nach jeder Antwort: `rate_limit_info.status` (gemessen nur `allowed`), `rateLimitType` (`five_hour`), `resetsAt` (Sekunden seit 1970), `unifiedWindows.five_hour.utilization` und `unifiedWindows.seven_day.utilization` (Anteil 0–1, gemessen 0.51 und 0.28), `overageStatus`.
- `result` trägt `permission_denials` (gemessen leer) und `total_cost_usd`, und zwar **aufsummiert über den Prozess**: zwei Antworten in einem Prozess meldeten 0.0794 und 0.159.
- `/compact` als Nachricht: `system`/`status` mit `status: "compacting"`, danach `status: null` mit `compact_result: "success"`, dann `system`/`compact_boundary` mit `compact_metadata` (`trigger: "manual"`, `pre_tokens: 64301`, `post_tokens: 3888`), danach eine `user`-Zeile mit `isSynthetic: true` und Text-Inhalt = die Zusammenfassung (beginnt mit „This session is being continued from a previous conversation“), dann eine `user`-Zeile `<local-command-stdout>Compacted </local-command-stdout>`, dann `result` mit `num_turns: 0`.
- **Nur aus dem Code der VS-Code-Erweiterung 2.1.301, nicht gemessen:** `rate_limit_info.status` außer `allowed` (`allowed_warning`, `rejected`); `system`/`model_refusal_fallback` (`original_model`, `fallback_model`, `direction` `retry`/`revert`/`sticky`, `content`); `system`/`informational` (`content`); `compact_metadata.trigger` `auto`. Form eines Eintrags in `permission_denials` aus dem Agent SDK: `tool_name`, `tool_use_id`, `tool_input` — Phase 1 misst ihn.
- Die Erweiterung rechnet den Cache-Zustand selbst: Anker = Eingang der letzten Antwort des Hauptagenten mit Cache-Angaben, Haltedauer aus `cache_creation`, „kalt“ nach Ablauf oder nach einer Zusammenfassung; neu zu schreiben = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` dieser Antwort.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 003](../../decisions/003-claude-anbindung.md), [ADR 008](../../decisions/008-kontext-und-kontingent.md), [ADR 016](../../decisions/016-betriebsarten-und-lokales-modell.md), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md). ADR 033 entsteht in Phase 2.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Protokoll: neue Felder und Zeilen lesen, neue `AgentEvent`s, Messung der abgelehnten Aufrufe | [phase-1-protokoll.md](phase-1-protokoll.md) | standard | pending |
| 2 | Prompt-Cache im Core: Zustand je Session, Speichern (Migration 12), in `SessionSummary`; ADR 033 | [phase-2-cache-core.md](phase-2-cache-core.md) | heikel | pending |
| 3 | Cache in der Oberfläche: Pille in der Kopfzeile (1), Hinweis in der Eingabeleiste (2), Hinweis im Modell-Menü (3) | [phase-3-cache-oberflaeche.md](phase-3-cache-oberflaeche.md) | standard | pending |
| 4 | Verlauf Teil 1: Eintragsart „Hinweis“, Zusammenfassung (4), Modellwechsel-Zeile (3) | [phase-4-verlauf-zusammenfassung.md](phase-4-verlauf-zusammenfassung.md) | standard | pending |
| 5 | Kontingent live (5): Werte aus `rate_limit_event`, Leiste unter der Kopfzeile | [phase-5-kontingent-live.md](phase-5-kontingent-live.md) | standard | pending |
| 6 | Verlauf Teil 2: Modell-Ausweichen (6), Hinweise und Moduswechsel (7), abgelehnte Aufrufe (8), Kosten (9); Abschluss der Doku | [phase-6-verlauf-weitere.md](phase-6-verlauf-weitere.md) | standard | pending |

**Reihenfolge:** strikt 1 → 6. Nach Phase 4 ist das Paket 1 aus dem Entwurf (Hinweise 1–4) fertig und benutzbar. Umsetzung direkt auf `main`, ein Commit pro Phase, Scope `notices` (Phase 1 trägt ihn in [commits.md](../../conventions/commits.md) nach; Phase 5 committet mit Scope `usage`). Vor jedem Commit `pnpm check` grün; `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine neuen Abhängigkeiten. Bindings nach Änderungen an Typen über die Tauri-Grenze neu erzeugen (`pnpm bindings`) und mitcommitten. Keine automatisierten Tests (Profil des Projekts). Erkenntnisse nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 2 schreibt daraus [ADR 033](../../decisions/033-warnhinweise.md) „Warnhinweise“ (Kontext / Optionen / Entscheidung / Konsequenzen); Phasen 3–6 ergänzen ihre Punkte.

- **Nur Betriebsart „Claude“.** Cache, Kosten, Kontingent live und Modell-Ausweichen gibt es nur, wenn der laufende Prozess die Claude-Kommandozeile mit dem Claude-Abo ist: `process_mode == OperatingMode::Claude && process_backend.is_none()` (neue Methode `SessionState::is_claude_process`). In „Claude Code + LM Studio“, „Autark“ und „Codex“ bleiben diese Werte leer und die Oberfläche zeigt nichts davon. Zusammenfassung, Hinweise, Moduswechsel und abgelehnte Aufrufe gelten in jeder Betriebsart, die die Zeilen liefert. Verworfen: Cache-Anzeige für LM Studio — dessen Wiederverwendung des Prompt-Anfangs hat keine Haltedauer und kostet nichts.
- **Der Cache-Zustand wird im Core festgehalten, die Uhr läuft in der Oberfläche.** Der Core speichert je Session einen `PromptCache` (Anker, Haltedauer, Token, Modell, Zeitpunkt einer Zusammenfassung) und schickt ihn in `SessionSummary.prompt_cache`; die Oberfläche rechnet daraus mit der aktuellen Uhrzeit „warm / kalt / neu“ (`promptCacheState`). Verworfen: Zustand im Core mit Zeitgeber — ein Zeitgeber je Session für eine reine Anzeige; verworfen: nur in der Oberfläche — nach einem App-Neustart wäre die Warnung genau dann weg, wenn sie am meisten zählt (Session vom Vortag).
- **Gespeichert als JSON in einer neuen Spalte** `sessions.prompt_cache TEXT NULL` (Migration 12), geschrieben mit `session_rows::upsert`, gelesen mit `load_active`/`load_for_project`. Unlesbares JSON → `None`, kein Fehler.
- **Anker = Eingang der ersten Zeile einer Antwort**: Eine Antwort (`message.id`) kommt in mehreren `assistant`-Zeilen; der Anker wird nur bei einer neuen `message.id` auf `now_ms()` gesetzt, Token und Haltedauer bei jeder Zeile aktualisiert. Nur Zeilen des Hauptagenten (`parent_tool_use_id` leer) und nur mit `cache_creation_input_tokens + cache_read_input_tokens > 0`. Haltedauer: `ephemeral_1h_input_tokens > 0` → 3 600 000 ms, sonst `ephemeral_5m_input_tokens > 0` → 300 000 ms, sonst die bisherige (beim ersten Mal 300 000 ms — die kürzere ist die vorsichtige Annahme).
- **Kalt** heißt: Haltedauer seit dem Anker abgelaufen, **oder** das Modell der Session ist ein anderes als das des Caches (der Cache gilt nur für ein Modell). **Neu** heißt: seit der letzten Zusammenfassung kam keine Antwort mit Cache-Angaben.
- **Schwelle für den Hinweis in der Eingabeleiste (2): 100 000 Token.** Die Grundlast jeder Session liegt gemessen bei rund 64 000 Token; darunter schreibt auch eine neue Session ungefähr gleich viel neu, der Rat „neue Session“ spart dann nichts. Konstante `COLD_HINT_MIN_TOKENS = 100_000` in `src/features/promptcache/promptCacheState.ts`. Der Hinweis steht, solange der Zustand gilt — ohne Ausblenden-Knopf; die nächste Antwort setzt den Anker neu und nimmt ihn weg.
- **„In neuer Session weiter“ im Hinweis (2)** legt mit `createSessionInProject(projectId)` eine neue Session im Vorhaben an und wählt sie aus (wie `HandoffButton`, ohne Entwurfszeile); die Einstiegsansicht der neuen Session hat den Haken „TL;DR mitschicken“ wie immer gesetzt.
- **Eine neue Eintragsart `ChatEntry::Notice { seq, notice: Notice }`** für alle Hinweise im Verlauf (Code-Ort `src-tauri/src/notices/model.rs`, Oberfläche `src/features/notices/`). `Notice` ist ein Enum mit `kind`-Tag: `Compacted`, `ModelSwitched`, `ModelFallback`, `Info`, `ModeChanged`, `TurnSummary` (Felder im Kontrakt). Verworfen: Hinweise als `ChatEntry::Error` — falsche Farbe und „Agent neu starten“-Logik; verworfen: eine Eintragsart je Hinweis — sieben Zweige in jedem `match` über `ChatEntry` (Archiv-Suche, TL;DR-Text, Retro).
- **Zusammenfassung (4):** `compact_boundary` → Eintrag `Compacted` und `prompt_cache.compacted_at = now`; die nächste `user`-Zeile mit `isSynthetic: true` und Text-Inhalt ist die Zusammenfassung und wird in diesen Eintrag geschrieben (`replace_entry`). Fehlt `compact_metadata` (der Agent „Autark“ schickt die Zeile ohne), sind Auslöser und Tokenzahlen leer.
- **Modellwechsel (3):** `set_model` mit einem anderen Modell legt einen Eintrag `ModelSwitched` an, wenn `is_claude_process()` und ein `prompt_cache` existiert; `recache_tokens` = `prompt_cache.tokens`. Das Modell-Menü warnt vorher, solange der Cache warm ist.
- **Kontingent live (5):** `rate_limit_event` aktualisiert im `UsageService` sofort die Prozentwerte der Fenster `session` (aus `five_hour`) und `weekly_all` (aus `seven_day`) eines vorhandenen Stands und setzt `UsageStatus.alert`: `None` bei `status == "allowed"`, sonst `UsageAlert` mit Status, Fenster, Prozent und Rücksetzzeit. Kein zusätzlicher Abruf über den Hilfsprozess. Die Leiste unter der Kopfzeile zeigt `alert`; „Ausblenden“ merkt sich den Schlüssel `<status>:<fenster>:<resetsAt>` im flüchtigen Store und zeigt dieselbe Warnung nicht noch einmal (wie die Erweiterung).
- **Modell-Ausweichen (6):** `model_refusal_fallback` → Eintrag `ModelFallback`; bei `direction` `retry` oder `sticky` merkt sich die Session `fallback_model` (nur im Speicher, in `SessionSummary`), die Eingabeleiste zeigt dann „<Modell> · Ersatz“ in Warnfarbe. `revert`, `set_model` und jeder Prozessstart löschen ihn. Der Knopf „Mit <Original> weiter“ erscheint nur, wenn `original_model` einer `ModelId::cli_id()` entspricht (neue Funktion `ModelId::from_cli_id`, der Core schickt das Ergebnis mit), und ruft `setSessionModel`. Anzeigenamen: bekannte ID → `modelName`, sonst die rohe Kennung.
- **Leiste „Kontingent“ ohne Knopf „Details“** (Abweichung vom Entwurf): das Kontingent-Fenster liegt einen Klick daneben in der Kopfzeile; ein zweiter Weg dorthin bräuchte den Fensterzustand von `SessionHeader` in `App`.
- **Moduswechsel (7):** `system`/`status` mit `permissionMode` → ist der Wert einer der vier bekannten (`default`, `acceptEdits`, `plan`, `auto`) und weicht er vom Modus der Session ab, übernimmt die Session ihn und legt einen Eintrag `ModeChanged` an. Selbst ausgelöste Wechsel (`set_mode`) kommen gleich zurück und erzeugen keinen Eintrag.
- **Hinweise (7):** `system`/`informational` mit nicht leerem `content` → Eintrag `Info`. Kein Filter auf `tag` (die Erweiterung filtert auf einen Wert, dessen Bedeutung nicht belegt ist); erweist sich das als zu laut, filtert ein Follow-up.
- **Antwort-Abschluss (8, 9):** am Ende jeder Antwort ein Eintrag `TurnSummary`, wenn es abgelehnte Aufrufe gibt **oder** ein Kostenwert > 0 vorliegt. Kosten nur bei `is_claude_process()`, als Zuwachs: `total_cost_usd − letzter Wert desselben Prozesses` (der Wert ist prozessweit aufsummiert, siehe oben); ist der neue Wert kleiner als der alte, gilt er selbst. Jeder Prozessstart setzt den letzten Wert auf 0. Text „abgelehnt“ statt „von Regeln blockiert“: die Liste enthält auch vom User abgelehnte Aufrufe.
- **Code-Orte:** `src-tauri/src/prompt_cache/` (Typ, Haltedauer-Konstanten), `src-tauri/src/notices/` (Typ `Notice`), Oberfläche `src/features/promptcache/` und `src/features/notices/`; Kontingent bleibt in `usage`. Feature-Namen `promptcache` und `notices` in der Code-Map.

## Kontrakt

### Neue `AgentEvent`s (`src-tauri/src/agents/event.rs`, Phase 1)

```rust
/// Cache-Angaben einer Zeile des Hauptagenten; `tokens` = input + cache_creation + cache_read,
/// `written_5m`/`written_1h` = `cache_creation.ephemeral_5m_input_tokens`/`ephemeral_1h_input_tokens` (fehlend = 0).
CacheUsed { message_id: Option<String>, tokens: u32, written_5m: u32, written_1h: u32 },
/// `system/compact_boundary`; ohne `compact_metadata` alles `None`.
Compacted { trigger: Option<String>, pre_tokens: Option<u32>, post_tokens: Option<u32> },
/// Text der Zusammenfassung (erste `user`-Zeile mit `isSynthetic` nach `Compacted`).
CompactSummary(String),
RateLimit(RateLimitInfo),
ModelFallback { original_model: String, fallback_model: String, direction: String, text: Option<String> },
Info(String),
/// `permissionMode` aus `system/status`, roh.
PermissionMode(String),
```

`TurnEnded` bekommt zwei Felder: `denials: Vec<Denial>` und `total_cost_usd: Option<f64>`.

```rust
pub struct RateLimitInfo {           // agents/event.rs, nicht über die Tauri-Grenze
    pub status: String,              // "allowed", sonst Warnung oder Sperre
    pub rate_limit_type: Option<String>, // "five_hour", "seven_day", …
    pub resets_at: Option<i64>,      // Sekunden seit 1970
    pub five_hour: Option<f64>,      // Anteil 0–1
    pub seven_day: Option<f64>,      // Anteil 0–1
}
```

### Typen über die Tauri-Grenze (`derive(TS)`, in `examples/gen-bindings.rs` eintragen)

```rust
// src-tauri/src/prompt_cache/model.rs (Phase 2)
pub struct PromptCache {
    pub anchor_at: f64,            // ms seit 1970
    pub ttl_ms: u32,               // 300_000 oder 3_600_000
    pub tokens: u32,
    pub model: ModelId,
    pub compacted_at: Option<f64>,
}
// SessionSummary (Phase 2 / 6)
pub prompt_cache: Option<PromptCache>,
pub fallback_model: Option<String>,     // Phase 6, roh wie von Claude gemeldet
pub fallback_model_id: Option<ModelId>, // Phase 6, `ModelId::from_cli_id(fallback_model)`

// src-tauri/src/notices/model.rs (Phase 4 / 6), serde tag = "kind", camelCase
pub enum Notice {
    Compacted { trigger: Option<String>, pre_tokens: Option<u32>, post_tokens: Option<u32>, summary: Option<String> },
    ModelSwitched { from: ModelId, to: ModelId, recache_tokens: u32 },
    ModelFallback { original_model: String, original_id: Option<ModelId>, fallback_model: String, fallback_id: Option<ModelId>, direction: String, text: Option<String> },
    Info { text: String },
    ModeChanged { from: Mode, to: Mode },
    TurnSummary { denials: Vec<Denial>, cost_usd: Option<f64> },
}
pub struct Denial { pub tool: String, pub target: String }
// ChatEntry (Phase 4)
Notice { seq: u32, notice: Notice },

// src-tauri/src/usage/model.rs (Phase 5)
pub struct UsageAlert {
    pub status: String,            // wie geliefert
    pub limit_kind: Option<String>,// rateLimitType wie geliefert
    pub percent: Option<u32>,      // 0–100 aus unifiedWindows des Fensters
    pub resets_at: Option<String>, // ISO-8601 UTC
}
// UsageStatus
pub alert: Option<UsageAlert>,
```

## Finale Abnahmekriterien

1. In „Claude“ zeigt die Session-Kopfzeile links vom Kontext-Donut eine Pille „Cache <n> min“ (grün), „Cache kalt“ (blau, Schneeflocke) oder „Cache neu“ (grau); vor der ersten Antwort einer Session keine Pille. Ein Klick öffnet ein Fenster mit Zustand, Token, Haltedauer, letzter Antwort und Modell sowie einem Satz, was den Cache kalt macht.
2. Ist der Cache kalt und liegen mindestens 100 000 Token darin, steht über dem Eingabefeld eine Zeile mit Pausendauer (bzw. „anderes Modell“) und Tokenzahl und ein Knopf „In neuer Session weiter“, der eine neue Session im Vorhaben anlegt und öffnet. Nach der nächsten Antwort ist die Zeile weg.
3. Das Modell-Menü warnt unter der Liste, solange der Cache warm ist; nach einem Wechsel steht im Verlauf „Modell gewechselt: A → B“ mit Tokenzahl, und die Pille zeigt „kalt“.
4. Nach `/compact` oder einer automatischen Zusammenfassung steht im Verlauf eine Trennlinie mit Tokenstand vorher/nachher, die Zusammenfassung lässt sich aufklappen, die Pille zeigt „Cache neu“.
5. Nach jeder Antwort in „Claude“ springt die Kontingent-Anzeige sofort auf den neuen Wert; meldet Claude eine Warnung oder Sperre, steht unter der Kopfzeile eine rote Leiste mit Prozent und Rücksetzzeit, ausblendbar.
6. Modell-Ausweichen, Hinweise von Claude Code und ein nicht selbst ausgelöster Moduswechsel erscheinen als Zeilen im Verlauf; abgelehnte Aufrufe und die Kosten je Antwort stehen klein am Ende der Antwort.
7. Alle Hinweise im Verlauf überleben einen App-Neustart; die Cache-Pille zeigt nach dem Neustart den richtigen Zustand.
8. In „Claude Code + LM Studio“, „Autark“ und „Codex“ gibt es keine Cache-Pille, keinen Cache-Hinweis, keine Kosten; sonst verhält sich alles wie vorher.

## Smoke-Checkliste

Wackelstellen zuerst:

1. **Cache nach Agent-Neustart** — die Anzeige nimmt an, dass ein beendeter und mit `--resume` neu gestarteter Agent den Cache innerhalb der Stunde weiter trifft. Prüfen: `VERWALTER_IDLE_SECONDS=60` setzen, Verwalter starten, in einer Session eine Nachricht schicken, 2 Minuten warten (Agent wird beendet), noch eine Nachricht schicken; danach in `%USERPROFILE%\.claude\projects\<Ordner des Workspace>\<Session-ID>.jsonl` bei der letzten `assistant`-Zeile `cache_read_input_tokens` ansehen. Groß (> 40 000) = Annahme stimmt; nahe 0 = Pille zeigt fälschlich „warm“ → FINDINGS, Follow-up: Prozessende setzt den Cache auf kalt.
2. **Automatische Zusammenfassung** — gemessen ist nur `/compact`. Prüfen: in einer Session `/compact` schicken (Trennlinie, Zusammenfassung aufklappbar, Pille „neu“); zusätzlich bei der nächsten echten automatischen Zusammenfassung einer langen Session nachsehen, ob dieselbe Trennlinie erscheint (Auslöser „automatisch“).
3. **Nicht gemessene Zeilen** — Kontingent-Warnung, Modell-Ausweichen und allgemeine Hinweise sind nur aus dem Code der Erweiterung bekannt. Prüfen: sobald eines davon im Alltag auftritt, Leiste bzw. Zeile ansehen; fehlt sie, im Protokoll der Session („Protokoll anzeigen“ an einer Fehlerzeile bzw. Log) nach `rate_limit_event`/`model_refusal_fallback`/`informational` suchen und die Zeile nach FINDINGS kopieren.
4. Cache-Pille: Session in „Claude“, eine Nachricht → „Cache 60 min“; nach einigen Minuten zählt sie herunter; Klick zeigt das Fenster.
5. Eingabeleiste: eine Session mit > 100 000 Token über eine Stunde liegen lassen (oder Systemuhr nicht verstellen — stattdessen Modell wechseln) → Zeile über dem Eingabefeld; „In neuer Session weiter“ legt eine Session an.
6. Modell-Menü bei warmem Cache öffnen → Warnung; Modell wechseln → Zeile im Verlauf, Pille „kalt“, Hinweis in der Eingabeleiste (falls ≥ 100 000 Token).
7. Kontingent: nach einer Antwort ändert sich die Prozentzahl ohne Öffnen des Fensters.
8. Modus Manuell, Werkzeugaufruf ablehnen → am Ende der Antwort „1 Aufruf abgelehnt“, aufklappbar; Kosten „≈ 0,08 $ Rechenwert“ o. ä.
9. Agent im Modus Planen einen Plan vorlegen und annehmen lassen → Zeile „Modus geändert: Planen → …“, Eingabeleiste zeigt den neuen Modus.
10. App-Neustart → Hinweise im Verlauf und Pille stimmen.
11. Gegenprobe in „Autark“ und „Codex“: keine Pille, keine Kosten, sonst unverändert.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
