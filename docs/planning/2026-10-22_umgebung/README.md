# Umgebung in den Einstellungen

Ziel: Ein neuer Abschnitt „Umgebung“ in den Einstellungen meldet kaputte Verknüpfungen (Junctions, symbolische Links) direkt unter `~\.claude` und gleicht die Skills und Befehle unter `~\.claude\skills` und `~\.claude\commands` mit einem frei wählbaren Master-Ordner ab. „Spiegeln“ kopiert, was im Master neuer ist oder lokal fehlt, und löscht nie. Der Verwalter kennt dabei weder Profile noch Accounts noch persönliche Pfade — der Master-Ordner liegt nur als Einstellung in der lokalen Datenbank. Entwurf: [artifacts/entwurf-umgebung.html](artifacts/entwurf-umgebung.html), vom User am 2026-10-22 freigegeben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Einstellungen“, „Skills und Befehle“, „App-Rahmen“), [docs/glossary.md](../../glossary.md), [docs/conventions/](../../conventions/), [ADR 012](../../decisions/012-einstellungen-farbschema-und-listen.md) (Einstellungsseite). Fehlerklassen geprüft (Vault: TypeScript, React): keine einschlägig; für Rust und Tauri gibt es keine Einträge.

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: Verknüpfungen prüfen, Abgleich, Spiegeln, Einstellung Master-Ordner; ADR 038 | standard | pending |
| 2 | Oberfläche: Abschnitt „Umgebung“, Punkt am Knopf „Einstellungen“; Doku-Abschluss | standard | pending |

**Rahmen:** strikt 1 → 2, direkt auf `main`, ein Commit pro Phase, Scope `settings`. `pnpm check` grün vor jedem Commit, `cargo` im PATH, keine neuen Abhängigkeiten (nur `std::fs`), Bindings mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Planabschluss mit Versions-Tag (Minor-Version).

## Festgelegte Entscheidungen

- **Verknüpfung** = Eintrag direkt unter `~\.claude`, dessen `fs::symlink_metadata` einen Link meldet (`file_type().is_symlink()`). **Kaputt**, wenn `fs::metadata` (folgt dem Link) scheitert. Ziel über `fs::read_link`, `None`, wenn auch das scheitert. Keine Rekursion.
- **Abgleich** vergleicht je Skill (Unterordner von `skills`) und je Befehl (`*.md` direkt in `commands`) Datei für Datei relativ zum Ordner: abweichend, wenn eine Datei lokal fehlt oder Größe oder Änderungszeit abweichen und die Master-Datei die neuere ist (Toleranz 2 s, wegen synchronisierter Laufwerke). Zustände: `onlyMaster` (fehlt lokal ganz), `masterNewer`, `onlyLocal` (nur lokal, bleibt). Lokal neuere Dateien gelten als gleich (nichts zu tun) — Spiegeln kopiert nie rückwärts.
- **Spiegeln** kopiert jede Datei mit Zustand „fehlt lokal“ oder „im Master neuer“ per `fs::copy` (behält unter Windows die Änderungszeit), legt fehlende Ordner an, löscht nichts, folgt im Master keinen Links (Unterordner mit Link werden übersprungen). Tiefe höchstens 8.
- **Geprüft wird** beim App-Start und bei jedem Öffnen der Einstellungen, sonst nie (kein Hintergrund-Thread).
- **Master-Ordner gültig**, wenn er existiert, nicht `~\.claude` selbst ist und `skills` oder `commands` enthält; sonst Satz in `master_error`, kein Abgleich.
- **„Zuletzt gespiegelt“** lebt nur im Speicher des Core bis zum App-Ende.

## Kontrakt

```rust
// src-tauri/src/environment/model.rs, camelCase, derive(TS)
pub struct BrokenLink { pub path: String, pub target: Option<String> }
pub struct LinkCheck { pub total: u32, pub broken: Vec<BrokenLink> }
#[serde(rename_all = "camelCase")] pub enum MirrorState { OnlyMaster, MasterNewer, OnlyLocal }
pub struct MirrorDiff {
    pub kind: SkillKind,          // aus skills/model.rs: Skill | Command
    pub name: String,             // Ordnername des Skills bzw. Dateiname ohne .md
    pub state: MirrorState,
    #[ts(type = "number | null")] pub master_modified_at: Option<f64>, // ms, jüngste Datei im Master
}
pub struct MirrorRun { pub copied: u32, #[ts(type = "number")] pub at: f64 }
pub struct EnvironmentStatus {
    pub links: LinkCheck,
    pub master_dir: Option<String>,
    pub master_error: Option<String>,
    pub diffs: Vec<MirrorDiff>,      // sortiert: kind, dann name
    pub last_mirror: Option<MirrorRun>,
    #[ts(type = "number")] pub checked_at: f64,
}
```

