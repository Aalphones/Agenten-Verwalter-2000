# Plan: Bibliothek — ein Ordner für Anweisungen, Skills und Wissen

Der Master-Ordner (Skills, Befehle, Ausgabestile, `CLAUDE.md`) und der Developer Vault werden ein Ordner: die **Bibliothek**. Der Benutzer gibt nur noch diesen einen Ordner an. Der Verwalter gleicht daraus wie bisher Skills, Befehle, Ausgabestile und `CLAUDE.md` mit `~\.claude` ab und durchsucht zugleich Anweisungen (samt Gedächtnis: die Dateien direkt in `memory/`), Skills und das Wissen im Unterordner `_vault/`. Alles andere im Ordner (`memory/_archiv/`, `hooks/`, Logs, `settings.json`, `codex/`, `continue/`, `setup.cmd` …) liest der Verwalter nie — eine feste Erlaubnisliste; die Ausschlussdatei `.vaultignore` dient nur noch für einzelne Dateien innerhalb der Liste. Ein Ordner ohne Skills, Befehle, Ausgabestile und `CLAUDE.md` bleibt ein reiner Vault wie bisher.

Entscheidungen und Begründung: [ADR 069](../../decisions/069-bibliothek.md) (ändert ADR 038 und ADR 068). Entwurf: [artifacts/README.md](artifacts/README.md).

## Overview

| Phase | Titel | Stufe | Wave | Status | Schätzung |
|---|---|---|---|---|---|
| 1 | [Aufbau der Bibliothek im Core](phase-1-aufbau-im-core.md) | heikel | 1 | complete | 3 h |
| 2 | [Ein Ordner in den Einstellungen](phase-2-ein-ordner.md) | standard | 2 | pending | 2,5 h |
| 3 | [Suchdialog mit Anweisungen, Skills und Wissen](phase-3-suchdialog-gruppen.md) | standard | 3 | pending | 2 h |

Reihenfolge strikt 1 → 2 → 3. Phase 2 stellt den gelesenen Ordner auf den Master-Ordner um; vorher muss die Erlaubnisliste aus Phase 1 stehen, sonst landen `hooks/`, die Logs, `settings.json` und `memory/_archiv/` im Index und über `vault_get` bei den Agenten. Phase 3 braucht die Gruppenfelder aus Phase 1 und die Benennung aus Phase 2; drei Phasen parallel zu schneiden spart hier keine Zeit. Erste Sichtabnahme: Phase 2 (Einstellungen › Skills & Umgebung › Bibliothek).

## Kontrakt

Alle Typen über die Tauri-Grenze mit `derive(TS)`, eingetragen in `src-tauri/examples/gen-bindings.rs`, danach `pnpm bindings`. Der Code behält den Feature-Namen `vault` in allen Schichten (Modul, Befehle, Werkzeuge `vault_search`/`vault_get`); „Bibliothek“ ist der Begriff in Oberfläche, Einstellungen und Doku.

**Aufbau** (`src-tauri/src/vault/library.rs`, Phase 1):

```rust
/// Unterordner der Bibliothek, in dem das Wissen liegt.
pub const KNOWLEDGE_DIR: &str = "_vault";

/// serde: "library" | "plain"
pub enum VaultLayout { Library, Plain }

/// Library, wenn der Ordner `skills`, `commands`, `output-styles` oder `CLAUDE.md` enthält
/// (dieselbe Prüfung wie der Master-Ordner: `crate::environment::mirror::has_mirrorable`).
pub fn layout(root: &Path) -> VaultLayout;
pub fn layout_name(layout: VaultLayout) -> &'static str;          // "library" | "plain"
pub fn layout_from_name(name: &str) -> VaultLayout;               // unbekannt = Plain

/// Ob ein Eintrag der ersten Ebene eingelesen wird. Plain: immer. Library: nur die Ordner
/// `skills`, `commands`, `output-styles`, `memory`, `_vault` und die Dateien `CLAUDE.md`,
/// `AGENTS.md`; Vergleich ohne Beachtung der Schreibweise.
pub fn is_included_top(layout: VaultLayout, name: &str, is_dir: bool) -> bool;

/// Library: Unterordner von `memory` (z. B. `memory/_archiv`) werden nicht betreten — aus
/// `memory` zählen nur die Dateien direkt darin. Plain: immer `true`.
pub fn is_included_below(layout: VaultLayout, parent_top: &str, is_dir: bool) -> bool;

/// Library: `skills/<name>`, wenn `skills/<name>/SKILL.md` unter den Dateien ist.
pub fn skill_folders(layout: VaultLayout, files: &[&str]) -> HashSet<String>;

/// Überschreibt Art, Titel und Einstieg nach dem Ort (nur Library), nach `extract`.
pub fn apply_place(layout: VaultLayout, artifact: &str, meta: &mut Meta);

pub struct Place { pub group: &'static str, pub subgroup: String }
pub fn place(layout: VaultLayout, path: &str) -> Place;
```

