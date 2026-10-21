# Phase 2 — Prompt-Cache im Core

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Nur Betriebsart Claude“, „Der Cache-Zustand wird im Core festgehalten“, „Gespeichert als JSON“, „Anker“, „Kalt“; Kontrakt `PromptCache`), [ADR 008](../../../decisions/008-kontext-und-kontingent.md), [ADR 016](../../../decisions/016-betriebsarten-und-lokales-modell.md), [ADR 032](../../../decisions/032-wartet-auf-skript.md) (Form eines ADR).

Code-Stellen:

- `src-tauri/src/sessions/registry.rs`: `SessionState` (Felder `context_used`, `process_mode`, `process_backend`), `apply_event` (Zweige aus Phase 1), `start_process` (setzt `process_mode`, `process_backend`, `translator`), Laden einer gespeicherten Session (dort, wo `state.context_used = row.context_used` steht), neue Session (dort, wo `context_used: 0` steht), `row_of`, `summarize`.
- `src-tauri/src/sessions/model.rs` (`SessionSummary`).
- `src-tauri/src/db/sessions.rs` (`SessionRow`, `StoredRow`, `upsert`, `load_active`, `load_for_project`), `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/migrations/011_session_codex_model.sql` (Muster).
- `src-tauri/examples/gen-bindings.rs`.
- Fehlerklassen: keine einschlägig (siehe Phase 1).

## AK der Phase

1. Nach einer Antwort in „Claude“ trägt `SessionSummary.prompt_cache` `anchorAt` (Eingang der ersten Zeile dieser Antwort), `ttlMs` 3 600 000 (gemessen 1-Stunden-Cache), `tokens` (= `contextUsed` dieser Antwort), `model` (Modell der Session) und `compactedAt: null`.
2. Mehrere Zeilen derselben Antwort (`message.id` gleich) verschieben den Anker nicht; eine neue Antwort setzt ihn neu.
3. Nach `compact_boundary` ist `compactedAt` gesetzt; die nächste Antwort mit Cache-Angaben setzt es wieder auf `null`.
4. Nach App-Neustart ist `prompt_cache` unverändert da (Migration 12, Spalte `sessions.prompt_cache`).
5. In „Claude Code + LM Studio“, „Autark“ und „Codex“ bleibt `prompt_cache` unverändert (neue Werte werden nicht geschrieben).
6. ADR 033 liegt unter `docs/decisions/033-warnhinweise.md`.

## Checkliste

- [x] `src-tauri/src/prompt_cache/` (in `lib.rs` eintragen): `mod.rs` mit `pub mod model;` und `pub const TTL_5M_MS: u32 = 300_000; pub const TTL_1H_MS: u32 = 3_600_000;`; `model.rs` mit `PromptCache` aus dem Kontrakt, `#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)] #[serde(rename_all = "camelCase")]`.
- [x] Migration `src-tauri/src/db/migrations/012_session_prompt_cache.sql`: `ALTER TABLE sessions ADD COLUMN prompt_cache TEXT;` — in `MIGRATIONS` hinten anhängen, Länge 12.
- [x] `db/sessions.rs`: `SessionRow.prompt_cache: Option<PromptCache>`; `StoredRow.prompt_cache: Option<String>` (Spalte 23, in `read`); `into_row`: `prompt_cache: self.prompt_cache.as_deref().and_then(|json: &str| serde_json::from_str(json).ok())`; `upsert`: Spalte `prompt_cache` als `?21` in `INSERT` und `prompt_cache = excluded.prompt_cache` in `DO UPDATE`, Wert `row.prompt_cache.as_ref().and_then(|cache: &PromptCache| serde_json::to_string(cache).ok())`; `load_active` und `load_for_project`: `prompt_cache` als letzte Spalte im `SELECT`. Jede Stelle, die `SessionRow { … }` baut, bekommt das Feld (der Compiler zeigt sie; `row_of` setzt `state.prompt_cache.clone()`).
- [x] `SessionState`: `prompt_cache: Option<PromptCache>` und `cache_message_id: Option<String>` (nur Speicher). Neue Session: beide `None`; geladene Session: `prompt_cache = row.prompt_cache`, `cache_message_id = None`. `start_process`: `cache_message_id = None` (neben `translator = Translator::default()`).
- [x] `SessionState::is_claude_process(&self) -> bool { self.process_mode == OperatingMode::Claude && self.process_backend.is_none() }` (Doc-Kommentar: Cache, Kosten, Kontingent live und Modell-Ausweichen gibt es nur hier, ADR 033).
- [x] `apply_event`, Zweig `CacheUsed { message_id, tokens, written_5m, written_1h }` → neue Methode `note_prompt_cache`:
  1. `if !self.is_claude_process() { return; }`
  2. `ttl_ms` = `TTL_1H_MS` wenn `written_1h > 0`, sonst `TTL_5M_MS` wenn `written_5m > 0`, sonst bisheriger `prompt_cache.ttl_ms`, sonst `TTL_5M_MS`.
  3. Neue Antwort = `message_id.is_none() || message_id != self.cache_message_id`; dann `anchor_at = now_ms()` und `self.cache_message_id = message_id`; sonst bisheriger `anchor_at` (ohne bisherigen Wert: `now_ms()`).
  4. `next = PromptCache { anchor_at, ttl_ms, tokens, model: self.model, compacted_at: None }`; nur wenn `Some(&next) != self.prompt_cache.as_ref()`: übernehmen und `outbox.summary_dirty = true`.
