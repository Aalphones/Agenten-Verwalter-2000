# Umgebung in den Einstellungen

Ziel: Ein neuer Abschnitt „Umgebung“ in den Einstellungen meldet kaputte Verknüpfungen (Junctions, symbolische Links) unter `~\.claude` und gleicht dessen Skills, Befehle, Ausgabestile und die Regeldatei `CLAUDE.md` mit einem frei wählbaren Master-Ordner ab. „Spiegeln“ kopiert, was im Master neuer ist oder lokal fehlt, und löscht nie. Der Verwalter kennt dabei weder Profile noch Accounts noch persönliche Pfade — der Master-Ordner liegt nur als Einstellung in der lokalen Datenbank. Entwurf: [artifacts/entwurf-umgebung.html](artifacts/entwurf-umgebung.html), vom User am 2026-10-22 freigegeben; am 2026-11-04 um Ausgabestile und Regeldatei erweitert (User-Entscheidung) und im Entwurf nachgezogen.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Einstellungen“, „Skills und Befehle“, „App-Rahmen“), [docs/glossary.md](../../glossary.md), [docs/conventions/](../../conventions/), [ADR 012](../../decisions/012-einstellungen-farbschema-und-listen.md) (Einstellungsseite). Fehlerklassen geprüft (Vault: TypeScript, React): keine einschlägig; für Rust und Tauri gibt es keine Einträge.

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: Verknüpfungen prüfen, Abgleich, Spiegeln, Einstellung Master-Ordner; ADR 038 | standard | pending |
| 2 | Oberfläche: Abschnitt „Umgebung“, Punkt am Knopf „Einstellungen“; Doku-Abschluss | standard | pending |

**Rahmen:** strikt 1 → 2, direkt auf `main`, ein Commit pro Phase, Scope `settings`. `pnpm check` grün vor jedem Commit, `cargo` im PATH, keine neuen Abhängigkeiten (nur `std::fs`), Bindings mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Planabschluss mit Versions-Tag (Minor-Version).

## Festgelegte Entscheidungen

- **Verknüpfung** = Eintrag direkt unter `~\.claude` oder direkt in einem echten Unterordner davon (zwei Ebenen: ein Unterordner kann selbst aus Links bestehen, etwa eine eingeschränkte Ansicht auf einen anderen Ordner), dessen `fs::symlink_metadata` einen Link meldet (`file_type().is_symlink()`). In einen Link wird nicht hineingegangen. **Kaputt**, wenn `fs::metadata` (folgt dem Link) scheitert. Ziel über `fs::read_link`, `None`, wenn auch das scheitert. Der Anzeige-Pfad ist der volle Pfad, damit die Ebene erkennbar ist. Gemessen am 2026-11-04 unter Windows 11: `is_symlink()` meldet Junctions als Link; bei einer kaputten Junction scheitert `fs::metadata`, und `fs::read_link` liefert das Ziel; `fs::copy` behält die Änderungszeit.
- **Einträge des Abgleichs** (Art → was zählt): **Skill** = Unterordner von `skills` mit einer `SKILL.md` (wie `skills/mod.rs`; andere Ordner, etwa vom Programm verwaltete, zählen nicht); **Befehl** = `*.md` direkt in `commands`; **Ausgabestil** = `*.md` direkt in `output-styles` (Unterordner bleiben außen vor); **Regeldatei** = `CLAUDE.md` direkt im Master-Ordner gegen `~\.claude\CLAUDE.md`. `settings.json` gehört nicht dazu (sie trägt Maschinen-Schlüssel). Ist die lokale `CLAUDE.md` selbst ein Link, gilt sie als gleich und wird nie überschrieben (Spiegeln schriebe sonst durch den Link in den Master).
- **Abgleich** vergleicht je Eintrag Datei für Datei relativ zu dessen Ordner **nach Inhalt** (erst die Größe, bei gleicher Größe die Bytes). Die Änderungszeit bestimmt nur die Richtung: ein synchronisiertes Laufwerk setzt eigene Zeiten, sie taugen nicht als Maßstab für „anders“. Zustände: `onlyMaster` (fehlt lokal ganz), `masterNewer` (mindestens eine Datei fehlt lokal oder weicht ab, und die Master-Datei ist die neuere), `localNewer` (weicht ab, lokal ist neuer: bleibt, zählt nicht als Abweichung), `onlyLocal` (nur lokal, bleibt). Gleiche Einträge tauchen nicht auf. Dateien nur lokal innerhalb eines gemeinsamen Eintrags werden ignoriert. Dateien im Master, deren Name auf eine Konfliktkopie des synchronisierten Laufwerks deutet (` (<Zahl>)`, `(Kopie)`, `konflikt`, `conflict`, ohne Beachtung der Schreibweise), zählen nicht mit. Spiegeln kopiert nie rückwärts.
- **Spiegeln** kopiert jede Datei, die lokal fehlt oder abweicht und im Master neuer ist (Zustände `onlyMaster`, `masterNewer`), per `fs::copy` (behält unter Windows die Änderungszeit), legt fehlende Ordner an, löscht nichts, überschreibt nie eine lokal neuere Datei, folgt im Master keinen Links (Unterordner mit Link werden übersprungen). Tiefe höchstens 8.
- **Geprüft wird** beim App-Start und bei jedem Öffnen der Einstellungen, sonst nie (kein Hintergrund-Thread).
- **Master-Ordner gültig**, wenn er existiert, nicht `~\.claude` selbst ist und mindestens eines von `skills`, `commands`, `output-styles` oder die Datei `CLAUDE.md` enthält; sonst Satz in `master_error`, kein Abgleich.
- **„Zuletzt gespiegelt“** lebt nur im Speicher des Core bis zum App-Ende.

