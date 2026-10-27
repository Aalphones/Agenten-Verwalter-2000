# Update des Verwalters aus den GitHub-Releases

Ziel: In den Einstellungen zeigt ein neuer Abschnitt „Agenten Verwalter“ die laufende Version, fragt die GitHub-Releases ab, zeigt die Versionen samt Release-Notes, die neuer sind als die laufende, und installiert auf Klick die neueste. Läuft der Verwalter als portable exe, ersetzt er seine eigene Datei am selben Pfad und startet neu; läuft er aus dem Installer, lädt er den Installer und startet ihn. Ohne Code-Signatur: die Echtheit des Downloads sichert die SHA-256-Prüfsumme, die GitHub je Release-Datei in der API nennt (schützt vor beschädigten Downloads, nicht vor einem gekaperten GitHub-Konto). Das Repository ist öffentlich und bleibt es — die App fragt ohne Token.

Kontext für jeden Umsetzer: [AGENTS.md](../../AGENTS.md), [docs/code-map.md](../code-map.md) (Zeilen „Claude-Version“, „Einstellungen“, „App-Rahmen“, „App-Info“), [docs/glossary.md](../glossary.md), [docs/conventions/](../conventions/) (rust, react, tailwind, linting, commits, releases), [.github/workflows/release.yml](../../.github/workflows/release.yml) (Namen der Release-Dateien). Fehlerklassen geprüft: im Vault gibt es keine Einträge zu Rust, Tauri, NSIS und der GitHub-API, zu TypeScript/React keine einschlägigen.

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: Releases abfragen, Download mit Prüfsumme, Datei tauschen, Neustart; Prüfprogramm; ADR 041 | heikel | complete |
| 2 | Oberfläche: Abschnitt „Agenten Verwalter“, Dialog mit Release-Notes, Punkt am Knopf „Einstellungen“; Doku-Abschluss | standard | pending |

**Rahmen:** strikt 1 → 2 (die Oberfläche braucht die generierten Typen), direkt auf `main`, ein Commit pro Phase, Scope `settings`. `pnpm check` grün vor jedem Commit, `cargo` im PATH (Rechner-Besonderheiten der Prüfkette: [STATE.md](../../STATE.md)), keine neuen Abhängigkeiten (`ureq`, `sha2`, `serde_json` sind da), Bindings mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Planabschluss mit Versions-Tag (Minor-Version). Keine Änderung an `release.yml` außer einem Kommentar (siehe Entscheidungen).

## Festgelegte Entscheidungen

