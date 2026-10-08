# Archiv: durchsuchen und wiederherstellen

Ein Dialog „Archiv“ listet archivierte Vorhaben (ohne Suchbegriff alle, scrollbar), findet sie über Vorhaben-Namen und Chat-Text und stellt sie mit allen Sessions wieder her. Entscheidungen: ADR 029 (anzulegen in Phase 1).

## Overview

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | Core: Suche, Wiederherstellen, Command, ADR 029 | heikel (Sperren-Reihenfolge, Neuaufbau der Session im Speicher) | complete |
| 2 | Oberfläche: Sidebar-Knopf, Dialog, Anbindung an die Listen | standard | pending |

## Entscheidungen (alle gefallen, keine offen)

- **Ort:** Dialog über der App (`Dialog` aus `src/components/Dialog.tsx`), geöffnet über einen Knopf „Archiv“ im Sidebar-Fuß neben „Einstellungen“. Keine eigene Hauptansicht (Glossar „Keine eigene Archiv-Ansicht“ wird zu „Archiv-Dialog“).
- **Ohne Suchbegriff** (leer oder nur Leerzeichen): alle archivierten Vorhaben, `archived_at` absteigend, ohne Textausschnitte. Mit Begriff: nur Treffer.
- **Suche:** Groß/Klein egal (Unicode, `to_lowercase()` in Rust, nicht SQL-`LIKE`: das kennt Groß/Klein nur für ASCII, „Über“ fände „über“ sonst nicht). Treffer in (a) Vorhaben-Name, (b) Chat-Text. Chat-Text = Felder `text` von `User`, `Text`, `Error` sowie `answer` von `Question`; nicht `Thinking`, `Tool`, Pfade, JSON-Schlüssel (sonst träfe „kind“ jeden Eintrag).
- **Treffer-Form:** je Vorhaben Name, Archiv-Datum, Anzahl Sessions, Repository-Namen, bis zu 3 Ausschnitte (je ±60 Zeichen um die Fundstelle, Session-Name davor). **Seitenweise:** der Core liefert höchstens 20 Vorhaben je Aufruf (`PAGE_SIZE = 20`, Konstante im Core, nicht vom Aufrufer wählbar); die Oberfläche zeigt zuerst 20 und hängt per Knopf „Mehr laden“ die nächsten 20 an. Der Core liest dazu `limit + 1` Treffer, um `hasMore` zu bestimmen; die Suche bricht nach diesem Treffer ab und scannt nie das ganze Archiv für eine Seite.
- **Wiederherstellen** hebt `archived_at` für Vorhaben und alle seine Sessions in einer Transaktion auf, lädt sie in die Registry (wie beim App-Start) und gibt Vorhaben + Sessions zurück. Der Verlauf lädt wie immer erst beim Öffnen einer Session. Der Agent startet erst mit der nächsten Nachricht. Gelöschte App-Worktrees (Sessions vor ADR 010) legt der bestehende Prüfpfad `worktrees::…WorktreeCheck::Missing` beim nächsten Start neu an; Haupt-Checkouts und Ticket-Worktrees waren nie weg.
- **Kein Löschen aus dem Archiv, keine Vorschau des Verlaufs** — Backlog.
- **Ausweichoptionen verworfen:** SQLite-FTS5 (Migration + Index doppelt zum Verlauf, bei Archivgrößen im einstelligen MB-Bereich unnötig); Namen-only-Suche (findet nichts, woran man sich nur inhaltlich erinnert).

## Kontrakt (Rust ↔ TypeScript, via `pnpm bindings`)

```rust
// src-tauri/src/archive/model.rs — #[derive(Serialize, TS)] #[serde(rename_all = "camelCase")]
pub struct ArchivedProject {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    pub archived_at: f64,
    pub session_count: u32,
    pub repository_names: Vec<String>,
    pub snippets: Vec<ArchiveSnippet>, // leer ohne Suchbegriff oder bei reinem Namenstreffer
}
pub struct ArchiveSnippet { pub session_name: String, pub text: String }
pub struct ArchivePage { pub items: Vec<ArchivedProject>, pub has_more: bool }
pub struct ProjectRestored { pub project: ProjectSummary, pub sessions: Vec<SessionSummary> }
```