Commands (`src-tauri/src/commands/environment.rs`): `environment_status(app, database, environment: State<EnvironmentService>) -> Result<EnvironmentStatus, CommandError>`, `environment_mirror(...) -> Result<EnvironmentStatus, CommandError>`. Einstellung: `Settings.master_dir: Option<String>`, Schlüssel `master_dir`, `SettingsChange::MasterDir { value: Option<String> }` (leer/`null` = entfernen). Wrapper `src/lib/environment.ts`: `loadEnvironment()`, `mirrorEnvironment()`.

## Phase 1 — Core

Lesen: `src-tauri/src/settings/model.rs` + `mod.rs` (`load`, `update`, `DEFAULT_SETTINGS`, Muster `voice_language` für einen optionalen Text), `src-tauri/src/db/settings.rs`, `src-tauri/src/skills/mod.rs` (`skills_dir`) und `skills/model.rs` (`SkillKind`), `src-tauri/src/filesystem/workspace.rs` (`home_dir`), `src-tauri/src/commands/settings.rs` (Command-Muster), `src-tauri/src/lib.rs` (Registrierung, `manage`), [docs/conventions/rust.md](../../conventions/rust.md).

AK:
1. Mit einer kaputten Junction unter `~\.claude` liefert `environment_status` sie in `links.broken` samt Ziel; `links.total` zählt alle Links direkt darunter.
2. Mit gesetztem gültigem Master liefert `diffs` genau die abweichenden Skills und Befehle nach den Regeln oben; ohne Master ist `diffs` leer und `master_dir` `null`.
3. `environment_mirror` kopiert nach den Regeln, setzt `last_mirror`, liefert danach einen Stand ohne `onlyMaster`/`masterNewer`.
4. Ein ungültiger Master liefert `master_error` mit Satz („Ordner nicht gefunden.“ / „Das ist der Ordner .claude selbst.“ / „Im Ordner liegen weder skills noch commands.“).

- [ ] Neues Modul `src-tauri/src/environment/` (`mod.rs`, `model.rs`, `links.rs`, `mirror.rs`; in `lib.rs` `mod environment;`), Modul-Kommentar „Umgebung des Benutzers: Verknüpfungen unter ~\\.claude, Abgleich mit einem Master-Ordner (ADR 038).“
- [ ] `links.rs`: `pub fn check(claude_dir: &Path) -> LinkCheck` nach Entscheidung; Anzeige-Pfad = voller Pfad als Text.
- [ ] `mirror.rs`: `fn files_of(dir: &Path, depth: u32) -> BTreeMap<PathBuf /*relativ*/, (u64, SystemTime)>` (eigene Rekursion mit `read_dir`, überspringt Links per `symlink_metadata`, Tiefe 8); `pub fn diffs(master: &Path, local_claude: &Path) -> Vec<MirrorDiff>`; `pub fn mirror(master: &Path, local_claude: &Path) -> Result<u32, CommandError>`. Konstante `MTIME_TOLERANCE: Duration = Duration::from_secs(2)`. Fehler beim Kopieren einer Datei brechen ab und nennen die Datei im `CommandError`.
- [ ] `mod.rs`: `pub struct EnvironmentService { last_mirror: Mutex<Option<MirrorRun>> }` (in `lib.rs` per `manage`), `pub fn status(app, database, service) -> Result<EnvironmentStatus, CommandError>` (Master aus `settings::load`, Prüfung nach Entscheidung, `checked_at = now_ms()`), `pub fn run_mirror(...)`.
- [ ] Einstellungen: Feld, Schlüssel `KEY_MASTER_DIR`, Lesen wie `voice_language`, `SettingsChange::MasterDir` mit Zweig in `update` (leer → Schlüssel mit leerem Text schreiben, wie bei den anderen optionalen Texten).
- [ ] Commands nach Kontrakt, in `lib.rs` registrieren; Typen in `src-tauri/examples/gen-bindings.rs` eintragen; `pnpm bindings`.
- [ ] `docs/decisions/038-umgebung.md`: Optionen (a) Prüfen der eigenen Sync-Einrichtung des Users (Profile, feste Pfade) — verworfen, gehört nicht in committeten Code; (b) allgemein: Links unter `~\.claude` + frei wählbarer Master — gewählt; (c) Spiegeln mit Löschen (wie `robocopy /MIR`) — verworfen, ein falsch gewählter Master würde lokale Skills löschen. Konsequenzen: kein Hintergrund-Prüfen; lokal neuere Dateien bleiben unbemerkt.
- [ ] `pnpm check` grün, Commit `feat(settings): Umgebung prüfen und Skills aus einem Master-Ordner spiegeln`.

## Phase 2 — Oberfläche

Lesen: Entwurf (beide Zustände), `src/features/settings/SettingsView.tsx` (`renderSections`, Abschnitt „Skills“, `renderRevealButton`, `save`), `SettingRow.tsx`, `src/features/repositories/RepositoryPicker.tsx` (Ordnerauswahl mit `open({ directory: true, multiple: false, title })`), `src/app/Sidebar.tsx` (Knopf `sidebar__settings`), `src/app/App.tsx`, [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md).