- [x] `apply_event`, Zweig `Compacted { .. }`: wenn `prompt_cache` vorhanden: `compacted_at = Some(now_ms())`, `summary_dirty = true`. (Der Verlaufseintrag kommt in Phase 4; den Zweig so schreiben, dass Phase 4 nur ergänzt.)
- [x] `SessionSummary.prompt_cache: Option<PromptCache>` mit Doc-Kommentar; `summarize` setzt `state.prompt_cache.clone()`.
- [x] `gen-bindings.rs`: `PromptCache` exportieren; `pnpm bindings`.
- [x] ADR 033 „Warnhinweise“ (`docs/decisions/033-warnhinweise.md`, Form wie ADR 032): Kontext (die Kommandozeile liefert Cache-, Kontingent- und Hinweiszeilen, der Verwalter warf sie weg; Messung vom 2026-10-21), Optionen (Ort des Cache-Zustands: Core mit Zeitgeber / nur Oberfläche / Core speichert + Oberfläche rechnet; Eintragsart: `Error` / je Hinweis eine / eine `Notice`), Entscheidung (die Punkte aus README „Festgelegte Entscheidungen“ zu Betriebsart, Cache-Zustand, Speicherung, Anker, Kalt), Konsequenzen (Pille nach Neustart richtig; Annahme, dass ein mit `--resume` neu gestarteter Agent den Cache trifft — Smoke 1).
- [x] `docs/code-map.md`: Feature `promptcache` in die Feature-Liste; Tabellenzeile „Prompt-Cache (Zustand je Session)“ mit Core `src-tauri/src/prompt_cache/`, `note_prompt_cache` und `is_claude_process` in `sessions/registry.rs`, Spalte `sessions.prompt_cache`; Zeile „Persistenz“ um „Migration 12 = `sessions.prompt_cache`“.
- [x] `docs/glossary.md`: „**Prompt-Cache** — Claude hält den bisherigen Verlauf einer Session nach jeder Antwort eine Zeit lang bereit (gemessen 1 Stunde, sonst 5 Minuten); die nächste Nachricht liest ihn dann günstig, statt ihn neu zu schreiben. Gilt nur für ein Modell; abgelaufen, nach einem Modellwechsel oder nach einer Zusammenfassung ist er „kalt“. Im Code `prompt_cache` ([ADR 033](decisions/033-warnhinweise.md)).“
- [x] `pnpm check` grün; Commit `feat(notices): Prompt-Cache je Session festhalten und speichern`.

## Report-Back

**Status:** complete. `pnpm check` einzeln grün (Lint ohne den fremden Ordner `docs/planning/2026-10-21_mitgelieferte-befehle/`, dessen `codex-probe.cjs` ESLint zum Absturz bringt — nicht Teil dieser Phase).

- Neu: `src-tauri/src/prompt_cache/` (`PromptCache`, Haltedauern), Migration 12, `SessionRow`/`StoredRow`/`upsert`/Laden mit `prompt_cache`, `SessionState.prompt_cache` + `cache_message_id`, `is_claude_process`, `note_prompt_cache`, `note_compaction`, `SessionSummary.prompt_cache`, Binding `PromptCache.ts`, ADR 033, Code-Map, Glossar.
- Abweichung: `note_compaction` als eigene Methode statt Inline-Zweig (lesbarer, Phase 4 ergänzt dort den Verlaufseintrag).
- Nicht im Live-Lauf geprüft (keine Tests im Projekt): Anker/Haltedauer gegen eine echte Antwort, Speichern und Laden über einen App-Neustart. Unsicherste Stelle: `note_prompt_cache` bei `message_id == None` (jede Zeile setzt den Anker neu) — betrifft laut Messung nur Zeilen ohne `message.id`.
