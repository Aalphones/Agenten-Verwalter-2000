# Vorhaben und Sessions, mit TL;DR

Ziel: Die zentrale Einheit der App wird das **Vorhaben** (z. B. „Plan XYZ umsetzen“). Ein Vorhaben enthält mehrere **Sessions**; jede Session ist genau eine Claude-Session mit eigenem, frischem Kontext. Wer einen Plan mit sechs Phasen umsetzt, startet für jede Phase eine neue Session im selben Vorhaben, statt `/clear` zu benutzen; die alten Sessions bleiben lesbar und fortsetzbar. Alle Sessions eines Vorhabens teilen Workspace, Repositories und die Changes-Ansicht. Die Sidebar zeigt Vorhaben mit aufklappbaren Sessions, ein Vorhaben hat eine eigene Übersicht. Dazu kommt ein **TL;DR** an jeder Session und an jedem Vorhaben: per Knopf erstellt eine kurze Claude-Anfrage mit Haiku im Hintergrund eine Zusammenfassung von drei, vier Zeilen, damit man beim Wechsel zwischen Sessions sofort sieht, woran gearbeitet wird.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [code-map.md](../../code-map.md), [glossary.md](../../glossary.md), [ADR 003](../../decisions/003-claude-anbindung.md) (Claude-Anbindung), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Datenbank, Migrationen, Wiederherstellung), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Haupt-Checkout, Ticket-Worktrees), ADR 011 (entsteht in Phase 1 aus „Festgelegte Entscheidungen“), [claude-stream-json.md](../../knowledge/claude-stream-json.md), die Konventionen unter [docs/conventions/](../../conventions/). **Verbindlicher Entwurf:** [docs/design/2026-09-30_vorhaben-und-tldr/](../../design/2026-09-30_vorhaben-und-tldr/README.md) (Tafeln, Maße, Texte); wo er schweigt, gilt der Entwurf [Hauptansichten](../../design/2026-09-28_hauptansichten/README.md).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Vorhaben als Datenmodell | [phase-1-vorhaben-core.md](phase-1-vorhaben-core.md) | heikel | complete |
| 2 | Core: neue Session im Vorhaben, Status „Neu“ | [phase-2-neue-session-core.md](phase-2-neue-session-core.md) | standard | complete |
| 3 | Oberfläche: Sidebar als Baum, Pfad in der Kopfzeile, „Neues Vorhaben“ | [phase-3-sidebar-und-kopfzeile.md](phase-3-sidebar-und-kopfzeile.md) | standard | complete |
| 4 | Oberfläche: Übersicht des Vorhabens, „Neue Session“ | [phase-4-vorhaben-uebersicht.md](phase-4-vorhaben-uebersicht.md) | standard | complete |
| 5 | Core: TL;DR erzeugen | [phase-5-tldr-core.md](phase-5-tldr-core.md) | heikel | complete |
| 6 | Oberfläche: TL;DR-Karten, Doku-Abschluss | [phase-6-tldr-oberflaeche.md](phase-6-tldr-oberflaeche.md) | standard | pending |
| 7 | Repository nachträglich an ein Vorhaben hängen (**läuft nach Phase 4, vor Phase 5**) | [phase-7-repository-anhaengen.md](phase-7-repository-anhaengen.md) | heikel | complete |

**Reihenfolge der drei offenen Pläne: dieser Plan → „Meilenstein 6 — UI auf Zielbild, plus Altlasten“ → „Sprachdiktat“.** M6 (Phase 3 bis 5) und Sprachdiktat sind gegen den Stand nach diesem Plan geschrieben. Dieser Plan belegt Migration 005 und ADR 011; M6 nimmt danach Migration 006 und ADR 012, Sprachdiktat ADR 009.

