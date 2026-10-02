# Innere Repositories: Changes für Repositories in einem angehängten Ordner

Ziel: Hängt an einem Vorhaben ein Ordner, in dem weitere Git-Repositories liegen (Beispiel `C:\Users\smick\develop\easyfitness\facepass`: ein Dach-Repo, darin `app\`, `android\` … mit eigener Historie und ihre Ticket-Worktrees `app-wt-*`, `android-wt-*`, alle vom Dach-Repo per `.gitignore` ausgeblendet), zeigen die Changes, was die Sessions in diesen inneren Repositories und ihren Ticket-Worktrees committet und geschrieben haben. Heute zeigen sie dort nichts: Die App kennt nur das angehängte Dach-Repo, sucht eigene Commits nur dort und erwartet Ticket-Worktrees als `facepass-wt-*` neben ihm.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Ticket-Worktrees), [ADR 014](../../decisions/014-changes-je-session.md) (eigene Commits und Dateien), [ADR 018](../../decisions/018-ordner-ohne-git.md) (Ordner ohne Git). ADR 020 entsteht in Phase 1 aus „Festgelegte Entscheidungen“.

## Phasen

| # | Phase | Datei | Rating | Wave | Status |
|---|---|---|---|---|---|
| 1 | Erkennung: innere Repositories, ihre Ticket-Worktrees, Prüfprogramm, ADR 020 | [phase-1-erkennung.md](phase-1-erkennung.md) | heikel | 1 | complete |
| 2 | Changes: Einträge für innere Repositories, Schlüssel `<P>:<Ordner>`, Diff | [phase-2-changes.md](phase-2-changes.md) | heikel | 2 | complete |
| 3 | Commit-Suche in inneren Repositories, Doku, Abnahme | [phase-3-commits-doku.md](phase-3-commits-doku.md) | standard | 3 | pending |

**Reihenfolge:** vor allen geparkten Plänen (Fehler im Alltag). Phasen strikt 1 → 2 → 3: Phase 2 braucht die Erkennung aus 1, Phase 3 die Einträge aus 2; alle drei schreiben in `src-tauri/src/worktrees/mod.rs` bzw. `changes/`, parallel geht nichts. Umsetzung direkt auf `main`, ein Commit pro Phase, Commit-Scope `changes`. Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine Typen über die Tauri-Grenze ändern sich — `pnpm bindings` muss `src/lib/bindings/` unverändert lassen. Erkenntnisse nach [FINDINGS.md](FINDINGS.md). Keine automatisierten Tests (Projektprofil); jede Phase prüft sich mit dem Prüfprogramm `changes-probe` gegen eine **Kopie** der Datenbank, am Ende die Smoke-Checkliste.

**Schätzung:** Phase 1 ~1 h, Phase 2 ~2 h, Phase 3 ~1 h.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 020](../../decisions/020-innere-repositories.md) „Innere Repositories: Changes für Repositories in einem angehängten Ordner“. Vergeben sind 001–014, 018, 019 auf der Platte, 015–017 in geparkten Plänen; dieser Plan schreibt 020.

- **Inneres Repository** = direkter Unterordner eines angehängten Repositorys (`RepositoryCheckout::Main`) oder Ordners ohne Git (`RepositoryCheckout::Folder`), in dem `.git` ein **Ordner** ist. Unterordner mit `.git`-**Datei** sind Worktrees, keine inneren Repositories. Namen mit führendem `.` zählen nicht. Nur eine Ebene tief. Sessions mit App-Worktree (`RepositoryCheckout::AppWorktree`, vor ADR 010) bekommen keine. Verworfen: (a) Agenten-Aussagen oder `cd`-Befehle auswerten — unzuverlässig; (b) beliebig tief suchen — kostet bei großen Ordnern Sekunden und findet `node_modules`-Klone.
- **Ticket-Worktrees eines inneren Repositorys** liegen als `<inneres Repo>-wt-<Name>` **im angehängten Ordner**, also neben dem inneren Repository (Muster facepass). Erkannt wie bisher am Text der Werkzeug-Aufrufe (`mentioned_ticket_worktrees`), gespeichert wie bisher in `session_ticket_worktrees` als `(Position des angehängten Ordners, Ordnername)` — **keine Migration**. Ob ein gespeicherter Ordner ein Ticket-Worktree des angehängten Repos oder eines inneren ist, entscheidet sein Präfix (`ticket_root_of`, längstes passendes Präfix gewinnt).
- **Erkennung beim Anlegen, Laden und jedem Agent-Start.** `worktrees::ticket_roots` liest dazu je angehängtem Ordner einmal das Verzeichnis. Der Agent-Start (`start_process`) rechnet sie neu, damit ein später geklontes inneres Repository erkannt wird; das ist ein Dateisystem-Zugriff unter der Session-Sperre wie `worktrees::ensure` an derselben Stelle.
- **Auch rückwirkend aus geschriebenen Dateien.** Die Ticket-Worktrees einer Reichweite sind die gemerkten **plus** die, die in den Pfaden der geschriebenen Dateien (`session_files`) vorkommen (`changes::sources::scope_ticket_folders`). So zeigen laufende Sessions ihre offenen Dateien in inneren Ticket-Worktrees sofort. Eigene Commits vor dieser Änderung bleiben unbekannt (ADR 014: kein Nachtragen).
- **Basis eines inneren Repositorys** = letzter Commit vor dem Beginn der Reichweite auf dem First-Parent-Pfad von `HEAD` (wie `main_checkout_since`): in der Reichweite „Session“ der Anlegezeitpunkt der Session, in „Vorhaben“ der des Vorhabens, in der Commit-Suche der der Session. Gibt es davor keinen Commit: der ausgecheckte Stand. Ergebnis im Speicher zwischengespeichert je (Ordner, Sekunde).
- **Ein inneres Repository erscheint nur, wenn es etwas zeigt**: Dateien oder eigene Commits, oder die Reichweite hat darin eine Datei geschrieben (dann auch mit Fehler). Grund: facepass hat acht innere Repositories, die meisten unberührt (AGENTS.md Regel 1). Ticket-Worktrees innerer Repositories erscheinen wie die bisherigen, sobald sie zur Reichweite gehören.
- **Neue Schlüsselform `"<Position>:<Ordner>"`** für ein inneres Repository (Ordner = sein Name) und für einen Ticket-Worktree eines inneren Repositorys (Ordner = Worktree-Ordner); beide liegen direkt im angehängten Ordner. Die bisherigen Formen `"<Position>"` und `"<Position>/<Ordner>"` bleiben unverändert. Die Oberfläche behandelt Schlüssel als undurchsichtig — sie ändert sich nicht.
- **Eine Stelle löst Schlüssel auf:** `changes::sources::sources` baut alle Einträge einer Reichweite (Schlüssel, Name, Repository, Ticket-Worktree), `changes::load`, `changes_file_diff` und die Commit-Suche benutzen sie. Der Diff akzeptiert nur Schlüssel, die `sources` für dieselbe Reichweite liefert — ein Ordner aus der Oberfläche wird so nie ungeprüft zum Pfad (AGENTS.md Regel 5).
- **Anzeigenamen:** inneres Repository `"<angehängter Name>/<innerer Ordner>"` (z. B. `facepass/app`), sein Ticket-Worktree `"<angehängter Name>/<innerer Ordner> · <Worktree-Ordner>"` (z. B. `facepass/app · app-wt-gymid-2288`).
- **Ordner ohne Git mit inneren Repositories:** der Ordner selbst bleibt in `plain_folders` ohne Eintrag (ADR 018), seine inneren Repositories bekommen Einträge. Das ändert die Folge in ADR 018 „`git` läuft für ihn nie“ in „`git` läuft nie im Ordner selbst, nur in seinen inneren Repositories“.
- **Keine neuen Freigaben** (`--allowedTools`): innere Repositories und ihre Ticket-Worktrees liegen im angehängten Ordner, der schon per `--add-dir` freigegeben ist.

## Kontrakt

### Typen und Funktionen in `src-tauri/src/worktrees/mod.rs` (Phase 1)

```rust
pub struct TicketRoot {
    pub position: u32,
    /// `<Ordner>-wt-` in ASCII-Kleinbuchstaben.
    pub prefix: String,
    /// `None`: Ticket-Worktrees des angehängten Repositorys, neben ihm. `Some(<Ordnername>)`:
    /// Ticket-Worktrees dieses inneren Repositorys, im angehängten Ordner.
    pub inner: Option<String>,
}

/// Namen der inneren Repositories von `folder`, aufsteigend ohne Rücksicht auf Groß/Klein.
pub fn inner_repositories(folder: &Path) -> Vec<String>;

/// Je Repository (Main): Wurzel `inner: None` plus je inneres Repository eine; je Ordner ohne Git:
/// nur die inneren; App-Worktrees: keine. Liest je Repository einmal das Verzeichnis.
pub fn ticket_roots(repositories: &[SessionRepository]) -> Vec<TicketRoot>;

/// Die Wurzel an `position`, deren Präfix `folder` am Anfang trägt (ASCII ohne Groß/Klein); bei
/// mehreren die mit dem längsten Präfix.
pub fn ticket_root_of<'a>(roots: &'a [TicketRoot], position: u32, folder: &str) -> Option<&'a TicketRoot>;

