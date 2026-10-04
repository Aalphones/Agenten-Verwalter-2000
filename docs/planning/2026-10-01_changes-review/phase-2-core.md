# Phase 2 — Core: `ReviewComment`, `chat_send` mit Kommentaren, Text an den Agenten

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ und **„Kontrakt“** (Typ, Chat-Eintrag, Command, Textformat) — der Kontrakt ist verbindlich.
- `src-tauri/src/commands/changes.rs` (`changes_file_diff`, `validate_folder` — die Auflösung wird verschoben, nicht geändert).
- `src-tauri/src/changes/mod.rs` (Modulliste, `file_diff`), `src-tauri/src/changes/model.rs` (`DiffLineKind`).
- `src-tauri/src/worktrees/mod.rs` (`SessionRepository`, `working_dir`, `TicketWorktree`, `ticket_worktrees`).
- `src-tauri/src/sessions/registry.rs`: `send` (inkl. Kommentar „Dateizugriffe gehören nicht unter die Session-Sperre“ und dem Lesen von `carried` vor `update`), `resume`, `push_user`, `message_line`, `repositories_of`, `project_ticket_worktrees`.
- `src-tauri/src/agents/event.rs` (`ChatEntry::User`, `Attachment` als Vorbild für derives).
- `src-tauri/src/attachments/mod.rs` (`message_content`: Anhänge-Pfadliste hinter dem Text).
- `src-tauri/src/tldr/transcript.rs` (Zweig `ChatEntry::User`).
- `src-tauri/src/commands/chat.rs`, `src-tauri/src/error.rs`, `src-tauri/src/lib.rs`, `src-tauri/examples/gen-bindings.rs`, `src/lib/chat.ts`, `src/features/chat/Composer.tsx` (`send`, `describeError`).
- [docs/conventions/rust.md](../../conventions/rust.md), [linting.md](../../conventions/linting.md), [commits.md](../../conventions/commits.md).
- Fehlerklassen geprüft (Vault: keine Rust-/Tauri-Entity vorhanden; `sprachen/typescript`): keine einschlägig.

**Chesterton:** `changes_file_diff` prüft, dass ein Ordner aus der Oberfläche dem Vorhaben gehört und ein Worktree ist, bevor er zu einem Pfad wird (Sicherheitsgrenze, AGENTS.md Regel 5). Diese Prüfung wird 1:1 verschoben und von beiden Aufrufern benutzt — nichts daran wird gelockert.

## Abnahmekriterien

- `pnpm check` grün; `pnpm bindings` erzeugt `src/lib/bindings/ReviewComment.ts`, `ChatEntry.ts` enthält `comments: Array<ReviewComment>`.
- `changes_file_diff` verhält sich unverändert (gleiche Fehlertexte, gleiche Prüfungen).
- `chat_send` mit leerer `comments`-Liste schickt exakt denselben Text an den Agenten wie vorher.
- Mit Kommentaren entspricht der Text an den Agenten dem Kontrakt (README); der Chat-Eintrag trägt den getippten Text unverändert und die Kommentare in `comments`.
- Kommentare während einer offenen Rückfrage → `CommentsWhileWaiting`; Kommentar mit `kind == Hunk` oder leerem `text` → `Internal`, nichts wird gesendet.
- Die TL;DR-Eingabe einer Nachricht mit Kommentaren enthält die Kommentare.
- Bestehende Sessions laden ihren Verlauf (Einträge ohne `comments`).

## Checkliste

### Auflösung Schlüssel → Ordner

