# Plan: Dateien-Ansicht – Repository-Baum, Gesamtübersicht je Vorhaben, Dateilinks aus dem Chat

Ziel: Der Reiter „Changes“ wird zum Reiter „Dateien“. Links steht je Repository des Vorhabens ein Baum, umschaltbar zwischen „Geändert“ und „Alle Dateien“; rechts die Übersicht mit Kennzahlen, Codebasis und dem Verlauf, welche Session wann was geändert hat. Jede Datei lässt sich als Änderung oder als ganze Datei ansehen, eine Suche (Strg P) springt per Dateiname hin, und ein Dateilink im Chat öffnet die Datei dort. Die Änderungen eines Vorhabens stehen je Repository genau einmal, gleich aus welchem Arbeitsordner oder Branch sie stammen. Grundsatz: [ADR 067](../../decisions/067-dateien-ansicht.md). Entwurf (verbindlich): [artifacts/entwurf-repository-ansicht.html](artifacts/entwurf-repository-ansicht.html), Bilder und Erzeugung in [artifacts/README.md](artifacts/README.md).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Kern: Repositories zusammenlegen, Baum und Dateiinhalt lesen | [phase-1-kern-baum.md](phase-1-kern-baum.md) | heikel | complete |
| 2 | Kern: Verlauf je Session und Diff eines Commits | [phase-2-kern-verlauf.md](phase-2-kern-verlauf.md) | standard | complete |
| 3 | Reiter „Dateien“: Baum, Leiste, Übersicht mit Verlauf | [phase-3-reiter-baum.md](phase-3-reiter-baum.md) | heikel | complete |
| 4 | Datei ansehen: Änderung, ganze Datei, Schritte | [phase-4-datei.md](phase-4-datei.md) | standard | complete |
| 5 | Suche und Strg P | [phase-5-suche.md](phase-5-suche.md) | standard | complete |
| 6 | Dateilinks im Chat | [phase-6-chat-links.md](phase-6-chat-links.md) | standard | complete |
| 7 | Git-Seite, „Changes“ entfernen, Doku | [phase-7-git-aufraeumen.md](phase-7-git-aufraeumen.md) | standard | pending |

Reihenfolge fest 1 → 7. Bis Phase 6 steht „Dateien“ als zusätzlicher Reiter neben „Changes“, damit die Git-Werkzeuge nach jeder Phase erreichbar bleiben; Phase 7 zieht sie um und entfernt „Changes“. Profil: privat – keine automatisierten Tests, keine Review-Stationen, keine Abnahmeliste. Nicht im Umfang: Dateien bearbeiten (Nicht-Ziel in `docs/PROJECT.md` bleibt), Volltextsuche im Dateiinhalt, Vorschau von HTML und PDF in der Ansicht, Vergleich zweier beliebiger Stände.

## Gemessene Grundlage (2026-11-18, Kopie der Datenbank, Ordner facepass mit acht inneren Repositories)

- 79 Vorhaben haben dort 1.088 Commits in `session_commits`. 1.058 sind von einem Ref aus erreichbar, 18 liegen nur noch lose im Objektspeicher, 12 gibt es nicht mehr.
- Alle Arbeitsbäume eines Repositorys teilen einen Objektspeicher: ein Commit aus einem Ticket-Worktree ist im Haupt-Checkout lesbar (`git cat-file -t` → `commit`).
- 173 Paare aus Vorhaben und Repository; in 7 liegen die eigenen Commits auf mehr als einer offenen Linie, in 5 davon hat dieselbe Datei auf zwei Linien unterschiedlichen Inhalt (16 Dateien).
- Ordnername und Branch eines Ticket-Worktrees stimmen nicht verlässlich überein (Ordner `…-wt-gymid-2720` auf Branch `feature/GYMID-2640-…`, ein Ordner mit losgelöstem HEAD).
- Im Dach-Repository meldet `git status --ignored` die inneren Repositories und ihre Arbeitsbäume als ignorierte Ordner.

## Kontrakt

### Namensschema

Neues Feature `files` (in der Oberfläche „Dateien“): `src/features/files/`, `src/stores/files.ts`, `src/lib/files.ts`, `src-tauri/src/files/` (`mod.rs`, `model.rs`, `tree.rs`, `read.rs`, `history.rs`), `src-tauri/src/commands/files.rs`. Die Changes (`src-tauri/src/changes/`, `changes_load`, `changes_file_diff`, `changes_file_lines`) bleiben die Quelle der Änderungen und der Diffs; `files` kommt dazu. Keine Migration.

### Begriffe

