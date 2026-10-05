# Plan: Claude-Konto in den Einstellungen

Die Einstellungsseite zeigt, mit welchem Konto die Claude-Kommandozeile angemeldet ist, und bietet „Konto wechseln“ an. Gewechselt wird nicht in der App, sondern über die Anmeldung der Kommandozeile selbst (`claude auth login`).

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | Core: Konto lesen, Anmeldung starten, Ereignis | standard | pending |
| 2 | Oberfläche: Abschnitt „Konto“, Doku, ADR 021 | standard | pending |

## Entscheidungen (fallen hier, nicht beim Umsetzen)

- **Quelle des Kontos:** `claude auth status --json` (Kommandozeile 2.1.284 geprüft). Ausgabe-Felder: `loggedIn` (bool), `authMethod` (z. B. `claude.ai`), `email`, `orgName`, `subscriptionType` (z. B. `pro`), dazu weitere, die wir ignorieren. Fehlende Felder sind `None`, kein Fehler.
- **Wechseln:** `claude auth login` ohne weitere Argumente (Standard `--claudeai` = Abo). Unter Windows **in einem eigenen sichtbaren Konsolenfenster** (`CREATE_NEW_CONSOLE` = `0x0000_0010`), damit Adresse und eine etwaige Code-Eingabe für den Nutzer sichtbar sind; Schließen des Fensters bricht ab. Unter macOS/Linux ohne Fenster, Ein-/Ausgaben auf `null` (der Browser öffnet sich von selbst). Die App wartet in einem Thread auf das Ende, liest danach das Konto neu und stößt das Kontingent mit `force = true` an.
- **Nie zwei Anmeldungen gleichzeitig:** `AccountService` hält `is_logging_in`; ein zweiter Klick tut nichts.
- **Kein Abmelden-Knopf** — nicht beauftragt; `claude auth login` ersetzt die Anmeldung.
- **Feature-Name `account`** nach dem Namensschema der Code-Map.
- **Design:** kein Mockup für diese Zeile; gebaut als neuer erster Abschnitt „Konto“ der bestehenden Einstellungsseite mit `SettingRow`, wie die übrigen Zeilen.

## Kontrakt (Core ↔ Oberfläche)

```rust
// src-tauri/src/account/model.rs — beide derive(Debug, Clone, Serialize, TS), rename_all camelCase
pub struct AccountInfo {
    pub logged_in: bool,
    pub email: Option<String>,
    pub org_name: Option<String>,
    /// `subscriptionType`, z. B. `pro`.
    pub plan: Option<String>,
    /// `authMethod`, z. B. `claude.ai`.
    pub auth_method: Option<String>,
}
pub struct AccountStatus {
    /// Letzter erfolgreich gelesener Stand; `None` vor dem ersten Lesen oder wenn es scheiterte.
    pub info: Option<AccountInfo>,
    pub error: Option<String>,
    pub is_logging_in: bool,
}
```

Commands: `account_load() -> AccountStatus` (liest neu, blockiert bis zu 15 s), `account_login() -> ()` (startet, kehrt sofort zurück). Ereignis `account://changed` (ohne Nutzlast) bei Start und Ende der Anmeldung.

## Phase 1 — Core

Kontext: `src-tauri/src/usage/mod.rs` (Muster Service + Thread + Ereignis), `src-tauri/src/usage/model.rs`, `src-tauri/src/agents/claude/locate.rs` (`find_claude`), `src-tauri/src/processes/mod.rs` (`hide_console`), `src-tauri/src/commands/usage.rs`, `src-tauri/src/lib.rs`, `src-tauri/examples/gen-bindings.rs`, `docs/conventions/rust.md`. Fehlerklassen geprüft: keine einschlägig.

AK:
- `account_load` liefert bei angemeldeter Kommandozeile `info.loggedIn = true` mit E-Mail und Abo; ohne gefundene Kommandozeile `error = "Claude-Kommandozeile nicht gefunden"`; nach 15 s ohne Antwort wird der Prozess beendet und `error` gesetzt.
- `account_login` öffnet unter Windows ein Konsolenfenster mit der Anmeldung; nach dessen Ende kommt `account://changed`, `is_logging_in` ist wieder `false`, das Kontingent wird neu abgerufen.
- `pnpm check` grün.