**Start erst, wenn der Plan „Kontext und Kontingent“ archiviert ist (erledigt)** — beide Pläne ändern `src/app/SessionHeader.tsx`, und Phase 6 benutzt `formatClock` aus dessen Phase 3 (`src/features/context/formatTokens.ts`). Reihenfolge fest: 1 → 2 → 3 → 4 → **7** → 5 → 6 (jede Phase baut auf den Typen der vorigen auf; Phase 7 trägt die Nummer 7, damit die Verweise auf Phase 5 und 6 gültig bleiben, und setzt die Übersicht aus Phase 4 voraus). Umsetzung direkt auf `main`, ein Commit pro Phase (Scopes: Phase 1 `projects`, Phase 2 `sessions`, Phase 3 `ui`, Phase 4 `projects`, Phase 5 `tldr`, Phase 6 `tldr`, Phase 7 `projects`; die Scopes `projects` und `tldr` trägt Phase 1 bzw. 5 in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Die Liste der exportierten Typen steht in `src-tauri/src/bin/gen-bindings.rs` (M6 Phase 1 zieht die Datei erst nach diesem Plan nach `src-tauri/examples/` um). Das Projekt hat keine automatisierten Tests und bekommt keine. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus ADR 011 „Vorhaben und Sessions“, Phase 5 ergänzt den Abschnitt TL;DR, Phase 7 den Abschnitt „Repository nachträglich anhängen“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). ADR 009 ist vom geparkten Plan „Sprachdiktat“ reserviert, ADR 012 vom Plan M6.

### Begriffe und Namen

- **Vorhaben** (Oberfläche) = **`project`** (Code: `src-tauri/src/projects/`, `commands/projects.rs`, `db/projects.rs`, `src/features/projects/`, `src/lib/projects.ts`, Tabelle `projects`). Das Wort „Projekt“ erscheint nie in der Oberfläche.
- **Session** bleibt `session` und ist genau eine Claude-Session: ihre ID ist die `--session-id`/`--resume`-ID der Kommandozeile. Status, Chat, Prozess, Hintergrund, Kontext, Modell, Modus und Denkaufwand gehören weiter der Session.
- **TL;DR** (Oberfläche und Code `tldr`): kurze Zusammenfassung einer Session oder eines Vorhabens.
- Sessions sind im Vorhaben durchnummeriert (`number`, ab 1, angezeigt als `#N`).

### Datenmodell

- Neue Tabelle `projects`; `sessions` bekommt `project_id`, `number` und drei TL;DR-Spalten; `projects` bekommt drei TL;DR-Spalten. **Eine** Migration für den ganzen Plan (Phase 1), Dateiname `<NNN>_projects.sql` mit der nächsten freien Nummer zum Zeitpunkt der Umsetzung (Stand Planung: 005 — dieser Plan kommt vor M6, M6 nimmt danach 006).
- **Bestehende Daten:** Jede bestehende Session wird ein Vorhaben mit **derselben ID**, demselben Namen, derselben Anlagezeit und demselben Archiv-Stand; die Session bekommt `number = 1`. Kein Datenverlust, keine Umbenennung.
- Alle Sessions eines Vorhabens teilen **denselben Workspace-Ordner** und **dieselben Repositories samt Basis** (`session_repositories` wird für jede neue Session aus der neuesten Session des Vorhabens kopiert — gleiche Zeilen, gleiche `base_ref`/`base_commit`). Der Workspace eines neuen Vorhabens heißt nach der Vorhaben-ID (`new_session_workspace(app, &project_id)`).
- **Changes gehören dem Vorhaben:** Ticket-Worktrees aller Sessions des Vorhabens erscheinen in den Changes jeder seiner Sessions (Vereinigung, ohne Doppelte). Die Oberfläche fragt die Changes weiter über eine Session-ID.
- **Archivieren** gibt es nur für das ganze Vorhaben: alle Sessions werden abgebrochen, Vorhaben und Sessions bekommen `archived_at`, App-Worktrees ohne Änderungen räumt der Core wie bisher einmal weg. Einzelne Sessions lassen sich nicht archivieren.
- **Umbenennen** geht für Vorhaben und Sessions getrennt (je höchstens 60 Zeichen, leer ist ein Fehler).
- **Sperren im Core:** Die Sperre der Vorhaben (`SessionRegistry.projects`) und die Sperre einer Session werden **nie gleichzeitig** gehalten. Wer beides braucht, liest erst das eine, gibt es frei, und nimmt dann das andere.

### Neue Session im Vorhaben