Commands (`src-tauri/src/commands/archive.rs`, registriert in `lib.rs` neben `project_archive`):

- `archive_search(query: String, offset: u32) -> Result<ArchivePage, CommandError>` — `offset` = Anzahl bereits gezeigter Vorhaben derselben Suche (Reihenfolge `archived_at DESC`, `id` als Tiebreak, damit Seiten nicht überlappen); `async`, Arbeit in `tauri::async_runtime::spawn_blocking`.
- `project_restore(project_id: String) -> Result<ProjectRestored, CommandError>` — unbekanntes oder nicht archiviertes Vorhaben → `CommandError::Internal`-Fehler (Variante wie `project_not_found` in `registry.rs`).

TS-Seite: `src/lib/archive.ts` mit `searchArchive(query)` und `restoreProject(projectId)`, Doc-Kommentare mit `@throws` im Stil von `src/lib/projects.ts`.

## Phase 1 — Core

**Kontext lesen:** `src-tauri/src/db/projects.rs` (`archive`, `load_active`), `db/sessions.rs` (`load_active`, `StoredRow`), `db/chat_entries.rs`, `sessions/registry.rs` (`restore` Z. 310–395, `archive_project` Z. 662, `project_summary`, `summarize`, `ProjectState::restored`, `SessionState::restored`, `stored_session_workspace`), `sessions/registry/tldr.rs` (Muster für ein Untermodul), `agents/event.rs` (`ChatEntry`), `docs/conventions/rust.md`, ADR 011.

**AK:**
- Suche ohne Begriff liefert alle archivierten Vorhaben, jüngst archivierte zuerst, `snippets` leer.
- Suche „über“ findet einen Eintrag mit „Über“ im `Text`-Feld; Suche „kind“ findet keinen Eintrag, nur weil das JSON `"kind"` enthält.
- Ein Treffer liefert höchstens 3 Ausschnitte; eine Antwort enthält höchstens 20 Vorhaben, `hasMore` ist genau dann wahr, wenn danach noch ein weiteres Vorhaben passt. Bei 45 archivierten Vorhaben liefern Offsets 0/20/40 je 20/20/5 Einträge ohne Doppelte, `hasMore` = wahr/wahr/falsch.
- `project_restore` setzt `archived_at` beider Tabellen atomar auf `NULL` (kein halb wiederhergestelltes Vorhaben bei Fehler), das Vorhaben erscheint in `project_list`/`session_list`.
- Wiederherstellen eines nicht archivierten oder unbekannten Vorhabens ist ein Fehler, kein No-op.
- `pnpm check` grün.

