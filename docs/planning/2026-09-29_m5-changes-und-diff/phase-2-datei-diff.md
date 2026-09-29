# Phase 2 — Core: Diff einer Datei

**Status:** complete · **Rating:** standard (Kontrakt steht, Parser für ein festes Format, eine Sicherheitsprüfung für Pfade)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (Blickwinkel, Plumbing, Untracked, Grenzen) und „Kontrakt“ (Git-Funktionen `diff_tree_patch`, `diff_index_patch`, `is_untracked`; Typen `DiffLineKind`, `DiffLine`, `FileDiff`; Command `changes_file_diff`)
- [ADR 006](../../decisions/006-changes-und-diff.md) (aus Phase 1)
- Bestand aus Phase 1: `src-tauri/src/git/mod.rs` (`run_raw`), `src-tauri/src/changes/{mod.rs,model.rs,parse.rs}` (`untracked_stat`, Konstanten), `src-tauri/src/commands/changes.rs`, `src/lib/changes.ts`
- Fehlerklassen: Vault `werkzeuge/git.md` — **Zeilenenden unter Windows:** Der Patch-Text kann Zeilen mit `\r` am Ende enthalten (Datei im Repository mit CRLF eingecheckt), und eine untracked Datei im Arbeitsbaum hat CRLF. Der Parser entfernt genau ein `\r` am Zeilenende — prüfen per AK 3. Projekteigen:
  - **Pfad aus der Oberfläche landet im Dateisystem:** `path` geht bei untracked Dateien in `fs::read`. Ein Pfad mit `..`, Laufwerksbuchstaben oder führendem Trenner würde außerhalb des Worktrees lesen — `validate_path` vor jedem Zugriff, prüfen per AK 4.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt `DiffLineKind.ts`, `DiffLine.ts`, `FileDiff.ts`.
2. `changes_file_diff` (Entwicklerkonsole: `await window.__TAURI_INTERNALS__.invoke('changes_file_diff', { sessionId, position: 0, path: '<datei>', scope: 'all' })`) für eine geänderte Datei: erste Zeile `kind: 'hunk'` mit dem Text `@@ -a,b +c,d @@ …`, danach Kontext-, Plus- und Minus-Zeilen mit fortlaufenden Nummern (Kontext: beide, Plus: nur `newLine`, Minus: nur `oldLine`), identisch zu `git -C <worktree> diff <base_commit> -- <datei>` ab der ersten `@@`-Zeile.
3. Eine Datei mit CRLF-Zeilenenden: kein `text` endet auf `\r`.
4. `path: '../x'`, `path: 'C:/Windows/win.ini'`, `path: '/etc'` und `path: ''` → Fehler `internal` mit „Ungültiger Pfad“; `position: 99` → Fehler `internal`.
5. Neue, untracked Datei mit 3 Zeilen, Blickwinkel `all` und `uncommitted`: eine Hunk-Zeile `@@ -0,0 +1,3 @@`, drei `added`-Zeilen mit `newLine` 1–3. Blickwinkel `committed`: `lines: []`.
6. PNG-Datei: `binary: true`, `lines: []`. Eine Textdatei mit mehr als 20 000 Diff-Zeilen: genau 20 000 Einträge in `lines`, `truncated: true`.

## Checkliste

- [x] `git/mod.rs`: `diff_tree_patch(worktree, from, to, path)`, `diff_index_patch(worktree, from, path)` über `run_raw`, Argumente genau wie im Kontrakt (`--` als eigenes Argument vor `path`); `is_untracked(worktree, path)` → `run_raw` mit `ls-files --others --exclude-standard -z -- <path>`, `Ok(!ausgabe.is_empty())`.
- [x] `changes/model.rs`: `DiffLineKind`, `DiffLine`, `FileDiff` nach Kontrakt.
- [x] `changes/parse.rs`: `pub const MAX_DIFF_LINES: usize = 20_000;` und `pub fn unified(raw: &str) -> FileDiff`:
  - `binary = false`, `in_hunk = false`, Zähler `old`, `new` (u32).
  - Je Zeile aus `raw.split('\n')`: ein `\r` am Ende entfernen. Zeile beginnt mit `Binary files ` → `binary = true`, weiter. Beginnt mit `@@` → `in_hunk = true`; `old` und `new` aus `@@ -<old>[,n] +<new>[,n] @@` lesen (erstes Feld nach `-` bis `,` oder Leerzeichen bzw. nach `+`), Zeile als `Hunk` mit ganzem Text, ohne Nummern. Vor dem ersten `@@` alles andere überspringen (Kopfzeilen `diff --git`, `index`, `---`, `+++`, `new file mode` …). Im Hunk: erstes Zeichen `' '` → `Context` mit `old`/`new`, beide danach +1; `'-'` → `Deleted` mit `old`, `old` +1; `'+'` → `Added` mit `new`, `new` +1; `'\\'` (`\ No newline at end of file`) und leere Zeile (Ende der Ausgabe) überspringen. `text` = Zeile ohne das erste Zeichen.
  - Sobald `lines.len() == MAX_DIFF_LINES` und noch eine weitere Zeile käme → `truncated = true`, abbrechen.
  - Ein Hunk-Kopf, dessen Zahlen sich nicht lesen lassen, setzt `old`/`new` auf 0 und wird trotzdem als Hunk ausgegeben (kein Fehler).