- **Quelle:** `GET https://api.github.com/repos/Aalphones/Agenten-Verwalter-2000/releases?per_page=10`, Kopfzeilen `User-Agent: Agenten-Verwalter-2000/<Version>` und `Accept: application/vnd.github+json`, Zeitlimit 10 s (ohne Token, 60 Abfragen je Stunde und IP reichen). Entwürfe (`draft`) und Vorabversionen (`prerelease`) werden übersprungen. Tag `vX.Y.Z` → Version `X.Y.Z` (führendes `v` abschneiden). Verglichen wird mit `cli_update::compare_versions` (dafür `pub(crate)` setzen).
- **Anzeige:** alle Releases mit Version > laufende Version, neueste zuerst, höchstens 10 — so sieht man beim Überspringen mehrerer Versionen alle Notizen. Installiert wird immer die neueste.
- **Prüfsumme:** jede Datei in `assets[]` trägt `digest` = `sha256:<hex>` (an `v0.34.1` am 2026-10-27 gemessen: fünf Treffer). Fehlt der Wert beim gewählten Asset, wird **nicht installiert** („Das Release enthält keine Prüfsumme.“). Kein Eingriff in `release.yml` nötig.
- **Download-Adresse:** nur `browser_download_url`, die mit `https://github.com/Aalphones/Agenten-Verwalter-2000/releases/download/` beginnt; sonst Fehler. Die App folgt Weiterleitungen (`ureq` Standard).
- **Welche Datei:** Art `Portable` → Asset, dessen Name auf `_x64-portable.exe` endet; Art `Installer` → Name endet auf `-setup.exe`. Fehlt es → „Das Release enthält keine passende Datei.“ Diese Namen sind damit ein **Vertrag** mit `release.yml` (Schritt „Dateien einsammeln“).
- **Art der Installation (`InstallKind`):** nicht Windows (`cfg!(windows)` falsch) → `Manual` (nur Link auf die Release-Seite, die Pakete für macOS und Linux sind nicht geprüft). Windows und neben der laufenden exe liegt `uninstall.exe` → `Installer`. Windows sonst → `Portable`. Dev-Läufe (`pnpm tauri dev`) gelten als `Portable` mit dem Pfad unter `target\debug`; ein Klick ersetzt dort nur die von Cargo erzeugte exe.
- **Pfad der exe:** beim Start in `setup` einmal mit `std::env::current_exe()` lesen und im `AppUpdateService` halten. Nach dem Umbenennen der laufenden Datei liefert `current_exe()` den neuen Namen `.alt` — danach nie mehr aufrufen.
- **Tausch (Portable):** (1) Download in `<Ordner der exe>\<Dateiname>.neu` (gleiches Laufwerk, `rename` bleibt atomar); (2) Größe gleich `assets[].size`, SHA-256 gleich `digest`, die ersten zwei Bytes `MZ` — sonst Datei löschen und Fehler; (3) alte `<Dateiname>.alt` löschen (Fehler ignorieren), laufende exe nach `<Dateiname>.alt` umbenennen (unter Windows erlaubt, gemessen mit einer laufenden exe), `.neu` auf den Pfad der exe umbenennen; schlägt der zweite Schritt fehl, `.alt` zurückbenennen und Fehler melden; (4) Neustart, dann `app.exit(0)`. Der Dateiname der portable exe bleibt unverändert, auch wenn er eine Version trägt (Verknüpfungen bleiben gültig); die echte Version steht in den Einstellungen.
- **Neustart (Windows):** `cmd.exe /d /s /c "ping -n 3 127.0.0.1 >nul & start "" "<Pfad>""` — ohne Fenster (`hide_console`), losgelöst vom eigenen Prozess (`creation_flags(CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS)`), Befehlszeile per `CommandExt::raw_arg`. Die zwei Sekunden Pause lassen den alten Prozess enden, bevor der neue die Datenbank öffnet.
- **Installer-Art:** Download nach `std::env::temp_dir()\Agenten-Verwalter-2000-update\<Dateiname>` (Ordner anlegen, alten Inhalt löschen), gleiche Prüfungen, dann Installer starten (losgelöst wie oben), danach `app.exit(0)`.
- **Aufräumen:** beim Start in `setup` `<exe>.alt` und `<exe>.neu` löschen, Fehler ignorieren (ein noch laufender Agent kann die alte Datei sperren — er ist selbst diese exe, siehe `agents/standalone.rs`); der Temp-Ordner des Installers wird beim nächsten Download geleert.
- **Version in Dev-Läufen:** `VERWALTER_APP_VERSION` ersetzt die laufende Version, **nur** mit `cfg!(debug_assertions)` (ein Release lässt sich so nicht täuschen). Dient dazu, „Update verfügbar“ in `pnpm tauri dev` zu sehen.
- **Prüfzeitpunkt:** beim App-Start (ein stiller Hintergrund-Aufruf, Fehler bleiben stumm) und bei „Erneut prüfen“ in den Einstellungen; sonst nie, kein Zeitgeber.
- **Ein Lauf zugleich:** `AppUpdateService` hält ein Flag `is_installing`; ein zweiter `app_update_install` kehrt mit Fehler „Eine Installation läuft bereits.“ zurück.
- **Laufende Sessions:** Die UI zählt Sessions mit Status `running` oder `starting` aus dem Sessions-Zustand. Ist die Zahl > 0, steht im Dialog „<n> Sessions arbeiten gerade und werden unterbrochen.“ und der Knopf heißt „Trotzdem installieren“. Sonst „Jetzt installieren“.