- [x] Neue Datei `src-tauri/src/changes/entry.rs`, Kopfkommentar: Eintrag der Changes-Ansicht aus seinem Schlüssel auflösen; geprüft wie für den Diff. Inhalt:
  - `pub struct ChangesEntry { pub workspace: PathBuf, pub repository: SessionRepository, pub ticket: Option<TicketWorktree> }`
  - `impl ChangesEntry { pub fn folder(&self) -> PathBuf }` → `ticket.path.clone()` falls vorhanden, sonst `self.repository.working_dir(&self.workspace)`.
  - `pub fn resolve(registry: &SessionRegistry, session_id: &str, key: &str) -> Result<ChangesEntry, CommandError>` — der Körper von `changes_file_diff` bis vor `changes::file_diff(...)`, unverändert in Logik und Fehlertexten; statt `return changes::file_diff(...)` wird der `ChangesEntry` zurückgegeben.
  - `fn validate_folder` aus `commands/changes.rs` hierher verschieben (unverändert).
- [x] `src-tauri/src/changes/mod.rs`: `pub mod entry;` zu den Modulen.
- [x] `commands/changes.rs` `changes_file_diff`: `let entry = changes::entry::resolve(&registry, &session_id, &key)?;` dann `changes::file_diff(&entry.workspace, &entry.repository, entry.ticket.as_ref(), &path, scope)`. Nicht mehr benutzte Imports entfernen.

### Typ und Text

- [x] Neuer Ordner `src-tauri/src/review/` mit `mod.rs` (Kopfkommentar: Review-Kommentare aus der Changes-Ansicht; Text für den Agenten) und `model.rs` (`ReviewComment` laut Kontrakt, derives `Debug, Clone, Serialize, Deserialize, TS`, `#[serde(rename_all = "camelCase")]`, Doc-Kommentare aus dem Kontrakt).
- [x] `src-tauri/src/lib.rs`: `pub mod review;` alphabetisch zwischen `repositories` und `sessions`.
- [x] In `review/mod.rs`:
  - `pub fn validate(comments: &[ReviewComment]) -> Result<(), CommandError>` — `kind == DiffLineKind::Hunk` → `Internal("Review-Kommentar auf einem Abschnittskopf")`, `text.trim().is_empty()` → `Internal("Leerer Review-Kommentar")`.
  - `pub fn agent_text(text: &str, comments: &[ReviewComment], folders: &[Option<PathBuf>]) -> String` exakt nach Kontrakt. `folders[i]` gehört zu `comments[i]`. Pfad mit `\`: vom Ordner ausgehend für jedes Stück von `path.split('/')` ein `push`. Hilfsfunktionen `fn location(comment, folder) -> String`, `fn sign(kind) -> &'static str`, `fn fence(code) -> String`.
- [x] `ChatEntry::User` (`agents/event.rs`): hinter `skill` das Feld `comments` laut Kontrakt mit Doc-Kommentar „Review-Kommentare aus der Changes-Ansicht; Einträge von vorher haben das Feld nicht.“
- [x] `src-tauri/examples/gen-bindings.rs`: `review::model::ReviewComment` importieren, `ReviewComment::export_all(&cfg)?;` neben `Attachment`.

### Senden

- [x] `error.rs`: Variante `CommentsWhileWaiting` mit `#[error("Review-Kommentare gehen erst, wenn die Rückfrage beantwortet ist")]` direkt unter `AttachmentsWhileWaiting`.
- [x] `commands/chat.rs` `chat_send`: Parameter `comments: Vec<ReviewComment>` hinter `attachment_ids`; Aufruf `registry.send(&app, &session_id, &text, &attachment_ids, &comments)`.
- [x] `SessionRegistry::send`: Parameter `comments: &[ReviewComment]`. Vor `update` (neben `skill` und `carried`, außerhalb der Session-Sperre): `review::validate(comments)?;` und `let folders: Vec<Option<PathBuf>> = comments.iter().map(|comment| changes::entry::resolve(self, session_id, &comment.repository_key).ok().map(|entry| entry.folder())).collect();` mit Kommentar „Ein nicht mehr auflösbarer Eintrag nennt den Repository-Namen statt zu scheitern.“
  - Im Zweig „Rückfrage offen“: vor der Anhänge-Prüfung `if !comments.is_empty() { return Err(CommandError::CommentsWhileWaiting); }`; `push_user(..., Vec::new())` für die Kommentare.
  - Im normalen Zweig: `let agent_text = review::agent_text(sent_text, comments, &folders);` und `message_line(&agent_text, &sent_attachments)?`; `state.push_user(outbox, sent_text, sent_attachments, skill, comments.to_vec())`.
