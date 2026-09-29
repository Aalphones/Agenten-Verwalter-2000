# Phase 1 — Core: Anhänge

**Status:** complete · **Rating:** standard (Entscheidungen stehen; Sorgfalt bei Dateipfaden, Verschieben zwischen Ordnern und dem Nachrichtenformat)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ → „Anhänge“ und „Kontrakt“ (Typen, Commands Phase 1)
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitt „Anhänge“ (Blockformat für Bild und PDF)
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Chat-Einträge als JSON in `chat_entries`), [ADR 005](../../decisions/005-repositories-und-worktrees.md) (Workspace-Ordner)
- [docs/conventions/rust.md](../../conventions/rust.md), [typescript.md](../../conventions/typescript.md)
- Bestand:
  - `src-tauri/src/agents/event.rs` (`ChatEntry::User`), `src-tauri/src/agents/claude/protocol.rs` (`user_message`)
  - `src-tauri/src/sessions/registry.rs`: `create`, `send`, `SessionState::push_user`, `update`/`Outbox`
  - `src-tauri/src/filesystem/workspace.rs` (`data_dir`), `src-tauri/src/lib.rs` (`setup`, `invoke_handler`)
  - `src-tauri/src/commands/chat.rs`, `src-tauri/src/commands/sessions.rs` (`session_create`), `src-tauri/src/error.rs`
  - `src/lib/chat.ts` (`sendMessage`), `src/lib/sessions.ts` (`createSession`), `src/lib/errors.ts` (`commandErrorText`), Aufrufer: `src/features/chat/Composer.tsx`, `src/features/sessions/NewSession.tsx`
  - `src-tauri/tauri.conf.json` (CSP), `src-tauri/Cargo.toml`
- Fehlerklassen: Vault `sprachen/typescript.md` gelesen — nicht einschlägig (betrifft `fetch`). Projekteigen:
  - **Pfad aus Oberflächen-Eingabe:** `attachment_discard` und `chat_send` bekommen Anhang-IDs von der Oberfläche. Eine ID wird als UUID geparst (`uuid::Uuid::parse_str`), bevor sie in einen Pfad eingeht; sonst wäre `..\..\` ein gültiger Ordnername. Prüfen per AK 4.
  - **`fs::rename` über Laufwerksgrenzen scheitert unter Windows:** Liegen Zwischenordner und Workspace auf verschiedenen Laufwerken (künftiger Einstellungs-Wert „Ordner für Worktrees“), schlägt `rename` fehl. Fallback: kopieren, dann Quelle löschen.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt `Attachment.ts`, `AttachmentKind.ts`, und `ChatEntry.ts` enthält `attachments` an `user`.
2. `attachment_add_files` mit einer PNG- und einer `.md`-Datei liefert zwei `Attachment` (`image` bzw. `file`, richtige Größe), und beide Dateien liegen unter `%USERPROFILE%\.verwalter\attachments\<id>\`. Ein Ordner als Pfad liefert einen `io`-Fehler „Ordner lassen sich nicht anhängen: <name>“.
3. Nach `chat_send` mit beiden IDs liegen die Dateien unter `<Workspace>\.anhaenge\<id>\<name>`, der Zwischenordner der IDs ist weg, und der gespeicherte `user`-Eintrag trägt beide Anhänge mit dem neuen Pfad. Der Agent beschreibt das Bild und nennt/liest die `.md`-Datei (Probe in der laufenden App mit `pnpm tauri dev`, noch ohne Oberfläche: über die Entwicklerkonsole `window.__TAURI_INTERNALS__.invoke('attachment_add_files', { paths: [...] })` usw.).
4. `attachment_discard` mit `..\x` oder einer Nicht-UUID liefert einen `io`-Fehler und löscht nichts.
5. `chat_send` mit Anhängen, während eine Rückfrage offen ist → Fehler `attachmentsWhileWaiting`, nichts wird verschoben.
6. Beim App-Start ist `%USERPROFILE%\.verwalter\attachments\` leer (vorhandene Unterordner gelöscht).
7. Alte Chat-Einträge ohne `attachments` laden weiter (Session aus M5 öffnen → Verlauf erscheint).

## Checkliste

### Abhängigkeiten und Konfiguration

- [x] `src-tauri/Cargo.toml`: `tauri = { version = "2", features = ["protocol-asset"] }`; neue Abhängigkeit `base64 = "0.22"`. Danach `cargo build` bzw. `pnpm check`.
- [x] `src-tauri/tauri.conf.json`: unter `app.security` `"assetProtocol": { "enable": true, "scope": ["$HOME/.verwalter/**"] }`; in der CSP `img-src 'self' asset: http://asset.localhost data:`.

