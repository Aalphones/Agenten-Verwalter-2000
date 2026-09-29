# Meilenstein 2b — Anhänge, Skills, Hintergrund

Ziel: Die Eingabeleiste nimmt Bilder und Dateien an (Knopf `+`, Hineinziehen, Ctrl+V) und bietet Skills und Befehle über den Knopf `/` und über `/` am Anfang des Eingabefelds an. Dasselbe gilt für das Aufgabenfeld unter „Neue Session“. Die Session-Kopfzeile bekommt den Knopf „Hintergrund“. Er öffnet ein Seitenpanel mit drei Reitern: laufende und ausgeführte Befehle (Reiter „Prozesse“), Subagenten und den Scratchpad-Ordner der Session. Im Chat-Verlauf erscheinen Subagenten und Hintergrundprozesse als eigene Zeilen, die das Panel auf genau diesem Eintrag öffnen. Alles, was das Panel zeigt, stammt aus den Ereignissen der Claude-Kommandozeile und den Dateien, die sie schreibt — nie aus dem Text des Agenten.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 003](../../decisions/003-claude-anbindung.md) (Anbindung), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Persistenz), [ADR 005](../../decisions/005-repositories-und-worktrees.md) (Workspace, Worktrees), ADR 007 (entsteht in Phase 1 aus „Festgelegte Entscheidungen“ unten), [claude-stream-json.md](../../knowledge/claude-stream-json.md) (**alle Protokoll-Fakten dieses Plans sind dort belegt**, Abschnitte „Anhänge“ bis „Scratchpad“), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md) (Tafeln `Attach`, `Cmd`, `Slash`, `NewSession`, `BgProc`, `BgAgents`, `BgScratch`), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Anhänge | [phase-1-anhaenge-core.md](phase-1-anhaenge-core.md) | standard | complete |
| 2 | Core: Skills und Befehle | [phase-2-skills-core.md](phase-2-skills-core.md) | standard | complete |
| 3 | Core: Hintergrund und Scratchpad | [phase-3-hintergrund-core.md](phase-3-hintergrund-core.md) | heikel | complete |
| 4 | Oberfläche: Eingabeleiste mit Anhängen und `/`-Menü | [phase-4-eingabeleiste.md](phase-4-eingabeleiste.md) | standard | complete |
| 5 | Oberfläche: Hintergrund-Panel, Verlaufszeilen, Doku-Abschluss | [phase-5-hintergrund-panel.md](phase-5-hintergrund-panel.md) | standard | pending |

