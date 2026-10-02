# Plan: Sidebar nach letzter Aktivität, Ungelesen-Hinweis

Die Seitenleiste zeigt die Vorhaben heute in drei Gruppen („Braucht dich“, „Läuft“, „Abgeschlossen“), innerhalb jeder Gruppe das zuletzt **angelegte** Vorhaben oben, die Sessions darin aufsteigend nach Nummer. Ziel: **eine** Liste, das Vorhaben mit der jüngsten Aktivität oben, die Sessions darin ebenso; dazu ein Hinweis, welche Sessions Neues enthalten, das der User noch nicht gesehen hat.

## Overview

| Phase | Inhalt | Komplexität | Status |
|---|---|---|---|
| 1 | Core: Migration 8, letzte Aktivität und Gesehen-Zeitpunkt je Session, Command `session_set_viewed`, ADR 019 | standard | complete |
| 2 | Oberfläche: Gruppen entfernen, Sortierung nach Aktivität, Ungelesen-Punkt, gesehene Session melden | standard | complete |

## Entscheidungen (mit dem User geklärt, 2026-10-02)

- **Gruppen entfallen.** Die drei Überschriften verschwinden ersatzlos; den Status zeigt weiter das Symbol an jeder Zeile.
- **Was als Aktivität zählt:** (a) der User schickt eine Nachricht, (b) der Agent gibt ab, also die Session wechselt auf `Waiting` (Rückfrage), `Completed` (fertig) oder `Error`. Werkzeug-Aufrufe und Zwischentexte während eines Laufs zählen **nicht**, damit gleichzeitig laufende Vorhaben nicht im Sekundentakt die Plätze tauschen. Verworfen: jeder neue Chat-Eintrag.
- **Ungelesen** heißt: die letzte Aktivität ist jünger als der Zeitpunkt, an dem der User die Session zuletzt gesehen hat. **Gesehen** ist eine Session, solange sie in der Oberfläche die sichtbare Session ist (Chat- oder Changes-Reiter). Die Übersicht eines Vorhabens, die Einstellungen und „Neues Vorhaben“ zeigen keine Session. Eigene Nachrichten machen nie ungelesen (wer sendet, hat gesehen).
- **Aussehen:** kleiner Punkt in Akzentfarbe am rechten Zeilenrand plus fetter Name — an der Session-Zeile und an der Vorhaben-Zeile, sobald eine seiner Sessions ungelesen ist. Kein Entwurf vorhanden, freihändig nach den vorhandenen Tokens (vom User so gewählt).
- **Speicherort:** beide Zeitpunkte in SQLite (Spalten der Tabelle `sessions`), „wird gerade gezeigt“ nur im Speicher des Core. Begründung: Critical Rule 3 (Persistentes in SQLite) und 4 (überlebt Neustart).
- **Altbestand:** Die Migration setzt die letzte Aktivität auf den Zeitpunkt der letzten Nutzernachricht (sonst `created_at`) und markiert alle bestehenden Sessions als gesehen — nach dem Update leuchtet nichts auf.
- **Die Übersichtskarten eines Vorhabens** (`ProjectOverview`) bleiben nach Nummer sortiert; nur die Seitenleiste ändert sich.

## Kontrakt Core → Oberfläche

`SessionSummary` (`src-tauri/src/sessions/model.rs`) bekommt zwei Felder, TS-Namen nach `pnpm bindings`:

| Rust | TS | Bedeutung |
|---|---|---|
| `last_activity_at: f64` | `lastActivityAt: number` | Millisekunden seit Epoche; letzter Zeitpunkt, an dem der User gesendet oder der Agent abgegeben hat; beim Anlegen = `created_at` |
| `unread: bool` | `unread: boolean` | `last_activity_at > seen_at` |

Neues Command `session_set_viewed(session_id: Option<String>) -> Result<(), CommandError>`; TS-Wrapper `setViewedSession(sessionId: string | null): Promise<void>` in `src/lib/sessions.ts`. Setzt die gezeigte Session (oder keine). Fehler: `sessionNotFound`, wenn `session_id` unbekannt ist.

