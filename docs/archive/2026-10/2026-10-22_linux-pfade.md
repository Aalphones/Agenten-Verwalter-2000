# Linux- und macOS-Pfade in Git und Dateisystemen

## Überblick

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | Externe Pfade nativ behandeln und plattformabhängige Aufrufe korrigieren | standard | complete |

## Ziel

Unter Linux und macOS bleiben Git- und URL-Pfade mit `/` gültige Dateisystempfade. Repository-Erkennung, Worktree-Erkennung, Git-Zustand, Changes, Artefakte und Scratchpad-Dateien funktionieren mit nativen Pfaden. Unter Windows bleiben Git-Pfade mit `\` kompatibel.

## Umfang

- Gemeinsame Funktion `filesystem::native_path(&str) -> PathBuf` in `src-tauri/src/filesystem/mod.rs`: nur unter Windows `/` in `\` umwandeln, auf anderen Plattformen den Text unverändert an `PathBuf` geben.
- Die Funktion an allen Stellen verwenden, an denen ein Git- oder URL-Pfad in einen Dateisystempfad umgewandelt wird:
  - `git::toplevel`, `parse_worktree_block` und `git_path_exists` in `src-tauri/src/git/mod.rs`.
  - Untracked-Dateien und deren Diff in `src-tauri/src/changes/mod.rs`.
  - Relative Artefaktpfade in `src-tauri/src/artifacts/server.rs`.
- Scratchpad-Pfade in `src/features/background/ScratchpadTab.tsx` mit dem Trenner des gelieferten Ordnerpfads zusammensetzen.
- `git::open_in_vs_code` in `src-tauri/src/git/actions.rs`: auf Windows weiter `cmd /C code`, sonst `code` direkt starten.
- `worktrees::rule_path` in `src-tauri/src/worktrees/mod.rs`: Unix-Absolute beginnen für Claude-Freigabemuster mit `//`; Windows-Laufwerkspfade behalten die vorhandene Form.
- Rust-Konvention und Release-Hinweis zu nicht getesteten Plattformpfaden aktualisieren.

## Außerhalb des Umfangs

- Vergleichsnormalisierung in `changes/attribution.rs`, `worktrees::normalized_dir`, Repository-Vergleichen und Artefakt-Präfixvergleichen. Diese Werte dienen dem Vergleich und werden nicht als Dateisystempfad geöffnet.
- `to_lowercase()` in Vergleichsschlüsseln: mögliche Unterschiede bei Groß-/Kleinschreibung auf Linux sind ein separates Thema.
- Die Windows-spezifischen Programme `taskkill`, `powershell.exe` und `cmd` in der Betriebsart „Autark“.
- Allgemeine Linux-/macOS-Unterstützung jenseits der beschriebenen Pfad- und VS-Code-Fälle.

## Entscheidungen und Risiken

- Pfadumwandlung wird in `filesystem` zentralisiert, weil Git-Ausgaben und Artefakt-URLs dieselbe Konvertierung von `/` zu nativen `PathBuf`s benötigen. Eine Umwandlung nur an Git-Aufrufstellen ließe den Artefakt-Server als gleichartigen Fehlerpfad zurück.
- Unix-Freigabemuster erhalten ein zusätzliches führendes `/`, damit der absolute Pfad als `//home/...` beginnt. Bei der Umsetzung ist der tatsächlich erzeugte Musterstring zu prüfen; ein einzelnes `/` wird von Claude Code relativ zu den Einstellungen interpretiert.
- Die Änderung behebt bekannte Pfadfehler, belegt aber für sich allein keine vollständige Linux-/macOS-Unterstützung. Die bestehende Release-Pipeline baut AppImage und `.deb`; ein Laufzeitnachweis auf Linux bleibt erforderlich.

## Konfidenz

Eine offene Stelle: Die Scratchpad-Ordnerzeichenkette muss unter Nicht-Windows bereits mit nativen Trennern aus dem Core kommen. Vor der Anpassung `scratchpad`-Command und den Typ `SessionSummary` in `src-tauri/src/commands/background.rs` und `src-tauri/src/sessions/` nachverfolgen; die Funktion richtet sich anschließend nach diesem gelieferten Pfad.

## Gesamtabnahme