### Typen

- [x] `src-tauri/src/agents/event.rs`: `AttachmentKind`, `Attachment` nach Kontrakt. `ChatEntry::User` bekommt `#[serde(default)] attachments: Vec<Attachment>`. Wenn `pnpm bindings` das Feld als optional (`attachments?:`) erzeugt, bleibt es so; die Oberfläche liest in Phase 4 `entry.attachments ?? []`.
- [x] `src-tauri/src/error.rs`: Variante `AttachmentsWhileWaiting` mit `#[error("Anhänge gehen erst, wenn die Rückfrage beantwortet ist")]`.
- [x] `src/lib/errors.ts`: `commandErrorText` bekommt den Fall `attachmentsWhileWaiting` → „Anhänge gehen erst, wenn die Rückfrage beantwortet ist.“
- [x] Beide Typen in `gen-bindings.rs` eintragen, `pnpm bindings`.

### Modul `src-tauri/src/attachments/` (neu, `mod.rs`; in `lib.rs` als `mod attachments;`)

- [x] Konstanten: `STAGING_FOLDER = "attachments"`, `WORKSPACE_FOLDER = ".anhaenge"`, `MAX_IMAGE_BLOCK_BYTES: u64 = 3_932_160`, `MAX_PDF_BLOCK_BYTES: u64 = 10_485_760`, `IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"]`.
- [x] `pub fn staging_dir(app: &AppHandle) -> Result<PathBuf, CommandError>` = `data_dir(app)?.join(STAGING_FOLDER)`.
- [x] `pub fn clear_staging(app: &AppHandle)`: löscht jeden Unterordner von `staging_dir` (`fs::remove_dir_all` je Eintrag, Fehler ignorieren). Aufruf in `lib.rs` im `setup`, vor dem Wiederherstellen der Sessions.
- [x] `fn sanitize_name(raw: &str) -> String`: ersetzt `< > : " / \ | ? *` und Steuerzeichen durch `_`, schneidet Leerzeichen und Punkte am Ende ab; leeres Ergebnis → `anhang`.
- [x] `fn kind_of(name: &str) -> AttachmentKind`: Endung (klein) in `IMAGE_EXTENSIONS` → `Image`, sonst `File`.
- [x] `fn parse_id(id: &str) -> Result<String, CommandError>`: `uuid::Uuid::parse_str`, Fehler → `CommandError::Io(format!("Ungültige Anhang-ID: {id}"))`.
- [x] `pub fn add_file(app, source: &Path) -> Result<Attachment, CommandError>`: Ordner → `Io("Ordner lassen sich nicht anhängen: <name>")`; neue UUID, `staging_dir/<id>/` anlegen, Datei unter bereinigtem Namen hineinkopieren, `Attachment` mit Größe (`metadata().len()`) und absolutem Pfad zurück. Scheitert das Kopieren, wird der angelegte `<id>`-Ordner wieder gelöscht.
- [x] `pub fn add_bytes(app, name: &str, data_base64: &str) -> Result<Attachment, CommandError>`: Base64 dekodieren (`base64::engine::general_purpose::STANDARD`), Fehler → `Io("Anhang nicht lesbar")`; sonst wie `add_file`, aber schreiben statt kopieren. Leerer Name → `bild.png`.
- [x] `pub fn discard(app, id: &str) -> Result<(), CommandError>`: `parse_id`, dann `remove_dir_all(staging_dir/<id>)`; fehlt der Ordner, ist das kein Fehler.
- [x] `pub fn take_for_workspace(app, ids: &[String], workspace: &Path) -> Result<Vec<Attachment>, CommandError>`: für jede ID `parse_id`, die einzige Datei in `staging_dir/<id>/` finden (fehlt sie → `Io("Anhang nicht mehr vorhanden")`), Ziel `workspace/.anhaenge/<id>/<name>` anlegen, `fs::rename`; scheitert das, `fs::copy` + `remove_dir_all` der Quelle. `Attachment` mit neuem Pfad zurück, Reihenfolge wie `ids`.
- [x] `pub fn message_content(text: &str, attachments: &[Attachment]) -> Result<serde_json::Value, CommandError>`: Array aus
  1. einem Textblock `{"type":"text","text": …}`: `text`, und falls es Pfad-Anhänge gibt, zwei Zeilenumbrüche, `Angehängte Dateien (im Workspace):` und je Pfad-Anhang `\n- <path>`. Ist der zusammengesetzte Text leer, entfällt der Block.
  2. je Bild mit Größe ≤ `MAX_IMAGE_BLOCK_BYTES`: `{"type":"image","source":{"type":"base64","media_type": <image/png | image/jpeg (jpg, jpeg) | image/gif | image/webp>,"data": <Base64 der Datei>}}`.
  3. je Datei mit Endung `pdf` und Größe ≤ `MAX_PDF_BLOCK_BYTES`: `{"type":"document","source":{"type":"base64","media_type":"application/pdf","data": …}}`.
  - Alle übrigen Anhänge sind Pfad-Anhänge (Punkt 1). Blockreihenfolge: Text, dann Anhänge in ihrer Reihenfolge.

