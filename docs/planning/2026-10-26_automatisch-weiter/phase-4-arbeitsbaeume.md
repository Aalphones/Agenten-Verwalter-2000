# Phase 4 — Arbeitsbäume über die geschriebenen Dateien finden

Rating: standard · Modell: Sonnet · Commit: `fix(changes): Arbeitsbäume über die geschriebenen Dateien finden`, danach Plan-Abschluss und Release (Minor-Version, von Phase 3 hierher verschoben)

Fehler: Die Changes-Ansicht zeigt einen Arbeitsbaum nur, wenn er `<Repo>-wt-<Name>` heißt **und neben** dem Repository liegt (`worktrees::ticket_worktrees`, `parent.join(folder)`; für innere Repositories im angehängten Ordner). Der Arbeitsbaum des Arbeitsbereichs-Repos `facepass` liegt aber **innerhalb** von `facepass` (`facepass\facepass-wt-session-workflow`) — er fällt still weg, die Ansicht zeigt `master ← master, 0 Commits`. Jede andere Lage oder Benennung scheitert genauso. Diese Phase ersetzt die Erkennung über Namen und Lage durch eine über die Dateien, die die Session geschrieben hat.

## Kontext

Lesen: [README](README.md) (Rahmen), [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeile „Changes“), [ADR 006](../../decisions/006-changes-und-diff.md) und [ADR 020](../../decisions/020-innere-repositories.md) (Abschnitt über Ticket-Worktrees), [docs/conventions/](../../conventions/).

Bestand (gelesen 2026-10-26, per Grep neu finden):

- `src-tauri/src/worktrees/mod.rs`: `ticket_roots` (Namens-Präfix je Repository), `mentioned_ticket_worktrees` (Namen im Text), `ticket_worktrees` und `ticket_worktrees_in` (prüfen gegen `git worktree list`, erwarten `parent.join(folder)`), `ticket_base`, `same_dir`, `inner_repositories`.
- `src-tauri/src/changes/sources.rs`: `sources` (baut die Einträge, sortiert `ticket_folders` nach Wurzel in `sibling` und `inner_folders`), `inner_sources`, `scope_ticket_folders` (gemerkte Namen plus Namen in den Pfaden aus `own.touched`).
- `src-tauri/src/changes/mod.rs`: `ChangesInput` (`ticket_roots`, `ticket_folders`), `load_ticket`, `base_of`.
- `src-tauri/src/sessions/registry.rs`: `changes_input` (~1547, ruft `scope_ticket_folders` **außerhalb** der Session-Sperre), `note_ticket_worktrees` (~2782, liest nur Text unter der Session-Sperre — dort kommt kein Dateisystem und kein Git hinzu), `remember_ticket_worktree`.
- `src-tauri/src/sessions/registry/commit_scan.rs` nutzt dieselben Felder — beim Ändern von `ChangesInput` mitziehen (der Compiler meldet es).
- `src-tauri/src/changes/attribution.rs`: `Ownership.touched` (normalisierter absoluter Pfad → ms), `normalize_path`.

## Entscheidung

**Ein Arbeitsbaum wird an seiner Struktur erkannt, nicht an seinem Namen.** Ein verknüpfter Arbeitsbaum hat in seiner Wurzel eine **Datei** `.git` mit der Zeile `gitdir: <Haupt-Repo>/.git/worktrees/<Name>`; ein normales Repository hat dort einen **Ordner**. Daraus folgt für jede Datei, die die Session geschrieben hat: nächster Elternordner mit `.git`-Datei → Wurzel des Arbeitsbaums; `gitdir`-Zeile ohne `/.git/worktrees/<Name>` → Haupt-Repository. Das Haupt-Repository wird mit `repository_path` des Session-Repositorys (oder eines inneren) verglichen (`same_dir`). Kein Git-Aufruf, nur Dateisystem — Kosten: ein Ordner-Aufstieg je geschriebene Datei, mit Zwischenspeicher je Ordner.

Der bisherige Weg über Namen bleibt daneben bestehen: er findet auch Arbeitsbäume, in die noch nichts geschrieben wurde. Beide Wege münden in dieselbe Prüfung gegen `git worktree list` (Pfad statt `parent.join(folder)`) und werden nach `normalized_dir` entdoppelt.

Verworfen: nur Befehlstext (`git worktree add …`) auswerten — Schreibweise, Quoting und `git -C` machen das fragil, und der Arbeitsbaum ist erst durch geschriebene Dateien für die Ansicht relevant.

## Kontrakt

```rust
// src-tauri/src/worktrees/mod.rs
/// Ein Arbeitsbaum, den die Dateien der Session verraten (Phase 4).
#[derive(Debug, Clone)]
pub struct DiscoveredWorktree {
    /// Position des Session-Repositorys, zu dem sein Haupt-Repository gehört.
    pub position: u32,
    /// `Some(<Ordnername>)`, wenn das Haupt-Repository ein inneres Repository des angehängten Ordners ist.
    pub inner: Option<String>,
    pub path: PathBuf,
}

/// Wurzel und Haupt-Repository des verknüpften Arbeitsbaums, in dem `file` liegt; `None` bei einem
/// normalen Repository, ohne Git, oder wenn die `.git`-Datei nicht lesbar ist. Nur Dateisystem.
pub fn linked_worktree_of(file: &Path) -> Option<(PathBuf, PathBuf)>

/// Die Arbeitsbäume, die `touched` verrät und die zu einem der Session-Repositories gehören.
pub fn discover(repositories: &[SessionRepository], touched: &HashMap<String, f64>) -> Vec<DiscoveredWorktree>
```