Reihenfolge fest: 1 → 2 → 3 → 4 → 5 (Phase 4 braucht die Commands aus 1 und 2, Phase 5 die aus 3). Umsetzung direkt auf `main`, ein Commit pro Phase (Scopes: Phase 1 `attachments`, Phase 2 `skills`, Phase 3 `background`, Phase 4 `chat`, Phase 5 `background`). Vor jedem Commit muss `pnpm check` grün sein; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` ausführen und die erzeugten Dateien mit committen. Erkenntnisse während der Umsetzung gehören nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus ADR 007 „Anhänge, Skills und Hintergrund“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen).

### Anhänge

- **Zwischenordner:** Jeder hinzugefügte Anhang wird sofort nach `<Benutzerordner>\.verwalter\attachments\<id>\<name>` kopiert (`<id>` = UUID v4). So braucht „Neue Session“ noch keinen Workspace, und die Oberfläche kann sofort ein Vorschaubild zeigen. Beim App-Start wird der Zwischenordner geleert, denn ungesendete Entwürfe überleben keinen Neustart (sie liegen im flüchtigen Zustand der Oberfläche).
- **Beim Senden** verschiebt der Core jeden Anhang nach `<Workspace>\.anhaenge\<id>\<name>`. Damit liegt er innerhalb der Sicherheitsgrenze (AGENTS.md, Regel 5), der Agent darf ihn lesen, und der Verlauf zeigt ihn nach einem Neustart weiter an.
- **Transport an den Agenten:**
  - Bilder mit Endung `png`, `jpg`, `jpeg`, `gif` oder `webp` (Groß-/Kleinschreibung egal) bis **3 932 160 Bytes (3,75 MiB)** gehen als Base64-Bildblock. Die Grenze kommt daher, dass Base64 um 4/3 wächst und die API-Grenze pro Bild bei 5 MB liegt.
  - PDFs bis **10 485 760 Bytes (10 MiB)** gehen als Base64-Dokumentblock. Die Grenze hält die stdin-Zeile unter rund 14 MB; längere Zeilen sind ungeprüft (GAPS).
  - Alles andere — und alles über diesen Grenzen — wird dem Agenten als absoluter Pfad im Textblock genannt, unter der Zeile `Angehängte Dateien (im Workspace):` mit je einer Zeile `- <Pfad>`.
  - Ohne Anhänge bleibt die Nachricht ein String wie bisher.
- **Art in der Oberfläche:** `image` bei den fünf Bild-Endungen (unabhängig von der Größe), sonst `file`. Bilder zeigen ein Vorschaubild über das Tauri-Asset-Protokoll (siehe unten) und ihre Abmessungen; die Abmessungen misst die Oberfläche am geladenen Bild, der Core nicht.
- **Während einer offenen Rückfrage keine Anhänge:** Eine Nachricht beantwortet dann die Rückfrage als Text (bestehendes Verhalten von `send`). Die Oberfläche sperrt deshalb `+`, Hineinziehen und Einfügen im Status `waiting`. Der Core lehnt Anhänge in diesem Fall zusätzlich mit dem neuen Fehler `attachmentsWhileWaiting` ab.
- **Asset-Protokoll:** Cargo-Feature `protocol-asset` an `tauri`, in `tauri.conf.json` `app.security.assetProtocol` mit `enable: true` und Scope `["$HOME/.verwalter/**"]`. Die CSP `img-src` bekommt `http://asset.localhost` dazu, denn so heißen Asset-Adressen unter Windows. Scratchpad-Ordner werden zur Laufzeit einzeln freigegeben (Abschnitt „Hintergrund“), nie ganz `%TEMP%`.

### Skills und Befehle

- **Quelle ist das Dateisystem, nicht `system/init`.** `init.skills` enthält nur Namen, ohne Herkunft und Beschreibung, und ist erst bekannt, nachdem der Agent einmal lief. „Neue Session“ braucht die Liste aber vorher.
- **Gelesen wird aus vier Orten**, in dieser Reihenfolge: `~\.claude\skills\<ordner>\SKILL.md`, `~\.claude\commands\<datei>.md` (nur oberste Ebene), dann je Repository der Session in deren Reihenfolge `<wurzel>\.claude\skills\<ordner>\SKILL.md` und `<wurzel>\.claude\commands\<datei>.md`. `<wurzel>` ist bei einer bestehenden Session der Worktree (`<Workspace>\<folder>`), unter „Neue Session“ der Haupt-Checkout des gewählten Repositorys.
- **Name:** das Frontmatter-Feld `name`; fehlt es, der Ordnername (Skill) bzw. Dateiname ohne `.md` (Befehl). **Beschreibung:** das Frontmatter-Feld `description`; fehlt es bei einem Befehl, die erste nicht leere Zeile nach dem Frontmatter ohne führende `#`. Die Beschreibung wird auf 160 Zeichen gekürzt (mit `…`). Doppelte Namen bleiben beide stehen, denn die Herkunft unterscheidet sie.
- **Plugin- und eingebaute Skills der Kommandozeile stehen nicht im Menü** (Entscheidung Sascha, 2026-09-29). Tippen funktioniert trotzdem, weil die Kommandozeile jedes `/name` selbst auflöst.
- **Skill-Marke im Verlauf:** Beginnt eine gesendete Nachricht (nach führenden Leerzeichen) mit `/<name>`, gefolgt von Leerzeichen oder Textende, und steht `<name>` in der Liste der Session, speichert der Core am Chat-Eintrag `skill` = Name + Herkunft. Die Oberfläche zeigt dann `/name` als farbige Marke und darunter „Skill <name> geladen · aus deinem Benutzerordner“ bzw. „· aus <Repository>“. Die Kommandozeile meldet das Laden nicht selbst; dass sie `/name` ausführt, ist belegt (claude-stream-json.md, „Skills per Nachricht“).
- **Session-Befehle im `/`-Menü** führt die App selbst aus, sie gehen nie an den Agenten: `/rename` (Umbenennen in der Sidebar starten), `/changes` (Reiter Changes; nur bei Sessions mit Repository), `/pause` (nur in `starting`, `running`, `waiting`).

