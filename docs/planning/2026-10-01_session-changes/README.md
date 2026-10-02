# Changes je Session: nur eigene Änderungen, am Vorhaben zusammengefasst

Ziel: Die Changes-Ansicht einer Session zeigt nur, was diese Session geändert hat: ihre eigenen Commits und die uncommitteten Dateien, die ihr Agent oder seine Subagenten geschrieben haben. Die Changes-Ansicht der Vorhaben-Übersicht zeigt die Summe aller Sessions des Vorhabens. Commits und Änderungen, die außerhalb entstanden sind (anderes Werkzeug, Hand, andere Vorhaben), erscheinen nicht. Bisher zeigt jede Session alles seit der Basis des Vorhabens ([ADR 006](../../decisions/006-changes-und-diff.md), [ADR 011](../../decisions/011-vorhaben-und-sessions.md)).

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 006](../../decisions/006-changes-und-diff.md) (drei Blickwinkel, nur Plumbing), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Haupt-Checkout, Ticket-Worktrees), [ADR 011](../../decisions/011-vorhaben-und-sessions.md) (Vorhaben und Sessions). ADR 014 entsteht in Phase 1 aus „Festgelegte Entscheidungen“.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Erfassen: Migration 8, eigene Commits und geschriebene Dateien je Session mitschreiben, ADR 014 | [phase-1-erfassung.md](phase-1-erfassung.md) | heikel | pending |
| 2 | Core-Anzeige: Changes und Diff nach Reichweite Session/Vorhaben, fremde Anteile markieren | [phase-2-zuordnung.md](phase-2-zuordnung.md) | heikel | pending |
| 3 | Oberfläche und Doku: Reichweite durchreichen, Hinweise, Glossar, Code-Map | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | pending |