- Git-Repository-, Worktree- und Git-Zustandspfade werden unter Unix ohne Backslash-Konvertierung als Dateisystempfade verwendet.
- Untracked-Dateistatistik und -Diff sowie Artefakte in Unterordnern verwenden unter Unix tatsächlich `/`-Pfade.
- Scratchpad-Dateien lassen sich mit dem vom Core gelieferten nativen Ordnerpfad öffnen.
- Claude-Freigabemuster enthalten für `/home/...` den Präfix `//home/...`; Windows-Muster bleiben unverändert.
- VS Code startet über `cmd /C code` nur unter Windows und direkt über `code` auf Unix.
- `pnpm check` ist grün; `docs/conventions/rust.md` und der Plattformhinweis in `docs/conventions/releases.md` entsprechen dem neuen Verhalten.

## Phase 1 — Pfade und Plattformaufrufe

### Kontext

Vor der Umsetzung lesen: `AGENTS.md`, `docs/code-map.md`, `docs/conventions/rust.md`, `docs/conventions/typescript.md`, `docs/conventions/linting.md`, `docs/conventions/releases.md`, `src-tauri/src/filesystem/mod.rs`, `src-tauri/src/git/mod.rs`, `src-tauri/src/git/actions.rs`, `src-tauri/src/changes/mod.rs`, `src-tauri/src/artifacts/server.rs`, `src-tauri/src/worktrees/mod.rs`, `src/features/background/ScratchpadTab.tsx` sowie den Scratchpad-Command und `SessionSummary`.

### Abnahmekriterien

- Die gemeinsame Pfadfunktion ändert Separatoren nur unter Windows.
- Jede in „Umfang“ genannte Dateisystem-Konvertierung nutzt native Pfade; reine Vergleichsnormalisierung bleibt Vergleichslogik.
- Unix-Freigabemuster beginnen mit `//`, Windows-Laufwerkspfade behalten ihr bestehendes Format.
- VS-Code-Aufruf und Scratchpad-Pfad verwenden den jeweiligen Plattformtrenner.
- Die Dokumentation behauptet nicht mehr, dass alle Git-Pfade weiterhin auf Windows-Trenner umgeschrieben werden.

### Checkliste

- [x] Scratchpad-Pfadquelle bis zum Core nachverfolgen und im Frontend den nativen Trenner verwenden.
- [x] `native_path` in `filesystem` ergänzen und Git-, Changes- und Artefakt-Dateisystemzugriffe darauf umstellen.
- [x] VS-Code-Aufruf nach Betriebssystem verzweigen.
- [x] Unix- und Windows-Zweige von `rule_path` korrigieren bzw. erhalten.
- [x] `docs/conventions/rust.md` und `docs/conventions/releases.md` aktualisieren; `docs/code-map.md` nur ändern, falls die bestehende Zuordnung nicht mehr zutrifft.
- [x] `pnpm check` ausführen.
- [ ] (offen, Follow-up) Nach einem Linux-Laufzeitnachweis den Hinweis in `docs/conventions/releases.md` präzise aktualisieren; bis dahin Linux/macOS weiterhin als nicht vollständig getestet kennzeichnen.

## Abschluss

### Summary

`filesystem::native_path` wandelt `/` nur unter Windows in `\` um; Git-, Changes-, Artefakt- und Review-Pfade nutzen sie. Der Scratchpad-Ordner kommt als `PathBuf`-Text mit nativen Trennern aus dem Core, das Frontend übernimmt den Trenner aus dem Ordnerpfad. VS Code startet nur unter Windows über `cmd`. Unix-Freigabemuster beginnen mit `//`. `pnpm check` grün.

### Files touched

`src-tauri/src/filesystem/mod.rs`, `git/mod.rs`, `git/actions.rs`, `changes/mod.rs`, `artifacts/server.rs`, `review/mod.rs`, `worktrees/mod.rs`, `src/features/background/ScratchpadTab.tsx`, `docs/conventions/rust.md`, `docs/conventions/releases.md`.

### Commits

Siehe `git log` zum Plan „Linux-Pfade“.

### Deviations from plan

- Zusätzlich umgestellt: der Dateipfad des Artefakt-Kommentars in `review/mod.rs` (gleiche Umwandlung, im Plan nicht genannt).
- Der Hinweis „Öffnet den Ordner im Windows-Explorer“ im Scratchpad-Tab bleibt unverändert (außerhalb des Umfangs).

### Follow-ups

- Laufzeitnachweis auf Linux/macOS; danach den Plattformhinweis in `docs/conventions/releases.md` präzisieren.
- Wurzelordner `/` als Elternordner eines Ticket-Worktrees ergäbe das Muster `///…` — unwahrscheinlich, nicht behandelt.