Regeln von `apply_place` (Library; `artifact` = Pfad des Artefakts):

| Artefakt | `kind` | `title` | `entrypoint` |
|---|---|---|---|
| `CLAUDE.md`, `AGENTS.md` (Wurzel) | `rules` | unverändert | unverändert |
| `output-styles/<x>.md` (direkt) | `style` | unverändert | unverändert |
| `commands/<x>.md` (direkt) | `command` | `/<x>` | unverändert |
| `memory/<x>.md` (direkt) | `memory` | unverändert | unverändert |
| `skills/<x>` (Skill-Ordner) | `skill` | `<x>` | `skills/<x>/SKILL.md` |
| alles andere | unverändert | unverändert | unverändert |

Regeln von `place` (Gruppen-Ids und Untergruppen-Ids, Labels nur in der Oberfläche):

| Layout | Pfad | `group` | `subgroup` |
|---|---|---|---|
| Library | `CLAUDE.md`, `AGENTS.md` | `anweisungen` | `grundregeln` |
| Library | `output-styles/…` | `anweisungen` | `ausgabestile` |
| Library | `memory/…` | `anweisungen` | `gedaechtnis` |
| Library | `skills/mode-…` | `skills` | `arbeitsweise` |
| Library | `skills/lang-…` | `skills` | `sprachen` |
| Library | `skills/framework-…` | `skills` | `frameworks` |
| Library | übrige `skills/…` | `skills` | `werkzeuge` |
| Library | `commands/…` | `skills` | `befehle` |
| Library | `_vault/<ordner>/…` | `wissen` | `<ordner>` |
| Library | `_vault/<datei>` | `wissen` | `""` (Hauptordner) |
| Plain | `<ordner>/…` | `wissen` | `<ordner>` |
| Plain | `<datei>` | `wissen` | `""` |

**Status** (`src-tauri/src/vault/model.rs`): `VaultStatus` bekommt `layout: Option<VaultLayout>` (`None` ohne brauchbaren Ordner) und ersetzt `is_empty_dir` durch `can_create_skeleton: bool` — Plain: Ordner ohne sichtbare Einträge; Library: `_vault` fehlt oder hat keine sichtbaren Einträge.

**Treffer** (`src-tauri/src/vault/search.rs`): `VaultHit` bekommt `group: String` und `subgroup: String` aus `place`. Das Layout liegt in der Index-Datei (`meta`, Schlüssel `layout`), geschrieben von `scan::run`; `SCHEMA_VERSION` wird `"2"`, damit jeder bestehende Index neu aufgebaut wird.

**Einstellung** (Phase 2): `Settings.library_dir: Option<String>` (Schlüssel `library_dir`) ersetzt `master_dir` und `vault_dir`; `SettingsChange::LibraryDir { value: Option<String> }` ersetzt `MasterDir` und `VaultDir`. `vault_enabled` bleibt (Schalter „Suche“). Übernahme ohne Migration in `settings::load`: steht der Schlüssel `library_dir` (auch leer), gilt er; sonst `master_dir`, sonst `vault_dir`. Jedes Schreiben von `LibraryDir` schreibt zusätzlich `master_dir` und `vault_dir` leer.

