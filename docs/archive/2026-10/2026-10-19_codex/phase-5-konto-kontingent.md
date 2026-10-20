# Phase 5 — Konto und Kontingent

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Konto“, „Kontingent“; Probe-Ergebnis: nur `primary`, 43 200 Minuten), [ADR 008](../../decisions/008-kontext-und-kontingent.md), [ADR 021](../../decisions/021-claude-konto.md).

Code-Stellen:

- `src-tauri/src/account/` (`AccountService`, `login`, `finish_login`, `refresh_usage`, `emit_changed`), `commands/account.rs`, `src/features/account/` (`AccountRow`, `useAccount`), `src/lib/account.ts`, `planLabel` in `src/lib/labels.ts`.
- `src-tauri/src/usage/` (`UsageService::refresh`, `fetch`, `model.rs`), `src/features/usage/` (`UsageButton`, `UsagePopover`, `usageTexts.ts`), `src/app/SessionHeader.tsx` (Kontingent nur bei Claude).
- Öffnen einer Adresse: Opener-Plugin wie in `commands/file_links.rs` bzw. die Outbox in `registry.rs` (MCP-Anmeldung öffnet eine Seite).
- `codex/rpc.rs` aus Phase 1.

Fehlerklassen geprüft: keine einschlägig.

## AK der Phase

1. Einstellungen: unter „Claude-Konto“ eine Zeile „Codex-Konto“ (in jeder Betriebsart sichtbar) mit E-Mail und Abo (`planType`, über `planLabel` bzw. neue Bezeichnungen für `go`, `plus`, `pro`, `team`, `business`, `enterprise`, `edu`, sonst der Rohwert) bzw. „Nicht angemeldet“; Fehler als Satz in der Zeile.
2. „Anmelden“ öffnet die Anmeldeseite im Standardbrowser; die Zeile zeigt „Anmeldung läuft …“, bis `account/login/completed` kommt (höchstens 10 Minuten, danach Abbruch mit `account/login/cancel` und Satz); danach Konto neu lesen und Kontingent mit `force` neu abrufen. Ein zweiter Klick während der Anmeldung tut nichts. Das i-Symbol erklärt: „Meldet Codex mit deinem ChatGPT-Konto an; gilt für alle Codex-Sessions ab der nächsten Nachricht.“
3. In „Codex“ zeigt die Session-Kopfzeile das Kontingent aus `account/rateLimits/read`; jedes Fenster heißt nach seiner Dauer: 300 min → „5-Stunden-Fenster“, 10 080 → „Wochenfenster“, sonst ganze Tage → „<n>-Tage-Fenster“, sonst „<n>-Stunden-Fenster“.
4. In „Claude“ ist das Kontingent unverändert.

## Checkliste

- [x] `codex/helper.rs`: `fn with_server<T>(f: impl FnOnce(&Rpc) -> Result<T, String>) -> Result<T, String>` — `find_codex`, `codex app-server` starten (Arbeitsordner `%USERPROFILE%\.verwalter`), `initialize`/`initialized`, `f`, beenden; Gesamtzeitlimit 20 s. Phase 4 `codex_models` darauf umstellen.
- [x] `src-tauri/src/codex_account/` (eigenes Feature, Muster `account/`): `CodexAccountService` mit `load` (`account/read` → `AccountInfo {logged_in: account != null, email, plan: planType, org_name: None, auth_method: Some("chatgpt"|"apiKey")}`), `login(app)`: eigener Thread, Server bleibt bis zum Ende offen, `account/login/start {type:"chatgpt"}` → `authUrl` öffnen, auf Benachrichtigung `account/login/completed` warten (10 min), Ergebnis wie `finish_login`; Ereignis `codex-account://changed`. Commands `codex_account_load`, `codex_account_login` in `commands/codex_account.rs`, registrieren in `lib.rs`, State im Setup.
- [x] `usage/model.rs`: `UsageLimit.window_minutes: Option<u32>` (Claude: `None`). `usage/mod.rs` `fetch`: Betriebsart lesen; „Codex“ → `codex::helper::with_server` + `account/rateLimits/read` → `UsageSnapshot {plan: planType, limits: [primary, secondary] vorhandene je `UsageLimit {kind: "codex", percent: usedPercent, severity: "normal", resets_at: resetsAt (Sekunden) als ISO-8601 UTC, window_minutes}`, day/week: None}`. Der Zwischenspeicher gilt je Betriebsart: beim Wechsel der Betriebsart (`settings::update` mit `OperatingMode`) Kontingent mit `force` neu abrufen.
- [x] `pnpm bindings`.
- [x] Oberfläche: `src/features/codexaccount/` (`CodexAccountRow`, `useCodexAccount`) nach Muster `AccountRow`/`useAccount`, Wrapper `src/lib/codexAccount.ts`; in `SettingsView` direkt unter „Claude-Konto“.
- [x] `usageTexts.ts`: Bezeichnung aus `windowMinutes` gemäß AK 3, wenn gesetzt; `SessionHeader`: Kontingent bei `claude` und `codex`.
- [x] `docs/code-map.md`: Zeile „Codex-Konto“, Zeile Kontingent um den Codex-Zweig.
- [x] ADR 031: Abschnitt Konto/Kontingent.

## Report-Back

Status: complete. `pnpm check` grün; `account/read` und `account/rateLimits/read` gegen das echte Codex (`0.162.0-alpha.2`, Erweiterung 26.1007) gelesen, Formen stimmen mit den Parsern überein (`primary` 43 200 Minuten, `secondary: null`, `planType: go`). Der Anmelde-Rundlauf (`account/login/start` → Browser → `account/login/completed`) ist nur gegen das Schema gebaut, nicht live gelaufen — Smoke 6.

Abweichungen:
- `UsageLimit.kind` heißt `codex_primary`/`codex_secondary` statt zweimal `codex`: die Oberfläche nutzt `kind` als React-Schlüssel, und die Bezeichnung kommt ohnehin aus `windowMinutes`.
- `UsageService` bekommt einen Zähler für Wechsel der Betriebsart (`restart`), damit ein Abruf, der vor dem Wechsel begann, den Stand der neuen Betriebsart nicht überschreibt; `settings_update` ruft ihn bei einem Wechsel nach „Claude“ oder „Codex“.
- `useAccount` und `AccountRow` sind in `useAccountSource`/`AccountRowView` aufgeteilt, die Claude- und Codex-Zeile teilen.
- `with_listening_server` neben `with_server`: die Anmeldung braucht Benachrichtigungen und mehr als 20 s.