AK:
1. Abschnitt „Umgebung“ zwischen „Skills“ und „Ordner“ mit den Zeilen „Verknüpfungen“, „Master-Ordner“ und — nur mit gültigem Master — „Abgleich“, Texte und Aufbau wie im Entwurf; jede Zeile mit ⓘ-Text aus dem Entwurf.
2. Verknüpfungen: alles gut → „Alle <total> erreichbar“ (grün); sonst „⚠ <n> von <total> zeigt ins Leere“ (Warnfarbe), je kaputtem Link Pfad → Ziel in Mono und „Ziel fehlt · zuletzt geprüft <HH:MM>“, Knopf „Erneut prüfen“. Ohne Links: „Keine Verknüpfungen“.
3. Master-Ordner: ohne Wert „Kein Master-Ordner“ + „Wählen …“; mit Wert Pfad in Mono + „Ändern …“ + „Entfernen“; `master_error` als Satz in Warnfarbe darunter. Wählen/Ändern öffnet die Ordnerauswahl (Titel „Master-Ordner wählen“), speichert per `save({ kind: 'masterDir', value })` und lädt den Stand neu.
4. Abgleich: keine Abweichung → „Gleich“ (grün), mit „· zuletzt gespiegelt <HH:MM> (<n> Dateien)“, falls `last_mirror`; sonst „<a> Skills und <b> Befehle weichen ab“ (Einzahl/Mehrzahl, Null-Teile weglassen) + Knopf „Spiegeln“ (Akzent) + Liste wie im Entwurf (Art, Name, Zustand: „im Master neuer · <TT.MM. HH:MM>“, „fehlt lokal“, „nur lokal · bleibt“). `onlyLocal` zählt nicht in die Abweichungszahl und allein nicht als Abweichung.
5. Der Knopf „Einstellungen“ in der Sidebar trägt einen Punkt (Warnfarbe, `aria-label` „Umgebung braucht Aufmerksamkeit“), solange ein Link kaputt ist oder `onlyMaster`/`masterNewer` vorliegt; geprüft beim App-Start und beim Öffnen der Einstellungen.

- [ ] Store `src/stores/environment.ts`: `status: EnvironmentStatus | null`, `setStatus`, abgeleitet `needsAttention(status): boolean` in `src/features/environment/environmentTexts.ts`.
- [ ] Hook `src/features/environment/useEnvironment.ts`: lädt beim Einhängen; `reload()`, `mirror()` (setzt `isMirroring`), Fehler als Satz über `commandErrorText`. Einmal in `App.tsx` beim Start laden; `SettingsView` ruft `reload()` beim Öffnen.
- [ ] `src/features/environment/EnvironmentSection.tsx` + `.css` (BEM `environment-section__*`), eingebunden in `renderSections` zwischen „Skills“ und „Ordner“; Texte in `environmentTexts.ts`.
- [ ] `Sidebar.tsx`: Punkt nach AK 5 (Klasse `sidebar__settings-dot`).
- [ ] Doc: `docs/code-map.md` neue Zeile „Umgebung“ (Oberfläche `src/features/environment/`, Store, Wrapper; Core `src-tauri/src/environment/`, Commands, ADR 038) und Zeile „Einstellungen“ um `master_dir`; `docs/glossary.md` neue Einträge **Master-Ordner** („Frei gewählter Ordner mit den Originalen der Skills und Befehle; der Verwalter vergleicht `~\.claude` damit und spiegelt auf Klick (ADR 038).“) und **Spiegeln** („Kopiert aus dem Master-Ordner, was dort neuer ist oder lokal fehlt; löscht nie.“).
- [ ] Plan-Abschluss: Bottom-Sektionen, Archiv, STATE.md, Versions-Tag.
- [ ] `pnpm check` grün, Commit `feat(settings): Abschnitt Umgebung und Hinweis in der Sidebar`.

## Wackelstellen (nur Plan, kein Prüfauftrag)

- 🟡 Ob `symlink_metadata().file_type().is_symlink()` unter Windows auch Junctions (nicht nur symbolische Links) meldet, ist im Projekt nicht gemessen. Falls nicht, findet „Verknüpfungen“ die Junction nicht — dann in FINDINGS.md festhalten; Ausweg ohne Abhängigkeit wäre der Vergleich `fs::canonicalize(path) != path`.
- 🟡 Synchronisierte Laufwerke (Google Drive) setzen beim Herunterladen eigene Änderungszeiten; die 2-s-Toleranz fängt Rundung, nicht ganze Zeitzonen-Sprünge. Kopiert Spiegeln dann zu viel, ist das harmlos (überschreibt mit gleichem Inhalt).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