- **Eintrag:** wie bisher ein `RepositoryChanges` (ein Checkout: Haupt-Checkout, Ticket-Worktree, inneres Repository, dessen Ticket-Worktree), adressiert über `key`.
- **Repository-Knoten (Gruppe):** alle Einträge desselben Repositorys zusammen. Im Baum genau ein Knoten.
- **Anker:** der Eintrag einer Gruppe, dessen Ordner den Baum „Alle Dateien“ und den Inhalt unveränderter Dateien liefert.
- **Schritt:** ein eigener Commit des Vorhabens an einer Datei.

### Typen (Rust, über die Tauri-Grenze mit `ts-rs`, `serde(rename_all = "camelCase")`)

```rust
// src-tauri/src/changes/sources.rs — Source, neue Felder
pub group: String,       // "<P>" für ein angehängtes Repository und seine Ticket-Worktrees,
                         // "<P>:<innerer Ordner>" für ein inneres Repository und dessen Ticket-Worktrees
pub group_name: String,  // Name des Repositorys: "facepass" bzw. "facepass/app" – ohne Worktree-Ordner
pub is_main: bool,       // der Checkout des Repositorys selbst, kein Ticket-Worktree

// src-tauri/src/changes/model.rs — RepositoryChanges, neue Felder (alle #[serde(default)])
pub group: String,
pub group_name: String,
pub is_main: bool,

// src-tauri/src/changes/model.rs — FileChange, neue Felder (alle #[serde(default)])
pub last_commit: Option<String>,  // volle ID des letzten eigenen Commits an der Datei (OwnFile.to); None: nur uncommittet
pub changed_at: f64,              // ms seit 1970: das Spätere aus Committer-Zeit von last_commit und letztem Schreiben

// src-tauri/src/files/model.rs
pub struct TreeFile { pub path: String, pub link: bool }          // path relativ zum Ordner des Eintrags, mit '/'
pub struct IgnoredEntry { pub path: String, pub dir: bool }       // path ohne Schrägstrich am Ende
pub struct RepoTree { pub files: Vec<TreeFile>, pub ignored: Vec<IgnoredEntry>, pub truncated: bool }
pub struct DirEntry { pub name: String, pub dir: bool, pub link: bool }
#[serde(tag = "kind", rename_all = "camelCase")]   // je Variante mit Feldern zusätzlich #[serde(rename_all = "camelCase")], Muster: AutoHandoff in sessions/model.rs
pub enum FileContent {
    Text { text: String, line_count: u32, truncated: bool },
    Image { data_url: String, bytes: f64 },
    Binary { bytes: f64 },
    TooLarge { bytes: f64 },
    Missing,
}
pub struct HistoryFile { pub path: String, pub kind: ChangeKind, pub added: u32, pub deleted: u32, pub binary: bool }
pub struct HistoryCommit {
    pub id: String, pub short_id: String, pub subject: String,
    pub time: f64,            // Committer-Zeit in Sekunden
    pub group: String, pub group_name: String,
    pub key: String,          // Eintrag, in dessen Ordner der Commit lesbar ist (für files_commit_diff)
    pub loose: bool,          // in keinem Eintrag zwischen Basis und HEAD enthalten
    pub files: Vec<HistoryFile>,
}
pub struct HistorySession { pub session_id: String, pub number: u32, pub name: String, pub commits: Vec<HistoryCommit> }
pub struct ProjectHistory { pub sessions: Vec<HistorySession>, pub missing: u32 }

// src-tauri/src/file_links/mod.rs
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileLinkTarget {
    View { key: String, path: String, line: Option<u32> },  // in „Dateien“ öffnen
    External,                                               // mit file_link_open im Standardprogramm öffnen
    Name { name: String },                                  // nur ein Dateiname: die Oberfläche sucht in den Bäumen
}
```

### Commands (`src-tauri/src/commands/files.rs`, alle `async`, in `lib.rs` registriert; Aufrufe in `src/lib/files.ts`)

| Command | Eingabe | Ergebnis | Regel |
|---|---|---|---|
| `files_tree` | `session_id`, `key` | `RepoTree` | `key` über `sources::find` mit Reichweite `Project`; liest im Ordner des Eintrags |
| `files_ignored_children` | `session_id`, `key`, `path` | `Vec<DirEntry>` | eine Ebene eines ignorierten Ordners |
| `files_read` | `session_id`, `key`, `path` | `FileContent` | Arbeitsverzeichnis-Fassung der Datei im Ordner des Eintrags |
| `files_history` | `session_id` | `ProjectHistory` | immer das ganze Vorhaben |
| `files_commit_diff` | `session_id`, `key`, `commit`, `path` | `FileDiff` | Diff eines eigenen Commits gegen seinen ersten Elternteil |
| `files_open_in_editor` | `session_id`, `key`, `path`, `line: Option<u32>` | `()` | `code --goto <Datei>:<Zeile>` |
| `file_link_resolve` (in `commands/file_links.rs`) | `session_id`, `path` | `FileLinkTarget` | entscheidet, wohin ein Dateilink führt |

