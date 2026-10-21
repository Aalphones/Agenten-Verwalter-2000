# Phase 6 — Verlauf Teil 2: Modell-Ausweichen, Hinweise, Moduswechsel, Antwort-Abschluss

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Modell-Ausweichen“, „Moduswechsel“, „Hinweise“, „Antwort-Abschluss“; Kontrakt `Notice`, `SessionSummary.fallback_model`/`fallback_model_id`; AK 6–8), Entwurf [artifacts/warnhinweise-entwurf.html](artifacts/warnhinweise-entwurf.html) (Fälle „Modell-Ausweichen“ und „Weitere Hinweise“; Markierungen 6–9), Phase 4 (Bausteine `NoticeBlock`, `NoticeLine`).

Code-Stellen:

- `src-tauri/src/notices/model.rs` (`Notice`, `Denial`), `src-tauri/src/agents/event.rs` (`ModelId::cli_id`, `Mode::cli_value`).
- `src-tauri/src/sessions/registry.rs`: `apply_event` (Zweige `ModelFallback`, `Info`, `PermissionMode`, `TurnEnded`), `end_turn`, `set_model`, `start_process` (bei `translator = Translator::default()`), `summarize`.
- `src-tauri/src/sessions/model.rs` (`SessionSummary`).
- Oberfläche: `src/features/notices/` (Phase 4), `src/features/chat/ChatTimeline.tsx`, `src/features/chat/Composer.tsx` (`modelLabel`, `composer__model`), `src/lib/labels.ts` (`modelName`, `modeOption`), `src/lib/sessions.ts` (`setSessionModel`).
- **Fehlerklasse `werkzeuge/claude-code` → „Fortsetzungen melden den Gesamtstand, nicht den Zuwachs“:** `total_cost_usd` ist prozessweit aufsummiert (gemessen 0.0794 → 0.159). Prüfpunkt: die Kosten je Antwort sind die Differenz zum letzten Wert desselben Prozesses, nie die Summe — prüfen per Smoke 8 (zwei kurze Antworten hintereinander zeigen ähnliche, nicht wachsende Beträge).

## AK der Phase

1. **Modell-Ausweichen (6):** Zeile `--warn`: Schild-Symbol, **„Sicherheitsfilter hat eine Nachricht markiert.“** „Claude antwortet ab hier mit <Ersatz> statt <Original>.“ (bei `direction == "revert"`: **„Zurück beim ursprünglichen Modell.“** „Claude antwortet wieder mit <Original>.“); liefert Claude einen Text (`content`), steht er klein darunter. Knopf „Mit <Original> weiter“, wenn `originalId` bekannt und `direction != "revert"`. Solange das Ersatzmodell gilt, zeigt die Eingabeleiste „<Ersatz> · Ersatz“ in `--color-status-waiting` mit `title` „Claude ist nach einer Markierung durch den Sicherheitsfilter auf dieses Modell ausgewichen. Wähle ein Modell, um zurückzuwechseln.“
2. **Hinweis (7):** Zeile `--info` mit i-Symbol, **„Hinweis von Claude Code:“** + Text.
3. **Moduswechsel (7):** Zeile `--info` mit Schloss-Symbol, **„Modus geändert:“** „von <Label alt> auf <Label neu>.“; die Eingabeleiste zeigt danach den neuen Modus. Ein selbst gewählter Modus erzeugt keine Zeile.
4. **Antwort-Abschluss (8, 9):** am Ende einer Antwort eine kleine Zeile (11.5 px, `--color-fg-muted`): bei abgelehnten Aufrufen ein aufklappbares „<n> Aufruf(e) abgelehnt ▸“ in `--color-status-waiting` mit Liste „<Werkzeug> <Ziel>“; in „Claude“ daneben „≈ <Betrag> $ Rechenwert“ (zwei Nachkommastellen, deutsches Komma; unter 0,01 „< 0,01 $ Rechenwert“) mit `title` „Rechenwert der Claude-Kommandozeile zum Listenpreis; beim Abo kein echter Betrag.“
5. Alles überlebt einen App-Neustart (außer der Ersatz-Anzeige in der Eingabeleiste: ein neu gestarteter Agent läuft wieder mit dem Modell der Session).

## Checkliste

