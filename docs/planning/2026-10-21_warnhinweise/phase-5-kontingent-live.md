# Phase 5 — Kontingent live

## Kontext

Lesen: [README.md](README.md) (Abschnitt „Belegt“ zu `rate_limit_event`; Entscheidungen „Kontingent live“, „Leiste ohne Knopf Details“; Kontrakt `RateLimitInfo`, `UsageAlert`; AK 5), Entwurf [artifacts/warnhinweise-entwurf.html](artifacts/warnhinweise-entwurf.html) (Fall „Kontingent knapp“, Markierung 5), [ADR 008](../../decisions/008-kontext-und-kontingent.md).

Code-Stellen:

- `src-tauri/src/usage/mod.rs` (`UsageService`, `UsageCache`, `status`, `restart`, `emit_changed`), `src-tauri/src/usage/model.rs` (`UsageLimit.kind` `session`/`weekly_all`, `UsageStatus`).
- `src-tauri/src/codex/rate_limits.rs` (`iso_utc(seconds: u64) -> String` — Sekunden in ISO-8601 UTC; für diese Phase `pub(crate)` machen und wiederverwenden).
- `src-tauri/src/sessions/registry.rs`: `Outbox` (Felder, `emit`), `apply_event` (Zweig `RateLimit` aus Phase 1), `is_claude_process`.
- Oberfläche: `src/app/App.tsx` (`<SessionActionError sessionId=… />` direkt unter `<SessionHeader>`), `src/app/SessionActionError.tsx` (Muster einer Zeile unter der Kopfzeile), `src/features/usage/useUsage.ts`, `src/features/usage/usageTexts.ts` (`formatResetAt`), `src/lib/usage.ts` (`loadUsage`, `onUsageChanged`).
- Fehlerklassen: keine einschlägig.

## AK der Phase

1. Nach jeder Antwort in „Claude“ zeigt die Kontingent-Anzeige der Kopfzeile sofort den Wert aus `unifiedWindows.five_hour.utilization` (× 100, gerundet), ohne Öffnen des Fensters und ohne Hilfsprozess; das Fenster zeigt die Woche aus `seven_day` ebenso aktuell.
2. Ist `status` nicht `allowed`, steht zwischen Kopfzeile und Chat eine Leiste: Hintergrund `--color-status-error-subtle`, Warndreieck in `--color-status-error`, Schrift 12.5 px. Bei `rejected`: „**Kontingent aufgebraucht:** <Fenster>. Es setzt sich <formatResetAt> zurück.“ Sonst: „**Kontingent fast aufgebraucht:** <p> % des <Fenster>. Es setzt sich <formatResetAt> zurück.“ (Teile ohne Wert entfallen). Fenster: `five_hour` → „5-Stunden-Fensters“ bzw. „5-Stunden-Fenster“, `seven_day` → „Wochenfensters“ bzw. „Wochenfenster“, sonst der Rohwert. Rechts Knopf „Ausblenden“.
3. „Ausblenden“ blendet genau diese Warnung aus; eine neue Warnung (anderer Status, anderes Fenster oder andere Rücksetzzeit) erscheint wieder. Ein `allowed` lässt die Leiste verschwinden.
4. Wechsel der Betriebsart löscht die Warnung (`restart`). In „Codex“, „Autark“ und „Claude Code + LM Studio“ keine Leiste.

## Checkliste

- [ ] `usage/model.rs`: `UsageAlert` aus dem Kontrakt (`Serialize, TS`, camelCase), `UsageStatus.alert: Option<UsageAlert>`.
- [ ] `usage/mod.rs`: `UsageCache.alert: Option<UsageAlert>`; `status()` gibt ihn mit; `restart()` setzt ihn auf `None`. Neue Methode `pub fn apply_rate_limit(&self, app: &AppHandle, info: &RateLimitInfo)`: unter der Sperre — gibt es einen `snapshot`, setze im Eintrag `kind == "session"` `percent` aus `info.five_hour` und im Eintrag `kind == "weekly_all"` aus `info.seven_day` (je `(anteil * 100.0).round()` begrenzt auf 0–100, nur wenn der Anteil vorhanden ist); `alert` = `None` bei `status == "allowed"`, sonst `UsageAlert { status, limit_kind: rate_limit_type, percent: Anteil des Fensters `rate_limit_type` (`five_hour` → `five_hour`, `seven_day` → `seven_day`, sonst `None`) × 100 gerundet, resets_at: resets_at → `iso_utc` }`; danach `emit_changed(app)`.
- [ ] `registry.rs`: `Outbox.rate_limit: Option<RateLimitInfo>`; Zweig `AgentEvent::RateLimit(info)` → `if self.is_claude_process() { outbox.rate_limit = Some(info); }` (ohne `wake_if_idle`); `Outbox::emit`: `if let Some(info) = &self.rate_limit { app.state::<UsageService>().apply_rate_limit(app, info); }`.
- [ ] `pnpm bindings`.
- [ ] `src/stores/usage.ts` (neu, Zustand, nur flüchtig): `dismissedAlertKey: string | null`, `dismissAlert(key: string): void`.
- [ ] `src/features/usage/useUsageAlert.ts`: lädt `loadUsage()` beim Einhängen und bei jedem `onUsageChanged`, gibt `status.alert` zurück — **ohne** eigenes `refreshUsage` (das macht `UsageButton`/`useUsage`); Muster für Abo und „nur die jüngste Antwort zählt“ aus `useUsage.ts`.
- [ ] `src/features/usage/UsageAlertBar.tsx` + `.css` (BEM `usage-alert-bar`): laut AK 2/3; Schlüssel `${status}:${limitKind ?? ''}:${resetsAt ?? ''}`; `role="status"`; Texte in `usageTexts.ts` (`alertText(alert, now)`, Fensternamen).
- [ ] `App.tsx`: direkt nach `<SessionActionError … />` `{isClaude && <UsageAlertBar />}` (Betriebsart aus `useSettingsStore`).
- [ ] `docs/code-map.md`: Zeile „Kontingent“ um `apply_rate_limit` (Werte aus `rate_limit_event`), `UsageAlertBar`, `useUsageAlert`, `src/stores/usage.ts`.
- [ ] ADR 033: Abschnitt Kontingent live; [ADR 008](../../decisions/008-kontext-und-kontingent.md) bekommt unter „Konsequenzen“ einen Satz mit Verweis auf ADR 033 (Werte kommen zusätzlich live aus den Antworten).
- [ ] `pnpm check` grün; Commit `feat(usage): Kontingent live aus jeder Antwort, Leiste bei Warnung`.

## Report-Back