Jeder Pfad aus der Oberfläche läuft durch `changes::validate_path`, wird an den Ordner des Eintrags gehängt und nach `fs::canonicalize` gegen den kanonischen Ordner des Eintrags geprüft (`starts_with`); sonst `CommandError::FileNotAllowed`. Ein Schlüssel wird nie direkt zum Pfad (AGENTS.md Regel 5).

### Konstanten

| Name | Wert | Ort |
|---|---|---|
| `MAX_TREE_FILES` | 50 000 | `files/tree.rs` |
| `MAX_DIR_ENTRIES` | 2 000 | `files/tree.rs` |
| `MAX_IMAGE_BYTES` | 2 · 1024 · 1024 | `files/read.rs` |
| `IMAGE_EXTENSIONS` | `png jpg jpeg gif webp svg ico` | `files/read.rs` |
| `EXTERNAL_EXTENSIONS` | `html htm pdf` | `file_links/mod.rs` |
| `EMPTY_TREE` | `4b825dc642cb6eb9a060e54bf8d69288fbee4904` | `files/history.rs` |
| `MAX_RESULTS` | 40 | `src/features/files/searchFiles.ts` |
| `NARROW_WIDTH_PX` | 780 | `src/features/files/FilesView.css` (Container-Abfrage) |

Text: höchstens `changes::MAX_UNTRACKED_BYTES` (8 MB, sonst `TooLarge`) und `parse::MAX_DIFF_LINES` Zeilen (20 000, danach `truncated`).

### Zusammenlegen der Einträge (Oberfläche, `src/features/files/mergeGroups.ts`)

1. Einträge mit gleichem `group` bilden einen Knoten, in der Reihenfolge des ersten Auftretens; Name = `groupName`.
2. Je Pfad entsteht aus den `FileChange` der Einträge eine Liste von Fassungen `{ entryKey, branch, change }`. Zwei Fassungen mit gleichem, gesetztem `lastCommit` und ohne `uncommitted` sind dieselbe: es bleibt die des Eintrags mit `isMain`, sonst die erste.
3. Die Fassungen sind nach `changedAt` absteigend sortiert; die erste ist die gezeigte. Zeilenzahlen und Buchstabe (A, M, D) der Zeile kommen von ihr, die Summe des Knotens aus den gezeigten Fassungen.
4. Anker = der Eintrag mit dem größten `changedAt` unter seinen Dateien; ohne Änderungen der Eintrag mit `isMain`, sonst der erste.
5. Codebasis des Knotens = `baseRef` des Eintrags mit `isMain`, sonst des ersten. Branch als Nebenangabe = die verschiedenen `branch` der Einträge mit Dateien, höchstens zwei genannt, danach `+n`.

### Blickwinkel und Session-Filter

Standard in einer Session und in der Übersicht des Vorhabens: Reichweite `project`, Blickwinkel `all`. Der Session-Filter lädt `changes_load(<gewählte Session>, session)`; Diffs dann mit derselben Session und Reichweite `session`. Die Blickwinkel „Alle · Uncommitted · Committed“ wirken wie bisher (`statOf`).

### Suche (`src/features/files/searchFiles.ts`)

Durchsucht die Pfade aller geladenen Bäume, nie ignorierte Einträge. Vergleich ohne Groß-/Kleinschreibung, Ergebnisse bleiben nach genauer Schreibweise getrennt. Wertung je Pfad: Suchtext im Dateinamen `1000 − Position − 0,1 · Namenslänge`, am Namensanfang `+200`; sonst im Pfad `500 − 0,1 · Position`; sonst als Buchstabenfolge in Reihenfolge `100 − 0,1 · Pfadlänge`; sonst kein Treffer. Geänderte Dateien `+50`. Die besten `MAX_RESULTS`. Leeres Suchfeld: die geänderten Dateien nach `changedAt` absteigend.

### Dateilink (`file_links::target`, Reihenfolge der Regeln)

1. Bereinigen wie bisher (`clean`), Zeile = erste angehängte Zahl. Unter Unix bleibt nach dem Entfernen von `file://` der führende Schrägstrich stehen (`file:///home/x` → `/home/x`); die Prüfung „Doppelpunkt nur an Stelle 1“ gilt nur unter Windows.
2. Enthält der Pfad kein Trennzeichen und gibt es ihn in keiner relativen Basis: `Name`.
3. Auflösen und Grenze prüfen wie `resolve`, aber ohne Endungsliste. Nicht gefunden: `FileNotFound`. Außerhalb: `FileNotAllowed` wie heute.
4. Endung in `EXTERNAL_EXTENSIONS`: `External`.
5. Liegt die Datei im Ordner eines Eintrags (längster passender kanonischer Ordner gewinnt): `View` mit dessen `key` und dem Pfad relativ dazu mit `/`.
6. Sonst (Workspace, Scratchpad): Endung in `OPENABLE_EXTENSIONS` → `External`, sonst `FileNotAllowed("Liegt in keinem Repository des Vorhabens")`.