### Hintergrund

- **Drei Arten von Einträgen** (`BackgroundKind`):
  - `command`: Bash-Aufruf des Hauptagenten im Vordergrund. Er erscheint unter „Prozesse“ in der Gruppe „Ausgeführt“, mit Exit-Code, Dauer und Ausgabe.
  - `process`: Bash mit `run_in_background`. Er steht unter „Läuft“, solange er läuft, danach unter „Ausgeführt“.
  - `subagent`: Aufruf des Werkzeugs `Agent`. Er erscheint im Reiter „Subagenten“.
  - Befehle **von Subagenten** sind keine eigenen Einträge, sondern Schritte ihres Subagenten.
- **Zustand** (`BackgroundState`): `running`, `completed`, `failed`, `stopped` (von der App angehalten), `interrupted` (der Agent-Prozess endete, während der Eintrag lief — er kann trotzdem weitergelaufen sein, deshalb nie „nicht ausgeführt“).
- **Ausgabe:**
  - `command`: das Ende der Ausgabe aus dem `tool_result`, höchstens 64 KiB, gespeichert in SQLite.
  - `process`: gelesen aus Claudes Ausgabedatei (`output_file`, bekannt ab `task_notification`; vorher aus dem Text des `tool_result` nach `Output is being written to: `), höchstens die letzten 256 KiB.
  - Die Liste lädt nie Ausgaben mit, nur der gewählte Eintrag lädt seine.
- **Adresse eines Prozesses:** Die erste Zeichenkette in den ersten 64 KiB der Ausgabe, die mit `http://` oder `https://` beginnt und deren Host `localhost`, `127.0.0.1`, `0.0.0.0` oder `[::1]` ist. `0.0.0.0` wird zu `localhost`; Satzzeichen `.,;:)` am Ende werden abgeschnitten. Gesucht wird beim Laden des Panels, solange der Prozess läuft und noch keine Adresse hat.
- **Exit-Code:**
  - `command`: `is_error` nicht gesetzt → 0; gesetzt und der Inhalt beginnt mit `Exit code <n>` → n; sonst unbekannt.
  - `process`: aus `summary` (`… exit code <n>`); bei `completed` ohne Zahl → 0.
- **Anhalten:** Die Steueranfrage `stop_task` mit der `task_id` gilt für Prozesse und Subagenten. **„Neu starten“ und „Erneut ausführen“ entfallen**, weil die Kommandozeile nichts dafür bietet und die App Befehle nicht selbst ausführt (AGENTS.md, Regel 5).
- **Subagent:** Typ aus `task_started.subagent_type`, Modell aus `tool_use_result.resolvedModel`, Werkzeugaufrufe aus `task_progress.usage.tool_uses`, Schritte aus seinen `tool_use`-Zeilen (Werkzeug + Ziel wie im Chat, höchstens die letzten 200). Das Ergebnis ist sein letzter Text; fehlt der, die `summary` der `task_notification`, wenn sie mit `completed` endet.
- **Scratchpad = Claudes eigener Ordner** aus `system/init.scratchpad_path` (belegt, bleibt über `--resume` gleich). Die App legt keinen eigenen an und schickt keinen Systemprompt-Zusatz. Der Core speichert den Pfad an der Session (Spalte `scratchpad_dir`) und gibt ihn für das Asset-Protokoll frei, sobald er ihn kennt, und beim App-Start für jede gespeicherte Session. Unbekannt (Agent lief noch nie) → das Panel sagt es in einem Satz.
- **Selbstständiges Aufwachen:** Kommt Ausgabe des Hauptagenten (Text, Gedankengang, Werkzeugaufruf, Aufgabenliste), während die Session `completed` oder `paused` ist und weder Pause noch Abbruch angefordert ist, wechselt sie auf `running`. Das behebt den Fall, dass der Agent nach dem Ende eines Subagenten oder Hintergrundprozesses von selbst weiterarbeitet und die Sidebar „Abgeschlossen“ zeigt. Bewusst **nicht** an `system/init` gekoppelt, weil unklar ist, ob `init` schon beim Prozessstart ohne Nachricht kommt.
- **Ruhe-Timer:** `reap_idle` beendet keinen Agenten, solange einer seiner Einträge `running` ist. Sonst stürbe der Dev-Server nach 30 Minuten still.
- **Ende des Agenten-Prozesses** (Absturz, Abbruch, Archivieren, Ruhe-Timer, Neustart, Wechsel des Denkaufwands): Alle laufenden Einträge werden `interrupted`. Ein Wechsel des Denkaufwands startet den Agenten neu (ADR 003) und unterbricht dabei laufende Prozesse; M2b schützt davor nicht.
- **Persistenz:** Tabelle `background_items` (Nutzlast als JSON wie `chat_entries`, Ausgabe getrennt in eigener Spalte). Beim Laden sind Einträge, die noch `running` stehen, von einem früheren App-Lauf und werden `interrupted`.
- **Aktualisieren:** Der Core sendet `background://changed` mit der Session-ID bei jeder Änderung eines Eintrags. Die Oberfläche lädt dann `background_load` neu. Die Ausgabe eines gewählten, laufenden Prozesses lädt sie alle 2 s nach. Den Scratchpad-Reiter lädt sie beim Öffnen und alle 5 s nach, solange er sichtbar ist und der Agent arbeitet (`starting`, `running`, `waiting`). Kein Dateisystem-Beobachter (Begründung wie ADR 006).