## Kontrakt

```rust
// src-tauri/src/app_update/model.rs, camelCase, derive(TS); u64 als #[ts(type = "number")]
#[serde(rename_all = "camelCase")] pub enum InstallKind { Portable, Installer, Manual }
pub struct ReleaseInfo {
    pub version: String,                  // "0.35.0"
    pub notes: String,                    // Markdown aus `body`, leer wenn null
    pub published_at: Option<String>,     // ISO 8601 aus `published_at`
    pub url: String,                      // `html_url`
}
pub struct AppUpdateStatus {
    pub installed: String,                // laufende Version (Env-Override nur in Debug)
    pub latest: Option<String>,           // neueste Version, None bei Fehler
    pub has_update: bool,
    pub releases: Vec<ReleaseInfo>,       // alle neuer als `installed`, neueste zuerst
    pub install_kind: InstallKind,
    pub target_path: Option<String>,      // Portable: Pfad der exe, die ersetzt wird
    #[ts(type = "number | null")] pub download_size: Option<u64>,  // Bytes der Datei der neuesten Version
    pub latest_error: Option<String>,     // Satz, wenn die Abfrage scheiterte
}
#[serde(rename_all = "camelCase")] pub enum InstallPhase { Downloading, Verifying, Installing }
pub struct AppUpdateProgress {
    pub phase: InstallPhase,
    #[ts(type = "number")] pub downloaded: u64,
    #[ts(type = "number | null")] pub total: Option<u64>,
}
```

Commands (`src-tauri/src/commands/app_update.rs`, beide `async`, Muster `commands/cli_update.rs`): `app_update_load(app, service: State<AppUpdateService>) -> Result<AppUpdateStatus, CommandError>` (fragt GitHub, blockiert bis 10 s) und `app_update_install(app, service) -> Result<(), CommandError>` (lädt, prüft, tauscht, startet neu; kehrt nur mit Fehler zurück — bei Erfolg endet die App). Ereignis `app-update://progress` mit `AppUpdateProgress`, höchstens alle 250 ms und bei jedem Phasenwechsel. Wrapper `src/lib/appUpdate.ts`: `loadAppUpdate()`, `installAppUpdate()`, `onAppUpdateProgress(cb)`.

## Phase 1 — Core

Lesen: `src-tauri/src/cli_update/mod.rs` + `model.rs` (Vorbild: `ureq`-Agent mit Zeitlimit, `compare_versions`, Service mit `Mutex`, Ereignis senden), `src-tauri/src/commands/cli_update.rs` (async-Command-Muster), `src-tauri/src/commands/app.rs`, `src-tauri/src/lib.rs` (`mod`, `manage`, `setup`, `generate_handler!`), `src-tauri/src/error.rs` (`CommandError`), `src-tauri/src/processes/` (`hide_console`), `src-tauri/src/voice/model_file.rs` (Download mit SHA-256 und Fortschritt — Muster für Streamen und Prüfsumme), `src-tauri/examples/changes-probe.rs` (Muster Prüfprogramm), `src-tauri/examples/gen-bindings.rs`, [docs/conventions/rust.md](../conventions/rust.md) (`unwrap_used` ist verboten), [.github/workflows/release.yml](../../.github/workflows/release.yml).