/// Inneres Repository als `SessionRepository` (`checkout: Main`, Name = `folder`) mit Basis vor `since_ms`.
pub fn inner_checkout(outer: &SessionRepository, folder: &str, since_ms: f64) -> Result<SessionRepository, CommandError>;

/// Wie `ticket_worktrees`, aber die Worktree-Ordner liegen in `parent` statt neben dem Haupt-Checkout.
pub fn ticket_worktrees_in(repository: &SessionRepository, position: u32, folders: &[String], parent: &Path) -> Vec<TicketWorktree>;
```

### Typen und Funktionen in `src-tauri/src/changes/sources.rs` (Phase 2)

```rust
/// Ein Eintrag der Changes-Ansicht, bevor Git seine Dateien liest.
pub struct Source {
    /// `RepositoryChanges.key`: `"<P>"`, `"<P>/<Ordner>"` oder `"<P>:<Ordner>"`.
    pub key: String,
    pub name: String,
    /// Wogegen gemessen wird; bei inneren Repositories aus `inner_checkout`.
    pub repository: SessionRepository,
    pub ticket: Option<TicketWorktree>,
    /// Ordner, in dem Git liest: Ticket-Worktree, sonst `repository.working_dir(workspace)`.
    pub dir: PathBuf,
    /// Nur innere Repositories: entfällt in `changes::load`, wenn es nichts zeigt (siehe Entscheidungen).
    pub optional: bool,
    /// Basis nicht bestimmbar; der Eintrag trägt dann diesen Fehler.
    pub error: Option<String>,
}