- Neuer Session-Status **„Neu“** (`new`): Session angelegt, Agent nie gestartet, kein Verlauf. Symbol: gestrichelter Ring in gedämpfter Farbe; Sidebar-Gruppe „Läuft“; keine Knöpfe in der Kopfzeile.
- „Neue Session“ legt die Session **sofort** an (Status „Neu“, Name „Session N“, ohne Prozess, ohne Kosten) mit Modell, Denkaufwand und Modus der Session mit der höchsten Nummer. **Höchstens eine** noch nicht gestartete Session je Vorhaben: gibt es schon eine, liefert der Core diese zurück.
- Mit der ersten Nachricht startet der Agent (`--session-id`, wie heute). Heißt die Session dann noch „Session N“, bekommt sie den Namen aus dem ersten Satz der Nachricht (`name_from_task`, wie beim Anlegen eines Vorhabens).
- Alte Sessions bleiben **frei fortsetzbar**, auch während eine neuere läuft (Entscheidung Sascha, 2026-09-30). Die App verhindert zwei gleichzeitig arbeitende Agenten im selben Haupt-Checkout nicht.

### TL;DR

- **Nur per Knopf** (Entscheidung Sascha, 2026-09-30): nie automatisch. Die Karte zeigt, wie alt sie ist („Stand 14:32 · 23 neue Einträge seitdem“).
- **Modell Haiku**, als einmaliger, abgespeckter Aufruf der Kommandozeile im Druckmodus, unabhängig vom Agenten der Session: `claude.exe -p --model haiku --tools "" --safe-mode --strict-mcp-config --no-session-persistence --system-prompt <…> --json-schema <…> --output-format json`, Eingabe über die Standardeingabe, Arbeitsordner `<Benutzerordner>\.verwalter`. **Gemessen am 2026-09-30 mit Claude Code 2.1.284:** läuft mit der Abo-Anmeldung, 1 455 Eingabe-Tokens Grundlast samt kurzer Eingabe, 268 Ausgabe-Tokens, 0,38 Cent, Ergebnis in `structured_output`. `--bare` scheidet aus (meldet sich nur mit API-Schlüssel an, siehe claude-stream-json.md).
- **Eingabe für eine Session:** nur der Gesprächstext aus den Chat-Einträgen (Nachrichten, Antworten, Rückfragen samt Antwort, Fehler, letzte Aufgabenliste), keine Werkzeug-Aufrufe, kein Gedankengang. Obergrenze 300 000 Zeichen; darüber bleibt die erste Nachricht (bis 20 000 Zeichen) und das Ende, die Mitte fällt weg und wird markiert. Gemessen an 77 echten Verläufen: Median 16 k, 90 % unter 34 k, Maximum 128 k Zeichen.
- **Eingabe für ein Vorhaben:** nur die TL;DRs seiner Sessions. Session-TL;DRs, die fehlen, erstellt derselbe Klick vorher mit; veraltete nimmt er, wie sie sind.
- **Gespeichert** in `sessions.tldr*` bzw. `projects.tldr*` als JSON; ein Lauf, der gerade läuft, und sein Fehler liegen nur im Speicher des Core.
- **Stand des Vorhabens für die neue Session:** Die erste Nachricht einer Session im Status „Neu“ bekommt das TL;DR des Vorhabens vorangestellt, wenn es eins gibt und der Haken in der Einstiegsansicht gesetzt ist (Standard: gesetzt; nur im Speicher, nicht in der Datenbank). Der Chat zeigt die Nachricht so, wie sie an den Agenten ging.

## Kontrakt

### Datenbank (Migration aus Phase 1)

```sql
CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   REAL NOT NULL,
  archived_at  REAL,
  tldr         TEXT,
  tldr_at      REAL,
  tldr_sources INTEGER
);

INSERT INTO projects (id, name, created_at, archived_at)
  SELECT id, name, created_at, archived_at FROM sessions;

ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE sessions ADD COLUMN number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN tldr TEXT;
ALTER TABLE sessions ADD COLUMN tldr_at REAL;
ALTER TABLE sessions ADD COLUMN tldr_seq INTEGER;

UPDATE sessions SET project_id = id;
```

