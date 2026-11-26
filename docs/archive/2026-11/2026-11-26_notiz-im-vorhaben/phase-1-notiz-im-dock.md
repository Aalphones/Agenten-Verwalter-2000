# Phase 1 — Notiz im Dock

**Rating:** standard · **Status:** complete

## Kontext (vor dem ersten Edit lesen)

- `README.md` dieses Plans: Kontrakt, „Von mir gesetzt“, Risiken.
- `AGENTS.md`, `docs/code-map.md` (Zeilen „Terminal im Vorhaben“ und „Hintergrund“), `docs/conventions/rust.md`, `typescript.md`, `react.md`, `tailwind.md`, `linting.md`.
- `docs/decisions/052-terminal.md` (Dock, Reiter, nur im Speicher).
- Core-Muster: `src-tauri/src/commands/terminal.rs` (Befehl mit `SessionRegistry`), `src-tauri/src/sessions/registry/terminal.rs` (`project_workspace` liefert `project_not_found` für ein unbekanntes Vorhaben), `src-tauri/src/filesystem/workspace.rs` (`data_dir`), `src-tauri/src/background/scratchpad.rs` (Pfadprüfung, `CommandError::Io`), `src-tauri/src/settings/model.rs` (Derive-Muster `Serialize, Deserialize, TS`), Registrierung in `src-tauri/src/lib.rs` (`invoke_handler`, Zeile mit `commands::terminal::terminal_list`) und `src-tauri/src/commands/mod.rs`.
- Oberfläche: `src/features/terminal/TerminalDock.tsx`, `TerminalDock.css`, `src/stores/terminal.ts`, `src/lib/terminal.ts` (Wrapper-Muster mit JSDoc `@throws`), `src/lib/errors.ts` (`commandErrorText`).
- Vault-Fehlerklassen `sprachen/typescript`, `frameworks/react`: nicht einschlägig (README).

## AK

1. `note_read` für ein Vorhaben ohne Datei liefert `{ text: "", modifiedMs: 0 }` und legt nichts an.
2. `note_write` schreibt `%USERPROFILE%\.verwalter\notizen\<ID>.txt` (UTF-8, Ordner wird angelegt) über eine Zwischendatei `<ID>.txt.tmp` plus Umbenennen; `note_read` liefert danach denselben Text.
3. Eine ID mit anderen Zeichen als `A–Z a–z 0–9 -` oder ein unbekanntes Vorhaben → Fehler `internal` mit Satz, keine Datei angelegt. Text über 1 MiB (UTF-8-Bytes) → Fehler „Notiz ist größer als 1 MiB“, Datei unverändert.
4. Das Dock zeigt ganz links einen Reiter „Notiz“ mit Stift-Symbol (Inline-SVG, 14 px), Text in `--color-accent-text`, Hintergrund des aktiven Reiters `--color-accent-subtle`; Terminal-Reiter bleiben unverändert.
5. Klick auf „Notiz“ zeigt ein `<textarea>` über die ganze Dock-Fläche: Festbreitenschrift wie das Terminal, `wrap="off"`, `spellCheck={false}`, `autoCorrect="off"`, `autoCapitalize="off"`, Platzhalter „Befehle zusammenbauen, Token ergänzen … — wird automatisch gespeichert, Agenten sehen diese Notiz nicht.“
6. Getippter Text wird 500 ms nach dem letzten Tastendruck gespeichert, zusätzlich sofort beim Wechsel auf einen Terminal-Reiter, beim Ausblenden, beim Vorhabenwechsel und beim Unmount. Rechts in der Notiz-Leiste steht „Gespeichert“ / „Speichert …“ bzw. der Fehlersatz in der Fehlerzeile des Docks.
7. `×` am Notiz-Reiter (Titel „Notiz ausblenden — die Datei bleibt erhalten“) blendet den Reiter aus; danach steht neben `+` ein Stift-Knopf (Titel „Notiz einblenden“), der ihn wieder einblendet und auswählt.
8. Das automatische Öffnen eines Terminals bei leerem Vorhaben (`TerminalDock.tsx`, Effekt „Ein Vorhaben ohne Terminal …“) bleibt unverändert; war zuletzt die Notiz gewählt, zeigt das Dock beim Öffnen die Notiz.

## Checkliste

