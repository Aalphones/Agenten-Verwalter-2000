# Review-Bericht abschaltbar

Ein Schalter in den Einstellungen schaltet den Review-Bericht ([ADR 073](../decisions/073-review-bericht.md)) als Ganzes ab: keine `report_*`-Werkzeuge, keine Anweisung an die Stationen, keine Ordnung durch Haiku am Phasenende, kein Reiter „Review“. Die Skills fallen dann auf den HTML-Bericht zurück, weil sie an der Frage „sind die `report_*`-Werkzeuge da?“ hängen; wo sie das noch nicht tun, werden sie nachgezogen.

| Phase | Titel | Rating | Status |
|---|---|---|---|
| 1 | Schalter im Verwalter | standard | pending |
| 2 | Skills auf den Schalter einstellen, Plan fertig | mechanisch | pending |

## Entscheidungen

- **Vom Benutzer:** Standard **an** (heutiges Verhalten bleibt). Bei **aus** verschwindet der Reiter „Review“ ganz, auch bei älteren Umsetzungen; gespeicherte Berichte bleiben in der Datenbank und erscheinen nach dem Wiedereinschalten. Die facepass-Skills werden mitgezogen, **ohne Branch direkt auf `master`, danach Push**.
- **Von mir gesetzt:**
  - Ein Schalter für alles, Schlüssel `report_enabled`, Feld `reportEnabled`, Änderung `SettingsChange::ReportEnabled` — der Benutzer fragte nach dem „gesamten Feature“.
  - Ort: Kategorie „Agent“, Abschnitt „Umsetzungen“, nach „Nach Kontingent-Limit automatisch weiter“; ohne `isShown`, weil der Reiter in jeder Betriebsart betroffen ist.
  - Wirkung ab dem nächsten Start einer Station. Wird mitten in einer Station ausgeschaltet, stehen die Werkzeuge noch in ihrer Liste, ein Aufruf scheitert aber mit dem Satz aus `unavailable_message` — der sagt dem Agenten, er solle den Bericht wie ohne Verwalter schreiben.
  - Nebenfragen lesen den Schalter beim Stellen der Frage, nicht den Wert vom Start der Station; nach einem Umschalten mitten in der Station verfehlt höchstens eine Nebenfrage den Prompt-Cache.
  - Bei aus entfällt am Phasenende die ganze Phasenend-Arbeit (Ordnung und Prüfwerte), denn beides zeigt nur der Reiter. Nach dem Wiedereinschalten holt „Neu ordnen“ im Reiter beides für eine Phase nach (`report::retidy` → `start_phase_end`).
  - `retidy` bleibt ungeprüft: er ist nur aus dem Reiter erreichbar.
  - Kein neues ADR, sondern ein Abschnitt „Nachtrag: Schalter“ in ADR 073 — die Entscheidung ändert den Umfang, nicht die Architektur des Berichts.

## Konfidenz-Ausweis

- 🟡 Ob die Claude-Kommandozeile `tools/list` nur beim Start liest: Check in Phase 1 — Station starten, Schalter aus, `mcp-probe … list` gegen die Konfigurationsdatei der Station (`%USERPROFILE%\.verwalter\mcp\<Session-ID>.json`) muss die drei `report_*` nicht mehr zeigen; `call report_note {}` muss den Satz aus `unavailable_message` liefern.
- 🟡 facepass-Commit direkt auf `master`: der Haupt-Checkout muss sauber auf `master` stehen. Check zu Beginn von Phase 2: `git -C C:\Users\smick\develop\easyfitness\facepass status --short` leer und `git -C … branch --show-current` = `master`; sonst 🔴 an den Benutzer.
- Fehlerklassen geprüft (Vault): `werkzeuge/claude-code` „Textsuche in einem Punkt-Ordner liefert stumm null“ und `werkzeuge/git` „Ersetzungsskript findet im Windows-Arbeitsbaum seinen Anker nicht“ sowie „`git add <Ordner>` nimmt fremde ungetrackte Dateien mit“ treffen Phase 2; `frameworks/react`: keine einschlägig; für Rust und Tauri gibt es keine Entity.

## Finale AK

1. Mit Schalter **an** verhält sich der Verwalter wie vor dem Plan (Werkzeuge, Anweisung, Ordnung am Phasenende, Reiter).
2. Mit Schalter **aus**: eine neu gestartete Claude-Station bekommt weder die `report_*`-Werkzeuge noch die Anweisung zum Review-Bericht; am Phasenende läuft keine Ordnung; der Reiter „Review“ fehlt in Umsetzung und Station.
3. Eine Station mit Schalter **aus** baut in Verwalter-Projekten und in facepass den Bericht wieder nach den Skills (HTML-Seite im Artefakte-Ordner bzw. Abnahme-Paket wie vor `1f54e41`).
4. `pnpm check` grün; Plan archiviert, Version und Tag nach `docs/conventions/releases.md`.

---

## Phase 1 — Schalter im Verwalter (standard)

### Kontext (lesen)