### Bewusst weggelassen (kein toter Knopf)

Die Abweichungen trägt Phase 5 ins Entwurfs-README ein:

- **`/`-Menü:** „Denken ein/aus“, „Zurückspulen“, „Verlauf exportieren“, „Datei aus dem Workspace erwähnen …“ (`@`) und `/artefakte`.
- **`+`-Menü:** „Screenshot aus der Zwischenablage“ (Ctrl+V bleibt), „Datei aus dem Workspace erwähnen …“ und „Artefakt dieser Session erwähnen …“.
- **Prozesse:** „Neu starten“, „Erneut ausführen“ und die Repository-Angabe in der Meta-Zeile (das Arbeitsverzeichnis eines Befehls ist nicht belegbar).
- **Platzhalter:** Er lautet „Nachricht an Claude … (/ für Skills)“ ohne „@ für Dateien“.

## Kontrakt

### Typen im Core

Alle mit `derive(Debug, Clone, Serialize, Deserialize, TS)` und `#[serde(rename_all = "camelCase")]` (Enums mit Nutzlast zusätzlich `tag = "kind"`, `rename_all_fields = "camelCase"`), eingetragen in `src-tauri/src/bin/gen-bindings.rs`. `Option<T>` wird in TypeScript `T | null`.

```rust
// src-tauri/src/agents/event.rs (Phase 1)
pub enum AttachmentKind { Image, File }                          // zusätzlich Copy, PartialEq, Eq
pub struct Attachment {
    pub id: String,            // UUID v4
    pub name: String,          // Dateiname, bereinigt (Phase 1)
    pub kind: AttachmentKind,
    pub size_bytes: u64,
    pub path: String,          // absolut: Zwischenordner, nach dem Senden <Workspace>\.anhaenge\<id>\<name>
}
// ChatEntry::User bekommt zwei Felder, beide mit #[serde(default)] (alte Einträge in der Datenbank haben sie nicht):
//   attachments: Vec<Attachment>          (Phase 1)
//   skill: Option<SkillRef>               (Phase 2)

// src-tauri/src/skills/model.rs (Phase 2)
pub enum SkillOrigin { User, Repository { name: String } }       // tag = "kind"; zusätzlich PartialEq, Eq
pub enum SkillKind { Skill, Command }                            // zusätzlich Copy, PartialEq, Eq
pub struct SkillInfo { pub name: String, pub description: String, pub kind: SkillKind, pub origin: SkillOrigin }
pub struct SkillRef { pub name: String, pub origin: SkillOrigin }

// src-tauri/src/background/model.rs (Phase 3)
pub enum BackgroundKind { Command, Process, Subagent }           // zusätzlich Copy, PartialEq, Eq
pub enum BackgroundState { Running, Completed, Failed, Stopped, Interrupted }  // zusätzlich Copy, PartialEq, Eq
pub struct SubagentStep { pub tool: String, pub target: String }
pub struct BackgroundItem {
    pub id: String,                    // task_id (process, subagent) bzw. tool_use_id (command)
    pub tool_use_id: String,           // verbindet den Eintrag mit der Werkzeug-Zeile im Chat
    pub kind: BackgroundKind,
    pub state: BackgroundState,
    pub title: String,                 // Befehl (command, process) bzw. Aufgabe = description (subagent)
    pub started_at: f64,               // ms seit Epoche
    pub ended_at: Option<f64>,
    pub exit_code: Option<i32>,        // command, process
    pub url: Option<String>,           // process
    pub output_file: Option<String>,   // process
    pub subagent_type: Option<String>, // subagent
    pub model: Option<String>,         // subagent, Modell-ID wie gemeldet
    pub tool_uses: u32,                // subagent
    pub steps: Vec<SubagentStep>,      // subagent, höchstens 200, älteste fallen weg
    pub result: Option<String>,        // subagent
}
pub struct SessionBackground { pub items: Vec<BackgroundItem>, pub scratchpad_dir: Option<String> }  // items nach started_at aufsteigend
pub struct TextPreview { pub text: String, pub truncated: bool, pub missing: bool, pub binary: bool }
pub struct ScratchpadEntry { pub path: String, pub is_dir: bool, pub size_bytes: u64, pub modified_ms: f64 }  // path relativ, Schrägstriche
pub struct ScratchpadListing { pub dir: Option<String>, pub entries: Vec<ScratchpadEntry>, pub truncated: bool }
pub struct BackgroundChangedEvent { pub session_id: String }

// src-tauri/src/error.rs (Phase 1): neue Variante
AttachmentsWhileWaiting   // #[error("Anhänge gehen erst, wenn die Rückfrage beantwortet ist")]
```