- [ ] `agents/event.rs`: `impl ModelId { pub fn from_cli_id(id: &str) -> Option<ModelId> }` über alle Varianten und `cli_id()`.
- [ ] `notices/model.rs`: Varianten `ModelFallback { original_model, original_id, fallback_model, fallback_id, direction, text }`, `Info { text }`, `ModeChanged { from: Mode, to: Mode }`, `TurnSummary { denials: Vec<Denial>, cost_usd: Option<f64> }` (Kontrakt).
- [ ] `SessionState`: `fallback_model: Option<String>`, `last_total_cost: f64` (beide nur Speicher). `start_process`: beide zurücksetzen (`None`, `0.0`). `set_model`: `fallback_model = None`. `SessionSummary`: `fallback_model`, `fallback_model_id` (`fallback_model.as_deref().and_then(ModelId::from_cli_id)`), `summarize` setzt beide.
- [ ] `apply_event`:
  - `ModelFallback { original_model, fallback_model, direction, text }` → `push_entry` mit `Notice::ModelFallback` (IDs über `from_cli_id`); `direction` `"retry"`/`"sticky"` → `self.fallback_model = Some(fallback_model)`, `"revert"` → `None`; `summary_dirty`.
  - `Info(text)` → `push_entry` mit `Notice::Info { text }`.
  - `PermissionMode(raw)` → `mode_of_cli(&raw)` (neue Funktion: `default`→`Manual`, `acceptEdits`→`Edit`, `plan`→`Plan`, `auto`→`Auto`, sonst `None`); bei `Some(mode)` und `mode != self.mode`: `push_entry` mit `Notice::ModeChanged { from: self.mode, to: mode }`, `self.mode = mode`, `summary_dirty`.
  - `TurnEnded { end, context_window, denials, total_cost_usd }` → `end_turn(outbox, end, context_window, denials, total_cost_usd)`.
- [ ] `end_turn`: nach der Prüfung `if self.cancel_requested { return; }` und vor dem `match end`: `cost_usd` nur bei `is_claude_process()`: `let delta = match total_cost_usd { Some(total) if total >= self.last_total_cost => total - self.last_total_cost, Some(total) => total, None => 0.0 };` dann `if let Some(total) = total_cost_usd { self.last_total_cost = total; }`, `cost_usd = (delta > 0.0).then_some(delta)`. Gibt es `denials` oder `cost_usd`, `push_entry` mit `Notice::TurnSummary`.
- [ ] `gen-bindings.rs` unverändert (Varianten hängen an `Notice`); `pnpm bindings`.
- [ ] Oberfläche `src/features/notices/`: `NoticeBlock` um die vier Varianten; `TurnSummaryLine.tsx` + `.css` (BEM `turn-summary`, `<details>`/`<summary>` für die Liste); Knopf „Mit <Original> weiter“ ruft `setSessionModel(sessionId, originalId)`, Fehler über `useSessionErrorsStore.report` (Muster `ErrorBlock`); `NoticeBlock` bekommt dafür `sessionId`. Texte in `noticeTexts.ts`; Betrag mit `Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- [ ] `Composer.tsx`: im Claude-Zweig (`!isCodex && !isLocal`) bei `session.fallbackModel !== null` Label `${fallbackModelId ? modelName(fallbackModelId) : fallbackModel} · Ersatz`, Klasse `composer__model--fallback` (Farbe `--color-status-waiting`), `title` laut AK 1.
- [ ] `docs/code-map.md`: Zeile „Hinweise im Verlauf“ um die neuen Varianten, `fallback_model`, `last_total_cost`, `mode_of_cli`, `TurnSummaryLine`.
- [ ] `docs/glossary.md`: „**Modell-Ausweichen** — Claude wechselt nach einer Markierung durch den Sicherheitsfilter selbst auf ein anderes Modell; die Eingabeleiste zeigt das Ersatzmodell, bis der User ein Modell wählt oder der Agent neu startet.“
- [ ] `docs/knowledge/claude-stream-json.md`: Messwerte aus den Smoke-Läufen nachtragen, soweit vorhanden.
- [ ] ADR 033 vervollständigen (Abschnitte Modell-Ausweichen, Moduswechsel, Hinweise, Antwort-Abschluss).
- [ ] `pnpm check` grün; Commit `feat(notices): Modell-Ausweichen, Hinweise, Moduswechsel und Antwort-Abschluss im Verlauf`.

## Report-Back