`ChangesInput.discovered: Vec<DiscoveredWorktree>` (neu, gefüllt in `changes_input` außerhalb der Sperre aus `own.touched`). `worktrees::ticket_worktrees_at(repository, position, paths: &[PathBuf]) -> Vec<TicketWorktree>` — wie `ticket_worktrees_in`, prüft aber `entry.path` gegen den **gegebenen Pfad**; `TicketWorktree.folder` = letzter Pfadbestandteil. Schlüssel der Einträge bleiben `"<P>/<Ordner>"` und `"<P>:<Ordner>"`; `find` löst sie weiter über `sources` auf.

## AK

1. Ein Arbeitsbaum **innerhalb** des Ordners seines Repositories (`facepass\facepass-wt-x`) erscheint in der Changes-Ansicht der Session, die darin Dateien geschrieben hat — mit Branch, Commits gegen die Abzweigung vom Standard-Branch und Dateiliste.
2. Ein Arbeitsbaum mit **beliebigem Namen** an beliebiger Stelle erscheint, sobald die Session darin eine Datei geschrieben hat und `git worktree list` ihn führt.
3. Bestehendes bleibt: ein `app-wt-…` im angehängten Ordner und ein `<Repo>-wt-…` neben dem Repository erscheinen wie bisher, nie doppelt.
4. Ein von Hand gelöschter Arbeitsbaum, dessen `.git`-Datei noch in einem Pfad der Session steht, erzeugt keinen Fehler, nur keinen Eintrag.
5. Unter der Session-Sperre kommt kein Dateisystem- und kein Git-Zugriff hinzu (`note_ticket_worktrees` unverändert).
6. `pnpm check` grün.

## Checkliste

### Core

- [ ] `worktrees/mod.rs`: `DiscoveredWorktree`, `linked_worktree_of` (Aufstieg über die Elternordner der Datei bis zum ersten Ordner, in dem `.git` eine **Datei** ist; Inhalt `gitdir: …` lesen, `/worktrees/<Name>` abschneiden, `/.git` abschneiden; Pfade mit `native_path` und `same_dir` vergleichen, Schrägstriche beachten), `discover` (je geschriebene Datei einmal, Ergebnis je Ordner zwischenspeichern; Haupt-Repository gegen `repository_path` jedes Session-Repositorys und gegen `repository_path.join(inner)` für `inner_repositories` prüfen), `ticket_worktrees_at`.
- [ ] `changes/mod.rs`: `ChangesInput.discovered`; `changes/sources.rs`: in `sources` und `inner_sources` die gefundenen Pfade neben den Namens-Treffern auflösen, entdoppeln nach `normalized_dir`.
- [ ] `registry.rs` `changes_input` und `commit_scan.rs`: `discovered` aus `own.touched` bauen (außerhalb der Sperre, direkt hinter `scope_ticket_folders`).
- [ ] `pnpm bindings` nur, falls sich ein `derive(TS)`-Typ geändert hat (erwartet: nein).

### Doku und Abschluss

- [ ] `docs/code-map.md` Zeile „Changes“: Erkennung über `.git`-Datei; ADR 020 (bzw. der Abschnitt dort, der die Erkennung über `<Repo>-wt-` beschreibt): Satz ersetzen, nicht anhängen.
- [ ] Prüfung am echten Fall (Projektstand: keine automatisierten Tests): eine Session mit dem Repo `facepass` im Hauptbaum, ein Arbeitsbaum darin (`git worktree add facepass-wt-probe -b probe`), eine Datei darin schreiben → Eintrag erscheint; einen zweiten Arbeitsbaum mit Namen ohne `-wt-` anlegen und ebenso prüfen; danach beide mit `git worktree remove` entfernen. 🟡 Unsicher: ob `own.touched` auch Dateien füllt, die der Agent per Shell-Befehl schreibt, nicht nur per Edit/Write. Check: in einem der Arbeitsbäume eine Datei per `Set-Content` schreiben und nachsehen; erscheint sie nicht, ist das ein benannter offener Punkt im Report-Back, kein Grund, den Befehlstext zu parsen.
- [ ] `pnpm check` grün, Commit.
- [ ] Plan archivieren nach `docs/archive/2026-10/2026-10-26_automatisch-weiter/` (Bottom-Sektionen der README füllen), `STATE.md` nachziehen, Release nach [releases.md](../../conventions/releases.md): nächste freie Minor-Version (`v0.33.0` ist schon vergeben — `git tag --list "v0.*" --sort=-v:refname` prüfen), `chore(release)`-Commit, Tag, Push.

## Report-Back