### Protokoll, Registry, Commands

- [x] `src-tauri/src/agents/claude/protocol.rs`: `pub fn user_message_content(content: Value) -> String` → `{"type":"user","message":{"role":"user","content": content}}`.
- [x] `registry.rs`: `SessionState::push_user(outbox, text, attachments: Vec<Attachment>)` — schreibt `attachments` in den Eintrag (Phase 2 ergänzt `skill`). Alle bisherigen Aufrufer übergeben `Vec::new()`, außer `send` und `create`.
- [x] `registry.rs` `send(&self, app, session_id, text, attachment_ids: &[String])`: In der `update`-Closure gilt: Sind `attachment_ids` nicht leer **und** `state.pending` nicht leer → `Err(CommandError::AttachmentsWhileWaiting)`, **bevor** etwas verschoben wird. Sonst `take_for_workspace(app, ids, &session.workspace)`, dann wie bisher. Die geschriebene Zeile ist `user_message(text)` ohne Anhänge, sonst `user_message_content(message_content(text, &attachments)?)`. `take_for_workspace` läuft unter der Session-Sperre; das ist hier zulässig, weil es nur lokale Dateien verschiebt und nicht in die Pipe schreibt.
- [x] `registry.rs` `create(…, task, attachment_ids: &[String], repository_ids, …)`: nach `new_session_workspace` und erfolgreichem `worktrees::create_all` `take_for_workspace(app, attachment_ids, &workspace)`; scheitert es, räumt der bestehende Weg Workspace und Worktrees ab (wie bei einem Fehler von `create_all`: `worktrees::rollback` + `remove_dir_all`). In der `update`-Closure `push_user(outbox, task, attachments.clone())` und die erste Zeile wie in `send` bauen.
- [x] `src-tauri/src/commands/attachments.rs` (neu, in `commands/mod.rs`): `attachment_add_files(app, paths: Vec<String>) -> Result<Vec<Attachment>, CommandError>` (bricht beim ersten Fehler ab, verwirft die schon angelegten dieses Aufrufs per `discard`), `attachment_add_bytes(app, name, data_base64)`, `attachment_discard(app, id)`. Alle `async`.
- [x] `commands/chat.rs` `chat_send` + `attachment_ids: Vec<String>`; `commands/sessions.rs` `session_create` + `attachment_ids: Vec<String>` direkt nach `task`.
- [x] `lib.rs`: drei neue Commands im `invoke_handler`.

