# Ordner ohne Git als Arbeitsordner

Ziel: In „Neues Vorhaben“ (Schritt 2) und über „+ Repository“ in der Übersicht lässt sich auch ein Ordner wählen, der kein Git-Repository ist. Der Agent bekommt ihn wie einen Haupt-Checkout per `--add-dir`, seine Skills und seine `CLAUDE.md` gelten in der Session. Die App zeigt für diesen Ordner keine Changes, sagt das aber in der Changes-Übersicht, statt „keine Änderungen“ vorzutäuschen. Der User kennt und akzeptiert das Risiko: kein Diff, kein Zurück über Git.

Kontext für jeden Umsetzer: [AGENTS.md](../../AGENTS.md), [docs/code-map.md](../code-map.md), [docs/glossary.md](../glossary.md), die Konventionen unter [docs/conventions/](../conventions/) (vor allem `rust.md`, `react.md`, `tailwind.md`, `linting.md`, `commits.md`, `releases.md`), [ADR 005](../decisions/005-repositories-und-worktrees.md), [ADR 006](../decisions/006-changes-und-diff.md), [ADR 010](../decisions/010-worktrees-durch-den-agenten.md). Fehlerklassen aus dem Vault (React, TypeScript, Git, SQLite, Claude Code) geprüft: keine einschlägig.

## Phasen

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: Ordner aufnehmen, Checkout-Art `folder`, Agent-Start, Changes, ADR 018 | standard | complete |
| 2 | Oberfläche: Auswahl, Menü, Changes-Übersicht, Texte, Doku, Release | standard | pending |

**Reihenfolge:** vor allen geparkten Plänen (STATE.md). Phasen strikt 1 → 2. Umsetzung direkt auf `main`, ein Commit pro Phase, Commit-Scope `repositories`. Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach Phase 1 `pnpm bindings` und die erzeugten Dateien mitcommitten. Die neuen Bindings brechen in der Oberfläche genau eine Stelle (`describeAddError` prüft `notARepository`); Phase 1 ersetzt sie, damit auch ihr Commit `pnpm check` grün hat.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 018](../decisions/018-ordner-ohne-git.md) „Ordner ohne Git“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Vergeben sind 001–012 auf der Platte und 013–017 in den geparkten Plänen; dieser Plan nimmt 018, auch wenn er vor ihnen umgesetzt wird — die Nummern der anderen Pläne bleiben, wie sie sind.