`session_list` liefert die Sessions künftig **zuletzt aktive zuerst** (statt neueste zuerst).

## Finale Abnahmekriterien

1. Die Seitenleiste zeigt keine Gruppen-Überschriften mehr; alle Vorhaben stehen in einer Liste.
2. Oben steht das Vorhaben, in dem zuletzt gesendet wurde oder ein Agent abgegeben hat; ein frisch angelegtes Vorhaben steht oben, weil seine erste Nachricht gerade gesendet wurde.
3. Innerhalb eines aufgeklappten Vorhabens steht die zuletzt aktive Session oben.
4. Während ein Agent arbeitet (Werkzeug-Aufrufe), ändert sich die Reihenfolge nicht; sie ändert sich erst beim Senden, bei einer Rückfrage, beim Fertigwerden oder bei einem Fehler.
5. Gibt ein Agent in einer Session ab, die gerade **nicht** gezeigt wird, bekommen Session-Zeile und Vorhaben-Zeile einen Punkt in Akzentfarbe und einen fetten Namen; der Punkt hat einen Tooltip.
6. Öffnet der User diese Session, verschwinden Punkt und Fettschrift an beiden Zeilen (die Vorhaben-Zeile nur, wenn keine andere Session darin ungelesen ist).
7. Gibt der Agent in der gerade gezeigten Session ab, wird sie nicht ungelesen.
8. Ungelesen und Reihenfolge überleben einen Neustart der App.
9. Nach dem Update auf diese Version ist keine bestehende Session ungelesen.
10. `pnpm check` ist grün.

## Smoke-Checkliste (prüft der User am Plan-Ende)

Wackelstellen zuerst:

1. **Neustart-Fall:** Agent in Session A laufen lassen, zu Session B wechseln, A fertig werden lassen → A ist ungelesen. App schließen und neu starten → A ist weiter ungelesen und steht oben. *Hintergrund:* Nach dem Start öffnet die App automatisch die zuletzt aktive Session, und die gilt damit sofort als gesehen. Ist A die zuletzt aktive, verschwindet ihr Punkt beim Start; das ist beabsichtigt (sie wird ja gezeigt). Für den Test vor dem Neustart in B noch eine Nachricht senden, damit B die zuletzt aktive ist.
2. **Abstand oben:** Ohne die erste Gruppen-Überschrift beginnt die Liste direkt mit dem ersten Vorhaben. Prüfen, ob der Abstand zum Knopf „Neues Vorhaben“ stimmig aussieht.
3. **Punkt an der Vorhaben-Zeile:** Sitzt er vertikal mittig zur Namenszeile (nicht zur Meta-Zeile darunter) und kollidiert nicht mit langen, abgeschnittenen Namen?
4. Zwei Vorhaben gleichzeitig laufen lassen: Die Reihenfolge bleibt während der Werkzeug-Aufrufe ruhig.
5. Rückfrage in einer nicht gezeigten Session → ungelesen; öffnen → gelesen.
6. In der gezeigten Session senden und fertig werden lassen → nie ein Punkt.
7. Übersicht eines Vorhabens geöffnet, dessen Session wird fertig → die Session wird ungelesen (die Übersicht zählt nicht als „drin“).
8. Changes-Reiter einer Session offen, Agent wird fertig → kein Punkt (Changes zählt als „drin“).

## Konfidenz-Ausweis

- 🟡 **Startfall in AK 8:** Wie in Smoke 1 beschrieben, macht das automatische Öffnen nach dem Start die zuletzt aktive Session gelesen. Das folgt aus `App.tsx` (`currentSession` fällt auf `sessions[0]` zurück) und ist gewollt, sieht beim Testen aber wie ein Fehler aus. Check: Smoke 1.
- 🟡 **Upsert vergisst eine Spalte:** `db::sessions::upsert` muss beide neuen Spalten in `INSERT` **und** `ON CONFLICT … DO UPDATE SET` tragen, sonst wird `seen_at` nie gespeichert und AK 8 fällt still durch. Check: nach Phase 1 App starten, Session öffnen, App schließen, `seen_at` der Zeile mit einem SQLite-Betrachter ansehen oder Smoke 1.
- Erledigt vor dem Vorlegen: Die eingebaute SQLite (`libsqlite3-sys` 0.38.2, `bundled`) hat die JSON-Funktionen, die die Migration braucht (seit SQLite 3.38 fest eingebaut).