**Reihenfolge:** nach dem aktiven Plan „Sprachdiktat“ (STATE.md) und **vor** dem geparkten Plan „Changes-Review“. Der Grund: Review-Kommentare sollen auf dem Diff entstehen, der nur die Änderungen der Session zeigt. Dieser Plan ändert die Signaturen von `changes_load`/`changes_file_diff` und `loadChanges`/`loadFileDiff`; die Folgen für „Changes-Review“ stehen dort in [FINDINGS.md](../2026-10-01_changes-review/FINDINGS.md). Zum Plan „MCP-Dialog“ gibt es keine Berührung. Phasen strikt 1 → 2 → 3. Umgesetzt wird direkt auf `main`, ein Commit pro Phase, Commit-Scope `changes`. Vor jedem Commit muss `pnpm check` grün sein; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` laufen lassen und die erzeugten Dateien mitcommitten. Erkenntnisse aus der Umsetzung gehören nach [FINDINGS.md](FINDINGS.md). Keine automatisierten Tests (Projektprofil); geprüft wird über die Smoke-Checkliste unten.

## Messungen und Belege (2026-10-01)

- **Zeitfenster trifft den Commit.** Gelesen aus `background_items` der App-Datenbank: der Befehl `git … add -A && git … commit` lief von 1790847743 bis 1790847743 (Sekunden, Start = Eingang des Werkzeugaufrufs in der App, Ende = Eingang des Ergebnisses). Der Commit `2f108e5` hat die Committer-Zeit 1790847743. Der Commit liegt also im Fenster, aber auf der Sekunde genau am Rand. Daraus folgen die Toleranzen in „Festgelegte Entscheidungen“.
- **Ausgabeformat** von `git rev-list --reverse --topo-order --no-merges --timestamp --parents <a>..HEAD` (Git 2.55): eine Zeile je Commit, `<Committer-Zeit in Sekunden> <Commit-ID> <Eltern-ID> [<weitere Eltern>]`.
- **Werkzeug-Ergebnisse von Subagenten** verwirft der Übersetzer heute komplett (`handle_user` in `agents/claude/translate.rs` kehrt bei `parent_tool_use_id` sofort zurück). Die Werkzeugaufrufe selbst kommen an (`SubagentStep` mit `used_paths`), aber ohne ID.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 014](../../decisions/014-changes-je-session.md) „Changes je Session: eigene Commits und geschriebene Dateien“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Vergeben sind 001–008 und 010–012 auf der Platte, 009 im Plan „Sprachdiktat“, 013 im Plan „MCP-Dialog“; dieser Plan schreibt **014**, danach vergeben „Changes-Review“ 015, „Claude Code mit lokalem Modell“ 016 und „Autarker Agent“ 017. ADR 014 löst in ADR 011 den Satz „Die Changes gehören dem Vorhaben: Ticket-Worktrees aller seiner Sessions erscheinen in den Changes jeder seiner Sessions“ ab und in ADR 006 die Definition der drei Blickwinkel gegen `base_commit`.

- **Eigene Commits erkennt die App am Zeitfenster.** Jeder Bash- oder PowerShell-Aufruf des Agenten oder eines Subagenten, dessen Befehl `git` enthält und der nicht im Hintergrund läuft, öffnet ein Fenster vom Eingang des Werkzeugaufrufs bis zum Eingang seines Ergebnisses. Wenn das Ergebnis da ist, liest die App in jedem Arbeitsordner der Session (Haupt-Checkout bzw. App-Worktree und benutzte Ticket-Worktrees) die Commits seit der Basis. Jeder Commit, dessen Committer-Zeit im Fenster liegt (Anfang 2 s früher, Ende 1 s später), gehört der Session. Verworfen wurde (a): die Commit-ID aus der Ausgabe von `git commit` lesen. Das erfasst kein `git merge`, keinen Rebase und keine Subagenten, deren Ergebnisse heute verworfen werden. Verworfen wurde auch (b): HEAD vor und nach dem Befehl vergleichen. Der Eingang des Werkzeugaufrufs ist nicht garantiert vor der Ausführung, und ein Rebase brächte Upstream-Commits mit. Das Zeitfenster erfasst Commit, Amend, Cherry-Pick, Rebase und Squash, weil Git dabei die Committer-Zeit auf jetzt setzt. Fremde Commits aus einem Rebase behalten ihre alte Zeit und fallen heraus.
- **Merge-Commits zählen nie** (`--no-merges`), weder als eigene noch als fremde. Ihr Diff gegen den ersten Elternteil wäre bei „main in den Ticket-Branch mergen“ der ganze Upstream. Die Commits eines gemergten Branches erscheinen trotzdem: sie liegen selbst im Bereich Basis..HEAD und sind einzeln eigene oder fremde Commits. Was nur in der Konfliktlösung eines Merge-Commits steckt, fehlt.
- **Uncommittete Änderungen gehören der Session, wenn ihr Agent die Datei geschrieben hat.** `Edit`, `Write`, `MultiEdit` und `NotebookEdit` des Agenten und seiner Subagenten werden mit dem normalisierten absoluten Pfad und der Uhrzeit festgehalten. Eine uncommittete Datei zählt zur Session, wenn sie dort steht **und** kein eigener Commit dieser Reichweite sie in derselben oder einer späteren Sekunde enthält. Ist sie danach committet worden, stammt neuer Schmutz nicht mehr von der Session. Was ein Shell-Befehl erzeugt (Formatierer, Code-Generator, `git mv`), erscheint erst als Commit. Verworfen: Schnappschüsse des Arbeitsverzeichnisses vor und nach jedem Befehl. Das sind Kosten bei jedem Befehl, und bei parallelen Sessions im selben Haupt-Checkout trotzdem falsch.
- **Diff aus verstreuten Commits je Datei.** Für eine Datei mit eigenen Commits gilt `from` = erster Elternteil des ersten eigenen Commits, der sie ändert, und `to` = letzter eigener Commit, der sie ändert (Reihenfolge `--topo-order`). „Committed“ = `from → to`, „Alle“ = `from → Arbeitsverzeichnis`, „Uncommitted“ = `HEAD → Arbeitsverzeichnis` wie bisher, nur gefiltert. Ändert ein fremder Commit dieselbe Datei zwischen erstem und letztem eigenen Commit („Committed“) bzw. nach dem ersten eigenen Commit oder liegt fremder Schmutz darin („Alle“), steckt das im Diff. Dann ist `LineStat.foreign = true` und der Diff zeigt einen Hinweis. Verworfen: die Patches der eigenen Commits einzeln aneinanderhängen. Das lässt sich nicht verlässlich zu einem Diff zusammensetzen.
- **Reichweite** (`ChangesReach`): `Session` = die Session allein, ihre eigenen Ticket-Worktrees. `Project` = alle Sessions des Vorhabens, alle ihre Ticket-Worktrees. Die Changes-Ansicht einer Session fragt `Session`, die der Vorhaben-Übersicht und deren Änderungssumme fragt `Project`. Ein Commit, den zwei parallel arbeitende Sessions im selben Fenster sehen, gehört beiden.
- **Ticket-Worktrees** werden weiter gegen ihre Abzweigung vom Standard-Branch gemessen (ADR 010), aber ebenfalls nur mit eigenen Commits. Das Merge-Gate sieht damit nicht mehr den ganzen Branch, sondern nur die Arbeit der Reichweite. Das ist bewusst so, denn genau das verlangt der Auftrag.
- **Kein Nachtragen.** Sessions aus der Zeit vor Migration 8 haben keine Aufzeichnung. Die Migration setzt ihnen `changes_tracked_at` auf den Zeitpunkt der Migration. Neue Sessions bleiben `NULL` (aufgezeichnet ab Anlegen). Die Ansicht nennt den Zeitpunkt, wenn eine Session der Reichweite einen hat. Verworfen: Nachtragen aus den Transkripten der Claude-Kommandozeile. Das wäre ein internes Dateiformat als neue Abhängigkeit, für einen Übergangsfall.
- **Zwischenspeicher für Unveränderliches.** Die Dateiliste eines Commits und die Zahlen `from → to` ändern sich nie, deshalb merkt sich der Core sie im Speicher (Obergrenzen siehe Phase 2). Diffs gegen das Arbeitsverzeichnis werden bei jedem Laden neu gelesen.
- **Name:** kein neues Feature. Alles gehört zu `changes` (`src-tauri/src/changes/history.rs`, `attribution.rs`, `scan.rs`), die Tabellen heißen `session_commits` und `session_files` mit gleichnamigen Dateien unter `src-tauri/src/db/`.

## Kontrakt

### Typen über die Tauri-Grenze (`src-tauri/src/changes/model.rs`)

```rust
/// Wessen Änderungen die Changes zeigen (ADR 014).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ChangesReach {
    /// Nur die Session: ihre eigenen Commits, ihre geschriebenen Dateien, ihre Ticket-Worktrees.
    Session,
    /// Alle Sessions des Vorhabens zusammen.
    Project,
}
```

- `LineStat` bekommt hinter `binary` das Feld `pub foreign: bool` mit dem Doc-Kommentar: „Der Diff enthält auch Änderungen von außerhalb der Reichweite (fremder Commit an derselben Datei oder fremde uncommittete Änderung). Unter Uncommitted immer `false`.“
- `RepositoryChanges.commit_count` behält Namen und Typ. Der Doc-Kommentar wird „Eigene Commits der Reichweite von der Basis bis `HEAD`, ohne Merge-Commits.“
- `SessionChanges` bekommt hinter `repositories` das Feld `pub untracked_before: Option<f64>` (Millisekunden seit 1970) mit dem Doc-Kommentar: „Gesetzt: mindestens eine Session der Reichweite stammt aus der Zeit vor der Aufzeichnung. Ihre Änderungen vor diesem Zeitpunkt fehlen.“

TS (erzeugt): `ChangesReach = "session" | "project"`, `LineStat.foreign: boolean`, `SessionChanges.untrackedBefore: number | null`.

### Commands und Wrapper

- `changes_load(session_id: String, reach: ChangesReach) -> SessionChanges`; TS `loadChanges(sessionId: string, reach: ChangesReach)`.
- `changes_file_diff(session_id: String, reach: ChangesReach, key: String, path: String, scope: ChangeScope) -> FileDiff`; TS `loadFileDiff(sessionId: string, reach: ChangesReach, key: string, path: string, scope: ChangeScope)`.
- Eine Datei, die in der Reichweite unter „Committed“ keine eigenen Commits hat → `CommandError::Internal("Die Datei hat keine eigenen Commits in dieser Ansicht")`.

### Agent-Ereignis (nur im Core, `src-tauri/src/agents/event.rs`)

```rust
/// Ein Bash- oder PowerShell-Aufruf mit `git` im Befehl ist beendet — vom Hauptagenten oder einem
/// Subagenten, nicht im Hintergrund. Zeiten in Millisekunden seit 1970, gemessen beim Eingang.
GitCommandEnded { started_at: f64, ended_at: f64 },
```

### Schema (Migration 8, `src-tauri/src/db/migrations/008_session_changes.sql`)

```sql
CREATE TABLE session_commits (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  commit_id  TEXT NOT NULL,
  PRIMARY KEY (session_id, commit_id)
) WITHOUT ROWID;