AK:
1. Mit `--current 0.0.1` meldet das Prüfprogramm die Releases von `Aalphones/Agenten-Verwalter-2000` neuer als 0.0.1 samt Notizen, `latest` = Tag des neuesten Releases ohne `v`, `has_update` wahr, `download_size` > 0; mit `--current 99.0.0` ist `has_update` falsch und `releases` leer.
2. Das Prüfprogramm lädt die Datei der neuesten Version in einen angegebenen Ordner, die SHA-256 stimmt mit `digest` überein; ist die Datei um ein Byte verändert, bricht die Prüfung mit „Prüfsumme stimmt nicht.“ ab und löscht sie.
3. `swap_files(target, new)` ersetzt eine **laufende** exe: das Prüfprogramm startet eine Kopie von `ping.exe` (`-n 30`), tauscht sie gegen eine zweite Datei und meldet danach Inhalt von `target` = neue Datei, `<target>.alt` = alte Datei; scheitert das zweite Umbenennen (Probe: Ziel schreibgeschützt in einem gesperrten Ordner nachstellen oder `new` entfernen), steht die alte Datei wieder am Pfad.
4. Ein Asset ohne `digest`, ohne passende Endung oder mit fremder `browser_download_url` führt zu den Sätzen aus den Entscheidungen, nicht zu einem Download (belegt durch Funktion `pick_asset` auf selbst gebauten Antwort-Texten im Prüfprogramm, Modus `pick`).
5. `InstallKind` ist `Portable`, wenn neben der exe keine `uninstall.exe` liegt, und `Installer`, wenn eine liegt (Prüfprogramm, Modus `kind <Ordner>`).
6. `pnpm check` grün; `src/lib/bindings/` trägt `AppUpdateStatus`, `ReleaseInfo`, `InstallKind`, `InstallPhase`, `AppUpdateProgress`.

- [x] Neues Modul `src-tauri/src/app_update/` (`mod.rs` Service und Ablauf, `model.rs` Typen, `releases.rs` Abfrage + `pick_asset`, `download.rs` Streamen mit Fortschritt und SHA-256, `swap.rs` `swap_files`, `relaunch`, `cleanup`; in `lib.rs` `pub mod app_update;`), Modul-Kommentar „Update des Verwalters: Releases von GitHub abfragen, Download prüfen, eigene Datei tauschen oder Installer starten (ADR 041).“
- [x] `releases.rs`: `pub fn fetch(current: &str) -> Result<Vec<Release>, String>` (interne Struktur `Release { version, notes, published_at, url, assets: Vec<Asset> }`, `Asset { name, url, size, digest: Option<String> }`), `pub fn pick_asset(release: &Release, kind: InstallKind) -> Result<&Asset, String>` mit den Prüfungen aus den Entscheidungen. Fehlersätze deutsch, z. B. „Abfrage der Releases scheitert: …“, „GitHub antwortet mit 403 — Abfragegrenze erreicht, später erneut versuchen.“ (bei HTTP 403/429).
- [x] `download.rs`: `pub fn fetch_verified(asset: &Asset, dest: &Path, on_progress: impl FnMut(u64, Option<u64>)) -> Result<(), String>`: streamt mit `ureq` in 64-KiB-Blöcken in `dest`, füttert `Sha256`, vergleicht am Ende mit `digest`, prüft Größe und `MZ`; bei Fehler `dest` löschen. Zeitlimit je Lesen 30 s (`timeout_global` nicht setzen — ein großer Download darf länger dauern).
- [x] `swap.rs`: `pub fn swap_files(target: &Path, new: &Path) -> Result<(), String>` nach „Tausch (Portable)“ Schritt 3; `#[cfg(windows)] pub fn relaunch(path: &Path) -> Result<(), String>` und `pub fn start_installer(path: &Path)` nach den Entscheidungen; `pub fn cleanup(exe: &Path)`; `pub fn install_kind(exe: &Path) -> InstallKind` (`cfg!(windows)`, `uninstall.exe`).
- [x] `mod.rs`: `pub struct AppUpdateService { exe: Option<PathBuf>, installing: Mutex<bool>, cache: Mutex<Option<Vec<Release>>> }` mit `new()` (liest `current_exe()` genau hier), `pub fn load(&self, app) -> AppUpdateStatus` (Version = `package_info().version`, in Debug mit `VERWALTER_APP_VERSION`; Abfrage; Fehler → `latest_error`), `pub fn install(&self, app) -> Result<(), CommandError>` (Flag, Asset wählen, Download in den Zielordner nach Art, Prüfung, Tausch bzw. Installer, `app.exit(0)`; Flag in jedem Fehlerfall zurücksetzen), Fortschritt per `app.emit("app-update://progress", …)` gedrosselt.
- [x] `lib.rs`: `app.manage(AppUpdateService::new())`, in `setup` danach `app_update::swap::cleanup`, Commands in `generate_handler!` eintragen. `cli_update::compare_versions` auf `pub(crate)`.
- [x] `src-tauri/src/commands/app_update.rs` nach Kontrakt, in `commands/mod.rs` eintragen; Typen in `gen-bindings.rs` eintragen, `pnpm bindings`.
- [x] Prüfprogramm `src-tauri/examples/app-update-probe.rs` mit den Modi `check [--current <Version>]`, `download <Ordner> [--current <Version>]`, `swap`, `pick`, `kind <Ordner>`; Aufruf in AGENTS.md (Tabelle „Befehle“). Es fasst weder die Datenbank noch die laufende App an.
- [x] `release.yml`: Kommentar am Schritt „Dateien einsammeln“: „Die Namen `*-setup.exe` und `*_x64-portable.exe` liest die Update-Funktion des Verwalters (ADR 041) — nicht ändern, ohne `app_update/releases.rs` anzupassen.“
- [x] `docs/decisions/041-app-update.md`: Optionen (a) Tauri-Updater-Plugin — verworfen: verlangt Signaturschlüssel und Manifest, die portable exe kennt es nicht; (b) eigener Ablauf mit `digest` der GitHub-API — gewählt, ohne Schlüsselverwaltung; (c) Tausch über ein Hilfsprogramm oder Skript — verworfen, Umbenennen der laufenden exe genügt. Konsequenzen: Prüfsumme schützt nicht vor gekapertem GitHub-Konto; Asset-Namen sind ein Vertrag; Dateiname der portable exe bleibt alt; laufende Agenten werden beim Neustart unterbrochen.
- [x] `pnpm check` grün, Commit `feat(settings): Releases abfragen, prüfen und die eigene Datei tauschen`.

