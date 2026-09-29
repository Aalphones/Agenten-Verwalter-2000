# Meilenstein 5 — Changes & Diff

Ziel: Die Session-Kopfzeile bekommt den Reiter „Changes“. Er zeigt, was der Agent in den Worktrees der Session gegenüber der Basis geändert hat — über alle Repositories der Session, umschaltbar zwischen „Alle“, „Uncommitted“ und „Committed“, mit Repository-Filter, Dateibaum und Übersicht. Ein Klick auf eine Datei öffnet ihren Unified Diff. Alles, was die Ansicht zeigt, liest der Core aus Git — nie aus Aussagen des Agenten (AGENTS.md, Regel 2).

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 005](../../decisions/005-repositories-und-worktrees.md) (Basis, Worktree-Ordner, Branch), [ADR 006](../../decisions/006-changes-und-diff.md) (entsteht in Phase 1 aus dem Abschnitt „Festgelegte Entscheidungen“ unten), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md) (Tafeln `Changes` und `Diff`, Abschnitt „Layout-Maße“ Zeile „Changes“), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Changes lesen | [phase-1-changes-lesen.md](phase-1-changes-lesen.md) | heikel | complete |
| 2 | Core: Diff einer Datei | [phase-2-datei-diff.md](phase-2-datei-diff.md) | standard | pending |
| 3 | Oberfläche: Reiter, Werkzeugleiste, Dateibaum, Übersicht | [phase-3-changes-ansicht.md](phase-3-changes-ansicht.md) | standard | pending |
| 4 | Oberfläche: Diff-Ansicht und Doku-Abschluss | [phase-4-diff-ansicht.md](phase-4-diff-ansicht.md) | standard | pending |