**Grundgerüst**: `skeleton::create(dir)` schreibt bei Library nach `<dir>\_vault\` (Ordner wird angelegt, wenn er fehlt; nur wenn er leer ist), bei Plain wie bisher nach `<dir>\` (nur wenn leer). Sonst schreibt der Verwalter nichts in die Bibliothek.

## Tests

- **Phase 1:** Rust-Tests (`#[cfg(test)] mod tests` in `src-tauri/src/vault/library.rs`) für `is_included_top`, `is_included_below`, `skill_folders`, `apply_place` und `place` nach den Tabellen im Kontrakt, dazu `layout` gegen zwei Ordner unter `std::env::temp_dir()` (mit `skills\` bzw. ohne), die der Test selbst anlegt und wieder löscht. Keine neue Abhängigkeit.
- **Phase 2:** Rust-Test für die Übernahme der Einstellung als reine Funktion `library_dir_from(stored: &HashMap<String, String>) -> Option<String>` in `settings/mod.rs` (Fälle: nur `master_dir`; nur `vault_dir`; beide; `library_dir` leer neben gesetztem `master_dir` → `None`).
- **Phase 3:** keine automatisierten Tests — das Projekt hat kein Testwerkzeug für die Oberfläche, und dieser Plan führt keins ein. Belegt wird mit Bildern.
- Lauf: `cargo test --manifest-path src-tauri/Cargo.toml <modul>` und `pnpm check`. Die Bestands-Tests sind Grundlage; schlagen sie schon vor Phase 1 fehl, wird das vor dem ersten Edit gemeldet.

## Finale Abnahmekriterien

1. In den Einstellungen gibt es einen Abschnitt „Bibliothek“ mit genau einer Ordnerwahl; die Abschnitte „Umgebung“ und „Developer Vault“ gibt es nicht mehr.
2. Nach dem Update zeigt die Ordnerzeile ohne Zutun den bisherigen Master-Ordner (`G:\Meine Ablage\U104_Agents`); Abgleich und Suche arbeiten damit.
3. Der Index der Bibliothek `U104_Agents` enthält keinen Pfad unter `memory/_archiv/`, `hooks/`, `codex/`, `continue/`, `references/`, `_stylePakete/` und keine der Dateien `memory/feedback_local_login_credentials.md` (ausgeschlossen per `.vaultignore` im Master-Ordner), `settings.json`, `improvement-log.md`, `skill-evolution-log.md`, `setup.cmd`, `SETUP.md`, `MIGRATION.md`, `merge-hooks.cjs`; `vault_get` auf eine dieser Dateien endet mit einem Fehlersatz.
4. `vault_search` findet Skills (Art `skill`, ein Treffer je Skill-Ordner), Befehle (Art `command`, Titel `/plan`), Ausgabestile (Art `style`), `CLAUDE.md` (Art `rules`), Memories (Art `memory`) und die Einträge unter `_vault/`.
5. Der Suchdialog heißt „Bibliothek“ und gliedert links nach Anweisungen (Grundregeln, Ausgabestile, Gedächtnis), Skills (Arbeitsweise, Sprachen, Frameworks, Werkzeuge, Befehle) und Wissen (je Ordner unter `_vault/`); Gruppen ohne Treffer fehlen.
6. Die erste Nachricht einer Station nennt nur Treffer aus `_vault/`, nie einen Skill, eine Anweisung oder eine Memory.
7. Ein Ordner ohne `skills`, `commands`, `output-styles` und `CLAUDE.md` funktioniert als reiner Vault wie vor dem Plan (alles eingelesen, nur Gruppe Wissen, Grundgerüst nur in einen leeren Ordner); der Abgleich meldet dann, dass im Ordner nichts abzugleichen ist.
8. `setup.cmd` läuft nach dem Umbau unverändert: die Umsetzung ändert keine Datei im Master-Ordner (`git -C "G:\Meine Ablage\U104_Agents" status --short` ist nach jeder Phase leer, kein Commit einer Phasen-Session liegt im Master), und im Code schreibt außer `vault/skeleton.rs` nichts in die Bibliothek.

## Wackelstellen (nur hier, keine Abnahmeliste)

- **Skill-Texte in der Suche:** die Beschreibungen der Skills sind lange Auslöse-Texte und treffen viele Wörter. Im Stationsauftrag ausgeschlossen (AK 6); im Dialog sorgen die Gruppen für Ordnung. Zeigt die Nutzung zu viel Rauschen, folgt eine Gewichtung (Wissen vor Skills) als eigener Plan.
- **Erster Abgleich auf dem Laufwerk:** der Wechsel von `_vault` auf `U104_Agents` baut den Index neu; liegen Skills nur online, lädt der erste Abgleich sie herunter (klein, einige hundert Dateien).
- **Zwei Rechner:** die Einstellung ist pro Rechner. Auf dem zweiten Rechner greift die Übernahme aus `master_dir` ebenso, sofern dort ein Master-Ordner eingestellt war.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