## Phase 2 — Oberfläche

Lesen: `src/features/cliupdate/CliVersionRow.tsx` + `.css` + `useCliVersion.ts` (Vorbild für Aufbau, Zustände und Texte), `src/lib/cliUpdate.ts`, `src/features/settings/SettingsView.tsx` (`renderSections`, Abschnitt „Claude Code“), `SettingRow.tsx`, `src/components/Dialog.tsx`, `src/components/Markdown.tsx`, `src/components/ExternalLink.tsx`, `src/app/Sidebar.tsx` (Knopf `sidebar__settings`), `src/app/App.tsx`, `src/stores/sessions.ts` + `src/lib/bindings/SessionStatus.ts` (Zählung), [docs/conventions/react.md](../conventions/react.md), [tailwind.md](../conventions/tailwind.md), [typescript.md](../conventions/typescript.md). Kein Mockup vorhanden: die Zeile folgt dem Aufbau von `CliVersionRow`, der Dialog dem vorhandenen `Dialog`.

AK:
1. Abschnitt „Agenten Verwalter“ steht in den Einstellungen direkt über „Claude Code“ mit einer Zeile „Version“ (ⓘ-Text: „Die Version dieses Verwalters. ‚Erneut prüfen‘ fragt die GitHub-Releases ab. Ein Update lädt die neue Datei, prüft ihre Prüfsumme und startet den Verwalter neu; laufende Agenten werden dabei unterbrochen.“).
2. Zustände der Zeile: Lädt → „Lädt …“; aktuell → „Version 0.34.1 · aktuell“; Update → „Version 0.34.1“ + „Version 0.35.0 verfügbar“ (Akzentfarbe) + Knopf „Anzeigen“; Abfragefehler → Satz in Warnfarbe („Neue Version nicht abfragbar: …“); immer Knopf „Erneut prüfen“.
3. „Anzeigen“ öffnet einen Dialog „Neue Version 0.35.0“: je Release eine Karte (Version, Datum `TT.MM.JJJJ`, Notizen als Markdown über `Markdown`, Link „Auf GitHub ansehen“ über `ExternalLink`), darunter eine Zeile, was passiert (Portable: „Die Datei <Pfad> wird ersetzt und der Verwalter startet neu.“; Installer: „Der Installer wird gestartet und der Verwalter beendet.“; Manual: „Dieses Paket aktualisiert sich nicht selbst.“), und die Knöpfe „Später“ und „Jetzt installieren“ (bei Manual stattdessen „Release-Seite öffnen“; bei laufenden Sessions „Trotzdem installieren“ plus der Satz aus den Entscheidungen).
4. Beim Installieren zeigt der Dialog eine Fortschrittsleiste mit „Lade <x> von <y> MB“, danach „Prüfe …“ und „Installiere …“; alle Knöpfe sind währenddessen gesperrt, Esc und Klick daneben schließen nicht. Ein Fehler erscheint als Satz im Dialog, die Knöpfe sind wieder frei.
5. Der Knopf „Einstellungen“ in der Sidebar trägt einen Punkt (Akzentfarbe, `aria-label` „Neue Version verfügbar“), solange `hasUpdate` wahr ist; geprüft beim App-Start und beim Öffnen der Einstellungen.
6. Mit `VERWALTER_APP_VERSION=0.0.1 pnpm tauri dev` erscheinen Zeile, Dialog mit den echten Release-Notes und der Punkt; die Zustände „aktuell“ und „Fehler“ sind belegt (Funktionsweise ohne Netz: Netzwerk trennen, „Erneut prüfen“).