Fehlerklassen geprüft (Vault: `frameworks/react`, `sprachen/typescript`, `systeme/sqlite`; für Rust und Tauri gibt es keine Entity): keine einschlägig.

---

## Phase 1 — Core

### Kontext (lesen vor dem Start)

- Dieser Plan: Abschnitte „Entscheidungen“ und „Kontrakt“.
- `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/migrations/005_projects.sql` (Muster `ALTER TABLE … ADD COLUMN`).
- `src-tauri/src/db/sessions.rs` (ganz).
- `src-tauri/src/sessions/model.rs` (`SessionSummary`).
- `src-tauri/src/sessions/registry.rs`: `struct SessionRegistry` und `SessionRegistry::new`, `struct SessionState`, `SessionState::new`, `SessionState::restored`, `set_status`, `push_user`, `list`, `rename` (Muster für einen Zustandswechsel mit `update`), `fn update`, `fn persist`, `fn row_of`, `fn summarize`, `lock_sessions` (Muster für `PoisonError::into_inner`).
- `src-tauri/src/commands/sessions.rs` (Muster `session_rename`), Registrierung der Commands in `src-tauri/src/lib.rs`.
- `docs/conventions/rust.md`, `docs/decisions/011-vorhaben-und-sessions.md` (Form eines ADR).

### Abnahmekriterien der Phase

- `cargo` baut, `pnpm check` ist grün, `src/lib/bindings/SessionSummary.ts` enthält `lastActivityAt: number` und `unread: boolean`.
- Eine bestehende Datenbank migriert ohne Fehler; danach hat jede Session `seen_at = last_activity_at`.
- `set_status` mit `Waiting`, `Completed` oder `Error` setzt `last_activity_at`; andere Status (`Starting`, `Running`, `Paused`, `Cancelled`, `New`) nicht.
- `push_user` setzt `last_activity_at` **und** `seen_at` auf denselben Zeitpunkt.

### Checkliste

- [x] Neue Datei `src-tauri/src/db/migrations/008_session_activity.sql`, genau:
  ```sql
  ALTER TABLE sessions ADD COLUMN last_activity_at REAL NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN seen_at REAL NOT NULL DEFAULT 0;

  UPDATE sessions SET last_activity_at = COALESCE(
    (SELECT MAX(json_extract(payload, '$.sentAt')) FROM chat_entries
      WHERE chat_entries.session_id = sessions.id
        AND json_extract(payload, '$.kind') = 'user'),
    created_at);

  UPDATE sessions SET seen_at = last_activity_at;
  ```
- [x] `src-tauri/src/db/migrations.rs`: `MIGRATIONS` auf `[&str; 8]`, `include_str!("migrations/008_session_activity.sql")` hinten anhängen.
- [x] `src-tauri/src/db/sessions.rs`:
  - `SessionRow` um `pub last_activity_at: f64` (Doc: „Letztes Senden oder Abgeben des Agenten“) und `pub seen_at: f64` (Doc: „Wann der User die Session zuletzt gesehen hat“) erweitern, hinter `tldr_seq`.
  - `StoredRow` ebenso; `StoredRow::read` liest sie als Index 18 und 19; `into_row` reicht sie durch.
  - `upsert`: beide Spalten in die `INSERT`-Spaltenliste und als `?16`, `?17` in `VALUES`, in `params!` hinten anhängen, und beide in `ON CONFLICT(id) DO UPDATE SET` aufnehmen (`last_activity_at = excluded.last_activity_at, seen_at = excluded.seen_at`). Den Doc-Kommentar von `upsert` nicht ändern (die Spalten werden normal überschrieben).
  - `load_active`: `last_activity_at, seen_at` ans Ende der `SELECT`-Liste (nach `tldr_seq`).