`file_link_open` bleibt unverändert und prüft seine Endungsliste weiter selbst.

### Linux und macOS

Kein neuer Code darf Windows voraussetzen: Pfade aus Git tragen `/` und werden nie in Kleinbuchstaben verglichen; Baum und Suche unterscheiden `Readme.md` und `README.md`; symbolische Links erscheinen als Link und werden beim Lesen nur geöffnet, wenn ihr kanonisches Ziel im Ordner des Eintrags liegt; ein Commit, der nur Dateirechte ändert, zeigt einen Hinweis statt eines leeren Diffs; Strg P ruft `preventDefault` auf; `files_open_in_editor` startet `code` unter Windows über `cmd /C`, sonst direkt. Die sechs Punkte stehen als AK in den Phasen 1, 4, 5 und 6.

## Finale AK

1. In einem Vorhaben mit mehreren Arbeitsordnern desselben Repositorys steht das Repository im Baum genau einmal; kein Worktree-Ordnername erscheint im Baum, in der Leiste oder in der Übersicht. Codebasis steht am Knoten, der Branch nur als Nebenangabe.
2. „Alle Dateien“ zeigt den ganzen Ordner des Repositorys einschließlich neuer und von Git ignorierter Einträge; geänderte Dateien sind hervorgehoben, Ordner tragen die Zahl ihrer geänderten Dateien. Ignorierte Ordner, die selbst Repository oder Arbeitsbaum sind, fehlen.
3. Die Übersicht nennt Kennzahlen, je Repository Codebasis, Umfang und Abgleich, und den Verlauf nach Session mit Commits und Dateien. „Übersicht · Verlauf“ steht fest über dem Baum; aus einer geöffneten Datei führen „← Übersicht“ und Esc zurück, Aufgeklapptes und Bildlaufposition bleiben.
4. Eine Datei zeigt „Änderung“ (ganzes Vorhaben oder ein Schritt) und „Ganze Datei“ mit markierten geänderten Zeilen; unveränderte Dateien, Bilder, Binärdateien und zu große Dateien haben je ihren Zustand.
5. Strg P setzt den Fokus ins Suchfeld; Tippen, Pfeiltasten und Enter öffnen eine Datei aus jedem Repository des Vorhabens.
6. Ein Dateilink im Chat öffnet die Datei in „Dateien“ und springt zur genannten Zeile; HTML und PDF öffnen im Standardprogramm; ein Name mit mehreren Treffern öffnet die Suche.
7. Die Git-Werkzeuge sind je Repository über „Git“ am Knoten erreichbar und können alles, was sie vorher im Reiter „Changes“ konnten; der Reiter „Changes“ existiert nicht mehr.
8. `pnpm check` grün; `cargo check` für Linux und macOS im Kompilier-Check der CI grün.

## Wackelstellen

- `SessionRegistry::changes_input` mit der ID einer längst beendeten Session als Session-Filter ist nicht gemessen → Check in Phase 3: `cargo run --example changes-probe -- <Kopie> <ID einer beendeten Session> session` muss Einträge liefern; liefert es `sessionNotFound`, bietet der Filter nur Sessions an, die die Registry kennt (`project_members`).
- Die Reichweite, mit der Review-Kommentare ihren Eintrag beim Senden auflösen, ist nicht gelesen → Geprüft in Phase 4 (Auflösung stand auf `Session`, jetzt `Project` in `SessionRegistry::comment_folders`): in `src-tauri/src/review/` die Auflösung des Schlüssels suchen; löst sie mit `Session` auf, auf `Project` umstellen, sonst scheitern Kommentare an Dateien aus dem Ordner einer anderen Session.
- `attribution::normalize_path` ersetzt `/` durch `\` und schreibt klein, ohne Unterschied nach Betriebssystem (gelesen am 2026-11-18); Phase 1 gibt ihr einen Unix-Zweig. Ob ein früherer Plan die Unix-Pfade an anderer Stelle schon abfängt, ist nicht gelesen → Check in Phase 1: Aufrufer von `normalize_path` suchen (Grep `normalize_path` in `src-tauri/src`) und prüfen, dass keiner danach noch einmal umformt.
- Ob `ts-rs` aus einem Enum mit `serde(tag = "kind")` und benannten Feldern den erwarteten TypeScript-Typ erzeugt, ist am Muster `AutoHandoff` abgelesen, nicht für `FileContent` gelaufen → Check in Phase 1: nach `pnpm bindings` die Datei `src/lib/bindings/FileContent.ts` lesen; sie muss eine Vereinigung mit `kind: "text" | "image" | "binary" | "tooLarge" | "missing"` sein.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
