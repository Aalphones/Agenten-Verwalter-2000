# Plan: Session-Dateien – jede Datei einer Session im Reiter „Dateien“ ansehen

Ziel: Im Reiter „Dateien“ steht unter den Repositories ein Knoten „Session-Dateien“. Er zeigt je Session des Vorhabens (auch Stationen einer Umsetzung) die Dateien in ihren beiden Scratchpads, die Dateien außerhalb der Repositories, die sie geschrieben hat, und jede Datei, die sie im Chat verlinkt hat. Ein Klick auf einen Dateilink im Chat öffnet die Datei dort, auch außerhalb des Vorhabens. Bild, Video, Ton, PDF und große Bilder zeigt die Ansicht im abgeschotteten Betrachter der Artefakte, auch für Dateien in Repositories. Jede Datei hat die Knöpfe „In VS Code öffnen“, „Im Dateisystem anzeigen“, „Mit Standardprogramm öffnen“ und „Pfad kopieren“; „Mit Standardprogramm öffnen“ ist für ausführbare Typen gesperrt, auch im Reiter „Artefakte“. Grundsatz: [ADR 071](../../decisions/071-session-dateien.md). Entwurf (verbindlich): [artifacts/entwurf-session-dateien.html](artifacts/entwurf-session-dateien.html), Erläuterung in [artifacts/README.md](artifacts/README.md).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Kern: Verweise im Chat erfassen, Scratchpad der Kommandozeile merken | [phase-1-kern-erfassen.md](phase-1-kern-erfassen.md) | standard | complete |
| 2 | Kern: Liste der Session-Dateien, Lesen, Grenze, Dateilink-Ziele, Sperre | [phase-2-kern-liste.md](phase-2-kern-liste.md) | heikel | complete |
| 3 | Kern: Betrachter-Adresse für einzelne Dateien | [phase-3-kern-betrachter.md](phase-3-kern-betrachter.md) | heikel | complete |
| 4 | Knoten „Session-Dateien“ und Sprünge aus dem Chat | [phase-4-knoten-links.md](phase-4-knoten-links.md) | standard | pending |
| 5 | Datei-Ansicht: Betrachter, vier Knöpfe, Sperre in „Artefakte“, Doku | [phase-5-datei-ansicht.md](phase-5-datei-ansicht.md) | standard | pending |

Reihenfolge fest 1 → 5; nach jeder Phase läuft die App. Profil: privat – keine automatisierten Tests, keine Review-Stationen, keine Abnahmeliste. Nicht im Umfang: Suche (Strg P) über Session-Dateien, Bilder mit relativem Pfad in der Markdown-Vorschau einer Session-Datei, HTML-Vorschau in der App, Bearbeiten, Dateien, die ein Agent per Shell außerhalb der Scratchpads erzeugt und nie verlinkt.

## Gemessene Grundlage (2026-11-25)