- [ ] `src-tauri/src/account/model.rs` mit den Typen aus dem Kontrakt.
- [ ] `src-tauri/src/account/mod.rs`: `AccountService` (Mutex mit `info`, `error`, `is_logging_in`), `pub const ACCOUNT_CHANGED_EVENT = "account://changed"`, `load(&self) -> AccountStatus` (ruft `read_status`, merkt sich Ergebnis), `login(&self, app: &AppHandle)` (Muster `UsageService::refresh`: Flag setzen, Ereignis, Thread `account-login` startet und wartet; danach Flag zurück, `read_status` speichern, Ereignis, `app.state::<UsageService>().refresh(app, true)`).
- [ ] `read_status(exe)`: `claude auth status --json`, `hide_console`, stdout gepipt, stderr `null`; Warten mit Zeitlimit 15 s über Thread + `mpsc::recv_timeout` (Muster `helper::exchange`), bei Zeitlimit `kill` + `wait`. JSON mit `serde_json::Value` lesen, Felder einzeln als `as_str`/`as_bool`.
- [ ] `login_command(exe)`: Windows `creation_flags(0x0000_0010)` statt `hide_console`; sonst `Stdio::null()` für alle drei. Die Konstante samt Plattformweiche gehört nach `src-tauri/src/processes/mod.rs` als `pub fn show_console(command: &mut Command)` (Gegenstück zu `hide_console`).
- [ ] `src-tauri/src/commands/account.rs`: `account_load`, `account_login` (`async`, Kommentar wie in `usage.rs`); in `commands/mod.rs` und `lib.rs` registrieren, `app.manage(AccountService::new())`, `pub mod account;` in `lib.rs`.
- [ ] `gen-bindings.rs`: `AccountInfo`, `AccountStatus` exportieren; `pnpm bindings`.

## Phase 2 — Oberfläche und Doku

Kontext: `src/lib/usage.ts`, `src/features/usage/useUsage.ts` (Muster Abo + Nachladen), `src/features/settings/SettingsView.tsx` + `.css`, `src/features/settings/SettingRow.tsx`, `src/features/usage/UsagePopover.tsx` (`capitalize`), `src/lib/labels.ts`, `docs/conventions/react.md`, `docs/conventions/tailwind.md`.

AK:
- Abschnitt „Konto“ steht als erster Abschnitt der Einstellungen mit der Zeile „Claude-Konto“: angemeldet → E-Mail und `Abo: Pro` (Organisation im `title` der E-Mail); nicht angemeldet → „Nicht angemeldet“; Fehler → Fehlersatz in der Zeile. Knopf „Konto wechseln“ bzw. „Anmelden“.
- Während der Anmeldung: Knopf deaktiviert mit „Anmeldung läuft …“, darunter „Im Konsolenfenster und im Browser fortfahren.“
- ⓘ-Text: „Das Konto, mit dem die Claude-Kommandozeile angemeldet ist. „Konto wechseln“ startet deren Anmeldung (claude auth login) in einem eigenen Fenster und im Browser; Schließen des Fensters bricht ab. Gilt für jeden Agenten, der danach startet.“
- `pnpm check` grün.

- [ ] `src/lib/account.ts`: `loadAccount()`, `startAccountLogin()`, `onAccountChanged(cb)` (Muster `src/lib/usage.ts`).
- [ ] `src/features/account/useAccount.ts`: erst abonnieren, dann laden; jüngste Antwort gewinnt (Muster `useUsage`, ohne Intervall); liefert `{ status, isLoading, login }`.
- [ ] `src/features/account/AccountRow.tsx` (+ `AccountRow.css`, BEM `account-row`) rendert die `SettingRow` aus der AK; Knopf-Klasse wie `settings-view__button`.
- [ ] `planLabel(plan: string): string` in `src/lib/labels.ts` (erster Buchstabe groß); `UsagePopover` nutzt es statt seines `capitalize`, falls dieses nur dort dafür dient.
- [ ] `SettingsView.tsx`: Abschnitt „Konto“ vor „Darstellung“.
- [ ] Doku: Zeile „Konto (Claude-Anmeldung)“ in `docs/code-map.md` + Feature-Liste; Begriff „Claude-Konto“ in `docs/glossary.md`; `docs/decisions/021-claude-konto.md` (Kontext / Optionen: eigenes OAuth vs. Kommandozeile, verstecktes vs. sichtbares Fenster / Entscheidung / Konsequenzen).

## Smoke-Checkliste (Abgleich macht Sascha)

1. **Wackelstelle:** „Konto wechseln“ → Konsolenfenster erscheint, Browser öffnet sich; mit anderem Konto anmelden → Fenster schließt, Zeile zeigt das neue Konto ohne Neuladen.
2. **Wackelstelle:** Konsolenfenster mitten in der Anmeldung schließen → Knopf wird wieder aktiv, altes Konto steht noch da (falls die Kommandozeile schon vorher abmeldet: „Nicht angemeldet“ — dann notieren).
3. **Wackelstelle:** Nach dem Wechsel eine Nachricht in einer Session senden, deren Agent schon lief → in der Kontingent-Anzeige prüfen, welches Abo gilt.
4. Einstellungen öffnen → E-Mail und Abo erscheinen innerhalb weniger Sekunden.
5. Doppelklick auf „Konto wechseln“ → nur ein Fenster.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