- `docs/decisions/073-review-bericht.md` (was der Review-Bericht ist), `docs/decisions/046-mcp-zugang.md` (Werkzeug-Sätze), `docs/decisions/061-schlanke-werkzeuge-in-stationen.md` (gemeinsamer `--append-system-prompt`), `docs/decisions/044-nebenfragen.md` (Nebenfragen teilen den Prompt-Cache der Station).
- Muster für einen Schalter, der Agenten-Werkzeuge abstellt: `src-tauri/src/skins/tools.rs` Funktion `offered` (Zeilen um 65) und `src-tauri/src/vault/tools.rs` Funktion `offered` (um 107).
- Muster für einen Schalter der Umsetzungen: `auto_compact_stations` in `src-tauri/src/settings/mod.rs` (Konstante `KEY_AUTO_COMPACT_STATIONS`, `DEFAULT_SETTINGS`, `load`, `update`), `src-tauri/src/settings/model.rs` (`Settings`, `SettingsChange::AutoCompactStations`), `src/features/settings/settingsCatalog.ts` (Eintrag `autoCompactStations`), `src/features/settings/SettingsView.tsx` (Zweig `case 'autoCompactStations'`).
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/linting.md`.

### AK

1. `Settings` trägt `report_enabled: bool` (TS `reportEnabled`), Standard `true`, gespeichert unter `report_enabled`; `SettingsChange::ReportEnabled { value: bool }` schreibt ihn; `pnpm bindings` ist gelaufen.
2. `ReportTools::offered` liefert `settings::load(...).is_ok_and(|s| s.report_enabled)` (Muster `skins/tools.rs`), und `ReportTools::unavailable_message` liefert: „Der Review-Bericht ist in den Einstellungen ausgeschaltet. Schreib deinen Bericht so, wie es deine Anweisungen ohne diese Werkzeuge verlangen.“
3. `SpawnOptions` (`src-tauri/src/agents/claude/process.rs`) hat ein Feld `report: bool` mit Doc-Kommentar; die Bedingung vor `prompts.push(report_prompt())` lautet `opts.lean_tools && opts.report && opts.verwalter_mcp.is_some()`. Gesetzt wird es in `src-tauri/src/sessions/registry.rs` (bei `lean_tools`, um Zeile 4381) als `lean_tools && settings::load(&session.database).is_ok_and(|s| s.report_enabled)` und in `src-tauri/src/sessions/registry/side.rs` (bei `lean_tools`, um Zeile 92) auf dieselbe Weise mit der Datenbank der Session; `src-tauri/examples/side-probe.rs` und der Test-Baustein `options` in `process.rs` setzen `report: false`.
4. `report::on_station_completed` (`src-tauri/src/report/mod.rs`) kehrt ohne Phasenend-Arbeit zurück, wenn der Schalter aus ist (Datenbank über `app.try_state::<Arc<Database>>()` wie in `skins/tools.rs`; fehlt sie, gilt „aus“ nicht — dann wie bisher weiter).
5. Einstellungsseite: Eintrag `reportEnabled` in `settingsCatalog.ts` direkt nach `autoContinueAtLimit` — Kategorie `agent`, Abschnitt `Umsetzungen`, Label „Review-Bericht“, ohne `isShown`, ⓘ-Text: „Stationen einer Umsetzung erklären ihre Änderungen, Befunde und Bildschirmfotos im Reiter „Review“; am Ende einer Phase ordnet Haiku die Einträge. Aus: Stationen bekommen weder die Werkzeuge noch die Anweisung dazu und schreiben ihren Bericht wieder nach ihren Skills, der Reiter „Review“ verschwindet. Gespeicherte Berichte bleiben erhalten und erscheinen nach dem Einschalten wieder. Wirkt ab dem nächsten Start einer Station.“ In `SettingsView.tsx` ein Zweig `case 'reportEnabled'` wie `autoCompactStations` mit `Switch`, Label „Review-Bericht führen“.
6. Reiter: `src/features/implementation/ImplementationView.tsx` — `hasReport` wird `hasBegunPhase(implementation) && isReportEnabled`, wobei `isReportEnabled = useSettingsStore((state) => state.settings?.reportEnabled ?? true)`. `src/app/App.tsx` — derselbe Selektor; `useReportOfSession` bekommt als ersten Wert `isStationShown && isReportEnabled ? (currentSession?.id ?? null) : null` und als zweiten `isStationShown && isReportEnabled`. Damit sind `reportImplementation`, `hasReport` des `SessionHeader` und `isReportView` bei aus leer bzw. `false`.
7. Doku: ADR 073 bekommt am Ende den Abschnitt „## Nachtrag: Schalter (2026-11-27)“ mit drei Zeilen (was der Schalter abstellt, Standard an, Daten bleiben); `docs/glossary.md` Eintrag **Review-Bericht** um den Satz „Abschaltbar in den Einstellungen unter Agent → Umsetzungen.“ ergänzt; `docs/code-map.md` nur, falls dort Einstellungen je Feature aufgezählt sind.
8. `powershell -File scripts/check.ps1` endet mit `exit 0`.

### Checkliste

- [ ] Rust: `settings/model.rs`, `settings/mod.rs` (Konstante, Standard, `load`, `update`).
- [ ] Rust: `report/tools.rs` (`offered`, `unavailable_message`), `report/mod.rs` (`on_station_completed`).
- [ ] Rust: `agents/claude/process.rs` (Feld, Bedingung, Test-Baustein), `sessions/registry.rs`, `sessions/registry/side.rs`, `examples/side-probe.rs`.
- [ ] `pnpm bindings`.
- [ ] TS: `settingsCatalog.ts`, `SettingsView.tsx`, `ImplementationView.tsx`, `App.tsx`.
- [ ] Doku: ADR 073 Nachtrag, Glossar.
- [ ] Probe (Konfidenz-Check oben): in `pnpm tauri dev` eine Station starten, Schalter aus, `mcp-probe` `list` und `call report_note {}` gegen deren Konfigurationsdatei; Ergebnis in den Report-Back.
- [ ] `scripts/check.ps1` grün, Commit nach `docs/conventions/commits.md`.

### Report-Back

---

## Phase 2 — Skills auf den Schalter einstellen, Plan fertig (mechanisch)

### Kontext (lesen)

- Vor jedem Write in eine eigene Regeldatei: `~/.claude/knowledge/topics/regeldateien.md` und `~/.claude/knowledge/topics/skill-evolution.md` (Decision-Log statt Plan).
- facepass: `C:\Users\smick\develop\easyfitness\facepass\AGENTS.md` und `.claude\skills\project-committing\SKILL.md` (Commit-Regeln dieses Repos). Der Benutzer hat für diese Änderung **direkt auf `master` committen und pushen** angeordnet, ohne Branch.
- Die zu ändernden Stellen sind genau die Zeilen des Commits `1f54e41` in facepass: `git -C C:\Users\smick\develop\easyfitness\facepass show 1f54e41` (7 Dateien, 12 Zeilen; seitdem unverändert). Die alte Fassung jeder Zeile ist der Rückweg, die neue der Weg mit Werkzeugen.
- Fehlerklassen: Vault `werkzeuge/claude-code` „Textsuche in einem Punkt-Ordner liefert stumm null“ — in `.claude`-Ordnern mit `Grep` und `path` auf `.claude\skills` suchen, ein leerer Treffer ist kein Beleg; `werkzeuge/git` „Ersetzungsskript findet im Windows-Arbeitsbaum seinen Anker nicht“ — Edits mit dem Edit-Werkzeug, nicht per Skript; „`git add <Ordner>` nimmt fremde ungetrackte Dateien mit“ — die sieben Dateien einzeln stagen.

### AK

1. **facepass:** Jede der 12 Zeilen aus `1f54e41` nennt die Bedingung ausdrücklich: „Sind die Werkzeuge `mcp__verwalter__report_*` da: <Wortlaut nach 1f54e41>. Sonst: <Wortlaut vor 1f54e41>.“ — in Klartext und als ein Absatz je Zeile, ohne harte Zeilenumbrüche; wo die neue Fassung nur „im Verwalter“ sagt, wird daraus die Werkzeug-Bedingung. Keine Erwähnung von Zeremonie oder `~/.claude`.
2. **facepass:** vor dem ersten Write `git status --short` leer und Branch `master`, sonst 🔴 an den Benutzer; Commit nach `project-committing` von facepass mit den sieben Dateien einzeln gestaged, direkt auf `master`, danach `git push`.
3. **User-Ebene:** `~/.claude/skills/mode-implementing/WORK.md` Zeile „Verifikation = Selbst-Smoke“: „im Agenten-Verwalter ein Screenshot als `report_figure` …“ wird „sind die Werkzeuge `mcp__verwalter__report_*` da, ein Screenshot als `report_figure` mit `text` statt als Artefakt“. Im Master `G:\Meine Ablage\U104_Agents` ändern, Decision-Log-Eintrag, Spiegeln nach `regeldateien.md`. Die übrigen Stellen (`CLAUDE.md`, `mode-implementing/SKILL.md`, `mode-reviewing/SKILL.md`) hängen schon an den Werkzeugen — nur per `Grep` auf `report_` bestätigen.
4. **Plan fertig** nach `mode-implementing`: dieser Plan nach `docs/archive/2026-11/`, Version und Tag nach `docs/conventions/releases.md`, `pnpm check` grün.

### Checkliste

- [ ] `regeldateien.md`, `skill-evolution.md` lesen.
- [ ] facepass: Status prüfen, `git show 1f54e41` lesen, 12 Zeilen ändern, `Grep` mit `path` auf `.claude\skills` nach `report_` — jeder Treffer steht in einem Satz mit der Werkzeug-Bedingung.
- [ ] facepass: Commit auf `master`, Push.
- [ ] User-Ebene: `WORK.md`, Decision-Log, Spiegeln.
- [ ] „Plan fertig“: Archiv, Version, Tag, Push.

### Report-Back

---

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
