# Plan: Browser-Zugriff (Claude in Chrome)

Der User soll einer Session per Schalter erlauben können, seinen echten Chrome-Browser zu bedienen — das, was im Terminal `claude --chrome` und `/chrome` tun. Der Verwalter startet den Agenten dafür mit `--chrome` und ersetzt den interaktiven Befehl `/chrome` durch einen eigenen Schalter.

| Phase | Inhalt | Komplexität | Status |
|---|---|---|---|
| 1 | Core: Zustand speichern, Startargument, Neustart, Befehl | standard | pending |
| 2 | Oberfläche: Schalter in der Eingabeleiste, `/chrome` im Befehlsmenü, Doku | standard | pending |

## Belegte Grundlagen

Am 2026-10-19 mit Claude Code 2.1.293 gemessen:

- `claude --help` kennt `--chrome` („Enable Claude in Chrome integration“) und `--no-chrome`.
- `claude -p --chrome --output-format stream-json --verbose` meldet in `system/init` den MCP-Server `claude-in-chrome` (Status `connected`, Herkunft `dynamic`) samt 22 Werkzeugen `mcp__claude-in-chrome__*`. Der Druckmodus, den der Verwalter fährt, trägt die Option also.
- `/chrome` steht im Druckmodus **nicht** in `slash_commands`. Der Befehl ist interaktiv und kommt beim Agenten nicht an. Deshalb fängt der Verwalter ihn selbst ab.

## Entscheidungen (ADR 030)

- **Ein Wert pro Session**, `chrome: bool`, Standard `false`. Neue Sessions starten immer ohne Browser. Eine Übergabe an eine Nachfolge-Session erbt ihn nicht.
- **Nur im Claude-Betrieb.** Bei LM Studio und beim autarken Agenten setzt der Core nichts, und die Oberfläche zeigt keinen Schalter. Der gespeicherte Wert bleibt dabei stehen.
- **Ausdrücklich in beide Richtungen:** Im Claude-Betrieb gibt der Core immer `--chrome` oder `--no-chrome` mit. So entscheidet der Schalter und nicht eine Voreinstellung in der Claude-Konfiguration des Users.
- **Wirksam beim nächsten Start**, nach dem Muster des Denkaufwands (`effort`/`process_effort`): Der Core merkt sich, mit welchem Wert der laufende Prozess gestartet wurde (`process_chrome`). Weicht der gewünschte Wert ab, startet `send` den Agenten mit `--resume` neu, aber nur wenn die Session ruht (`is_resting()`, wie beim Wechsel der Betriebsart). Ein arbeitender Agent wird nie unterbrochen.
- **`/chrome` gehört dem Verwalter:** als Zeile im Abschnitt „Session“ des Befehlsmenüs. Sie geht nie als Text an den Agenten.
- **Kein Design-Entwurf** für den Schalter. Er wird freihändig im Stil des Modus-Knopfs (`composer__mode`) gebaut.

## Finale AK

1. Eine neue Session startet ohne Browser-Zugriff, und der Agent bekommt `--no-chrome`.
2. Schalter an und Nachricht gesendet: Der Agent startet mit `--chrome`, der Verlauf bleibt erhalten (`--resume`), und die Werkzeuge `mcp__claude-in-chrome__*` stehen ihm zur Verfügung.
3. Umschalten, während der Agent arbeitet, unterbricht ihn nicht. Die Änderung greift mit der nächsten Nachricht, sobald er ruht.
4. Der Wert überlebt einen Neustart des Verwalters.
5. `/chrome` im Eingabefeld plus Enter schaltet um und schickt nichts an den Agenten.
6. In den Betriebsarten LM Studio und Autark gibt es keinen Schalter, keine `/chrome`-Zeile und keine Option am Startaufruf.
7. `pnpm check` ist grün.

## Smoke-Checkliste (macht der User)

Wackelstellen zuerst:

1. **Wackelstelle — Freigabe der Browser-Werkzeuge:** Schalter an, „Öffne example.com und lies mir die Überschrift vor“. Erwartung: Der Verwalter zeigt für die Browser-Werkzeuge seinen normalen Freigabedialog, oder sie laufen im Modus „Alles erlauben“ durch. Ein Hänger ohne Dialog ist ein Befund.
2. **Wackelstelle — Fortsetzen mit Browser:** In einer Session mit Verlauf den Schalter einschalten und eine Rückfrage zum alten Verlauf stellen. Erwartung: Der Agent kennt den Verlauf, und `/mcp` listet `claude-in-chrome`.
3. **Wackelstelle — Chrome zu oder Erweiterung fehlt:** Chrome schließen, Schalter an, Nachricht senden. Erwartung: Der Agent meldet, dass kein Browser verbunden ist. Leuchtet dafür der MCP-Problem-Chip, wird das notiert, ist aber kein Fehler.
4. Schalter während einer laufenden Antwort umlegen. Erwartung: Die Antwort läuft zu Ende, und die nächste Nachricht startet den Agenten neu.
5. Verwalter schließen und neu öffnen. Erwartung: Der Schalter steht wie vorher.
6. `/chrome` tippen und Enter drücken. Erwartung: Der Schalter kippt, das Feld ist leer, und im Chat erscheint keine Nachricht.
7. In den Einstellungen auf LM Studio wechseln. Erwartung: Schalter und `/chrome` sind weg.

## Konfidenz-Ausweis

- 🟡 **Freigabe der Browser-Werkzeuge** über `--permission-prompt-tool stdio` ist nicht gemessen. Check: Smoke 1.
- 🟡 **`--resume` zusammen mit `--chrome`** ist nicht gemessen, nur `--chrome` bei einer frischen Session. Check: Smoke 2.
- 🟡 **Status des MCP-Servers ohne laufendes Chrome** ist unbekannt (`connected` oder `failed`). Bei `failed` zählt `mcpProblems` ihn mit, und der Problem-Chip leuchtet. Check: Smoke 3. Ein Sonderfall wird erst gebaut, wenn das stört.

Fehlerklassen geprüft (`werkzeuge/claude-code`, `frameworks/react`, `sprachen/typescript`): keine einschlägig.

---

## Phase 1 — Core

### Kontext (lesen vor dem Start)

- `docs/conventions/rust.md`, `docs/conventions/linting.md`
- `src-tauri/src/agents/claude/process.rs`: `SpawnOptions`, `build_command`
- `src-tauri/src/sessions/registry.rs`: `SessionState` (Felder `effort`, `process_effort`), `SessionState::new`, `SessionState::restored`, `set_effort`, `send` (Bedingung vor `start_process`), `start_process`, `row_of`, `summarize`, die zweite `SessionRow { … }`-Stelle (bei Zeile ~1597)
- `src-tauri/src/sessions/model.rs`: `SessionSummary`
- `src-tauri/src/db/sessions.rs`: `SessionRow`, `StoredRow`, `upsert`, beide `SELECT`s
- `src-tauri/src/db/migrations.rs` und `migrations/009_session_handoff.sql` (Format einer Migration)
- `src-tauri/src/commands/sessions.rs`: `session_set_effort`; `src-tauri/src/lib.rs` (Registrierung der Befehle)
- `src-tauri/src/standalone/args.rs`: Parser des autarken Agenten. Er bekommt die Option nie und wird nicht angefasst.

### AK der Phase

- `SessionRow`, `SessionState`, `SessionSummary` tragen `chrome: bool`, und die Datenbank speichert es (Spalte `chrome`, Standard 0).
- `build_command` hängt im Claude-Betrieb (`opts.local.is_none()`) `--chrome` an, wenn `opts.chrome` gesetzt ist, sonst `--no-chrome`. Im lokalen Betrieb hängt es keins von beiden an.
- `send` startet neu, wenn `state.chrome != state.process_chrome && state.is_resting()`.
- Der Tauri-Befehl `session_set_chrome(session_id, enabled)` existiert, und `pnpm bindings` hat `SessionSummary.ts` erneuert.

### Checkliste

