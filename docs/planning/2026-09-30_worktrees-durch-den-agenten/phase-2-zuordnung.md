# Phase 2 — Zuordnung: welche Ticket-Worktrees der Agent einer Session benutzt hat

Rating: **heikel** (Auswertung von Agent-Eingaben unter der Session-Sperre, Persistenz).

Nach dieser Phase merkt sich jede Session die Ticket-Worktrees, die ihr Agent oder ein Subagent benutzt hat, auch über einen Neustart der App hinweg. Angezeigt werden sie erst in Phase 3.

## Kontext — vorher lesen

- [README.md](README.md) dieses Plans, Abschnitt „Kontrakt"
- [phase-1-core-haupt-checkout.md](phase-1-core-haupt-checkout.md), Report-Back: `RepositoryCheckout`, `TICKET_WORKTREE_INFIX`, Tabelle `session_ticket_worktrees`
- [docs/conventions/rust.md](../../conventions/rust.md)
- `src-tauri/src/agents/event.rs`: `AgentEvent::ToolStarted`, `AgentEvent::SubagentStep`
- `src-tauri/src/agents/claude/translate.rs`: `translate_tool_use`, `subagent_events`, `target_of`, `TARGET_FIELDS`
- `src-tauri/src/sessions/registry.rs`: `SessionState` (Felder, `new`, `restored`), `apply_event`, `Outbox`, `persist`, `restore`, `create`
- `src-tauri/src/db/session_repositories.rs` als Muster für das neue DB-Modul
- Fehlerklassen geprüft (Vault: claude-code, sqlite). Keine einschlägig.

## Grundsatz

Die Zuordnung liest nur Text aus den Werkzeug-Aufrufen des Agenten. Sie startet kein `git` und berührt kein Dateisystem, denn sie läuft unter der Session-Sperre. Ob ein genannter Ordner wirklich ein Worktree ist, prüft erst die Changes-Ansicht (Phase 3) über Git. Damit bleibt Critical Rule 2 gewahrt: Den angezeigten Zustand liefert Git, der Agent liefert nur den Hinweis, wo die App nachsehen soll.

## Abnahmekriterien

- Nennt ein Werkzeug-Aufruf des Hauptagenten oder eines Subagenten in `file_path`, `notebook_path`, `path` oder `command` einen Ordner `<Ordner eines Main-Repositorys>-wt-<Name>`, steht `(Position, Ordnername)` danach in `session_ticket_worktrees`. Das gilt als absoluter Pfad, als `../<Ordner>` oder als nackter Ordnername. Jeder Ordner steht je Session höchstens einmal drin.
- Groß/Klein spielt beim Erkennen keine Rolle. Gespeichert wird die Schreibweise aus dem Aufruf.
- Nach einem Neustart der App kennt die Session ihre Ticket-Worktrees wieder.
- `SessionRegistry::ticket_worktrees_of(session_id)` liefert die Liste als `Vec<(u32, String)>`.
- Sessions mit `AppWorktree`-Repositories ordnen nichts zu.
- `pnpm check` ist grün.

## Checkliste

**Ereignisse (`agents/event.rs`, `agents/claude/translate.rs`)**

- [ ] `AgentEvent::ToolStarted` und `AgentEvent::SubagentStep` bekommen je ein Feld `used_paths: Vec<String>` mit Doc-Kommentar „Ungekürzte Werte von `file_path`, `notebook_path`, `path` und `command` aus der Eingabe des Werkzeugs; daraus ordnet die Session Ticket-Worktrees zu."
- [ ] `translate.rs`: private `fn used_paths(input: &Value) -> Vec<String>` sammelt die vier Felder, soweit sie Strings sind, in dieser Reihenfolge. `translate_tool_use` und `subagent_events` setzen das Feld. Alle anderen Stellen, die diese Varianten bauen oder zerlegen, ziehen nach (Compiler).

**Erkennen (`worktrees/mod.rs`)**