- Ein Klick auf `<Workspace>\.scratchpad\<Session>\nachweis-labor01.sh` scheitert; `file-link-probe` mit Workspace als Basis und einem Repository als Eintrag: `ZIEL FEHLER FileNotAllowed: Liegt in keinem Repository des Vorhabens`.
- `session_files` erfasst jede Datei, die Agent oder Subagent mit `Edit`, `Write`, `MultiEdit`, `NotebookEdit` schreibt, ohne Ortsfilter (`sessions/registry.rs` `note_touched_files`, `WRITING_TOOLS`); Codex meldet `fileChange` als `Edit` (`codex/items.rs`). Die Pfade stehen dort normalisiert (`changes::attribution::normalize_path`: unter Windows klein, `\`).
- Echte Scratchpads eines Vorhabens: 0, 0, 1, 12, 450 (Edge-Profil eines Screenshot-Laufs) und 1.401 Dateien (entpacktes Repository).
- Den Scratchpad der Kommandozeile kennt der Kern nur im Speicher (`cli_tasks_dir` aus `AgentEvent::ScratchpadDir`), nach einem Neustart nicht mehr.
- Der Artefakt-Server erlaubt einer Seite per CSP nur `<origin>/<token>/<session>/` und `https:` (`artifacts/server.rs` `artifact_csp`).
- `artifact_open_default` öffnet jeden Dateityp ohne Sperre (`commands/artifacts.rs`).
- Stationen einer Umsetzung sind Sessions desselben Vorhabens (`implementation/start.rs` `create_fresh_in_project`).

## Kontrakt

### Namensschema

Neues Feature `session_files`: `src-tauri/src/session_files/` (`mod.rs`, `model.rs`, `links.rs`, `scan.rs`, `access.rs`, `handles.rs`), `src-tauri/src/commands/session_files.rs`, neue Tabelle `src-tauri/src/db/session_links.rs`; die bestehende Tabelle `src-tauri/src/db/session_files.rs` bleibt Quelle der geschriebenen Dateien. Oberfläche im Feature `files`: `src/features/files/SessionFilesNode.tsx` (+ `.css`), `src/features/files/buildSessionRows.ts`, `src/features/files/useSessionFiles.ts`, `src/features/files/ViewerFrame.tsx` (+ `.css`), `src/features/files/FileActions.tsx`, Wrapper `src/lib/sessionFiles.ts`.

### Begriffe

- **Session-Datei:** eine Datei außerhalb aller Repository-Einträge des Vorhabens und außerhalb `.artefakte`, die (a) im Scratchpad einer Session des Vorhabens liegt, (b) die Session geschrieben hat (`session_files`) oder (c) die Session im Chat verlinkt hat (`session_links`).
- **Ort:** `scratchpad` (`<Workspace>\.scratchpad\<Session-ID>`), `cliScratchpad` (der Scratchpad, den die Kommandozeile meldet), `elsewhere` (alles andere).
- **Verlinkt:** ein absoluter Pfad aus Inline-Code oder dem Ziel eines Markdown-Links einer Agenten-Antwort (`ChatEntry::Text`), der nach den Regeln von `filePathOf` (`src/lib/fileLinks.ts`) ein Dateilink ist.
- **Ausführbar:** Endung in `file_links::EXECUTABLE_EXTENSIONS` oder (nur Unix) Datei mit gesetztem Ausführungsbit.

### Migration 022 (`src-tauri/src/db/migrations/022_session_links.sql`)

```sql
CREATE TABLE session_links (
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  first_seen_at REAL NOT NULL,
  last_seen_at  REAL NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN cli_scratchpad_dir TEXT;
ALTER TABLE sessions ADD COLUMN links_scanned INTEGER NOT NULL DEFAULT 0;
```

`session_links.path` ist absolut, ohne `file:///` und ohne angehängte Zeile, Trenner nativ, Groß-/Kleinschreibung wie im Text. `links_scanned = 1`: die Verweise älterer Chat-Einträge dieser Session sind eingelesen.

### Typen (Rust, über die Tauri-Grenze mit `ts-rs`, `serde(rename_all = "camelCase")`)

```rust
// src-tauri/src/session_files/model.rs
pub enum SessionFileOrigin { Scratchpad, CliScratchpad, Elsewhere }

pub struct SessionFile {
    pub path: String,              // absolut, nativ; bei vorhandener Datei mit echter Schreibweise
    pub folder: String,            // Scratchpad-Orte: Ordner relativ zum Scratchpad mit "/", "" = Wurzel;
                                   // elsewhere: absoluter Elternordner, nativ
    pub name: String,
    pub origin: SessionFileOrigin,
    pub written: bool,             // steht in session_files dieser Session
    pub linked: bool,              // steht in session_links dieser Session
    pub exists: bool,
    pub bytes: Option<f64>,
    pub modified_at: Option<f64>,  // ms seit 1970
    pub kind: ArtifactKind,        // artifacts::kind_of
    pub viewer: bool,              // artifacts::viewers::page(kind).is_some()
    pub executable: bool,
}

pub struct SessionFileGroup {
    pub session_id: String,
    pub number: u32,
    pub name: String,
    pub scratchpad_dir: Option<String>,
    pub cli_scratchpad_dir: Option<String>,
    pub files: Vec<SessionFile>,   // sortiert: Ort (scratchpad, cliScratchpad, elsewhere), dann folder, dann name
    pub truncated: bool,           // ein Scratchpad hatte mehr als scratchpad::MAX_ENTRIES Einträge
    pub errors: Vec<String>,       // je Ort ein Satz, z. B. "Scratchpad Kommandozeile nicht lesbar: Zugriff verweigert"
}

pub struct SessionFilesListing { pub groups: Vec<SessionFileGroup> }  // eigene Session zuerst, dann Nummer absteigend;
                                                                     // Gruppen ohne Dateien und ohne Fehler entfallen

// Wie die Oberfläche eine Datei adressiert (session_files/model.rs)
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileRef {
    Entry { key: String, path: String },   // Repository-Eintrag wie in files_read
    Absolute { path: String },             // Session-Datei
}

// src-tauri/src/file_links/mod.rs — FileLinkTarget, neue Varianten
SessionFile { path: String, line: Option<u32> },   // absolut, nativ
Artifact { file: String },                         // Name direkt in .artefakte (artifacts::artifact_file_of)
```

### Befehle (`src-tauri/src/commands/session_files.rs`, im `invoke_handler` in `lib.rs`)

| Befehl | Eingabe | Ergebnis | Fehler |
|---|---|---|---|
| `session_files_list` | `session_id` | `SessionFilesListing` des Vorhabens der Session | `sessionNotFound` |
| `session_file_read` | `session_id`, `path` | `FileContent` wie `files_read` | `fileNotAllowed` (keine Session-Datei), `io` |
| `file_view_url` | `session_id`, `file: FileRef` | `String`: `http://127.0.0.1:<port>/<token>/~datei/<handle>/<Dateiname>?view=1` | `fileNotAllowed`, `fileNotFound` |
| `file_reveal` | `session_id`, `file: FileRef` | `()` | `fileNotAllowed`, `fileNotFound`, `io` |
| `file_open_default` | `session_id`, `file: FileRef` | `()` | `fileNotAllowed` „Ausführbare Datei wird nicht geöffnet“, `fileNotFound`, `io` |
| `file_open_in_editor` | `session_id`, `file: FileRef`, `line: Option<u32>` | `()` | wie `files_open_in_editor` |

`files_open_in_editor` entfällt in Phase 5 (einziger Nutzer `FileViewer.tsx` zieht auf `file_open_in_editor` um).

### Dateilink (`file_links::target`, Reihenfolge)

Vorab: ein Netzwerkpfad (Windows, `\\…`) → `fileNotAllowed` „Netzwerkpfade werden nicht geöffnet“, vor jedem Zugriff auf das Dateisystem (schon die Suche nach der Datei meldete den Benutzer am fremden Rechner an).

1. Dateiname ohne Ordner und in keiner relativen Basis vorhanden → `Name` (unverändert).
2. Pfad finden (absolut oder gegen die relativen Basen); fehlt er → `FileNotFound`. Die Doppelpunkt-Prüfung unter Windows bleibt.
3. Kanonisch in `.artefakte` des Vorhabens → `Artifact { file }`.
4. `html`/`htm` innerhalb der erlaubten Wurzeln (`LinkRoots.allowed`) → `External` (Standardprogramm wie heute).
5. In einem Eintrag → `View` (unverändert, jetzt auch für PDF).
6. Sonst → `SessionFile { path, line }`; der Befehl `file_link_resolve` trägt den Pfad dabei in `session_links` der klickenden Session ein.

`EXTERNAL_EXTENSIONS` wird `["html", "htm"]`; PDF öffnet in der App.

### Betrachter-Adresse

`http://127.0.0.1:<port>/<token>/~datei/<handle>/<Dateiname>`: `<handle>` ist eine zufällige UUID (simple), die `file_view_url` für einen geprüften absoluten Pfad ausgibt und im Speicher hält (höchstens 512, älteste fliegt). Ohne `?view=1` liefert der Server die Datei, mit `?view=1` die Betrachter-Seite (`viewers::render(kind_of(path), name)`). `<Dateiname>` muss dem Namen der Datei hinter dem Handle gleichen, sonst 404. CSP-Bereich dieser Antworten: `<origin>/<token>/~datei/<handle>/` — eine Artefakt-Seite (Bereich `<origin>/<token>/<session>/`) erreicht ihn nicht direkt; nach einer Weiterleitung gilt der Pfad der CSP nicht, dann schützt allein der unbekannte Handle. Der Handle hält den kanonischen Pfad; ausgeliefert wird nur, solange dort noch dieselbe Datei liegt. Alle Antworten hinter dem richtigen Token, auch Fehler, tragen `Access-Control-Allow-Origin: *`, damit die Betrachter den Status lesen. Auch `file_view_url` für einen Typ ohne Betrachter liefert die Adresse mit `?view=1`; darunter antwortet der Server mit 404.

## Finale AK

1. Ein Klick auf `…\.scratchpad\<Session>\nachweis-labor01.sh` im Chat öffnet den Reiter „Dateien“, die Datei steht im Knoten „Session-Dateien“ ausgewählt und rechts als Text.
2. Ein Klick auf eine existierende Datei außerhalb des Vorhabens (z. B. `C:\Users\<du>\Downloads\x.mp4`) öffnet sie ebenso; sie steht danach mit „verlinkt“ in der Gruppe der Session.
3. Ein Klick auf eine Datei in `.artefakte` öffnet den Reiter „Artefakte“ mit diesem Artefakt.
4. Der Knoten zeigt für jede Session des Vorhabens (auch beendete und Stationen) die Orte Scratchpad, Scratchpad Kommandozeile und Weitere Orte; Sessions vor dieser Version zeigen ihre früher verlinkten Dateien, ihren Scratchpad der Kommandozeile erst ab ihrem nächsten Start.
5. Bild, Video, Ton und PDF erscheinen im Betrachter, in Session-Dateien und in Repositories; Markdown, CSV, JSON, YAML, XML und Mermaid zeigen Text mit Schalter „Vorschau“.
6. Jede Datei hat die vier Knöpfe; „Mit Standardprogramm öffnen“ ist bei ausführbaren Typen gesperrt (Hinweiszeile), im Reiter „Artefakte“ ebenso; der Kern lehnt den Aufruf für solche Typen ab.
7. `pnpm bindings` und `pnpm check` grün.

## Von mir gesetzt

- Nur absolute Pfade zählen als verlinkt; relative zeigen in Repositories und stehen dort im Baum. Grund: kein Auflösen gegen Basen beim Eintreffen jeder Antwort.
- Ältere Sessions werden beim ersten Laden der Liste einmal nachgelesen (`links_scanned`), nicht per Migration. Grund: die Migration bleibt reines SQL, der Aufwand fällt nur für geöffnete Vorhaben an.
- Gelöschte Dateien bleiben in der Liste („nicht mehr da“), statt still zu verschwinden.
- Der Knoten fehlt ganz, wenn keine Session eine Datei hat; „Blickwinkel“ und „Geändert/Alle Dateien“ wirken nicht auf ihn, der Session-Filter schon.
- HTML-Dateien als Session-Datei zeigen die Rest-Karte mit „Im Browser öffnen“ (= `file_open_default`), keine Vorschau: relative Bilder und Skripte der Seite lägen außerhalb der Betrachter-Adresse.
- Bild-Vorschau über `data:`-Adresse (`FileContent::Image`) entfällt; jedes Bild geht über den Betrachter, dadurch fällt die 2-MB-Grenze.
- Die Sperre ist eine Ausschlussliste ausführbarer Typen (Wunsch: Knopf an jeder Datei), nicht die bisherige Erlaubnisliste.
- Migration 022: `STATE.md` nennt für den späteren Plan „Zusammenarbeit der Stationen“ ebenfalls 022 — wer später kommt, nimmt die nächste freie Nummer.

## Risiken und Konfidenz

- 🟡 Die Ansichts-Grenze fällt: jede im Chat genannte Datei ist per Klick lesbar (bewusst entschieden, ADR 071). Ausführen bleibt gesperrt; die Betrachter-Adresse ist nur über einen Handle erreichbar.
- Geklärt in Phase 2: `fs::canonicalize` liefert unter Windows die echte Schreibweise (`Ördner Ähnlich\Groß.TXT` aus einem klein gespeicherten Pfad, `session-files-probe`).
- 🟡 Spulen im Video ist in WebView2 noch nicht gesehen. Seit Phase 3 beantwortet der Artefakt-Server `Range` mit `206` (per `curl` an einer `~datei`-Adresse belegt) und liest dafür je Anfrage die ganze Datei. Check in Phase 5: ein 20-MB-Video im Betrachter ans Ende spulen.
- 🟡 Große Scratchpads (1.401 Dateien) lesen bei jedem Laden der Liste den Ordner. `scratchpad::list` deckelt bei 2.000 Einträgen und 6 Ebenen; der Knoten zeigt dann „gekürzt“.
- Fehlerklassen geprüft (Vault `sprachen/typescript`, `frameworks/react`, `systeme/sqlite`): einschlägig nur „`fetch` wirft nicht bei HTTP-Fehlerstatus“ → Phase 3, Prüfpunkt in den Betrachter-Skripten. Rust und Tauri haben keinen Vault-Eintrag.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