- [x] `changes/mod.rs`:
  - `fn validate_path(path: &str) -> Result<(), CommandError>`: Fehler `CommandError::Internal(format!("Ungültiger Pfad: {path}"))`, wenn leer, beginnt mit `/` oder `\`, enthält `:`, oder ein Teil nach Split an `/` und `\` ist `..`.
  - `pub fn file_diff(workspace, repository, path, scope) -> Result<FileDiff, CommandError>`: `validate_path(path)?`; Haupt-Checkout fehlt → `Err(RepositoryMissing(pfad))`; Worktree fehlt → `Err(CommandError::Io(WORKTREE_MISSING.to_owned()))`. Dann `raw` nach Blickwinkel: `Committed` → `git::diff_tree_patch(worktree, base_commit, "HEAD", path)`, `All` → `git::diff_index_patch(worktree, base_commit, path)`, `Uncommitted` → `git::diff_index_patch(worktree, "HEAD", path)`. Ist `scope != Committed` und `raw.trim().is_empty()` und `git::is_untracked(worktree, path)?` → `untracked_diff(&worktree.join(path mit '/' → '\\'))`, sonst `parse::unified(&raw)`.
  - `fn untracked_diff(path: &Path) -> Result<FileDiff, CommandError>`: gleiche Binär-/Größenregel wie `untracked_stat` (gemeinsame Hilfsfunktion `fn read_text(path) -> Option<String>` herausziehen, `None` = binär oder zu groß; `untracked_stat` benutzt sie mit). Binär → `FileDiff { lines: vec![], binary: true, truncated: false }`. Sonst Zeilen per `split('\n')`, je ein `\r` am Ende entfernen, ein leeres letztes Stück (Datei endet auf Zeilenumbruch) weglassen; erste Zeile `Hunk` mit Text `@@ -0,0 +1,<n> @@`, dann je Zeile `Added` mit `new_line` ab 1; `MAX_DIFF_LINES`-Grenze wie im Parser.
- [x] `commands/changes.rs`: `changes_file_diff(registry, session_id: String, position: u32, path: String, scope: ChangeScope) -> Result<FileDiff, CommandError>` → `repositories_of`, `repositories.get(position as usize)` — fehlt → `Internal(format!("Repository-Position {position} gibt es in dieser Session nicht"))`; dann `changes::file_diff`. Registrieren in `lib.rs`.
- [x] `bin/gen-bindings.rs`: drei neue Typen; `pnpm bindings`.
- [x] `src/lib/changes.ts`: `loadFileDiff(sessionId: string, position: number, path: string, scope: ChangeScope): Promise<FileDiff>` → `invoke<FileDiff>('changes_file_diff', { sessionId, position, path, scope })`, JSDoc mit `@throws … internal, repositoryMissing, io, git`.
- [x] Code-Map: Zeile „Changes“ um `changes_file_diff`, `parse::unified` ergänzen.
- [x] `pnpm check`, Commit `feat(changes): return the unified diff of one file`.

## Report-Back

`pnpm check` und `pnpm bindings` grün; Abnahmekriterien 2–6 nicht gegen die laufende App geprüft (Smoke am Plan-Ende). `untracked_diff` gibt `FileDiff` statt `Result` zurück — dort gibt es keinen Fehlerpfad (unlesbar → binär). Leere neue Datei → `lines: []`.