- [ ] Wrapper `src/lib/appUpdate.ts` nach Kontrakt (Muster `cliUpdate.ts`).
- [ ] Store `src/stores/appUpdate.ts`: `status: AppUpdateStatus | null`, `setStatus`; Hook `src/features/appupdate/useAppUpdate.ts`: lädt beim Einhängen, `check()`, `install()` (setzt `progress` aus dem Ereignis, fängt Fehler als Satz über `commandErrorText`), Abo auf `app-update://progress` mit Abmelden. Einmal in `App.tsx` beim Start laden; `SettingsView` ruft `check()` beim Öffnen.
- [ ] `src/features/appupdate/AppVersionRow.tsx` + `.css` (BEM `app-version-row__*`), `AppUpdateDialog.tsx` + `.css`, `appUpdateTexts.ts` (alle Sätze, `formatMegabytes`, `runningSessionCount(summaries)`); eingebunden in `renderSections` über „Claude Code“.
- [ ] `Sidebar.tsx`: Punkt nach AK 5 (Klasse `sidebar__settings-dot`, falls Phase 2 des Plans „Umgebung“ ihn schon angelegt hat, dieselbe Klasse mit Modifikator `--update`; sonst neu).
- [ ] Doc: `docs/code-map.md` neue Zeile „App-Update“ (Oberfläche `src/features/appupdate/`, Store, Wrapper; Core `src-tauri/src/app_update/`, Commands, Prüfprogramm, ADR 041); `docs/glossary.md` neue Einträge **Portable** („Die lose `verwalter.exe` ohne Installer; ein Update ersetzt sie am selben Pfad (ADR 041).“) und **Prüfsumme** („SHA-256 einer Release-Datei, von GitHub je Datei genannt; ohne Treffer wird nichts installiert.“); `AGENTS.md`: Zeile `VERWALTER_APP_VERSION` in „Befehle“; `docs/conventions/releases.md`: Regel „Die Dateinamen `*-setup.exe` und `*_x64-portable.exe` sind ein Vertrag mit der Update-Funktion“; `README.md` Satz zum Update in den Einstellungen.
- [ ] Plan-Abschluss: Bottom-Sektionen, Archiv, STATE.md, Versions-Tag (Minor-Version).
- [ ] `pnpm check` grün, Commit `feat(settings): Abschnitt Agenten Verwalter, Dialog und Hinweis in der Sidebar`.

## Wackelstellen (nur Plan, kein Prüfauftrag)

