# Phase 1 — Retro-Transkript, Verlaufsdateien, Einmal-Aufruf mit wählbarem Modell

## Kontext (vor dem Start lesen)

- `README.md` dieses Plans (Kontrakt)
- `docs/code-map.md` (Namensschema), `docs/conventions/rust.md`, `docs/conventions/commits.md`, `docs/conventions/linting.md`
- `src-tauri/src/tldr/transcript.rs` — `session_transcript`, `entry_block`, `fit`, `status_label`, `Block`
- `src-tauri/src/agents/claude/print.rs` — `ask_haiku`, `HaikuRequest`, `PrintRequest`, `run_print`
- `src-tauri/src/agents/event.rs` — `ChatEntry`, `ToolState`, `ModelId::cli_id`
- `src-tauri/src/skills/model.rs` — `SkillRef`
- Fehlerklassen geprüft (TypeScript, React, SQLite, Claude Code): keine einschlägig für diese Phase.

## Abnahmekriterien der Phase

1. `ask_haiku` verhält sich unverändert; neu gibt es `ask_model` mit wählbarem Modell.
2. `retro::transcript::session_file` liefert den Dateiinhalt laut Format unten; Tool-Einträge erscheinen nur als Zählung und als Fehlschläge.
3. `pnpm check` grün. Zwei Commits: erst der Refactor (ohne Verhaltensänderung), dann das neue Modul.

## Format `session-<N>.md`

```text
# Session #<Nummer> – <Name>
Status: <status_label>
Modell: <ModelId::cli_id>
Werkzeug-Aufrufe: <alle Tool-Einträge>, davon fehlgeschlagen: <Failed>, abgebrochen: <Interrupted>
Gekürzt: <ja|nein>

<Retro-Transkript>
```

## Checkliste

### Commit 1 — Refactor (keine Verhaltensänderung)

- [x] `print.rs`: neue `pub fn ask_model<T: DeserializeOwned>(app: &AppHandle, program: &PrintProgram, model: ModelId, request: &HaikuRequest<'_>) -> Result<T, String>` mit dem bisherigen Rumpf von `ask_haiku`, `ModelId::Haiku` durch `model` ersetzt. `ask_haiku` ruft `ask_model(app, program, ModelId::Haiku, request)`. `HaikuRequest` behält Namen und Felder (keine Umbenennung in diesem Plan).
- [x] `tldr/transcript.rs`: `Block` samt Feldern, `entry_block`, `status_label` auf `pub(crate)`. Neue `pub(crate) fn fit_with_flag(blocks: Vec<Block>) -> (String, bool)` mit dem bisherigen Rumpf von `fit`; das Flag ist `true` genau im Zweig über der Obergrenze. `fit` ruft `fit_with_flag(blocks).0`.
- [x] `pnpm check`, Commit `refactor(tldr): Einmal-Aufruf mit wählbarem Modell, Transkript-Bausteine teilbar`.

### Commit 2 — Modul `retro`

- [x] `src-tauri/src/retro/mod.rs` (`pub mod model; pub mod transcript;`), `mod retro;` in `src-tauri/src/lib.rs`.
- [x] `src-tauri/src/retro/model.rs`: `RetroExport` und `RetroProgress` laut Kontrakt (`#[derive(Debug, Clone, Serialize, TS)]`, `#[serde(rename_all = "camelCase")]`, `#[ts(export)]` wie die übrigen Typen über die Tauri-Grenze — Muster: `src-tauri/src/tldr/model.rs`). In `src-tauri/examples/gen-bindings.rs` eintragen, `pnpm bindings`.
- [x] `src-tauri/src/retro/transcript.rs`:
  - `pub fn retro_transcript(entries: &[ChatEntry]) -> (String, bool)` — Blöcke über `entry_block` wie `session_transcript`; zusätzlich wird `ChatEntry::Tool` mit `ToolState::Failed` zum Block `Werkzeug fehlgeschlagen: <tool> <target>` und mit `ToolState::Interrupted` zu `Werkzeug abgebrochen: <tool> <target>` (`is_user: false`), an seiner Stelle im Verlauf. Letzte Aufgabenliste wie in `session_transcript` (dafür `todo_block` ebenfalls `pub(crate)`). Kürzen mit `fit_with_flag`.
  - `pub fn tool_counts(entries: &[ChatEntry]) -> (u32, u32, u32)` — alle Tool-Einträge / `Failed` / `Interrupted`.
  - `pub fn is_retro_session(entries: &[ChatEntry]) -> bool` — die erste `ChatEntry::User` hat `skill: Some(SkillRef { name, .. })` mit `name == "session-review"`; keine Nutzernachricht → `false`.
  - `pub fn session_file(number: u32, name: &str, status: SessionStatus, model: ModelId, entries: &[ChatEntry]) -> String` — Format oben.
- [x] `pnpm check`, Commit `feat(retro): Verlaufsdateien für die Vorhaben-Retro`.

## Report-Back