- [x] `src-tauri/src/sessions/model.rs`, `SessionSummary` hinter `mcp_problems`:
  ```rust
  /// Letztes Senden des Users oder Abgeben des Agenten (Rückfrage, fertig, Fehler); beim Anlegen `created_at`.
  pub last_activity_at: f64,
  /// Seit dem letzten Blick des Users hat der Agent abgegeben.
  pub unread: bool,
  ```
- [x] `src-tauri/src/sessions/registry.rs`:
  - `SessionState` hinter `created_at` drei Felder: `last_activity_at: f64`, `seen_at: f64` (Doc wie in `SessionRow`) und `is_viewed: bool` (Doc: „Die Oberfläche zeigt die Session gerade (`set_viewed`); nur im Speicher.“).
  - `SessionState::new`: vor dem Struct-Literal `let now = now_ms();`, dann `created_at: now`, `last_activity_at: now`, `seen_at: now`, `is_viewed: false`.
  - `SessionState::restored`: hinter `state.created_at = row.created_at;` die Zeilen `state.last_activity_at = row.last_activity_at;` und `state.seen_at = row.seen_at;`.
  - Neue Methode in `impl SessionState`, direkt vor `set_status`:
    ```rust
    /// Merkt den Zeitpunkt, an dem der User gesendet oder der Agent abgegeben hat. Zeigt die
    /// Oberfläche die Session gerade, gilt das Neue sofort als gesehen.
    fn touch_activity(&mut self, outbox: &mut Outbox) {
        let now = now_ms();
        self.last_activity_at = now;
        if self.is_viewed {
            self.seen_at = now;
        }
        outbox.summary_dirty = true;
    }
    ```
  - `set_status`: als letzte Anweisung
    ```rust
    if matches!(
        status,
        SessionStatus::Waiting | SessionStatus::Completed | SessionStatus::Error
    ) {
        self.touch_activity(outbox);
    }
    ```
  - `push_user`: nach `self.push_entry(…)` die Zeilen `self.touch_activity(outbox);` und `self.seen_at = self.last_activity_at;` mit Kommentar `// Wer sendet, hat die Session gesehen.`
  - `row_of`: `last_activity_at: state.last_activity_at, seen_at: state.seen_at`.
  - `summarize`: `last_activity_at: state.last_activity_at, unread: state.last_activity_at > state.seen_at`.
  - `SessionRegistry`: neues Feld `viewed: Mutex<Option<String>>` mit Doc „Die Session, die die Oberfläche gerade zeigt. Nur `set_viewed` nimmt die Sperre, und zwar vor der Sessions-Map und der Session-Sperre.“; in `SessionRegistry::new` mit `Mutex::new(None)`.
  - Neue öffentliche Methode direkt hinter `rename`:
    ```rust
    /// Setzt die Session, die die Oberfläche zeigt (`None`: keine). Die bisher gezeigte gilt danach
    /// nicht mehr als gesehen; die neue ist sofort gelesen.
    pub fn set_viewed(&self, app: &AppHandle, session_id: Option<&str>) -> Result<(), CommandError> {
        let mut viewed = self.viewed.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(previous_id) = viewed.take()
            && Some(previous_id.as_str()) != session_id
            // Eine inzwischen archivierte Session hat nichts mehr zurückzusetzen.
            && let Ok(previous) = self.get(&previous_id)
        {
            update(app, &previous, |state: &mut SessionState, _outbox: &mut Outbox| {
                state.is_viewed = false;
                Ok(())
            })?;
        }
        let Some(id) = session_id else {
            return Ok(());
        };
        let session = self.get(id)?;
        update(app, &session, |state: &mut SessionState, outbox: &mut Outbox| {
            state.is_viewed = true;
            if state.seen_at < state.last_activity_at {
                state.seen_at = state.last_activity_at;
                outbox.summary_dirty = true;
            }
            Ok(())
        })?;
        *viewed = Some(id.to_owned());
        Ok(())
    }
    ```
    (`self.get` ist die vorhandene private Methode `fn get(&self, session_id: &str) -> Result<Arc<Session>, CommandError>`.)
  - `list`: Doc „Zuletzt aktive zuerst.“, Sortierung `right.last_activity_at.total_cmp(&left.last_activity_at)`.