Umsetzung direkt auf `main`, ein Commit pro Phase (Scope `changes`), `pnpm check` vor jedem Commit grün (rustfmt und Clippy brauchen `cargo` im PATH: `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mit committen. Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus ADR 006 (Kontext / Optionen / Entscheidung / Konsequenzen).

- **Drei Blickwinkel** (`ChangeScope`), alle gegen `base_commit` aus ADR 005:
  - `all` — Basis → Arbeitsverzeichnis des Worktrees, dazu die untracked Dateien. Das ist „alles, was die Session geändert hat“.
  - `committed` — Basis → `HEAD` des Session-Branches.
  - `uncommitted` — `HEAD` → Arbeitsverzeichnis, dazu die untracked Dateien. Gestagte Änderungen zählen als uncommitted.
  Das Segment „Alle · Uncommitted · Committed“ wählt den Blickwinkel; Dateiliste, Zähler, Summen und der geöffnete Diff folgen ihm. Eine Datei, die nur committed angelegt und danach uncommitted wieder gelöscht wurde, fehlt unter „Alle“, steht aber unter beiden anderen — das ist korrekt, nicht ein Fehler.
- **Nur Plumbing-Befehle** (`diff-index`, `diff-tree`, `ls-files`, `rev-list`), nie `git diff` oder `git status`. Belegt am 2026-09-29 im Git-Quelltext (`builtin/diff.c`, `refresh_index_quietly`): `git diff` nimmt bei „angefassten, aber inhaltlich gleichen“ Dateien kurz die Sperre `index.lock` und beachtet dabei `GIT_OPTIONAL_LOCKS` nicht — ein gleichzeitiges `git commit` des Agenten im selben Worktree würde dann mit „index.lock exists“ scheitern. Plumbing liest nur. Zusätzlich setzt `git/` für jeden Aufruf `GIT_OPTIONAL_LOCKS=0`.
- **Die Dateimenge kommt aus `--numstat`, die Art (A/M/D) aus `--name-status`.** Belegt am 2026-09-29 mit Git 2.55: `diff-index --name-status` meldet eine nur angefasste Datei als `M`, `--numstat` lässt sie weg. Eine Datei, die nur in `--name-status` steht, wird verworfen.
- **Keine Umbenennungen** (`--no-renames`): eine verschobene Datei erscheint als gelöscht (D) und neu (A). Umbenennungserkennung ist unzuverlässig und kostet Zeit; der Entwurf kennt nur A/M/D.
- **Untracked Dateien** kommen aus `git ls-files --others --exclude-standard -z` und zählen als neu angelegt (A). Ihre Zeilenzahl zählt der Core selbst: größer als 8 MiB oder ein NUL-Byte in den ersten 8000 Bytes → Binärdatei (keine Zeilenzahl, kein Textvergleich).
- **Eigener Diff statt Monaco.** Der Entwurf (verbindlicher Kontrakt) zeigt zwei Zeilennummern-Spalten zu je 48 px, eine Vorzeichen-Spalte zu 20 px, Abschnittskopf-Zeilen auf eigenem Hintergrund und 20 px Zeilenhöhe — das bildet der Monaco Diff Editor nicht ab, und er brächte mehrere MB und die vollständigen Dateiinhalte beider Seiten mit. Der Core liefert den Unified Diff als fertige Zeilen (Art, alte Nummer, neue Nummer, Text), die Oberfläche rendert sie virtualisiert mit `@tanstack/react-virtual`. Ersetzt die Zeile „Diff: Monaco Diff Editor, lazy“ in PROJECT.md, AGENTS.md und `react.md` (Phase 4).
- **Grenzen:** ein Diff zeigt höchstens 20 000 Zeilen, danach eine Zeile „Gekürzt …“. Keine Syntaxfarben im Diff (der Entwurf hat keine).
- **Nur lesen:** Die Changes-Ansicht legt keine Worktrees an und repariert nichts. Fehlt der Worktree-Ordner, zeigt sie „Worktree fehlt — die nächste Nachricht an den Agenten legt ihn neu an.“; fehlt der Haupt-Checkout, „Repository nicht gefunden: <Pfad>“. Die Reparatur bleibt bei `worktrees::ensure` vor dem Agent-Start.
- **Aktualisieren:** Die Oberfläche lädt die Changes neu, wenn die Session gewählt wird, wenn sich ihr Status ändert, wenn das Fenster den Fokus bekommt, und alle 5 s, solange der Reiter „Changes“ offen ist **und** der Agent arbeitet (`starting`, `running`, `waiting`). Kein Dateisystem-Beobachter: der kostet pro Worktree Ressourcen, auch wenn niemand hinsieht. Der geöffnete Diff lädt neu, wenn sich die Zahlen seiner Datei ändern.
- **Reiter:** „Chat · Changes“ in der Kopfzeile nach Entwurf; „Changes“ trägt die Zahl der Dateien im Blickwinkel „Alle“ (ab 1). Eine Session ohne Repository hat keinen Reiter „Changes“. Der gewählte Reiter bleibt beim Wechsel der Session stehen (wie im Entwurf); hat die neue Session kein Repository, zeigt die App den Chat. Beim Zurückwechseln zum Chat öffnet der Verlauf unten verankert, wie nach einem Session-Wechsel.
- **Artefakte gehören nicht in diesen Plan.** PROJECT.md nennt für M5 nur Changes & Diff; ob die Claude-Kommandozeile Artefakte überhaupt meldet, ist offen (GAPS). Die Tafel `Artifacts` wird im Entwurfs-README auf „offen“ umgehängt, der Reiter „Artefakte“ entsteht nicht (kein toter Knopf).
- **Keine Einstellungen:** die Basis bleibt `base_commit` aus ADR 005; „Basis für Changes“ in den Einstellungen ist M6.

## Kontrakt

### Git (`src-tauri/src/git/mod.rs`, neu)

Alle Funktionen nehmen den Worktree-Ordner, geben die **ungekürzte** Standardausgabe zurück (neue private Hilfsfunktion `run_raw`, siehe Phase 1) und rufen `git -C <worktree>` wie die bestehenden.

```rust
pub fn diff_tree_name_status(worktree: &Path, from: &str, to: &str) -> Result<String, CommandError>;  // diff-tree -r --no-renames --name-status -z <from> <to>
pub fn diff_tree_numstat(worktree: &Path, from: &str, to: &str) -> Result<String, CommandError>;      // diff-tree -r --no-renames --numstat -z <from> <to>
pub fn diff_index_name_status(worktree: &Path, from: &str) -> Result<String, CommandError>;           // diff-index --no-renames --name-status -z <from>
pub fn diff_index_numstat(worktree: &Path, from: &str) -> Result<String, CommandError>;               // diff-index --no-renames --numstat -z <from>
pub fn untracked_files(worktree: &Path) -> Result<String, CommandError>;                               // ls-files --others --exclude-standard -z
pub fn commit_count(worktree: &Path, from: &str) -> Result<u32, CommandError>;                         // rev-list --count <from>..HEAD
pub fn diff_tree_patch(worktree: &Path, from: &str, to: &str, path: &str) -> Result<String, CommandError>;  // diff-tree -r -p --no-renames -U3 <from> <to> -- <path>   (Phase 2)
pub fn diff_index_patch(worktree: &Path, from: &str, path: &str) -> Result<String, CommandError>;          // diff-index -p --no-renames -U3 <from> -- <path>           (Phase 2)
pub fn is_untracked(worktree: &Path, path: &str) -> Result<bool, CommandError>;                            // ls-files --others --exclude-standard -z -- <path>; nicht leer → true (Phase 2)
```

### Typen (`src-tauri/src/changes/model.rs`, alle `derive(Debug, Clone, Serialize, Deserialize, TS)` mit `#[serde(rename_all = "camelCase")]`, eingetragen in `gen-bindings.rs`)

```rust
pub enum ChangeKind { Added, Modified, Deleted }                 // zusätzlich Copy, PartialEq, Eq
pub enum ChangeScope { All, Committed, Uncommitted }             // zusätzlich Copy, PartialEq, Eq
pub struct LineStat { pub kind: ChangeKind, pub added: u32, pub deleted: u32, pub binary: bool }
pub struct FileChange {
    pub path: String,                    // relativ zum Worktree, Schrägstriche
    pub all: Option<LineStat>,
    pub committed: Option<LineStat>,
    pub uncommitted: Option<LineStat>,
}
pub struct RepositoryChanges {
    pub position: u32,                   // wie session_repositories.position
    pub name: String,
    pub branch: String,
    pub base_ref: String,
    pub commit_count: u32,               // Commits Basis..HEAD
    pub files: Vec<FileChange>,          // nach path sortiert (Byte-Reihenfolge)
    pub error: Option<String>,           // gesetzt → files leer, commit_count 0
}
pub struct SessionChanges { pub repositories: Vec<RepositoryChanges> }   // Reihenfolge wie session_repositories

pub enum DiffLineKind { Hunk, Context, Added, Deleted }          // zusätzlich Copy, PartialEq, Eq  (Phase 2)
pub struct DiffLine { pub kind: DiffLineKind, pub old_line: Option<u32>, pub new_line: Option<u32>, pub text: String }  // (Phase 2)
pub struct FileDiff { pub lines: Vec<DiffLine>, pub binary: bool, pub truncated: bool }                                  // (Phase 2)
```

In TypeScript heißen die Enum-Werte `'added' | 'modified' | 'deleted'`, `'all' | 'committed' | 'uncommitted'`, `'hunk' | 'context' | 'added' | 'deleted'`; `Option<T>` wird `T | null`.

### Core-Schnittstellen

```rust
// sessions/registry.rs
pub fn repositories_of(&self, session_id: &str) -> Result<(PathBuf, Vec<SessionRepository>), CommandError>;  // (Workspace, Kopie der Repositories); SessionNotFound

// changes/mod.rs
pub fn load(workspace: &Path, repositories: &[SessionRepository]) -> SessionChanges;   // ein Thread je Repository (std::thread::scope), nie Err
pub fn file_diff(workspace: &Path, repository: &SessionRepository, path: &str, scope: ChangeScope) -> Result<FileDiff, CommandError>;  // Phase 2
```

### Tauri Commands (`src-tauri/src/commands/changes.rs`, registriert in `lib.rs`)

| Command | Parameter | Rückgabe | Wrapper in `src/lib/changes.ts` |
|---|---|---|---|
| `changes_load` | `session_id: String` | `SessionChanges` | `loadChanges(sessionId)` |
| `changes_file_diff` | `session_id: String`, `position: u32`, `path: String`, `scope: ChangeScope` | `FileDiff` | `loadFileDiff(sessionId, position, path, scope)` |

### Oberfläche

```ts
// src/stores/sessions.ts (Erweiterung)
export const SESSION_VIEWS = ['chat', 'changes'] as const;
export type SessionView = (typeof SESSION_VIEWS)[number];
// im State: activeView: SessionView (Start 'chat'), showView: (view: SessionView) => void

// src/stores/changes.ts (neu)
export interface OpenFile { position: number; path: string }
export interface ChangesSelection { repositoryFilter: number | null; scope: ChangeScope; openFile: OpenFile | null }
export const DEFAULT_SELECTION: ChangesSelection = { repositoryFilter: null, scope: 'all', openFile: null };
// im State: selections: Record<string, ChangesSelection>; setRepositoryFilter, setScope, openFile, closeFile (je mit sessionId)

// src/features/changes/useSessionChanges.ts (neu)
export interface SessionChangesState { changes: SessionChanges | null; error: string | null }
export function useSessionChanges(session: SessionSummary | null, isVisible: boolean): SessionChangesState;

// src/lib/errors.ts (neu)
export function isCommandError(reason: unknown): reason is CommandError;
export function commandErrorText(reason: unknown): string;
```

## Finale Abnahmekriterien

1. Die Kopfzeile einer Session mit Repositories zeigt die Reiter „Chat · Changes“ nach Entwurf; „Changes“ trägt die Zahl geänderter Dateien (Blickwinkel „Alle“), ab 1. Eine Session ohne Repository zeigt nur „Chat“.
2. Die Changes-Ansicht zeigt Werkzeugleiste (44 px: Repository-Chips mit Zahl, „n Dateien +a −d“, „gegen <Basis>“ mit Erklärung beim Überfahren, Segment „Alle · Uncommitted · Committed“), links den Dateibaum (340 px, Repository-Kopf mit Summen, Branch-Zeile, Ordner eingerückt um 14 px je Ebene, Dateien mit A/M/D, Badge „uncommitted“ und +/−) und rechts die Übersicht (je Repository: Name, `Branch ← Basis`, Commits, uncommitted-Zahl).
3. Die Zahlen stimmen mit Git überein: für eine Datei, die nur committed geändert wurde, zeigen „Alle“ und „Committed“ dieselben +/−, und sie entsprechen `git diff --numstat <base_commit> HEAD -- <datei>` im Worktree; eine neue, nicht committete Datei steht unter „Alle“ und „Uncommitted“ mit ihrer Zeilenzahl, nicht unter „Committed“.
4. Ein Klick auf eine Datei öffnet ihren Diff nach Entwurf (Kopf 40 px mit Repository, Pfad, +/−, Vergleichs-Angabe und ×; Zeilen 20 px hoch mit zwei 48-px-Nummernspalten, 20-px-Vorzeichen, farbigen Hinzufügungen/Löschungen und Abschnittsköpfen); der Diff folgt dem gewählten Blickwinkel. × schließt ihn und zeigt die Übersicht.
5. Eine Binärdatei zeigt „Kein Textvergleich“ statt Zeilen; ein Diff über 20 000 Zeilen endet mit „Gekürzt …“ und scrollt flüssig.
6. Arbeitet der Agent, erscheinen seine Änderungen bei offenem Reiter binnen etwa 5 s, ohne dass der Agent über gesperrte Git-Dateien stolpert.
7. Fehlt der Worktree-Ordner eines Repositorys, zeigt dessen Block „Worktree fehlt …“, die anderen Repositories erscheinen normal; nichts wird angelegt.
8. `pnpm check` grün; ADR 006, Code-Map, Glossar, PROJECT.md, AGENTS.md, `react.md` und Entwurfs-README beschreiben den tatsächlichen Stand.

## Smoke-Checkliste

Führt Sascha am Plan-Ende durch. Wackelstellen zuerst:

- [ ] **Mitlesen während der Agent arbeitet:** Session mit einem Repository, Agent bitten, drei Dateien anzulegen und nach jeder `git add` + `git commit` auszuführen. Währenddessen Reiter „Changes“ offen lassen → Liste wächst binnen ~5 s mit; im Chat kein Git-Fehler „index.lock“; am Ende stehen die Dateien unter „Committed“, „Uncommitted“ ist leer.
- [ ] **Zeilenenden und Zeilennummern:** im Worktree eine Datei mit Windows-Zeilenenden ändern (eine Zeile in der Mitte ersetzen, eine anhängen) → Diff zeigt genau diese Zeilen, keine `^M`-Reste, keine Verschiebung der Nummern; Nummern stimmen mit dem Editor überein.
- [ ] **Große und viele Dateien:** eine Textdatei mit 30 000 Zeilen anlegen und öffnen → „Gekürzt …“ am Ende, flüssiges Scrollen, lange Zeilen horizontal scrollbar. Einen Ordner mit ~1000 kleinen untracked Dateien anlegen → Liste bleibt bedienbar, die App friert beim 5-s-Nachladen nicht spürbar ein.
- [ ] Session mit zwei Repositories: Chips „Alle“ und je Repository mit Zahl; Klick auf ein Repository blendet das andere aus; Summen in der Werkzeugleiste folgen.
- [ ] Segment „Uncommitted“/„Committed“ umschalten → Liste, Zahlen und ein geöffneter Diff wechseln mit; Badge „uncommitted“ fehlt unter „Committed“.
- [ ] Gelöschte Datei (D, rot), neue Datei (A, grün), geänderte (M) — je Diff öffnen: gelöschte zeigt nur Minus-Zeilen, neue nur Plus-Zeilen.
- [ ] Bild (PNG) ins Repository legen → Zeile zeigt „binär“, Diff „Kein Textvergleich …“.
- [ ] Worktree-Ordner einer Session im Explorer umbenennen → Block „Worktree fehlt …“; zurückbenennen, Fenster fokussieren → Dateien wieder da.
- [ ] Session ohne Repository → kein Reiter „Changes“. Von einer Session im Reiter „Changes“ zu einer ohne Repository wechseln → Chat.
- [ ] Session-Wechsel im Reiter „Changes“ → bleibt auf „Changes“ der neuen Session; Filter und geöffnete Datei der alten Session sind beim Zurückwechseln noch da.
- [ ] Mit Tastatur: Tab erreicht Reiter, Chips, Segment, Dateien und ×; Fokus sichtbar (2 px Ring in Akzentfarbe).
- [ ] Rückstand aus M3 (Liste im [M3-Archiv](../../archive/2026-09/2026-09-28_m3-repositories-und-worktrees/README.md), „Smoke-Checkliste“) im selben Durchgang abarbeiten.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