### Typen im Core

Alle mit `derive(Debug, Clone, Serialize, Deserialize, TS)` und `#[serde(rename_all = "camelCase")]`, eingetragen in `gen-bindings.rs`.

```rust
// src-tauri/src/projects/model.rs (Phase 1)
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    /// Namen der Repositories in Positions-Reihenfolge; für alle Sessions des Vorhabens gleich.
    pub repository_names: Vec<String>,
}
pub struct ProjectCreated { pub project: ProjectSummary, pub session: SessionSummary }

// src-tauri/src/sessions/model.rs
pub enum SessionStatus { Starting, Running, Waiting, Paused, Completed, Cancelled, Error, New } // New: Phase 2
pub struct SessionSummary { /* bisherige Felder */ pub project_id: String, pub number: u32 }     // Phase 1

// src-tauri/src/tldr/model.rs (Phase 5)
pub struct SessionTldr {
    pub short: String,          // ein Satz, höchstens 160 Zeichen
    pub goal: String,
    pub done: String,
    pub ongoing: String,        // leer = nichts läuft
    pub open: String,           // leer = nichts offen
    pub open_needs_user: bool,
}
pub struct ProjectTldr {
    pub summary: String,        // zwei Sätze
    pub status: String,
    pub open: String,           // leer = nichts offen
    pub next: String,           // leer = unklar
    pub open_needs_user: bool,
}
pub struct SessionTldrView {
    pub tldr: Option<SessionTldr>,
    pub created_at: Option<f64>,       // ms seit 1970
    pub seq: u32,                      // Anzahl Chat-Einträge, die das TL;DR kannte; 0 ohne TL;DR
    pub is_running: bool,
    pub error: Option<String>,
    pub carries_project_tldr: bool,    // Haken der Einstiegsansicht
}
pub struct ProjectSessionTldr { pub session_id: String, pub short: Option<String>, pub is_running: bool }
pub struct ProjectTldrView {
    pub tldr: Option<ProjectTldr>,
    pub created_at: Option<f64>,
    pub source_count: u32,             // aus wie vielen Session-TL;DRs es entstand
    pub is_running: bool,
    pub error: Option<String>,
    pub sessions: Vec<ProjectSessionTldr>, // alle Sessions des Vorhabens, nach Nummer
}
pub struct TldrChangedEvent { pub project_id: String, pub session_id: Option<String> }
```

In TypeScript heißt der neue Status `'new'`.

### Tauri Commands (registriert in `src-tauri/src/lib.rs`)

| Command | Parameter | Rückgabe | Wrapper | Phase |
|---|---|---|---|---|
| `project_list` | — | `ProjectSummary[]`, neueste zuerst | `listProjects()` in `src/lib/projects.ts` | 1 |
| `project_create` | `task`, `attachmentIds`, `repositoryIds`, `model`, `effort`, `mode` | `ProjectCreated` | `createProject(…)` | 1 (ersetzt `session_create`) |
| `project_rename` | `projectId`, `name` | — | `renameProject(projectId, name)` | 1 |
| `project_archive` | `projectId` | — | `archiveProject(projectId)` | 1 (ersetzt `session_archive`) |
| `session_create_in_project` | `projectId` | `SessionSummary` | `createSessionInProject(projectId)` in `src/lib/sessions.ts` | 2 |
| `project_add_repository` | `projectId`, `repositoryId` | `ProjectSummary` | `addRepositoryToProject(projectId, repositoryId)` in `src/lib/projects.ts` | 7 |
| `tldr_session_load` | `sessionId` | `SessionTldrView` | `loadSessionTldr(sessionId)` in `src/lib/tldr.ts` | 5 |
| `tldr_session_create` | `sessionId` | — (startet im Hintergrund) | `createSessionTldr(sessionId)` | 5 |
| `tldr_project_load` | `projectId` | `ProjectTldrView` | `loadProjectTldr(projectId)` | 5 |
| `tldr_project_create` | `projectId` | — (startet im Hintergrund) | `createProjectTldr(projectId)` | 5 |
| `tldr_set_carry` | `sessionId`, `carry` | — | `setCarryProjectTldr(sessionId, carry)` | 5 |