- [x] `push_user`: Parameter `comments: Vec<ReviewComment>`, in `ChatEntry::User` setzen.
- [x] `resume`: `self.send(app, session_id, RESUME_MESSAGE, &[], &[])`.
- [x] Alle übrigen Stellen, die `ChatEntry::User { … }` bauen oder vollständig zerlegen, per Compiler finden und ergänzen (`comments: Vec::new()` bzw. `..`).
- [x] `tldr/transcript.rs`, Zweig `ChatEntry::User`: `comments` mit auspacken; nach dem bisherigen Text je Kommentar eine Zeile `\n  Review-Kommentar zu <path> Zeile <line>: <text>` anhängen (bei `Deleted`: `Zeile <line> (alt)`).

### Oberfläche (nur Anschluss, keine neue Bedienung)

- [x] `pnpm bindings`.
- [x] `src/lib/chat.ts` `sendMessage`: Parameter `comments: ReviewComment[]`, an `invoke('chat_send', { sessionId, text, attachmentIds, comments })`; JSDoc um `commentsWhileWaiting` und den Satz „Die Review-Kommentare gehen als Block hinter dem Text an den Agenten.“ ergänzen.
- [x] `Composer.tsx` `send`: vorerst `sendMessage(session.id, text, attachmentIds, [])` (Phase 4 setzt die gesammelten ein). `describeError`: Zweig `commentsWhileWaiting` → „Review-Kommentare gehen erst, wenn die Rückfrage beantwortet ist.“
- [x] `ChatTimeline.tsx`/`UserMessage.tsx` bleiben in dieser Phase unverändert (das Feld wird nur durchgereicht, wenn TS es verlangt).

### Doku

- [x] `docs/conventions/commits.md`: Scope `review` hinter `changes`.
- [x] `docs/code-map.md`: Feature-Liste (Absatz „Features:“) um `review`; neue Tabellenzeile „Review-Kommentare (Zeilen im Diff kommentieren, sammeln, mitsenden)“ — Core: `src-tauri/src/review/` (`model.rs` `ReviewComment`, `mod.rs` `validate`, `agent_text`), Auflösung `src-tauri/src/changes/entry.rs`, Anschluss in `SessionRegistry::send`; Oberfläche: „folgt in Phase 3/4“. Zeile „Changes“ um `changes/entry.rs` (Schlüssel → Ordner, auch für Review-Kommentare).
- [x] Commit `feat(review): send review comments with a chat message`.

## Report-Back

- Abweichung: kein `changes/entry.rs` — die Auflösung Schlüssel → Ordner steckt seit „Innere Repositories“ in `changes/sources.rs` (FINDINGS → Phase 2). `changes_file_diff` blieb unangetastet; `SessionRegistry::comment_folders` baut die Einträge der Reichweite Session einmal (`sources::sources`) und gleicht jeden Kommentar-Schlüssel mit `eq_ignore_ascii_case` dagegen ab — wie `sources::find`, nur ohne je Kommentar neu zu bauen. Der Schlüssel wird nie als Pfad benutzt.
- Zusatz: `ContextPopover.tsx` ruft `sendMessage` ebenfalls auf und bekam `[]` für die Kommentare.
- `pnpm check` grün (Lint, Typen, Prettier, Build, rustfmt, Clippy). Keine automatisierten Tests (Projektprofil).
- Wackelstelle: `src-tauri/src/sessions/registry.rs` `comment_folders` — löst ein Kommentar aus einem Ticket-Worktree oder inneren Repository wirklich zum richtigen Ordner auf? Prüfen: Smoke-Punkt 2 am Plan-Ende.