- **Keine Migration, die Art steht im Dateisystem.** Ein bekannter Eintrag ist ein Git-Repository, wenn `<Pfad>\.git` existiert (Ordner oder Datei), sonst ein Ordner ohne Git; „nicht gefunden“ heißt nur noch: der Ordner fehlt. Verworfen: Spalte `kind` in `repositories` — kostet eine Migration (Nummer 7 ist im Plan „Session-Changes“ reserviert) und hielte einen Ordner, in dem später `git init` lief, künstlich als „ohne Git“ fest. Folge: Ein Repository, dessen `.git` gelöscht wurde, erscheint als Ordner ohne Git statt als „nicht gefunden“.
- **In der Session ist die Art fest.** `session_repositories.checkout` bekommt den Wert `folder` (Spalte ist `TEXT`, keine Migration); `folder`, `branch`, `base_ref`, `base_commit` sind dabei leere Zeichenketten. Ein Ordner, der nach dem Anlegen `git init` bekommt, bleibt in dieser Session ein Ordner ohne Git.
- **Ob ein gewählter Pfad Git hat, entscheidet das Dateisystem, nicht ein Git-Fehler.** Liegt in dem Pfad oder einem Ordner darüber ein `.git`, ist er ein Repository: wie bisher speichert die App dessen Wurzel, und scheitert `git rev-parse` (z. B. „dubious ownership“), bleibt das ein Fehler. Nur ohne jedes `.git` darüber wird der Pfad als Ordner ohne Git gespeichert. Verworfen: jeden Git-Fehler als „kein Repository“ lesen — ein Repository mit Git-Problem würde still zum Ordner ohne Changes.
- **Zu umfassende Ordner sind gesperrt** (nur für Ordner ohne Git, Repositories bleiben wie bisher): Laufwerkswurzel (`C:\`), der Benutzerordner selbst und jeder Ordner darüber (`C:\Users`), der Datenordner der App `<Benutzerordner>\.verwalter` samt allem darin. Grund: AGENTS.md Regel 5 — der Agent bekommt nicht das Benutzerverzeichnis, und im Datenordner liegen Datenbank und alle Workspaces. Neuer Fehler `CommandError::FolderNotAllowed(Pfad)`.
- **Changes:** Ordner ohne Git liefern keinen Eintrag in `SessionChanges.repositories`, sondern ihre Namen in einer neuen Liste `SessionChanges.plain_folders`. Die Positions-Schlüssel der übrigen Einträge bleiben, wie sie sind (Position = Index in `session_repositories`). Die Changes-Übersicht zeigt je Ordner eine Zeile „Ordner ohne Git — die App sieht hier keine Änderungen.“ Verworfen: Eintrag mit `error` — erschiene rot und als Alarm für einen gewollten Zustand.
- **`CommandError::NotARepository` entfällt.** Einziger Erzeuger war `repositories::add` (Ablehnung eines Ordners ohne Git); genau diese Ablehnung fällt weg.
- **Begriff:** „Ordner ohne Git“ in Oberfläche, Glossar und Doku; im Code `RepositoryKind::Folder` und `RepositoryCheckout::Folder`. Die Überschrift „Repositories“ bleibt.

## Kontrakt

`src-tauri/src/repositories/model.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryKind { Git, Folder }

pub struct KnownRepository {
    pub id: String,
    pub name: String,
    pub path: String,
    /// `Git`, wenn `<path>\.git` existiert, sonst `Folder`.
    pub kind: RepositoryKind,
    pub skill_count: u32,
    /// Der Ordner fehlt.
    pub is_missing: bool,
}
```

`src-tauri/src/changes/model.rs` — `SessionChanges` bekommt `pub plain_folders: Vec<String>` (Namen der Session-Repositories mit Checkout-Art `Folder`, in Positions-Reihenfolge; für sie gibt es keine Changes).

`src-tauri/src/error.rs` — `NotARepository` raus; neu `#[error("Ordner nicht erlaubt: {0}")] FolderNotAllowed(String)` (Inhalt: der gewählte Pfad). TS-Seite: `kind: 'folderNotAllowed'`.

`src-tauri/src/worktrees/mod.rs` — `RepositoryCheckout` bekommt `Folder` (der Agent arbeitet direkt in `repository_path`, kein Git).

`repository_add` bekommt zusätzlich `app: tauri::AppHandle` (für den Benutzerordner); der Wrapper `addRepository(path)` in `src/lib/repositories.ts` bleibt in der Signatur gleich.

## Phase 1 — Core

**Lesen vorher:** `src-tauri/src/repositories/mod.rs` + `model.rs`, `src-tauri/src/commands/repositories.rs`, `src-tauri/src/worktrees/mod.rs`, `src-tauri/src/db/session_repositories.rs`, `src-tauri/src/changes/mod.rs` + `model.rs`, `src-tauri/src/error.rs`, `src-tauri/src/filesystem/workspace.rs` (`home_dir`, `data_dir`), in `src-tauri/src/sessions/registry.rs` die Funktion `start_process`, `docs/conventions/rust.md`.

**AK der Phase:**

1. `repositories::add` mit einem Ordner ohne `.git` in ihm und allen Ordnern darüber speichert den Pfad (ohne abschließenden `\`) und gibt `kind: Folder` zurück; ein zweites Hinzufügen desselben Pfads (beliebige Groß-/Kleinschreibung) liefert den vorhandenen Eintrag.
2. Ein Pfad in einem Git-Repository verhält sich wie bisher (Wurzel gespeichert, `kind: Git`); scheitert dort `git::toplevel`, kommt dessen Fehler zurück, kein Eintrag entsteht.
3. `C:\`, der Benutzerordner, `C:\Users` und `<Benutzerordner>\.verwalter\…` ergeben `FolderNotAllowed`, wenn sie kein `.git` haben.
4. Eine neue Session und „Repository anhängen“ mit einem Ordner ohne Git speichern Checkout-Art `folder`; beim Agent-Start steht der Ordner in `--add-dir`, für ihn gibt es keine `--allowedTools`-Regel und keine Ticket-Worktree-Erkennung; fehlt der Ordner, bekommt der Chat den bekannten Fehler-Eintrag „Repository nicht gefunden“.
5. `changes::load` ruft für einen Ordner ohne Git kein `git` auf und nennt ihn in `plain_folders`; `changes::file_diff` lehnt ihn mit `CommandError::Internal` ab.
6. `pnpm bindings` ausgeführt, `pnpm check` grün.

**Checkliste:**

- [x] `error.rs`: Variante `NotARepository` löschen, `FolderNotAllowed(String)` mit `#[error("Ordner nicht erlaubt: {0}")]` hinter `RepositoryMissing` einfügen.
- [x] `repositories/model.rs`: `RepositoryKind` und das Feld `kind` nach Kontrakt; Doku-Kommentar von `is_missing` auf „Der Ordner fehlt.“
- [x] `repositories/mod.rs`, `add(database, path, home: &Path)`:
  - Pfad normalisieren: `path.trim_end_matches(['\\', '/'])`, außer das Ergebnis endet auf `:` (dann `\` wieder anhängen, damit `C:\` als Wurzel erkennbar bleibt).
  - `has_git_above(path)` (neue private Funktion): `Path::new(path).ancestors().any(|dir| dir.join(".git").exists())`.
  - `true` → bisheriger Weg über `git::toplevel`, aber Fehler **unverändert** weiterreichen (kein Umwandeln von `CommandError::Git`).
  - `false` → `check_folder_allowed(Path::new(&normalized), home)?` (neue private Funktion, s. u.), dann `root = PathBuf::from(normalized)`; Name und Doppelten-Prüfung wie bisher.
  - `check_folder_allowed(dir, home)`: Vergleich über `normalized` = `to_string_lossy()`, `/` → `\`, ohne abschließendes `\`, `to_lowercase()`. Gesperrt, wenn `dir.parent().is_none()` (Laufwerkswurzel), wenn `home_n == dir_n` oder `home_n.starts_with(&format!("{dir_n}\\"))` (Benutzerordner oder darüber), oder wenn `dir_n == data_n` oder `dir_n.starts_with(&format!("{data_n}\\"))` mit `data_n` aus `home.join(".verwalter")`. Gesperrt → `Err(CommandError::FolderNotAllowed(<Pfad wie gewählt>))`. Den Ordnernamen `.verwalter` nicht neu hart kodieren, wenn `filesystem::workspace` eine Konstante dafür hat — sonst dort eine `pub const DATA_DIR_NAME: &str = ".verwalter";` anlegen und in `data_dir` mitbenutzen.
- [x] `repositories/mod.rs`, `describe`: `is_missing = !root.is_dir()`; `kind = if root.join(".git").exists() { Git } else { Folder }`; `skill_count` wie bisher nur, wenn nicht fehlend.
- [x] `commands/repositories.rs`, `repository_add`: Parameter `app: tauri::AppHandle` ergänzen, `let home = crate::filesystem::workspace::home_dir(&app)?;`, `repositories::add(&database, &path, &home)`.
- [x] `worktrees/mod.rs`:
  - `RepositoryCheckout::Folder` mit Doku-Kommentar „Ordner ohne Git: der Agent arbeitet direkt in `repository_path`; keine Basis, keine Changes (ADR 018).“
  - `working_dir`: `Folder => self.repository_path.clone()`.
  - Neue private Funktion `folder_checkout(row: &RepositoryRow) -> SessionRepository` mit `base_ref`/`base_commit` = `String::new()`, `checkout: Folder`.
  - `main_checkouts` und `main_checkout_since`: zuerst `if !repository_path.is_dir() { return Err(RepositoryMissing(..)) }`, dann `if !repository_path.join(".git").exists() { return Ok(folder_checkout(row)) }`, dann der bisherige Git-Weg.
  - `ensure_one`: als Erstes `if let RepositoryCheckout::Folder = repository.checkout { return if main_checkout.is_dir() { Ready(main_checkout.clone()) } else { Missing { name, reason: format!("{} gibt es nicht mehr.", …) } }; }` — vor der `.git`-Prüfung.
  - `ticket_worktrees`: Frühausstieg auch für `Folder` (`matches!(…, AppWorktree { .. } | Folder)`), damit kein `git worktree list` läuft. `permission_rules`, `ticket_roots`, `remove_clean` filtern schon auf `Main` bzw. `AppWorktree` — nur prüfen, nicht ändern.
  - Modul-Doku (Zeile 1–2) um „und Ordner ohne Git“ ergänzen.
- [x] `db/session_repositories.rs`: `const CHECKOUT_FOLDER: &str = "folder";`, in `checkout_columns` `Folder => (CHECKOUT_FOLDER, "", "")`, in `into_session` `CHECKOUT_FOLDER => RepositoryCheckout::Folder`; Modul-Doku unverändert.
- [x] `changes/model.rs`: `SessionChanges.plain_folders` nach Kontrakt, Doku-Kommentar von `repositories` bleibt.
- [x] `changes/mod.rs`:
  - `load`: vor dem Spawnen die Repositories mit `Folder` herausnehmen — Namen in `plain_folders` sammeln, für sie keinen Thread starten; die Position (`index`) der übrigen bleibt der Index in der vollen Liste.
  - `file_diff`: direkt nach `validate_path` `if matches!(repository.checkout, RepositoryCheckout::Folder) { return Err(CommandError::Internal("Ordner ohne Git hat keinen Diff".to_owned())); }`.
  - Rückgabe `SessionChanges { repositories, plain_folders }`.
- [x] `sessions/registry.rs`: Doku-Kommentar von `start_process` um „Ordner ohne Git gehen wie Haupt-Checkouts per `--add-dir` an den Agenten“ ergänzen; Code bleibt.
- [x] `src-tauri/examples/gen-bindings.rs`: `RepositoryKind` eintragen; `pnpm bindings`.
- [x] `src/features/repositories/RepositoryPicker.tsx`, `describeAddError`: Zweig `notARepository` ersetzen durch `folderNotAllowed` mit dem Text „Diesen Ordner bekommt der Agent nicht: <Pfad>. Gesperrt sind Laufwerke, der Benutzerordner und alles darüber sowie der Datenordner der App — wähle einen Unterordner.“ (`${String(reason.message)}` als Pfad). `src/lib/repositories.ts`: `@throws`-Kommentar `notARepository` → `folderNotAllowed`. Danach `pnpm check` grün.
- [x] ADR `docs/decisions/018-ordner-ohne-git.md` aus „Festgelegte Entscheidungen“ (Format wie ADR 010, Status angenommen, Datum des Commits). ADR 005 und 010 bekommen keinen Status-Wechsel, nur ADR 010 unter Konsequenzen den Satz „Ordner ohne Git (ADR 018) haben weder Ticket-Worktrees noch Freigaben.“
- [x] Commit `feat(repositories): Ordner ohne Git im Core zulassen`.

## Phase 2 — Oberfläche, Doku, Release

**Lesen vorher:** `src/features/repositories/RepositoryPicker.tsx` + `.css`, `src/features/projects/AddRepositoryMenu.tsx` + `.css`, `src/features/changes/ChangesOverview.tsx` + `.css`, `src/lib/repositories.ts`, `src/lib/errors.ts`, `src/features/settings/SettingsView.tsx` (Filter auf `isMissing`), `docs/conventions/react.md`, `docs/conventions/tailwind.md`, `docs/conventions/releases.md`.

**AK der Phase:**

1. „Repository hinzufügen …“ heißt „Repository oder Ordner hinzufügen …“, der Dialog-Titel „Repository oder Ordner wählen“; ein Ordner ohne Git erscheint als Zeile, sofort angehakt, mit grauer Marke „ohne Git“ vor der Skill-Angabe.
2. Ein gesperrter Ordner zeigt unter der Liste in Fehlerfarbe: „Diesen Ordner bekommt der Agent nicht: <Pfad>. Gesperrt sind Laufwerke, der Benutzerordner und alles darüber sowie der Datenordner der App — wähle einen Unterordner.“
3. Das ⓘ neben dem Knopf erklärt im Tooltip auch den Ordner ohne Git (Text unten).
4. Im Menü „+ Repository“ der Übersicht: Knopf „Anderes Repository oder Ordner wählen …“, Ordner ohne Git tragen dieselbe Marke „ohne Git“ hinter dem Namen.
5. Die Changes-Übersicht zeigt je Ordner ohne Git eine Zeile: Name in der ersten Spalte, daneben gedämpft über die restlichen Spalten „Ordner ohne Git — die App sieht hier keine Änderungen.“; Dateibaum, Filter und Basis-Angabe zeigen ihn nicht.
6. `pnpm check` grün.

**Checkliste:**

- [ ] `RepositoryPicker.tsx`:
  - `INFO_TEXT` → `'Der Agent arbeitet direkt im Ordner jedes gewählten Repositorys, auf dem gerade ausgecheckten Stand. Ob er dafür einen eigenen Branch oder Worktree anlegt, bestimmen seine Anweisungen; die App legt keinen an. Ein Ordner ohne Git geht genauso, aber ohne Changes: die App sieht dort nicht, was der Agent ändert, und Git kann nichts zurückholen.'`
  - Dialog-Titel `'Repository oder Ordner wählen'`, Knopftext `Repository oder Ordner hinzufügen …`.
  - `renderTrailing`: bei `repository.kind === 'folder'` und nicht fehlend vor der Skill-Angabe `<span className="repository-picker__kind">ohne Git</span>` (Fragment um beide Spans).
  - `describeAddError` hat Phase 1 schon umgestellt; Leerzustand-Text bleibt.
- [ ] `RepositoryPicker.css`: `&__kind { margin-right: var(--space-md); font-size: var(--font-size-xs); color: var(--color-fg-muted); }` — Token-Namen vorher in `src/styles/theme.css` belegen, bei Abweichung die vorhandenen nehmen, die `&__skills` benutzt.
- [ ] `AddRepositoryMenu.tsx`: Dialog-Titel wie oben; Knopftext `Anderes Repository oder Ordner wählen …`; in `renderCandidate` hinter dem Namen bei `kind === 'folder'` `<span className="add-repository-menu__kind">ohne Git</span>`; `TRIGGER_TITLE` um den Satz „Ein Ordner ohne Git geht auch, erscheint aber nicht in den Changes.“ ergänzen. CSS-Klasse `&__kind` in `AddRepositoryMenu.css` analog zu `&__missing`, aber Farbe `--color-fg-muted`.
- [ ] `ChangesOverview.tsx`: nach den Repository-Zeilen `changes.plainFolders.map((name) => <div key={`folder:${name}`} className="changes-overview__row"><span className="changes-overview__name">{name}</span><span className="changes-overview__note">Ordner ohne Git — die App sieht hier keine Änderungen.</span></div>)`. Doppelte Namen sind möglich (zwei Ordner gleichen Namens) → Schlüssel `folder:${String(index)}`.
- [ ] `ChangesOverview.css`: `&__note { grid-column: 2 / 5; font-size: var(--font-size-xs); color: var(--color-fg-muted); }`.
- [ ] `src/lib/errors.ts`: `commandErrorText` prüfen — fällt `folderNotAllowed` in einen generischen Zweig mit brauchbarem Text, nichts ändern; sonst Fall mit dem Text aus AK 2 ergänzen.
- [ ] `SettingsView.tsx`: Filter `!isMissing && skillCount > 0` gilt unverändert auch für Ordner ohne Git — nur lesen, nicht ändern.
- [ ] Doku im selben Commit:
  - `AGENTS.md` Regel 5: „je Repository den Haupt-Checkout per `--add-dir`“ → „je Repository den Haupt-Checkout bzw. den Ordner ohne Git per `--add-dir`“.
  - `docs/PROJECT.md`, Zeile „Workspace“ im MVP: „mehrere Repositories pro Session, auch Ordner ohne Git (ohne Changes, [ADR 018](decisions/018-ordner-ohne-git.md));“.
  - `docs/glossary.md`: Zeile **Repository** um „Auch ein Ordner ohne Git (→ Ordner ohne Git).“ ergänzen; neue Zeile **Ordner ohne Git** hinter **Haupt-Checkout**: „Ein bekannter Ordner ohne `.git`. Der Agent arbeitet darin wie im Haupt-Checkout; die App hat dort keine Basis, zeigt keine Changes und kann nichts zurückholen. Laufwerke, der Benutzerordner und alles darüber sowie der Datenordner der App sind gesperrt. Im Code `RepositoryKind::Folder` / `RepositoryCheckout::Folder` ([ADR 018](decisions/018-ordner-ohne-git.md)).“
  - `docs/code-map.md`: Zeile „Repositories“ Core um „Art Git/Ordner ohne Git, Sperrliste für Ordner“; Zeile „Repositories einer Session, Worktrees“ `RepositoryCheckout` „Haupt-Checkout, App-Worktree oder Ordner ohne Git“; Zeile „Changes“ um „`plain_folders` Ordner ohne Git“.
- [ ] Commit `feat(repositories): Ordner ohne Git in Auswahl und Changes`.
- [ ] Plan archivieren und Release nach `docs/conventions/releases.md`: Minor-Version (neue Funktion), `chore(release)`-Commit, Tag `vX.Y.0`, pushen.

## Finale Abnahmekriterien

1. `C:\Users\sasch\Downloads` (kein Git) lässt sich in „Neues Vorhaben“ wählen; die Zeile zeigt „ohne Git“, die Session startet, und der Agent liest und schreibt dort im Modus „Automatisch bearbeiten“ ohne Rückfrage.
2. Eine `CLAUDE.md` und Skills unter `.claude\skills` in diesem Ordner sind in der Session aktiv (Skill im `/`-Menü).
3. Die Changes zeigen für den Ordner die Zeile „Ordner ohne Git — …“; ein gemischtes Vorhaben (Repository + Ordner) zeigt für das Repository Changes wie bisher.
4. `C:\`, `C:\Users\sasch` und `C:\Users\sasch\.verwalter` werden mit dem Sperrtext abgelehnt; ein Unterordner eines Repositorys wird weiterhin als dessen Wurzel aufgenommen.
5. Ordner nach dem Anlegen umbenennen → nächste Nachricht: Chat-Eintrag „Repository nicht gefunden“, der Agent arbeitet ohne ihn weiter; in der Auswahl steht er als „nicht gefunden“ mit „Entfernen“.
6. Bestehende Vorhaben mit Repositories laufen unverändert (Changes, Ticket-Worktrees).
7. `pnpm check` grün, Bindings unverändert nach `pnpm bindings`.

## Smoke-Checkliste

Wackelstellen zuerst:

1. **Schreibrechte im Ordner (AK 1):** belegt ist nur, dass `--add-dir` beim Haupt-Checkout Schreiben ohne Rückfrage erlaubt — für einen Ordner ohne Git ist das Kommandozeilen-Verhalten dasselbe Flag, aber nicht gemessen. Prüfen: Agent bitten, `test.txt` im Ordner anzulegen → keine Rückfrage, Datei liegt da.
2. **`CLAUDE.md` und Skills (AK 2):** ADR 005 belegt beides für Git-Ordner. Prüfen: `.claude\skills\probe\SKILL.md` im Ordner anlegen → Skill „probe“ im `/`-Menü der Session.
3. **Sperrliste (AK 4):** alle drei Pfade über „Repository oder Ordner hinzufügen …“ probieren; zusätzlich einen OneDrive-Ordner (`C:\Users\sasch\OneDrive\…`) → muss **gehen**.
4. Gemischtes Vorhaben: Changes-Filter-Chips zeigen nur Repositories; Klick auf das Repository filtert richtig (Positions-Schlüssel nicht verrutscht).
5. Ordner wählen, der in einem Repository liegt (`…\verwalter\docs`) → Eintrag „verwalter“, kein Ordner ohne Git.
6. „+ Repository“ in der Übersicht eines laufenden Vorhabens → Ordner ohne Git anhängen → nach der nächsten Nachricht kennt der Agent ihn.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