In TypeScript heißen die Enum-Werte `'image' | 'file'`, `'skill' | 'command'`, `{ kind: 'user' } | { kind: 'repository', name: string }`, `'command' | 'process' | 'subagent'`, `'running' | 'completed' | 'failed' | 'stopped' | 'interrupted'`.

### Tauri Commands (registriert in `src-tauri/src/lib.rs`)

| Command | Parameter | Rückgabe | Wrapper | Phase |
|---|---|---|---|---|
| `attachment_add_files` | `paths: Vec<String>` | `Vec<Attachment>` | `addAttachmentFiles(paths)` in `src/lib/attachments.ts` | 1 |
| `attachment_add_bytes` | `name: String`, `data_base64: String` | `Attachment` | `addAttachmentBytes(name, dataBase64)` | 1 |
| `attachment_discard` | `id: String` | `()` | `discardAttachment(id)` | 1 |
| `chat_send` (geändert) | + `attachment_ids: Vec<String>` | `()` | `sendMessage(sessionId, text, attachmentIds)` | 1 |
| `session_create` (geändert) | + `attachment_ids: Vec<String>` nach `task` | `SessionSummary` | `createSession(task, attachmentIds, repositoryIds, model, effort, mode)` | 1 |
| `skill_list_for_session` | `session_id: String` | `Vec<SkillInfo>` | `listSessionSkills(sessionId)` in `src/lib/skills.ts` | 2 |
| `skill_list_for_repositories` | `repository_ids: Vec<String>` | `Vec<SkillInfo>` | `listRepositorySkills(repositoryIds)` | 2 |
| `background_load` | `session_id: String` | `SessionBackground` | `loadBackground(sessionId)` in `src/lib/background.ts` | 3 |
| `background_output` | `session_id: String`, `item_id: String` | `TextPreview` | `loadBackgroundOutput(sessionId, itemId)` | 3 |
| `background_stop` | `session_id: String`, `item_id: String` | `()` | `stopBackgroundItem(sessionId, itemId)` | 3 |
| `scratchpad_list` | `session_id: String` | `ScratchpadListing` | `listScratchpad(sessionId)` | 3 |
| `scratchpad_read` | `session_id: String`, `path: String` | `TextPreview` | `readScratchpadFile(sessionId, path)` | 3 |

Ereignis `background://changed` mit `BackgroundChangedEvent`, Wrapper `onBackgroundChanged(callback)` in `src/lib/background.ts` (Phase 3).

### Oberfläche