- 🟡 Die Neustart-Befehlszeile mit Anführungszeichen in `cmd /s /c` ist die kniffligste Zeile. Der Pfad enthält womöglich Leerzeichen (`Agenten Verwalter 2000`). Check: Prüfprogramm-Modus `swap` startet nach dem Tausch über denselben `relaunch`-Aufruf eine Kopie von `ping.exe` aus einem Ordner mit Leerzeichen im Namen.
- 🟡 Beenden der App hält laufende Agenten nicht ausdrücklich an (im Code kein Abräumen beim Beenden gefunden; `agents/standalone.rs` und `codex.rs` starten die eigene exe als Agenten). Folge: ein Agent kann nach dem Tausch weiter von `.alt` laufen und die Datei sperren; das Aufräumen beim nächsten Start ignoriert Fehler. Check in Phase 1: Prüfprogramm-Modus `swap` zeigt, dass der Tausch mit laufender Kopie klappt; ob Agenten beim Beenden mitsterben, steht in FINDINGS.md.
- 🟡 Der volle Durchlauf (Klick → Download → Tausch → Neustart der echten App) ist erst gegen ein echtes neueres Release prüfbar: der Verwalter selbst ist am 2026-10-27 auf dem neuesten Stand. Ausweg im Dev-Lauf: `VERWALTER_APP_VERSION=0.0.1 pnpm tauri dev` und „Jetzt installieren“ — ersetzt `target\debug\verwalter.exe` durch die portable exe von `v0.34.1`, benutzt die echte Datenbank wie jeder Dev-Lauf; nur starten, wenn kein Agent dieser Session davon abhängt. Sonst als erstes Follow-up nach dem nächsten Release beobachten.
- 🟡 `digest` ist ein junges GitHub-Feld; fehlt es künftig, bricht die Installation ab statt unsicher weiterzumachen. Wer das lockern will, entscheidet es in einem neuen ADR.

## Summary

## Files touched

## Commits

## Deviations from plan

- Phase 1: Neustart und Installer-Start laufen mit `CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP` statt `DETACHED_PROCESS` — ohne eigene (verborgene) Konsole öffnete `ping` ein sichtbares Fenster; der Prozess überlebt das Ende des Verwalters trotzdem, die App hängt ihre Kinder an kein Job-Objekt. Der Installer startet ebenfalls über `cmd … start`, damit Windows bei Bedarf nach Administratorrechten fragt.
- Phase 1: ureq 3 kennt kein Zeitlimit je Lesen. Download mit 30 s für Verbindung und Antwortkopf, 10 min für den ganzen Inhalt.
- Phase 1: `releases::fetch` liefert alle veröffentlichten Releases (die Version geht nur in den `User-Agent`); das Filtern auf „neuer als“ macht `releases::newer_than`. `Asset` trägt `sha256` (Hex ohne Präfix) statt `digest`. `download::verify` ist eigenständig, damit das Prüfprogramm eine veränderte Datei prüfen kann. Neue Variante `CommandError::AppUpdate` für die Sätze des Updates.
- Phase 1: Code-Map-Zeile „App-Update“ schon in Phase 1 angelegt (Core-Spalte); Phase 2 trägt die Oberfläche nach.

## Follow-ups

- → Phase 2: Ob laufende Agenten beim Beenden des Verwalters mitsterben, ist nicht belegt (Hypothese: Claude endet mit geschlossener Standardeingabe, Autark/Codex laufen als eigene exe weiter und können `.alt` sperren). Folge im ADR 041 vermerkt; ein zweites Update vor dem Ende eines solchen Agenten scheitert mit Meldung.
- → Phase 2: Fehlersätze kommen als `CommandError` der Art `appUpdate` mit fertigem Satz in `message`; `commandErrorText` gibt ihn ohne eigenen Fall aus.
- Prüfkette auf diesem Rechner: der Clippy-Lauf baut whisper-rs-sys in einem eigenen Build-Ordner; lag dort ein CMake-Cache eines anderen Visual-Studio-Generators, half nur Löschen von `CMakeCache.txt` und `CMakeFiles` in `target/debug/build/whisper-rs-sys-*/out/build`.