**Checkliste:**
- [x] `db/migrations`: keine Migration nötig (`archived_at` existiert in `projects` und `sessions`) — in ADR 029 festhalten.
- [x] `db/projects.rs`: `restore(connection: &mut Connection, id) -> Result<(), CommandError>` — Transaktion, beide `UPDATE … SET archived_at = NULL`; Fehler, wenn `UPDATE projects` 0 Zeilen trifft oder die Zeile gar nicht archiviert war (`WHERE id = ?1 AND archived_at IS NOT NULL`). Dazu `load_archived(connection) -> Vec<(ProjectRow, f64 /*archived_at*/)>` nach `archived_at DESC`.
- [x] `db/sessions.rs`: `load_for_project(connection, project_id) -> Vec<SessionRow>` (nach `number`), `archived_session_names(connection, project_id)`; Muster `load_active`.
- [x] `db/chat_entries.rs`: `for_each_payload(connection, session_id, FnMut(&str))` streamt `payload`-Zeilen ohne alles zu laden.
- [x] Neues Modul `src-tauri/src/archive/` (`mod.rs`, `model.rs`, `search.rs`), Muster `src-tauri/src/projects/`: `search::run(connection, query) -> Vec<ArchivedProject>` — Begriff trimmen und `to_lowercase()`; je archiviertem Vorhaben Name prüfen, je Session die Payloads streamen: erst billig `payload.to_lowercase().contains(term)`, nur bei Treffer in `ChatEntry` deserialisieren und die vier Textfelder prüfen; Ausschnitt an Zeichengrenzen (`char_indices`, nie Byte-Schnitt) schneiden, Zeilenumbrüche durch Leerzeichen ersetzen. Nach 3 Ausschnitten pro Vorhaben die übrigen Payloads dieses Vorhabens überspringen. `repository_names` aus `session_repositories::load` der Session mit kleinster Nummer.
- [x] `sessions/registry/restore.rs` (neues Untermodul, `mod restore;` in `registry.rs` bei den anderen): `SessionRegistry::restore_project(&self, app, project_id) -> Result<ProjectRestored, CommandError>`. Reihenfolge: Datenbank-Transaktion (`projects::restore`), dann Zeilen laden (`load_for_project` + `session_repositories::load` + `session_ticket_worktrees::load`), dann Speicher füllen. **Den Aufbau einer `Session` aus `StoredSession` (heute inline in `restore`, Z. 351–384) in eine freie Funktion `build_session(app, database, stored) -> Result<(Arc<Session>, Option<SessionRow>), CommandError>` ziehen und von `restore` und `restore_project` gleichermaßen aufrufen** — nicht kopieren. Sperren nie gleichzeitig halten: erst `lock_projects` einfügen und loslassen, dann `lock_sessions` (Reihenfolge wie `create_in_project`/`archive_project`). Unterbrochene Sessions (`needs_settling`) wie in `restore` pausiert zurückschreiben.
- [x] `commands/archive.rs` + `commands/mod.rs` + `lib.rs` (`generate_handler!`-Liste).
- [x] `pnpm bindings`; neue Typen unter `src/lib/bindings/` mit committen.
- [x] Docs: ADR `docs/decisions/029-archiv-suche.md` (Kontext/Optionen/Entscheidung/Konsequenzen aus „Entscheidungen“ oben); `docs/glossary.md` Eintrag „Archivieren“ (letzter Satz) + neuer Eintrag „Wiederherstellen“; `docs/code-map.md` Zeile Archiv (`src/features/archive/`, `src/lib/archive.ts`, `commands/archive.rs`, `archive/`, `sessions/registry/restore.rs`); `docs/PROJECT.md` Navigations-Satz („Vorhaben archivieren“ → „… und im Archiv suchen/wiederherstellen“); `AGENTS.md` unverändert.

## Phase 2 — Oberfläche

**Kontext lesen:** `src/app/Sidebar.tsx` (Fuß Z. 318–341), `src/app/Sidebar.css`, `src/app/SessionDeleteDialog.tsx` + `.css` (Dialog-Muster), `src/components/Dialog.tsx`, `src/app/App.tsx` (`handleCreated` Z. 148 als Muster für „Rückgabe selbst in die Listen“), `src/features/projects/useProjectSummaries.ts` (`upsertProject`), `src/features/sessions/useSessionSummaries.ts` (`upsertSession`), `src/lib/useActionError.ts`, `docs/conventions/react.md`, `docs/conventions/tailwind.md`.