- [x] `src-tauri/src/commands/sessions.rs`: Command hinter `session_rename`:
  ```rust
  #[tauri::command]
  pub async fn session_set_viewed(
      app: tauri::AppHandle,
      registry: tauri::State<'_, SessionRegistry>,
      session_id: Option<String>,
  ) -> Result<(), CommandError> {
      registry.set_viewed(&app, session_id.as_deref())
  }
  ```
  In `src-tauri/src/lib.rs` neben `session_rename` registrieren.
- [x] `pnpm bindings`.
- [x] Neue Datei `docs/decisions/019-letzte-aktivitaet-und-ungelesen.md` in der Form von ADR 011: Kontext (Sidebar sortierte nach Anlegen und Status), Optionen (jeder Chat-Eintrag zählt / nur Senden und Abgeben; Zeitpunkte in SQLite / nur im Speicher), Entscheidung (Abschnitt „Entscheidungen“ dieses Plans), Konsequenzen (ruhige Liste während Läufen; Altbestand gilt als gelesen; nach dem Start ist die automatisch geöffnete Session gelesen).
- [x] `docs/code-map.md`: Zeile „Persistenz (SQLite)“ um „Migration 8 = letzte Aktivität und Gesehen-Zeitpunkt je Session“ ergänzen; Zeile „Sessions“ (Core) um „`set_viewed` gezeigte Session, `touch_activity` letzte Aktivität“ ergänzen.
- [x] `docs/glossary.md`: Einträge **Letzte Aktivität** („Zeitpunkt, an dem der User zuletzt gesendet oder der Agent zuletzt abgegeben hat — Rückfrage, fertig oder Fehler. Werkzeug-Aufrufe zählen nicht. Bestimmt die Reihenfolge in der Sidebar.“) und **Ungelesen** („Eine Session, deren letzte Aktivität jünger ist als der letzte Blick des Users. Gesehen ist eine Session, solange sie im Chat- oder Changes-Reiter offen ist.“) in der vorhandenen Tabellenform, alphabetisch einsortiert.
- [x] `pnpm check` grün; Commit `feat(sessions): letzte Aktivität und Ungelesen im Core`.

### Report-Back

Phase 1 komplett, `pnpm check` grün. Abweichungen: (1) Die Glossar-Einträge stehen hinter „Waiting“ statt alphabetisch — das Glossar ist thematisch geordnet. (2) `restore` baut `interrupted` mit `..row.clone()`; die neuen Spalten laufen dort mit, keine Änderung nötig. Migration gegen das echte Schema gegengelesen (`payload`, `kind = 'user'`, `sentAt` stimmen); ausgeführt wird sie erst beim ersten App-Start.

---

## Phase 2 — Oberfläche

### Kontext (lesen vor dem Start)