CREATE TABLE session_files (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  touched_at REAL NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN changes_tracked_at REAL;
UPDATE sessions SET changes_tracked_at = (julianday('now') - 2440587.5) * 86400000.0;
```

`session_files.path` ist normalisiert: `/` → `\`, Kleinbuchstaben, ohne Präfix `\\?\`, ohne abschließenden `\` (`changes::attribution::normalize_path`).

## Finale Abnahmekriterien

- Die Changes einer Session zeigen nur Dateien aus eigenen Commits und eigene geschriebene, noch uncommittete Dateien. Ein Commit, den Sascha währenddessen aus einem anderen Werkzeug im selben Repository macht, erscheint nicht.
- Die Changes der Vorhaben-Übersicht zeigen die Summe aller Sessions des Vorhabens. Die Änderungssumme in der Übersicht und die Zahl am Reiter „Changes“ passen dazu.
- Commits eines Subagenten zählen zur Session. Ein Rebase durch den Agenten ersetzt die alten Commits durch die neuen, und die Dateien bleiben in den Changes.
- Eine Datei, die ein fremder Commit zwischen zwei eigenen Commits geändert hat, trägt im Diff den Hinweis „… enthält auch Änderungen von außerhalb …“.
- Die Session-Ansicht zeigt eigene Ticket-Worktrees, die Vorhaben-Übersicht alle Ticket-Worktrees des Vorhabens.
- Eine Session aus der Zeit vor diesem Plan nennt in der Übersicht der Changes, seit wann aufgezeichnet wird, und lädt ihren Verlauf unverändert.
- Unter jeder „Übersicht“-Überschrift steht, was die Ansicht zeigt (nur diese Session bzw. alle Sessions des Vorhabens).

## Smoke-Checkliste (macht Sascha am Plan-Ende; Wackelstellen zuerst)

1. **Commit landet in der Session** (Wackelstelle: Zeitfenster am Sekundenrand). In einer neuen Session den Agenten eine Datei ändern und committen lassen, ein zweites Mal mit einem Subagenten („lass einen Subagenten die Datei X ändern und committen“). Beide Commits erscheinen unter „Committed“ der Session, die Zahl „N Commits“ in der Übersicht stimmt.
2. **Fremder Commit bleibt draußen** (Wackelstelle: Zuordnung im geteilten Haupt-Checkout). Während die Session ruht, in VS Code eine andere Datei im selben Repository committen: weder Session noch Vorhaben zeigen sie. Danach dieselbe Datei committen, die die Session schon geändert hat, und die Session sie noch einmal ändern und committen lassen. Der Diff dieser Datei zeigt unter „Committed“ den Hinweis auf fremde Änderungen.
3. **Ladezeit** (Wackelstelle: viele Git-Aufrufe je Laden). Changes der Vorhaben-Übersicht von „Spracheingabe“ öffnen, nachdem Phase 3 dort mehrere Commits gemacht hat: die Ansicht steht in unter 2 s und lädt beim 5-s-Takt ohne spürbares Ruckeln nach.
4. Uncommittete Änderung durch den Agenten (Edit) erscheint unter „Uncommitted“ der Session. Eine Datei, die Sascha von Hand ändert, erscheint nicht.
5. Nach einem Commit des Agenten ändert Sascha dieselbe Datei von Hand: sie erscheint nicht unter „Uncommitted“ der Session, unter „Alle“ trägt ihr Diff den Hinweis auf fremde Änderungen.
6. Zwei Sessions im selben Vorhaben, jede ändert eine andere Datei: jede Session-Ansicht zeigt nur ihre Datei, die Vorhaben-Übersicht beide.
7. Agent rebased einen Ticket-Branch auf `main`: die Dateien der Session bleiben im Ticket-Worktree-Eintrag sichtbar, Upstream-Commits erscheinen nicht.
8. Alte Session aus „Spracheingabe“ (vor Migration 8): Übersicht der Changes nennt „Erfasst seit …“, die Ansicht stürzt nicht und der Chat-Verlauf lädt.
9. Unter „Übersicht“ steht in der Session „Nur, was diese Session geändert hat.“, in der Vorhaben-Übersicht „Was die Sessions dieses Vorhabens geändert haben.“

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