`changes_load` und `changes_file_diff` behalten ihre Parameter; ab Phase 1 zählen die Ticket-Worktrees aller Sessions des Vorhabens.

### Ereignisse

| Ereignis | Nutzlast | Wann | Phase |
|---|---|---|---|
| `project://changed` | `ProjectSummary` | Vorhaben umbenannt | 1 |
| `session://changed` | `SessionSummary` (wie bisher, jetzt mit `projectId`, `number`) | wie bisher | — |
| `tldr://changed` | `TldrChangedEvent` | ein TL;DR-Lauf beginnt oder endet (Erfolg oder Fehler) | 5 |

### Oberfläche (Zustand)

```ts
// src/stores/sessions.ts (Phase 3) — ersetzt renamingId
activeProjectId: string | null;
showProjectOverview: boolean;            // true = Übersicht des Vorhabens statt Session
projectView: 'overview' | 'changes';     // Reiter der Übersicht
renaming: { kind: 'session' | 'project'; id: string } | null;
expanded: Record<string, boolean>;       // Vorhaben-ID → aufgeklappt (fehlt = Standard)
selectSession(sessionId): void;          // + showProjectOverview = false
selectProject(projectId): void;          // activeProjectId, showProjectOverview = true, projectView = 'overview', showNewSession = false
showProjectView(view): void;
setExpanded(projectId, value: boolean): void;
startRename(kind, id): void; stopRename(): void;

// src/stores/tldr.ts (Phase 6)
collapsed: Record<string, boolean>;      // Session-ID → TL;DR-Karte eingeklappt
toggleCollapsed(sessionId): void;
```

## Finale Abnahmekriterien

1. Nach dem ersten Start mit der neuen Version steht jede bisherige Session als Vorhaben gleichen Namens in der Sidebar, mit genau einer Session `#1` darin; Verlauf, Changes und Hintergrund sind unverändert.
2. „Neues Vorhaben“ (Sidebar, Strg+N, Leerzustand) legt ein Vorhaben mit Session `#1` an und öffnet deren Chat; Name aus dem ersten Satz der Aufgabe.
3. Die Sidebar zeigt Vorhaben in den Gruppen „Braucht dich“, „Läuft“, „Abgeschlossen“ (nach der dringendsten Session), mit Chevron zum Aufklappen und eingerückten Sessions `#N Name` darunter. Klick auf ein Vorhaben mit mehreren Sessions öffnet seine Übersicht, mit genau einer Session deren Chat.
4. Die Kopfzeile einer Session zeigt „Vorhaben › #N Session-Name“ plus Status; Klick auf den Vorhaben-Namen öffnet die Übersicht.
5. Die Übersicht zeigt Repositories, Änderungssumme, die Sessions als Karten (Status, `#N`, Name, Modell · Laufzeit · Kontext) und „Neue Session“ mit dem Hinweis, welche Einstellungen übernommen werden; Reiter „Changes“ zeigt die Änderungen des ganzen Vorhabens.
6. „Neue Session“ legt ohne Wartezeit eine Session im Status „Neu“ an und öffnet sie mit einer Einstiegsansicht; ein zweiter Klick legt keine zweite an. Die erste Nachricht startet den Agenten mit frischem Kontext, die Session heißt danach nach dem ersten Satz.
7. Alte Sessions eines Vorhabens lassen sich jederzeit öffnen und fortsetzen, auch während eine andere läuft.
8. Vorhaben und Sessions lassen sich getrennt umbenennen (Rechtsklick, Doppelklick, F2); archivieren lässt sich nur ein Vorhaben, danach ist es samt Sessions aus der Liste.
9. Jede Session mit Verlauf zeigt über dem Chat eine TL;DR-Leiste bzw. -Karte in den Zuständen „noch keins“, „wird erstellt“, „aktuell“, „veraltet (N neue Einträge)“, „eingeklappt“; „TL;DR erstellen“/„Aktualisieren“ liefert nach wenigen Sekunden eine Zusammenfassung, der Chat bleibt benutzbar.
10. Die Übersicht zeigt das TL;DR des Vorhabens und an jeder Session-Karte deren Kurzfassung oder „TL;DR erstellen“; der Knopf am Vorhaben erstellt fehlende Session-TL;DRs mit.
11. In einer neuen Session schickt die erste Nachricht das TL;DR des Vorhabens mit, solange der Haken gesetzt ist.
12. Kein TL;DR-Lauf hinterlässt einen laufenden `claude.exe`; keiner öffnet ein Konsolenfenster; ein Fehler steht als Satz an der Karte.
13. Ein Vorhaben ohne Repository bekommt über „+ Repository“ in der Übersicht ein Repository angehängt: der Reiter „Changes“ erscheint in Übersicht und Session, die Changes zeigen alles seit dem Anlegen des Vorhabens (Phase 7).
14. `pnpm check` grün; ADR 011, Code-Map, Glossar, AGENTS.md, PROJECT.md, `commits.md`, claude-stream-json.md und die Entwurfs-README beschreiben den Stand.

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