**Design (kein Mockup vorhanden, vom User bestätigt: Dialog; Struktur hier festgelegt):** Breite 36 rem, Höhe max. 70 vh. Kopf: Überschrift „Archiv“, darunter ein Suchfeld (`type="search"`, Platzhalter „Vorhaben und Chat-Inhalte durchsuchen“, Autofokus). Darunter eine scrollbare Liste (`overflow-y: auto`). Eine Karte je Vorhaben: Name (fett), Zeile „archiviert am TT.MM.JJJJ · N Sessions · Repo-Namen“, bis zu 3 Ausschnitte (Session-Name grau, Fundstelle mit `<mark>`), rechts Knopf „Wiederherstellen“. Leerzustände: ohne Archiv „Noch nichts archiviert.“; mit Begriff ohne Treffer „Nichts gefunden.“. Am Listenende steht bei `hasMore` ein Knopf „Mehr laden“ (`title`: „Zeigt die nächsten 20 archivierten Vorhaben“), während des Ladens deaktiviert; er hängt die Seite an die vorhandenen Karten an (Doppelte per `id` verwerfen). Nie mehr als 20 neue Karten pro Klick im DOM. Neuer Suchbegriff setzt die Liste auf Seite 1 zurück. Wiederhergestelltes Vorhaben wird aus der Liste entfernt; `offset` für „Mehr laden“ ist die **aktuelle** Anzahl der Karten, also **nach** dem Entfernen — das wiederhergestellte Vorhaben fehlt auch in der Liste des Cores, die übrigen rücken um eins nach vorn; mit der Anzahl vor dem Entfernen übersprünge die nächste Seite einen Eintrag. Suchen entprellt (250 ms), neuer Aufruf verwirft veraltete Antwort (Zähler im Ref).

**AK:**
- Sidebar-Fuß zeigt „Archiv“ über oder neben „Einstellungen“; Klick öffnet den Dialog, Esc und Klick daneben schließen ihn (macht `Dialog`).
- Dialog öffnet mit den ersten 20 archivierten Vorhaben, ohne dass ein Begriff getippt wurde; die Liste scrollt. Bei mehr als 20 steht am Ende „Mehr laden“, ein Klick hängt die nächsten 20 an, bei der letzten Seite verschwindet der Knopf.
- Begriff tippen filtert nach 250 ms; Fundstelle ist hervorgehoben (`<mark>`, kein `dangerouslySetInnerHTML` — Text in Segmente teilen).
- Jede Aktion hat eine Erklärung per `title`: Suchfeld („Durchsucht Namen und Chat-Texte aller archivierten Vorhaben“), „Wiederherstellen“ („Holt das Vorhaben mit allen Sessions zurück in die Seitenleiste; der Agent startet erst mit deiner nächsten Nachricht“).
- Nach „Wiederherstellen“ steht das Vorhaben sofort in der Sidebar (ohne Neustart), die Karte verschwindet aus dem Dialog, der Dialog bleibt offen; Fehler erscheinen als `role="alert"`-Satz im Dialog, nicht in der Sidebar.
- Tastatur: Tab erreicht Suchfeld, jede Karte, jeden Knopf.
- `pnpm check` grün.

**Checkliste:**
- [ ] `src/lib/archive.ts` (`searchArchive(query, offset)` → `ArchivePage`, `restoreProject`).
- [ ] `src/features/archive/useArchiveSearch.ts` (Entprellen, Veraltet-Verwerfen, Lade-/Fehlerzustand; Muster: `useProjectSummaries.ts`).
- [ ] `src/features/archive/ArchiveDialog.tsx` + `ArchiveDialog.css` (BEM `archive-dialog__…`, Tokens wie `SessionDeleteDialog.css`), `ArchiveCard.tsx` + `.css`, `highlightSegments.ts` (reine Funktion: Text + Begriff → `{text, isMatch}[]`, Unicode-Groß/Klein egal).
- [ ] `Sidebar.tsx`: neues Prop `onOpenArchive: () => void`, Knopf im Fuß (Symbol: Karton, SVG im Stil der vorhandenen), `Sidebar.css`.
- [ ] `App.tsx`: State `isArchiveOpen`; `handleRestored(restored: ProjectRestored)` → `upsertProject(restored.project)` und `upsertSession` je Session (nicht auswählen, nicht wechseln); Dialog rendern.
- [ ] Docs: `docs/code-map.md` (Oberflächen-Zeile), Glossar-Feinschliff falls Begriffe im Dialog abweichen.