**Core**
- [x] `src-tauri/src/notes/mod.rs` + `model.rs` anlegen, in `lib.rs` als `pub mod notes;` eintragen. `model.rs`: `NoteText`, `NoteSaved` laut Kontrakt, Derive wie `settings/model.rs`, `#[serde(rename_all = "camelCase")]`.
- [x] `mod.rs`: `const MAX_NOTE_BYTES: usize = 1024 * 1024;`, `const NOTES_FOLDER: &str = "notizen";`, `fn valid_id(id: &str) -> bool` (nicht leer, nur ASCII-Alphanumerik und `-`), `pub fn path_of(data_dir: &Path, project_id: &str) -> Result<PathBuf, CommandError>`, `pub fn read(path: &Path) -> Result<NoteText, CommandError>` (fehlende Datei → leer; größer als Grenze → Fehler), `pub fn write(path: &Path, text: &str) -> Result<NoteSaved, CommandError>` (Grenze prüfen, `create_dir_all`, `.tmp` schreiben, `fs::rename`).
- [x] `src-tauri/src/commands/notes.rs`: `note_read(app, registry, project_id)` und `note_write(app, registry, project_id, text)`; beide rufen zuerst `registry.project_workspace(&project_id)?` (Ergebnis verwerfen, nur Existenzprüfung), dann `crate::filesystem::workspace::data_dir(&app)?` und `notes::path_of`. In `commands/mod.rs` und `invoke_handler` eintragen.
- [x] `pnpm bindings`.

**Oberfläche**
- [x] `src/lib/notes.ts`: `readNote(projectId)`, `writeNote(projectId, text)` nach dem Muster von `src/lib/terminal.ts`.
- [x] `src/stores/terminal.ts`: `export const NOTE_TAB_ID = 'note';`, Feld `noteHidden: Record<string, boolean>`, Aktionen `hideNote(projectId)` (setzt `noteHidden`, und ist die Notiz gewählt, wird `selected[projectId]` gelöscht) und `showNote(projectId)` (hebt auf, setzt `selected[projectId] = NOTE_TAB_ID`).
- [x] `src/features/notes/useProjectNote.ts`: lädt beim Wechsel der `projectId`, hält `text`, `state: 'loading' | 'saved' | 'saving' | 'error'`, `error: string | null`, `setText` (startet 500-ms-Timer), `flush()` (speichert sofort, wenn ungespeichert); ruft `flush` im Cleanup bei `projectId`-Wechsel und Unmount.
- [x] `src/features/notes/NotePane.tsx` + `NotePane.css` (BEM `note-pane`): Leiste mit Statustext rechts, darunter `<textarea>` laut AK 5. Prop `projectId`. Die Leiste bekommt einen leeren Bereich links für Phase 3.
- [x] `src/features/notes/PencilIcon.tsx`: Inline-SVG-Stift, `aria-hidden`.
- [x] `TerminalDock.tsx`: Notiz-Reiter vor den Terminal-Reitern rendern, wenn `!noteHidden[projectId]`; `shown` berücksichtigt `selected[projectId] === NOTE_TAB_ID` → `<NotePane>` statt `<TerminalPane>`; Stift-Knopf neben `+`, wenn ausgeblendet. Modifikator `terminal-dock__tab--note` in `TerminalDock.css` laut AK 4.
- [x] `docs/code-map.md`: neue Zeile „Notiz im Vorhaben“ (Core `src-tauri/src/notes/`, `commands/notes.rs`; Oberfläche `src/features/notes/`, `src/lib/notes.ts`, Anschluss `TerminalDock.tsx`), Stand-Satz oben ergänzen. `docs/glossary.md`: Begriff „Notiz“ (eine je Vorhaben, außerhalb des Workspace, Agenten sehen sie nicht).
- [x] `docs/decisions/074-notiz-im-vorhaben.md` (10 Zeilen): Kontext Token in Befehlen; Optionen Scratchpad im Workspace + Sperren vs. Datenordner; Entscheidung Datenordner, Gründe aus README „Risiken“; Konsequenz Klartext auf der Platte.

## Prüfung

- `pnpm check` grün (Summenzeile ins Report-Back). Keine automatisierten Tests (privates Profil).

## Report-Back

`pnpm check` grün (Lint, Typecheck, Build, rustfmt, Clippy). Oberfläche nicht in der echten App gelaufen. Abweichung: `NotePane` bekommt `key={projectId}` im Dock, statt dass der Hook den Vorhabenwechsel selbst behandelt (ESLint `react-hooks` verbietet Ref-Schreiben im Render und setState im Effekt); `NotePane` hat zusätzlich die Prop `onError` für die Fehlerzeile des Docks.