1. **Umstellung der echten Datenbank:** App schließen, `%USERPROFILE%\.verwalter\verwalter.db` samt `-wal`/`-shm` (falls vorhanden) wegkopieren, neue Version starten → alle bisherigen Sessions sind als Vorhaben da, ihre Verläufe und Changes stimmen.
2. **Zwei Sessions eines Vorhabens gleichzeitig:** in `#1` und `#2` desselben Vorhabens je eine längere Aufgabe schicken, die Dateien liest → beide Agenten antworten, keiner bricht mit einem Fehler ab, beide Verläufe bleiben getrennt.
3. **TL;DR einer langen Session:** in der längsten vorhandenen Session „TL;DR erstellen“ → nach spätestens 2 Minuten steht eine Zusammenfassung da, im Task-Manager bleibt kein zusätzlicher `claude.exe`.
4. Plan-Workflow nachspielen: Vorhaben anlegen, `#1` arbeiten lassen, TL;DR des Vorhabens erstellen, „Neue Session“ → Einstiegsansicht mit Haken und TL;DR-Text, Modell in der Eingabeleiste auf Sonnet stellen, erste Nachricht senden → der Chat zeigt die Nachricht mit vorangestelltem Stand, die Session heißt nach dem ersten Satz.
5. „Neue Session“ zweimal klicken, ohne zu senden → nur eine Session `#N` im Status „Neu“.
6. Vorhaben umbenennen (F2 in der Übersicht) und Session umbenennen (Doppelklick in der Sidebar) → beide Namen unabhängig, überstehen einen Neustart.
7. Vorhaben mit zwei Sessions archivieren → beide verschwinden, beide Agenten sind beendet.
8. TL;DR veraltet: nach dem TL;DR noch zwei Nachrichten schicken → „Stand HH:MM · N neue Einträge seitdem“ mit Knopf „Aktualisieren“. Karte einklappen → eine Zeile mit der Kurzfassung.
9. Netzwerk trennen, „TL;DR erstellen“ → Fehlersatz an der Karte, die App bleibt bedienbar.
10. Changes: in `#1` einen Ticket-Worktree benutzen lassen, dann `#2` öffnen → Reiter „Changes“ zeigt den Ticket-Worktree auch dort.
11. **Repository nachträglich anhängen (Phase 7), Wackelstelle Basis:** Vorhaben ohne Repository anlegen, den Agenten in einem Repository eine Datei ändern und committen lassen, dann in der Übersicht „+ Repository“ → das Repository wählen → Reiter „Changes“ erscheint und zeigt den Commit und die Datei. Danach in einer ruhenden Session (Status „Abgeschlossen“) eine Nachricht schicken → der Agent kennt das Repository (nachfragen: „In welchen Ordnern darfst du arbeiten?“).
12. Hell- und Dunkelmodus: Sidebar-Baum, Übersicht, TL;DR-Karten lesbar; mit den Tafeln im Entwurf vergleichen.

## Follow-ups

- `/tldr` im `/`-Menü als zweiter Auslöser für das TL;DR der aktuellen Session (Backlog, Entscheidung Sascha 2026-09-30).

## Summary

## Files touched

## Commits

## Deviations from plan