pub fn sources(input: &ChangesInput) -> Vec<Source>;
pub fn find(input: &ChangesInput, key: &str) -> Result<Source, CommandError>;
pub fn scope_ticket_folders(roots: &[TicketRoot], remembered: Vec<(u32, String)>, touched: &HashMap<String, f64>) -> Vec<(u32, String)>;
```

### `ChangesInput` (Phase 2, `src-tauri/src/changes/mod.rs`)

```rust
pub struct ChangesInput {
    pub workspace: PathBuf,
    pub repositories: Vec<SessionRepository>,
    /// Woran die Ticket-Worktrees zu erkennen sind; aus `SessionState.ticket_roots`.
    pub ticket_roots: Vec<TicketRoot>,
    /// Die Ticket-Worktrees der Reichweite als `(Position, Ordner)`, aus `scope_ticket_folders`.
    pub ticket_folders: Vec<(u32, String)>,
    /// Beginn der Reichweite in ms; Basis der inneren Repositories.
    pub since_ms: f64,
    pub own: Ownership,
}
```

## Finale Abnahmekriterien

- Gegen eine Kopie der Datenbank vom 2026-10-02 zeigt `changes-probe` für Session `a6357b9c-e08c-411a-9fcc-62a88321300a` (Reichweite Session) einen Eintrag `facepass/app · app-wt-gymid-2288` mit den uncommitteten, von ihr geschriebenen Python-Dateien, für Session `dd292f1c-4a58-4804-8cdc-0533ca2c1314` einen Eintrag `facepass/android · android-wt-gymid-799` mit `TimedSessionActivity.kt`; kein unberührtes inneres Repository erscheint.
- Ein Diff einer solchen Datei lädt über den Schlüssel `0:app-wt-gymid-2288`; ein erfundener Schlüssel (`0:..`, `0:fremder-ordner`, `0:app-wt-gibtsnicht`) wird abgewiesen.
- Ein Commit, den ein Agent nach dem Update in einem inneren Ticket-Worktree macht, erscheint in den Changes seiner Session (Smoke 1).
- Vorhaben ohne innere Repositories zeigen dieselben Einträge mit denselben Schlüsseln wie vorher.
- `pnpm check` grün; `pnpm bindings` ändert nichts.

## Smoke-Checkliste (macht Sascha am Plan-Ende; Wackelstellen zuerst)

1. **Neuer Commit in einem inneren Ticket-Worktree** (Wackelstelle: Commit-Suche über Präfix-Zuordnung). In einer FacePass-Session den Agenten bitten, in `app-wt-gymid-2288` eine Kleinigkeit zu committen: Reiter „Changes“ der Session zeigt `facepass/app · app-wt-gymid-2288` mit dem Commit und der Datei unter „Committed“.
2. **Dauer des Nachladens** (Wackelstelle: acht innere Repositories je Takt). Changes einer FacePass-Session offen lassen: Die Ansicht lädt alle 5 s ohne sichtbares Stocken; Wartezeit nach dem Öffnen unter 2 s.
3. **Vorhaben-Übersicht → Changes** für FacePass: zeigt die inneren Einträge aller Sessions zusammen.
4. Eine Datei in einem inneren Eintrag anklicken: Diff erscheint, in allen drei Blickwinkeln.
5. Ein Vorhaben ohne innere Repositories (z. B. dieses Repo): Changes unverändert.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