```ts
// src/stores/attachments.ts (Phase 4)
export const NEW_SESSION_KEY = 'new-session';
// im State: pending: Record<string, Attachment[]>  (Schlüssel = Session-ID oder NEW_SESSION_KEY)
//           add(key, attachments), remove(key, id), clear(key), clearIds(key, ids)

// src/stores/sessions.ts (Phase 4): Umbenennen wandert aus dem lokalen Zustand der Sidebar hierher
// im State: renamingId: string | null, startRename(sessionId), stopRename()

// src/stores/background.ts (Phase 5)
export type BackgroundTab = 'processes' | 'subagents' | 'scratchpad';
export interface BackgroundSelection { processes: string | null; subagents: string | null; scratchpad: string | null }
// im State: isOpen: boolean, tab: BackgroundTab, selections: Record<string, BackgroundSelection>
//           toggle(), close(), showTab(tab), select(sessionId, tab, id), openItem(sessionId, item: BackgroundItem)
```

## Finale Abnahmekriterien

1. `+` öffnet das Menü nach Entwurf (330 px, Eintrag „Datei oder Bild anhängen …“ mit Ctrl U, Fußzeile „Bilder, PDFs, Text und Code gehen. Einfach ins Fenster ziehen oder mit Ctrl+V einfügen.“). Gewählte, hineingezogene und eingefügte Dateien erscheinen als Chips über dem Textfeld: Bilder mit Vorschaubild und Abmessungen, andere Dateien mit Symbol und Größe, jeweils mit ×. Gesendete Nachrichten zeigen ihre Anhänge weiter, auch nach einem App-Neustart.
2. Ein angehängtes PNG-Bild und ein angehängtes PDF werden vom Agenten gelesen (er beschreibt Inhalt bzw. Text). Eine angehängte `.md`-Datei liest er über ihren Pfad in `<Workspace>\.anhaenge\`.
3. `/` (Knopf) öffnet das volle Menü mit Filterfeld und den Abschnitten Kontext, Modell, Skills, Session. `/` am Anfang des leeren Felds öffnet nur Skills und Session-Befehle und filtert mit jedem Zeichen. ↑/↓/Enter wählen, Esc schließt, ohne die Session zu pausieren. Skills zeigen `/name`, Beschreibung und „Benutzer“ bzw. „aus <Repository>“.
4. Ein gesendeter Skill erscheint im Verlauf als farbige Marke mit der Zeile „Skill <name> geladen · …“; der Agent führt ihn aus.
5. „Neue Session“: Das Aufgabenfeld nimmt Anhänge an (`+`, Hineinziehen, Ctrl+V) und bietet über `/` die Skills des Benutzers und der gewählten Repositories an. Die erste Nachricht an den Agenten enthält Text und Anhänge.
6. Die Kopfzeile zeigt „Hintergrund“ bzw. „n im Hintergrund“ mit blauem Punkt; der Knopf öffnet und schließt das Panel (440 px) mit den Reitern Prozesse · Subagenten · Scratchpad nach Entwurf.
7. Ein vom Agenten gestarteter Dev-Server steht unter „Läuft“ mit Befehl, Adresse und Laufzeit. „Im Browser öffnen“ öffnet die Adresse, „Beenden“ hält ihn an (danach unter „Ausgeführt“ mit ✕ bzw. Status „angehalten“). Die Ausgabe erscheint im Detailbereich und wächst mit.
8. Vordergrund-Befehle des Agenten stehen unter „Ausgeführt“ mit ✓/✕, Exit-Code, Uhrzeit, Dauer und Ausgabe. „Ausgabe kopieren“ und „Im Chat besprechen“ funktionieren.
9. Subagenten stehen im Reiter „Subagenten“ mit Aufgabe, Typ, Modell, Werkzeugaufrufen, Dauer, Ergebnis und Schritten als `⎿`-Zeilen; ein laufender lässt sich anhalten.
10. Der Scratchpad-Reiter zeigt Claudes Scratchpad-Ordner der Session als Baum mit Größe und Uhrzeit, Vorschau für Text und Bilder, „Im Chat besprechen“ und „Im Explorer zeigen“.
11. Im Verlauf erscheinen Subagenten als „● Agent <Typ> <Aufgabe> · <Status> · n Aufrufe“ und Hintergrundprozesse als „● Bash im Hintergrund <Befehl> → <Adresse>“; ein Klick öffnet das Panel auf genau diesem Eintrag.
12. Arbeitet der Agent nach dem Ende eines Subagenten oder Hintergrundprozesses von selbst weiter, zeigt die Sidebar „Läuft“ und danach wieder „Abgeschlossen“.
13. `pnpm check` grün; ADR 007, Code-Map, Glossar, PROJECT.md, AGENTS.md, `commits.md` (Scopes) und Entwurfs-README (Tafel-Zuordnung, Abweichungen) beschreiben den tatsächlichen Stand.

## Smoke-Checkliste

Führt Sascha am Plan-Ende durch. Wackelstellen zuerst:

- [ ] **Große Anhänge und Neustart:** ein PDF mit etwa 9 MB und ein Bild mit etwa 3 MB anhängen und senden → der Agent antwortet zum Inhalt, im Protokoll (Fehlerkasten „Protokoll anzeigen“ bzw. `session_log`) kein Abbruch. Danach App beenden, neu starten, in derselben Session „Was stand im PDF?“ fragen → der Agent weiß es noch (Bild-/PDF-Blöcke überleben `--resume`). Zusätzlich ein Bild über 3,75 MB → geht als Pfad, der Agent liest es trotzdem.
- [ ] **Verwaiste Dev-Server:** Agent bitten, `pnpm dev` (oder einen anderen Dev-Server) im Hintergrund zu starten. Warten, bis „Läuft“ die Adresse zeigt, dann Session über ⋯ abbrechen. Eintrag zeigt „unterbrochen“. In PowerShell `netstat -ano | findstr :<port>` → ist der Port noch belegt, ist der Prozess verwaist; Befund in FINDINGS/GAPS eintragen.
- [ ] **Selbstständiges Aufwachen:** Agent bitten, einen Subagenten im Hintergrund eine Minute arbeiten zu lassen und sofort zu antworten. Die Sidebar steht auf „Abgeschlossen“; wenn der Subagent fertig ist und der Agent von selbst weiterschreibt, springt sie auf „Läuft“ und danach zurück.
- [ ] **Ruhe-Timer:** mit `VERWALTER_IDLE_SECONDS=60` starten, Dev-Server im Hintergrund starten lassen, zwei Minuten warten → der Agent läuft noch, der Server auch. Server beenden, zwei Minuten warten → der Agent wird beendet.
- [ ] Anhänge per `+`, per Hineinziehen (mehrere Dateien) und per Ctrl+V (Screenshot) → Chips erscheinen, × entfernt, Senden ohne Text mit nur einem Bild geht.
- [ ] Offene Rückfrage → `+` gesperrt, Hineinziehen tut nichts; nach der Antwort wieder frei.
- [ ] `/` am Feldanfang, `pla` tippen → nur passende Skills; Enter setzt `/plan ` ins Feld; Senden → Marke + „Skill plan geladen · aus deinem Benutzerordner“, der Agent folgt dem Skill.
- [ ] Session mit Repository, das `.claude\skills` hat → dessen Skills mit „aus <Repository>“; unter „Neue Session“ nach Anhaken des Repositorys ebenso.
- [ ] `/rename`, `/changes`, `/pause` aus dem Menü → Umbenennen startet in der Sidebar, Changes öffnet, Pause pausiert. Esc im offenen Menü pausiert **nicht**.
- [ ] Vordergrund-Befehl mit Fehler (Agent bitten, `node -e "process.exit(3)"` auszuführen) → „Ausgeführt“ zeigt ✕ und „Exit 3“.
- [ ] Laufenden Subagenten anhalten → Status „angehalten“, der Agent erwähnt die Unterbrechung.
- [ ] Scratchpad: Agent bitten, dort eine `.md`-Datei und ein PNG abzulegen → beide im Baum, Vorschau für beide, „Im Explorer zeigen“ öffnet den Ordner mit markierter Datei.
- [ ] Klick auf eine Subagent-Zeile bzw. „Bash im Hintergrund“-Zeile im Verlauf → Panel öffnet sich auf genau diesem Eintrag.
- [ ] Mit Tastatur: Tab erreicht `+`, `/`, Chips-×, Hintergrund-Knopf, Panel-Reiter, Listeneinträge und Aktionen; Fokus sichtbar (2 px Ring in Akzentfarbe).
- [ ] Rückstände aus M3 und M5 (Listen in deren Archiv-README, „Smoke-Checkliste“) im selben Durchgang abarbeiten.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