### Oberfläche (nur Schnittstelle, keine sichtbare Änderung)

- [x] `src/lib/attachments.ts` (neu): `addAttachmentFiles(paths: string[]): Promise<Attachment[]>`, `addAttachmentBytes(name: string, dataBase64: string): Promise<Attachment>`, `discardAttachment(id: string): Promise<void>` mit JSDoc `@throws` wie in `src/lib/chat.ts`.
- [x] `src/lib/chat.ts` `sendMessage(sessionId, text, attachmentIds: string[])`; `src/lib/sessions.ts` `createSession(task, attachmentIds, repositoryIds, model, effort, mode)`. Bisherige Aufrufer in `Composer.tsx` und `NewSession.tsx` übergeben vorerst `[]`.

### Doku

- [x] `docs/decisions/007-anhaenge-skills-hintergrund.md` aus README „Festgelegte Entscheidungen“ (alle drei Unterabschnitte, gleiche Gliederung wie ADR 006): Kontext / betrachtete Optionen (Anhänge: alles als Pfad · alles als Block · gemischt; Skills: `init.skills` · Dateisystem; Scratchpad: eigener Ordner im Workspace mit Systemprompt-Zusatz · Claudes `scratchpad_path`) / Entscheidung / Konsequenzen.
- [x] `docs/code-map.md`: neue Zeile „Anhänge“ (`src/lib/attachments.ts` · `src-tauri/src/attachments/`, `src-tauri/src/commands/attachments.rs`); Namensschema-Liste der Features um `attachments` ergänzen.
- [x] `docs/conventions/commits.md`: Scopes um `attachments`, `skills`, `background` ergänzen.
- [x] `docs/glossary.md`: „Anhang“ ergänzen um: „Liegt nach dem Senden unter `<Workspace>\.anhaenge\`; Bilder bis 3,75 MiB und PDFs bis 10 MiB gehen als Inhalt an den Agenten, alles andere als Pfad.“

## Report-Back

- **Geprüft:** AK 1 (`pnpm check` grün, `Attachment.ts`/`AttachmentKind.ts` erzeugt, `attachments` an `user`). AK 4 und AK 7 am Code: `parse_id` lässt nur UUIDs durch, bevor ein Pfad entsteht; `#[serde(default)]` an `attachments`.
- **Nicht in der laufenden App geprobt:** AK 2, 3, 5, 6 (Entwicklerkonsole). Sie wandern in die Smoke-Abnahme am Plan-Ende; die Oberfläche aus Phase 4 macht sie dort ohne Konsole prüfbar.
- **Abweichungen:**
  - `SessionRegistry::create` nimmt die Angaben als `NewSession`-Struct (Clippy: höchstens 7 Parameter). Der Command `session_create` behält seine flache Parameterliste (Kontrakt) mit zeilengenauem `#[allow(clippy::too_many_arguments)]` nach [linting.md](../../conventions/linting.md).
  - Das Hinzufügen mehrerer Dateien samt Rückbau liegt als `attachments::add_files` im Modul statt im Command (Commands bleiben dünn).
  - `take_for_workspace` findet erst alle Anhänge und verschiebt dann: ein fehlender lässt keinen halben Satz im Workspace zurück.
  - Ohne Text, nur mit Pfad-Anhängen, beginnt der Textblock direkt mit `Angehängte Dateien (im Workspace):`, ohne zwei führende Leerzeilen.
  - `Attachment.sizeBytes` ist per `#[ts(type = "number")]` eine Zahl; ts-rs hätte `bigint` erzeugt, serde schickt aber eine JSON-Zahl.