## Kontrakt

```rust
// src-tauri/src/environment/model.rs, camelCase, derive(TS)
pub struct BrokenLink { pub path: String, pub target: Option<String> }
pub struct LinkCheck { pub total: u32, pub broken: Vec<BrokenLink> }
#[serde(rename_all = "camelCase")] pub enum MirrorKind { Skill, Command, OutputStyle, Rules } // eigene Aufzählung, nicht SkillKind: der Plan hängt nicht am Skills-Modell
#[serde(rename_all = "camelCase")] pub enum MirrorState { OnlyMaster, MasterNewer, LocalNewer, OnlyLocal }
pub struct MirrorDiff {
    pub kind: MirrorKind,
    pub name: String,             // Ordnername des Skills; Dateiname ohne .md bei Befehl und Ausgabestil; "CLAUDE.md" bei der Regeldatei
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

Lesen: `src-tauri/src/settings/model.rs` + `mod.rs` (`load`, `update`, `DEFAULT_SETTINGS`, Muster `default_codex_model` für einen optionalen Text), `src-tauri/src/db/settings.rs`, `src-tauri/src/skills/mod.rs` (`skills_dir`; Skill = Unterordner mit `SKILL.md`), `src-tauri/src/filesystem/workspace.rs` (`home_dir`), `src-tauri/src/commands/settings.rs` (Command-Muster), `src-tauri/src/lib.rs` (Registrierung, `manage`), [docs/conventions/rust.md](../../conventions/rust.md).

AK:
1. Mit einer kaputten Junction direkt unter `~\.claude` oder direkt in einem seiner Unterordner liefert `environment_status` sie in `links.broken` samt Ziel und vollem Pfad; `links.total` zählt alle Links dieser zwei Ebenen.
2. Mit gesetztem gültigem Master liefert `diffs` genau die abweichenden Skills, Befehle, Ausgabestile und die Regeldatei nach den Regeln oben; ohne Master ist `diffs` leer und `master_dir` `null`. Ein Ordner unter `skills` ohne `SKILL.md` erscheint nicht, eine Datei mit Konfliktnamen im Master zählt nicht, eine Datei mit gleichem Inhalt aber anderer Änderungszeit erscheint nicht.
3. `environment_mirror` kopiert nach den Regeln, setzt `last_mirror`, liefert danach einen Stand ohne `onlyMaster`/`masterNewer`; lokal neuere Dateien und eine lokale `CLAUDE.md`, die ein Link ist, bleiben unberührt.
4. Ein ungültiger Master liefert `master_error` mit Satz („Ordner nicht gefunden.“ / „Das ist der Ordner .claude selbst.“ / „Im Ordner liegen weder skills, commands, output-styles noch CLAUDE.md.“).

- [ ] Neues Modul `src-tauri/src/environment/` (`mod.rs`, `model.rs`, `links.rs`, `mirror.rs`; in `lib.rs` `mod environment;`), Modul-Kommentar „Umgebung des Benutzers: Verknüpfungen unter ~\\.claude, Abgleich mit einem Master-Ordner (ADR 038).“
- [ ] `links.rs`: `pub fn check(claude_dir: &Path) -> LinkCheck` nach Entscheidung (zwei Ebenen, nicht in Links hinein); Anzeige-Pfad = voller Pfad als Text.
- [ ] `mirror.rs`: `fn files_of(dir: &Path, depth: u32) -> BTreeMap<PathBuf /*relativ*/, (u64, SystemTime)>` (eigene Rekursion mit `read_dir`, überspringt Links per `symlink_metadata` und Konfliktnamen, Tiefe 8); `fn same_content(a: &Path, b: &Path, size_a: u64, size_b: u64) -> io::Result<bool>` (erst Größe, dann Bytes); `fn entries(root: &Path) -> Vec<(MirrorKind, String, PathBuf)>` (die Einträge einer Wurzel nach den Regeln oben, für `~\.claude` wie für den Master); `pub fn diffs(master: &Path, local_claude: &Path) -> Vec<MirrorDiff>`; `pub fn mirror(master: &Path, local_claude: &Path) -> Result<u32, CommandError>`. Keine Toleranz für Änderungszeiten: der Inhalt entscheidet, ob etwas abweicht, die Zeit nur die Richtung. Fehler beim Kopieren einer Datei brechen ab und nennen die Datei im `CommandError`.
- [ ] `mod.rs`: `pub struct EnvironmentService { last_mirror: Mutex<Option<MirrorRun>> }` (in `lib.rs` per `manage`), `pub fn status(app, database, service) -> Result<EnvironmentStatus, CommandError>` (Master aus `settings::load`, Prüfung nach Entscheidung, `checked_at = now_ms()`), `pub fn run_mirror(...)`.
- [ ] Einstellungen: Feld, Schlüssel `KEY_MASTER_DIR`, Lesen und Schreiben wie `default_codex_model` (`load` liest leeren Text als „nicht gesetzt“, `update` schreibt `None` als leeren Text), `SettingsChange::MasterDir` mit Zweig in `update`.
- [ ] Commands nach Kontrakt, in `lib.rs` registrieren; Typen in `src-tauri/examples/gen-bindings.rs` eintragen; `pnpm bindings`.
- [ ] `docs/decisions/038-umgebung.md`: Optionen (a) Prüfen der eigenen Sync-Einrichtung des Users (Profile, feste Pfade) — verworfen, gehört nicht in committeten Code; (b) allgemein: Links unter `~\.claude` + frei wählbarer Master — gewählt; (c) Spiegeln mit Löschen (wie `robocopy /MIR`) — verworfen, ein falsch gewählter Master würde lokale Skills löschen; (d) Vergleich allein nach Änderungszeit — verworfen, ein synchronisiertes Laufwerk setzt eigene Zeiten und meldete gleiche Dateien als abweichend, gewählt: Inhalt entscheidet, Zeit nur die Richtung; (e) Umfang nur Skills und Befehle — verworfen, Ausgabestile und `CLAUDE.md` wirken in jeder Session und würden sonst bei grünem „Gleich“ veraltet bleiben, `settings.json` bleibt draußen (Maschinen-Schlüssel). Konsequenzen: kein Hintergrund-Prüfen; lokal neuere Dateien werden nur angezeigt („lokal neuer · bleibt“), nie überschrieben.
- [ ] `pnpm check` grün, Commit `feat(settings): Umgebung prüfen und Skills aus einem Master-Ordner spiegeln`.

## Phase 2 — Oberfläche

Lesen: Entwurf (beide Zustände), `src/features/settings/SettingsView.tsx` (`renderSections`, Abschnitt „Skills“, `renderRevealButton`, `save`), `SettingRow.tsx`, `src/features/repositories/RepositoryPicker.tsx` (Ordnerauswahl mit `open({ directory: true, multiple: false, title })`), `src/app/Sidebar.tsx` (Knopf `sidebar__settings` mit dem bestehenden Punkt `sidebar__settings-dot--update`), `src/app/App.tsx`, [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md).

AK:
1. Abschnitt „Umgebung“ zwischen „Skills“ und „Ordner“ mit den Zeilen „Verknüpfungen“, „Master-Ordner“ und — nur mit gültigem Master — „Abgleich“, Texte und Aufbau wie im Entwurf; jede Zeile mit ⓘ-Text aus dem Entwurf.
2. Verknüpfungen: alles gut → „Alle <total> erreichbar“ (grün); sonst „⚠ <n> von <total> zeigt ins Leere“ (Warnfarbe), je kaputtem Link Pfad → Ziel in Mono und „Ziel fehlt · zuletzt geprüft <HH:MM>“, Knopf „Erneut prüfen“. Ohne Links: „Keine Verknüpfungen“.
3. Master-Ordner: ohne Wert „Kein Master-Ordner“ + „Wählen …“; mit Wert Pfad in Mono + „Ändern …“ + „Entfernen“; `master_error` als Satz in Warnfarbe darunter. Wählen/Ändern öffnet die Ordnerauswahl (Titel „Master-Ordner wählen“), speichert per `save({ kind: 'masterDir', value })` und lädt den Stand neu.
4. Abgleich: keine Abweichung → „Gleich“ (grün), mit „· zuletzt gespiegelt <HH:MM> (<n> Dateien)“, falls `last_mirror`; sonst „<Teile> weichen ab“ (bei genau einem Teil „weicht ab“) mit den Teilen „<a> Skills“, „<b> Befehle“, „<c> Ausgabestile“ (Einzahl „1 Skill“, „1 Befehl“, „1 Ausgabestil“) und „die Regeldatei“, Null-Teile weggelassen, „und“ vor dem letzten, + Knopf „Spiegeln“ (Akzent) + Liste wie im Entwurf (Art „Skill“/„Befehl“/„Ausgabestil“/„Regeldatei“, Name, Zustand: „im Master neuer · <TT.MM. HH:MM>“, „fehlt lokal“, „lokal neuer · bleibt“, „nur lokal · bleibt“). `localNewer` und `onlyLocal` zählen nicht in die Abweichungszahl und lösen allein weder den Knopf „Spiegeln“ noch den Punkt aus; bei „Gleich“ stehen sie, falls vorhanden, eingeklappt darunter („<n> Hinweise“).
5. Der Knopf „Einstellungen“ in der Sidebar trägt einen Punkt (Warnfarbe, `aria-label` „Umgebung braucht Aufmerksamkeit“), solange ein Link kaputt ist oder `onlyMaster`/`masterNewer` vorliegt; geprüft beim App-Start und beim Öffnen der Einstellungen. Der Punkt ist ein eigener Modifikator `sidebar__settings-dot--environment` neben dem bestehenden `--update`; beide können gleichzeitig stehen.

- [ ] Store `src/stores/environment.ts`: `status: EnvironmentStatus | null`, `setStatus`, abgeleitet `needsAttention(status): boolean` in `src/features/environment/environmentTexts.ts`.
- [ ] Hook `src/features/environment/useEnvironment.ts`: lädt beim Einhängen; `reload()`, `mirror()` (setzt `isMirroring`), Fehler als Satz über `commandErrorText`. Einmal in `App.tsx` beim Start laden; `SettingsView` ruft `reload()` beim Öffnen.
- [ ] `src/features/environment/EnvironmentSection.tsx` + `.css` (BEM `environment-section__*`), eingebunden in `renderSections` zwischen „Skills“ und „Ordner“; Texte in `environmentTexts.ts`.
- [ ] `Sidebar.tsx`: Punkt nach AK 5 (Modifikator `sidebar__settings-dot--environment` neben dem bestehenden `--update`).
- [ ] Doc: `docs/code-map.md` neue Zeile „Umgebung“ (Oberfläche `src/features/environment/`, Store, Wrapper; Core `src-tauri/src/environment/`, Commands, ADR 038) und Zeile „Einstellungen“ um `master_dir`; `docs/glossary.md` neue Einträge **Master-Ordner** („Frei gewählter Ordner mit den Originalen von Skills, Befehlen, Ausgabestilen und `CLAUDE.md`; der Verwalter vergleicht `~\.claude` damit und spiegelt auf Klick (ADR 038).“) und **Spiegeln** („Kopiert aus dem Master-Ordner, was dort neuer ist oder lokal fehlt; löscht nie.“).
- [ ] Plan-Abschluss: Bottom-Sektionen, Archiv, STATE.md (die Zeile „Danach im Backlog“ zu diesem Plan nennt die Funktion `send`, die der Plan nicht anfasst: streichen; dazu „Geparkt seit 2026-10-22“ nachführen), Versions-Tag.
- [ ] `pnpm check` grün, Commit `feat(settings): Abschnitt Umgebung und Hinweis in der Sidebar`.

## Wackelstellen (nur Plan, kein Prüfauftrag)

- 🟡 Die Namensmuster für Konfliktkopien (` (<Zahl>)`, `(Kopie)`, `konflikt`, `conflict`) raten, wie ein synchronisiertes Laufwerk Kopien benennt. Weicht es ab, rutscht eine Kopie in die Liste und beim Spiegeln lokal hinein: harmlos, aber Müll. Gemessen am 2026-11-04: im Master heute kein Treffer.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