- [ ] `pub struct TicketRoot { pub position: u32, pub prefix: String }` mit Doc-Kommentar „Woran ein Ticket-Worktree eines Session-Repositorys im Text zu erkennen ist." `prefix` ist `<Ordnername des Repositorys>` + `TICKET_WORKTREE_INFIX` in ASCII-Kleinbuchstaben.
- [ ] `pub fn ticket_roots(repositories: &[SessionRepository]) -> Vec<TicketRoot>`: je `Main`-Repository mit Ordnernamen (`repository_path.file_name()`) ein Eintrag, `position` = Index.
- [ ] `pub fn mentioned_ticket_worktrees(roots: &[TicketRoot], text: &str) -> Vec<(u32, String)>`:
  1. `lower = text.to_ascii_lowercase()`. Nur ASCII-Kleinschreibung verwenden, damit die Byte-Positionen in `text` gültig bleiben.
  2. Je Root jedes Vorkommen von `prefix` in `lower` per `match_indices` suchen.
  3. Treffer nur zählen, wenn er am Textanfang steht oder das Zeichen davor eines von `\ / " ' = :` oder ein Leerzeichen ist.
  4. Danach folgen Zeichen, solange sie ASCII-alphanumerisch oder `-`, `_`, `.` sind. Endende `.` abschneiden (Satzende). Bleibt nach dem Präfix nichts übrig, zählt der Treffer nicht.
  5. Ergebnis ist `(root.position, text[start..end].to_owned())`, also die Originalschreibweise ab Präfix-Anfang, ohne Doppelte (Vergleich ohne Groß/Klein).

  Doc-Kommentar: liest nur Text, kein Dateisystem, kein Git.

**Datenbank (`db/session_ticket_worktrees.rs`, neu)**

- [ ] Modul-Kommentar: „Tabelle `session_ticket_worktrees`: Ticket-Worktrees, die der Agent einer Session benutzt hat."
- [ ] `pub fn insert_all(connection: &mut Connection, session_id: &str, worktrees: &[(u32, String)]) -> Result<(), CommandError>`: eine Transaktion, `INSERT OR IGNORE INTO session_ticket_worktrees (session_id, position, folder) VALUES (?1, ?2, ?3)`.
- [ ] `pub fn load(connection: &Connection, session_id: &str) -> Result<Vec<(u32, String)>, CommandError>`, `ORDER BY position, folder`.
- [ ] In `db/mod.rs` registrieren wie `session_repositories`.

**Session (`sessions/registry.rs`)**

- [ ] `SessionState`: Felder `ticket_roots: Vec<TicketRoot>` (Kommentar „fest ab Anlegen") und `ticket_worktrees: Vec<(u32, String)>`. `new` und `restored` setzen beide leer. `create` setzt `ticket_roots` aus `worktrees::ticket_roots(&repositories)` in den neuen Zustand, bevor die Session in die Registry kommt. `restore` setzt `ticket_roots` genauso und lädt `ticket_worktrees` über `session_ticket_worktrees::load` in derselben `database.with`-Schleife wie `session_repositories::load`. Das geladene Tupel wird dafür erweitert.
- [ ] `Outbox`: Feld `ticket_worktrees: Vec<(u32, String)>` (neu zugeordnete). `persist` schreibt sie nach den Einträgen mit `session_ticket_worktrees::insert_all`, wenn nicht leer.
- [ ] `SessionState::note_ticket_worktrees(&mut self, outbox: &mut Outbox, used_paths: &[String])`: bei leerem `ticket_roots` sofort zurück. Sonst für jeden Text `mentioned_ticket_worktrees`, und jedes Paar, das (ohne Groß/Klein beim Ordner) noch nicht in `self.ticket_worktrees` steht, in `self.ticket_worktrees` und `outbox.ticket_worktrees` anhängen.
- [ ] `apply_event`: in den Zweigen `ToolStarted` und `SubagentStep` `self.note_ticket_worktrees(outbox, &used_paths)` aufrufen, zusätzlich zum bestehenden Verhalten.
- [ ] `pub fn ticket_worktrees_of(&self, session_id: &str) -> Result<Vec<(u32, String)>, CommandError>`: Session holen, unter `session.lock()` die Liste klonen. Doc-Kommentar: „Ticket-Worktrees, die der Agent der Session benutzt hat — ob es sie noch gibt, prüft der Aufrufer über Git."

**Doku**

- [ ] `docs/code-map.md`, Zeile „Persistenz (SQLite)": `session_ticket_worktrees.rs` ergänzen, außerdem „Migration 4 = Checkout-Art je Session-Repository und benutzte Ticket-Worktrees".

**Prüfen**

- [ ] `pnpm check` grün.

## Report-Back