- Dieser Plan: Abschnitte „Entscheidungen“, „Kontrakt“, „Finale Abnahmekriterien“.
- `src/app/Sidebar.tsx`, `src/app/Sidebar.css`, `src/app/buildSidebarRows.ts`, `src/app/SidebarItem.tsx`, `src/app/SidebarItem.css`, `src/app/SidebarProject.tsx`, `src/app/SidebarProject.css`.
- `src/features/projects/projectStatus.ts`, `src/features/sessions/sessionStatus.ts`, `src/features/sessions/useSessionSummaries.ts`, `src/lib/sessions.ts`.
- `src/app/App.tsx` (Variable `visibleSession`; `sessionsOf` bestimmt dort die Session mit der höchsten Nummer für die Übersicht — **nicht ändern**).
- `src/styles/theme.css` (Token `--color-accent`, `--color-fg-primary`).
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`.

### Verstanden, wird entfernt (Chesterton)

`GROUP_ORDER`, `SessionGroup`, `GROUP_LABEL`, `STATUS_GROUP` in `sessionStatus.ts` und `projectGroup` in `projectStatus.ts` existieren nur, um die Vorhaben in der Sidebar auf die drei Überschriften zu verteilen. Einzige Verwender laut Grep: `Sidebar.tsx`, `buildSidebarRows.ts`, `projectStatus.ts`. Die Zeilenart `group` in `buildSidebarRows` und die CSS-Blöcke `&__group-title`, `&__group-title--spaced`, `&__group-count` rendern diese Überschriften. Alles entfällt mit den Gruppen. `mostUrgent`, `URGENCY`, `projectMetaLine`, `metaLine`, `STATUS_LABEL` bleiben (Symbol und Meta-Zeile).

### Abnahmekriterien der Phase

Finale AK 1–7 und 10, sichtbar in `pnpm tauri dev`.

### Checkliste

- [x] `src/lib/sessions.ts`: Doc von `listSessions` auf „Alle Sessions, zuletzt aktive zuerst.“; neuer Wrapper hinter `renameSession`:
  ```ts
  /** Meldet dem Core die sichtbare Session (`null`: keine); ihr Neues gilt dann als gelesen.
   *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
  export async function setViewedSession(sessionId: string | null): Promise<void> {
    await invoke('session_set_viewed', { sessionId });
  }
  ```
- [x] `src/features/sessions/useSessionSummaries.ts`: beide Sortierungen (`second.createdAt - first.createdAt`) durch eine Funktion `latestActivityFirst(first, second)` mit `second.lastActivityAt - first.lastActivityAt` ersetzen, oben in der Datei definiert wie `newestFirst` in `useProjectSummaries.ts`.
- [x] Neue Datei `src/features/sessions/useViewedSession.ts`:
  ```ts
  import { useEffect } from 'react';
  import { setViewedSession } from '@/lib/sessions';

  /** Meldet dem Core, welche Session gerade sichtbar ist; deren Neues gilt dann als gelesen. */
  export function useViewedSession(sessionId: string | null): void {
    useEffect(() => {
      setViewedSession(sessionId).catch((reason: unknown) => {
        console.error('Sichtbare Session nicht gemeldet', reason);
      });
    }, [sessionId]);
  }
  ```
- [x] `src/app/App.tsx`: direkt hinter der Definition von `visibleSession` den Aufruf `useViewedSession(visibleSession === null ? null : visibleSession.id);` und den Import ergänzen.
- [x] `src/features/sessions/sessionStatus.ts`: `GROUP_ORDER`, `SessionGroup`, `GROUP_LABEL`, `STATUS_GROUP` löschen.
- [x] `src/features/projects/projectStatus.ts`:
  - `projectGroup` und die Importe von `STATUS_GROUP`/`SessionGroup` löschen.
  - `sessionsOf` bleibt unverändert.
  - Neu:
    ```ts
    /** Sessions eines Vorhabens, zuletzt aktive zuerst — die Reihenfolge in der Sidebar. */
    export function sessionsByActivity(
      projectId: string,
      sessions: readonly SessionSummary[],
    ): SessionSummary[] {
      return sessions
        .filter((session: SessionSummary) => session.projectId === projectId)
        .sort(
          (first: SessionSummary, second: SessionSummary) =>
            second.lastActivityAt - first.lastActivityAt || second.number - first.number,
        );
    }

    /** Jüngste Aktivität im Vorhaben; ohne Sessions sein Anlegezeitpunkt. */
    export function projectActivity(
      project: ProjectSummary,
      sessions: readonly SessionSummary[],
    ): number {
      return sessions.reduce(
        (latest: number, session: SessionSummary) => Math.max(latest, session.lastActivityAt),
        project.createdAt,
      );
    }

    export function hasUnread(sessions: readonly SessionSummary[]): boolean {
      return sessions.some((session: SessionSummary) => session.unread);
    }
    ```
    (Import `ProjectSummary` aus `@/lib/bindings/ProjectSummary` ergänzen.)
- [x] `src/app/buildSidebarRows.ts`: Zeilenart `group` aus `SidebarRow` entfernen, `SidebarGroup` löschen, `SidebarGroupProject` in `SidebarProjectEntry` umbenennen (Doc an `sessions`: „Sessions des Vorhabens, zuletzt aktive zuerst.“). Signatur `buildSidebarRows(projects: readonly SidebarProjectEntry[]): SidebarRow[]`; Doc „Die flache Zeilenliste der Sidebar: je Vorhaben seine Zeile und die Sessions der aufgeklappten Vorhaben.“ Die Schleife über Gruppen entfällt, die Schleife über Vorhaben bleibt wie sie ist. Import `SessionGroup` entfernen.
- [x] `src/app/Sidebar.tsx`:
  - Importe: `projectGroup`, `sessionsOf`, `GROUP_LABEL`, `GROUP_ORDER`, `SessionGroup` entfernen; `projectActivity`, `sessionsByActivity` aus `projectStatus` und `SidebarProjectEntry` aus `buildSidebarRows` importieren.
  - `rows`-Memo: je Vorhaben `projectSessions = sessionsByActivity(project.id, sessions)`, `isExpanded` wie bisher, dazu `activity = projectActivity(project, projectSessions)`; nach `activity` absteigend sortieren, bei Gleichstand `project.createdAt` absteigend; dann in `SidebarProjectEntry` (ohne `activity`) abbilden und `buildSidebarRows` übergeben.
  - `renderRow`: `case 'group'` entfernen.
  - `ESTIMATED_HEIGHT.group`, `SPACED_GROUP_EXTRA` und der Gruppen-Zweig in `estimateHeight` entfallen.
- [x] `src/app/Sidebar.css`: Blöcke `&__group-title`, `&__group-title--spaced`, `&__group-count` löschen.
- [x] `src/app/SidebarItem.tsx`: Name-Span bekommt bei `session.unread` die Klasse `sidebar-item__name sidebar-item__name--unread`. Hinter dem Namen, nur bei `session.unread`:
  ```tsx
  <span
    className="sidebar-item__unread"
    role="img"
    aria-label="Ungelesen"
    title="Neue Nachricht, seit du zuletzt in dieser Session warst"
  />
  ```
- [x] `src/app/SidebarItem.css` (im Block `.sidebar-item`):
  ```css
  &__name--unread {
    color: var(--color-fg-primary);
    font-weight: 600;
  }

  &__unread {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--color-accent);
  }
  ```
- [x] `src/app/SidebarProject.tsx`: `const isUnread: boolean = hasUnread(sessions);` (Import aus `projectStatus`). Name-Span bekommt zusätzlich `sidebar-project__name--unread`, wenn `isUnread`. Als letztes Kind des Buttons `sidebar-project__button`, nach `sidebar-project__text`, bei `isUnread` derselbe Punkt mit Klasse `sidebar-project__unread`, `aria-label="Ungelesen"` und `title="Neue Nachricht in einer Session dieses Vorhabens, seit du zuletzt drin warst"`. Doc der Prop `sessions`: „Sessions dieses Vorhabens, zuletzt aktive zuerst.“
- [x] `src/app/SidebarProject.css`: im Block `&__name` den Modifier `&--unread { font-weight: 700; }`; neuer Block
  ```css
  &__unread {
    flex-shrink: 0;
    align-self: flex-start;
    width: 6px;
    height: 6px;
    /* mittig zur ersten Zeile (Name), nicht zur Meta-Zeile */
    margin-top: calc((1lh - 6px) / 2);
    margin-left: auto;
    border-radius: 50%;
    background: var(--color-accent);
  }
  ```
  `margin-left: auto` schiebt den Punkt an den rechten Rand, weil `sidebar-project__text` nicht wächst (nur `min-width: 0`) und der Button `flex-grow: 1` hat.
- [x] `docs/code-map.md`: Zeile „Vorhaben“ und Zeile „App-Rahmen“: „gruppiert Vorhaben“ durch „sortiert Vorhaben und Sessions nach letzter Aktivität, Ungelesen-Punkt“ ersetzen; `projectStatus` um „`sessionsByActivity`, `projectActivity`, `hasUnread`“ ergänzen; Zeile „Sessions“ (Oberfläche) um `useViewedSession` (meldet die sichtbare Session) ergänzen; Zeilenarten in `buildSidebarRows.ts` auf „Vorhaben · Session“ korrigieren.
- [x] `pnpm check` grün; Commit `feat(sidebar): Sortierung nach letzter Aktivität und Ungelesen-Punkt`.

### Report-Back

Phase 2 komplett, `pnpm check` grün (inkl. Clippy). Abweichung: Im `rows`-Memo von `Sidebar.tsx` trägt der Zwischentyp `RankedProject` (erweitert `SidebarProjectEntry` um `activity`) direkt in `buildSidebarRows`; die im Plan vorgesehene Abbildung „ohne `activity`“ entfällt, weil TypeScript das zusätzliche Feld an einer Variable zulässt. Zusätzlich nachgezogen: `docs/PROJECT.md` (Navigation nannte noch die drei Gruppen) und der Kommentar an `URGENCY` (bestimmt nur noch das Symbol). Nicht gesehen: das Aussehen in `pnpm tauri dev` — die Smoke-Checkliste prüft der User.

---

## Summary

Die Seitenleiste zeigt eine Liste ohne Gruppen-Überschriften; das Vorhaben mit der jüngsten Aktivität (Senden, Rückfrage, fertig, Fehler) steht oben, die Sessions darin ebenso. Eine Session mit Neuem, das der User noch nicht gesehen hat, bekommt einen Punkt in Akzentfarbe und einen fetten Namen — an der Session-Zeile und an der Vorhaben-Zeile. Beide Zeitpunkte liegen in SQLite (Migration 8) und überleben den Neustart; „gerade gezeigt“ liegt nur im Speicher des Core.

## Files touched

- Core (Phase 1): `db/migrations/008_session_activity.sql`, `db/sessions.rs`, `sessions/model.rs`, `sessions/registry.rs`, `commands/sessions.rs`, `lib.rs`, ADR 019, Glossar, Code-Map.
- Oberfläche (Phase 2): `src/app/` (`App.tsx`, `Sidebar.tsx`/`.css`, `SidebarItem.tsx`/`.css`, `SidebarProject.tsx`/`.css`, `buildSidebarRows.ts`), `src/features/projects/projectStatus.ts`, `src/features/sessions/` (`sessionStatus.ts`, `useSessionSummaries.ts`, neu `useViewedSession.ts`), `src/lib/sessions.ts`, `docs/code-map.md`, `docs/PROJECT.md`.

## Commits

- `ed0a3c4` feat(sessions): letzte Aktivität und Ungelesen im Core
- `d22d5a3` feat(sidebar): Sortierung nach letzter Aktivität und Ungelesen-Punkt

## Deviations from plan

- Glossar-Einträge stehen thematisch statt alphabetisch (das Glossar ist thematisch geordnet).
- `RankedProject` in `Sidebar.tsx` geht direkt in `buildSidebarRows`; die Abbildung ohne `activity` entfiel.
- `docs/PROJECT.md` und der Kommentar an `URGENCY` nachgezogen (nannten die Gruppen noch).

## Follow-ups

- Smoke-Checkliste dieses Plans ist ohne Abnahme (Wackelstelle zuerst: Neustart-Fall, Punkt 1).
- 🟡 `seen_at` wird erst beim ersten App-Start mit Migration 8 gesetzt; Upsert-Spalten laufen über Smoke 1 mit.