## Smoke (Spec-first, Abnahme macht der User) — Wackelstellen zuerst

1. **Wiederherstellen eines Vorhabens mit mehreren Sessions und mit Haupt-Checkout im Repo:** alle Sessions stehen in der Sidebar, Nachricht an eine Session startet den Agenten mit `--resume` und kennt den alten Kontext. *(Unsicher: Neuaufbau der `Session` aus der Datenbank außerhalb des App-Starts, siehe Konfidenz.)*
2. **Sucheinstellung mit Umlauten:** „über“ findet „Über …“ und umgekehrt; „kind“ findet nichts, was nur das JSON-Feld enthält.
3. **Dialog ohne Begriff** mit mehr als 20 archivierten Vorhaben (z. B. 45): zuerst 20 Karten, „Mehr laden“ zweimal bis zum Ende, kein Eintrag doppelt oder fehlend; ein Vorhaben zwischendurch wiederherstellen und weiterladen.
4. **Großes Archiv:** Suche nach einem seltenen Wort bei vielen MB Verlauf bleibt bedienbar (Dialog bleibt reaktionsfähig, Ergebnis nach wenigen Sekunden). Messwert eintragen.
5. Vorhaben archivieren → im Archiv finden → wiederherstellen → erneut archivieren (Rundlauf, keine Doppelzeile in der Sidebar).
6. Restore, während ein anderes Vorhaben gerade arbeitet: dessen Agent läuft ungestört weiter.

## Konfidenz

- 🟡 **Neuaufbau der `Session` außerhalb von `restore`:** `build_session` aus der Schleife herauszulösen berührt den App-Start. Check: nach dem Umbau muss der Start unverändert laufen (Smoke-Lauf mit vorhandener Datenbank-Kopie, Vorhaben und Sessions zählen) — vor dem Restore-Code erledigen.
- 🟡 **Suchzeit bei großem Verlauf:** Streaming plus `to_lowercase()` je Payload ist linear über alle archivierten Chats. Check: Smoke 4 mit Messwert; erst bei spürbarer Wartezeit FTS5 als Folgeplan.
- 🟡 Vault-Fehlerklassen für Rust und React beim Planen nicht gelesen. Vor Phase 1 den Abschnitt „Fehlerklassen“ in `knowledge/sprachen/rust.md` und vor Phase 2 in `knowledge/sprachen/react.md` (falls vorhanden) lesen und die Prüfpunkte in die jeweilige Phase eintragen.

## Summary / Files touched / Commits / Deviations from plan / Follow-ups

**Deviations (Phase 1):**
- `search::run(database, query, offset)` bekommt die `Database` statt einer Verbindung und sperrt sie je Vorhaben bzw. Session — eine Sperre über die ganze Suche hielte laufende Sessions beim Speichern auf.
- `for_each_payload` nimmt eine Funktion mit `ControlFlow`-Rückgabe, damit die Suche nach dem dritten Ausschnitt abbricht. `archived_session_names` entfällt; `load_for_project` deckt Suche und Wiederherstellen ab. `load_archived` liefert `ArchivedRow` statt `(ProjectRow, f64)`; dazu `load_one`.
- `restore_project` baut die Sessions **vor** der Datenbank-Transaktion: scheitert der Aufbau, bleibt das Vorhaben archiviert statt nach dem nächsten Start aufzutauchen.
- Phase-2-Design korrigiert: `offset` nach einem Wiederherstellen = Kartenzahl **nach** dem Entfernen (der Plan sagte „vor“; das übersprünge einen Eintrag).
- Vault-Fehlerklassen Rust: keine Entity `sprachen/rust.md` vorhanden.

(Rest beim Archivieren füllen)