- [ ] Migration `src-tauri/src/db/migrations/010_session_chrome.sql`: `ALTER TABLE sessions ADD COLUMN chrome INTEGER NOT NULL DEFAULT 0;`. In `migrations.rs` als zehnten Eintrag `include_str!` hinzufügen.
- [ ] `db/sessions.rs`: `chrome: bool` in `SessionRow` (Doc: „Browser-Zugriff (Claude in Chrome) beim nächsten Start; ADR 030.“) und in `StoredRow`. Die Spalte ans Ende beider `SELECT`-Listen setzen (`row.get(21)`). In `upsert` als `?19` in `INSERT` und `VALUES` und `chrome = excluded.chrome` im `UPDATE` einfügen.
- [ ] `sessions/registry.rs` `SessionState`: die Felder `chrome: bool` und, direkt hinter `process_effort`, `process_chrome: bool` anlegen (Doc: „Wert von `chrome`, mit dem der laufende Prozess gestartet wurde.“). In `new`: beide `false`. In `restored`: `chrome = row.chrome`, `process_chrome = row.chrome`.
- [ ] `row_of` und die zweite `SessionRow { … }`-Stelle: `chrome: state.chrome`.
- [ ] `sessions/model.rs` `SessionSummary`: `pub chrome: bool` hinter `mode` (Doc: „Browser-Zugriff gewünscht; wirkt ab dem nächsten Start des Agenten.“). In `summarize` mit `state.chrome` belegen.
- [ ] `agents/claude/process.rs` `SpawnOptions`: `pub chrome: bool`. In `build_command` in den vorhandenen Block `if opts.local.is_none() { … }` zusätzlich `.arg(if opts.chrome { "--chrome" } else { "--no-chrome" })` setzen. Kommentar: „Ausdrücklich in beide Richtungen: der Schalter der Session gilt, nicht die Voreinstellung der Kommandozeile.“
- [ ] `start_process`: `chrome: state.chrome` an `SpawnOptions` übergeben. Nach `state.process_effort = state.effort;` die Zeile `state.process_chrome = state.chrome;` einfügen.
- [ ] `send`: die Bedingung vor `start_process` erweitern zu `… || ((has_new_repository || has_new_backend || state.chrome != state.process_chrome) && state.is_resting())`. Den Kommentar darüber um „ein umgelegter Browser-Zugriff“ ergänzen.
- [ ] `SessionRegistry::set_chrome(&self, app, session_id, enabled: bool)` direkt hinter `set_effort` anlegen, im selben Aufbau: `state.chrome = enabled; outbox.summary_dirty = true; Ok(())`. Doc: „Wirkt erst mit dem nächsten Start — die Kommandozeile kennt keine Steueranfrage dafür.“
- [ ] `commands/sessions.rs`: `session_set_chrome(app, registry, session_id: String, enabled: bool)` analog zu `session_set_effort` anlegen und in `lib.rs` hinter `session_set_effort` registrieren.
- [ ] Alle übrigen Stellen, die `SpawnOptions { … }` oder `SessionRow { … }` bauen, ergänzen (Compiler-Fehler zeigen sie). Tests und Beispiele setzen `chrome: false`.
- [ ] `pnpm bindings` laufen lassen, dann `pnpm check`.
- [ ] ADR `docs/decisions/030-browser-zugriff.md` (Kontext, betrachtete Optionen, Entscheidung, Konsequenzen) mit dem Inhalt des Abschnitts „Entscheidungen“ oben. Als verworfene Option festhalten: „`/chrome` als Text an den Agenten durchreichen — geht im Druckmodus ins Leere“.
- [ ] `docs/knowledge/claude-stream-json.md`: einen Abschnitt „Claude in Chrome“ mit den drei Messpunkten aus „Belegte Grundlagen“ ergänzen.

## Report-Back

---

## Phase 2 — Oberfläche und Doku

### Kontext (lesen vor dem Start)

- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`
- `src/features/chat/Composer.tsx` und `Composer.css`: Leiste `composer__bar`, Knopf `composer__mode`, `runSessionCommand`, `isLocal`, `NOTE_WHILE_ACTIVE`/`NOTE_WHILE_IDLE`
- `src/features/chat/commandMenuRows.ts`: `SessionCommand`, `SESSION_COMMAND_TEXT`, `sessionRows`, `buildCommandSections`
- `src/features/chat/useCommandMenu.ts`: Woher der Filter beim Slash-Menü kommt (mit oder ohne führendes `/`)
- `src/lib/sessions.ts`: `setSessionEffort`
- `docs/glossary.md`, `docs/code-map.md`

### AK der Phase

- In der Eingabeleiste steht im Claude-Betrieb links neben dem Modus-Knopf ein Umschaltknopf „Browser“ mit `aria-pressed`. Im Zustand „an“ ist er hervorgehoben, wie ein aktiver Zustand in `composer__mode`.
- Sein `title` erklärt die Wirkung. An: „Browser-Zugriff an — der Agent darf deinen Chrome bedienen (Erweiterung „Claude in Chrome“ nötig). Klicken schaltet ab.“ Aus: „Browser-Zugriff aus — klicken erlaubt dem Agenten, deinen Chrome zu bedienen (Erweiterung „Claude in Chrome“ nötig).“ An beide Texte wird jeweils ` ` + `modelNote` angehängt (vorhandene Konstante, erklärt den Zeitpunkt).
- Im Befehlsmenü (Knopf `/` und Slash am Feldanfang) steht im Abschnitt „Session“ die Zeile `/chrome`. Ihre Beschreibung lautet „Browser-Zugriff einschalten“ oder „Browser-Zugriff ausschalten“, je nach aktuellem Wert.
- Tippt der User genau `/chrome` (Groß- und Kleinschreibung egal), steht der Abschnitt „Session“ vor „Skills“. Enter wählt dann `/chrome` und keinen Skill, der „chrome“ im Namen trägt. Dasselbe gilt für jeden exakt getippten Session-Befehl (`/mcp`, `/pause` …).
- Im lokalen Betrieb (`isLocal`) gibt es weder Knopf noch Zeile.

### Checkliste

- [ ] `src/lib/sessions.ts`: `setSessionChrome(sessionId: string, enabled: boolean): Promise<void>` analog zu `setSessionEffort`, ruft `invoke('session_set_chrome', { sessionId, enabled })`.
- [ ] `commandMenuRows.ts`: `SessionCommand` um `'chrome'` erweitern. In `SESSION_COMMAND_TEXT` gibt es keinen festen Text dafür. Stattdessen liefert `rowText` für `command === 'chrome'` das Label `'/chrome'` und die Beschreibung abhängig von `session?.chrome`. Der Typ `Record<SessionCommand, RowText>` wird dafür zu `Record<Exclude<SessionCommand, 'chrome'>, RowText>`.
- [ ] `sessionRows(session, isLocal)`: einen neuen Parameter `isLocal: boolean` einführen und `buildCommandSections` um denselben Parameter erweitern (alle Aufrufer anpassen, in `useCommandMenu` aus `useSettingsStore` wie in `Composer.tsx` Zeile „operatingMode“). Die Zeile `{ kind: 'session', command: 'chrome' }` hinter `mcp` einfügen, wenn `!isLocal`.
- [ ] `buildCommandSections`: Ist `needle` ohne führendes `/` exakt gleich einem `SessionCommand` und `scope !== 'skills'`, kommt der Abschnitt „Session“ vor „Skills“. Sonst bleibt die Reihenfolge.
- [ ] `Composer.tsx` `runSessionCommand`: Zweig `command === 'chrome'` vor dem `else`, mit `setErrorMessage(null); setSessionChrome(session.id, !session.chrome).catch(report);`.
- [ ] `Composer.tsx`: den Knopf in `composer__bar` direkt vor dem `composer__anchor--end`-Block einfügen, nur wenn `!isLocal`: `<button type="button" className={`composer__browser${session.chrome ? ' composer__browser--on' : ''}`} aria-pressed={session.chrome} title={…} onClick={() => runSessionCommand('chrome')}>` mit einem kleinen Globus-Icon (inline-SVG, 14 px, `currentColor`, im Stil der vorhandenen Icons `PlusIcon`/`SlashIcon` in derselben Datei) und dem Text „Browser“.
- [ ] `Composer.css`: `.composer__browser` übernimmt die Werte von `.composer__mode` (gleiche Höhe, Polsterung, Rahmen, Schrift). `.composer__browser--on` nutzt die Akzentfarbe des Projekts (dasselbe Token, das ein aktiver/markierter Zustand in `Composer.css` oder `CommandMenu.css` schon nutzt — dort nachsehen, kein neues Token). Ein sichtbarer Fokusrahmen wie bei den übrigen Knöpfen.
- [ ] `pnpm check`.
- [ ] `docs/glossary.md`: Eintrag „Browser-Zugriff — Schalter pro Session, der den Agenten mit Claude in Chrome startet (`--chrome`); der Agent bedient dann den echten Chrome des Users mit dessen Anmeldungen. Nur im Claude-Betrieb.“
- [ ] `docs/code-map.md`: In der Zeile zu Sessions/Eingabeleiste ergänzen, dass der Browser-Zugriff als Session-Wert in `src-tauri/src/sessions/` und `src-tauri/src/db/sessions.rs` lebt und sein Schalter in `src/features/chat/Composer.tsx`.
- [ ] `docs/PROJECT.md`: prüfen, ob ein Nicht-Ziel dem Browser-Zugriff widerspricht. Wenn ja, als 🔴 melden und nicht still ändern.

## Report-Back

---

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups

- Backlog: Standard „Browser an“ für neue Sessions in den Einstellungen (beim Planen aufgefallen, nicht beauftragt).
- Ohne Code möglich, nur Doku: Chrome mit `--remote-debugging-port` und eigenem `--user-data-dir` plus `chrome-devtools-mcp` in der MCP-Konfiguration — läuft in jeder Betriebsart, aber in einem Zweitprofil ohne die Anmeldungen des Users (Chrome ≥ 136 ignoriert das Flag am Standardprofil).
