# Git-Werkzeuge in den Changes

Ziel: Die Bedienung von „Source Control“ aus VS Code im Verwalter — Branch sehen und wechseln, Commit, Push, Pull, Fetch, dazu Verwerfen, Stash, Merge, Rebase, Branch löschen und ein Verlauf als Graph. Alles sitzt im Reiter „Changes“ einer Session, je Eintrag (Repository, Ticket-Worktree, inneres Repository); die Kopfzeile bekommt nur eine Branch-Pille.

**Design (verbindlich):** [docs/design/2026-10-05_git-werkzeuge/](../../design/2026-10-05_git-werkzeuge/README.md) — `git-werkzeuge.html` im Browser öffnen, Schalter „Neues markieren“ zeigt, was neu ist. Abgenommen am 2026-10-05. Wo die Umsetzung abweichen muss, wird erst der Entwurf geändert, dann der Code.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 006](../../decisions/006-changes-und-diff.md), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md), [ADR 014](../../decisions/014-changes-je-session.md), [ADR 020](../../decisions/020-innere-repositories.md). ADR 025 entsteht in Phase 1 (024 ist an den Plan „MCP-Anmeldung“ vergeben).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core liest: Branch, Upstream, ↓/↑, fremde Änderungen, eigene Commits, Sperre; Commands und Bindings | [phase-1-status-lesen.md](phase-1-status-lesen.md) | heikel | complete |
| 2 | Core schreibt: Commit (auch „& Push“, Ergänzen), Push, Pull, Fetch, Branch wechseln und anlegen, Konflikt-Zustand | [phase-2-commit-und-sync.md](phase-2-commit-und-sync.md) | heikel | complete |
| 3 | Oberfläche: Branch-Pille, Repository-Zeile, Commit-Feld, Häkchen, fremde Änderungen, Gruppen, Hinweis, Branch-Menü, Dialoge | [phase-3-oberflaeche.md](phase-3-oberflaeche.md) | standard | complete |
| 4 | Weitere Befehle: Verwerfen, Stash, Pull mit Rebase, Merge, Branch löschen, Ticket-Worktree anlegen, Explorer/VS Code — Core und Oberfläche | [phase-4-weitere-befehle.md](phase-4-weitere-befehle.md) | standard | complete |
| 5 | Übersicht mit ↓/↑ und Verlauf als Graph; Nachrichtenvorschlag ✦; Doku, Release | [phase-5-verlauf-und-vorschlag.md](phase-5-verlauf-und-vorschlag.md) | standard | pending |

**Reihenfolge:** strikt 1 → 5. Nach Phase 3 ist der Kern benutzbar (Commit, Push, Pull, Wechseln); 4 und 5 ergänzen. Umsetzung direkt auf `main`, ein Commit pro Phase, Scope `git`. Vor jedem Commit `pnpm check` grün; `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Bindings nach Änderungen an Typen über die Tauri-Grenze neu erzeugen (`pnpm bindings`) und mitcommitten. Keine neuen Abhängigkeiten. Erkenntnisse nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 025](../../decisions/025-git-werkzeuge.md) „Git-Werkzeuge in den Changes“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen).

- **Ort:** Git-Bedienung nur in den Changes einer **Session** (Reichweite `session`). Die Changes der Vorhaben-Übersicht (Reichweite `project`) bleiben unverändert — ein Commit dort wüsste nicht, welcher Session er gehört. Verworfen: eigenes Panel rechts (erster Entwurf, zeigte dieselben Dateien doppelt).
- **Feature-Name `git`** in allen Schichten: `src-tauri/src/git/` (bleibt der einzige Ort, der `git` startet; neue Dateien `model.rs`, `status.rs`, `actions.rs`, `log.rs` neben `mod.rs`), `src-tauri/src/commands/git.rs`, `src/lib/git.ts`, `src/features/git/`, `src/stores/git.ts`. `git` wird in der Code-Map vom Querschnitt zum Feature.
- **Adressierung:** jeder Befehl nimmt `session_id` und `key` (`RepositoryChanges.key`) und löst den Ordner über `changes::sources::find` auf — wie `changes_file_diff`. Nie einen Pfad aus der Oberfläche annehmen.
- **Sperre:** Befehle, die Dateien im Arbeitsordner ändern (Branch wechseln, Pull, Pull mit Rebase, Verwerfen, Stash anlegen/zurückholen, Merge), sind gesperrt, solange **irgendeine Session desselben Vorhabens** im Status `Starting`, `Running` oder `Waiting` ist — alle Sessions eines Vorhabens teilen die Ordner. Der Core prüft das in jedem dieser Befehle selbst (Fehler `CommandError::Git("Gesperrt: …")`), die Oberfläche graut nur aus. Frei bleiben: Commit, Ergänzen, Push, Fetch, Branch anlegen ohne Wechsel (Ticket-Worktree), Branch löschen, Status, Verlauf.
- **Commit nimmt genau die angehakten Pfade:** `git add -A -- <pfade>` und `git commit -F - --only -- <pfade>` (Nachricht über die Standardeingabe). Andere schon gestagte Dateien bleiben unberührt. Angehakt sind anfangs die eigenen uncommitteten Dateien der Session; fremde nur, wenn man sie bewusst anhakt. Die Häkchen leben nur im UI-Zustand (`src/stores/git.ts`), nicht in Git (kein Staging-Bereich in der Oberfläche).
- **Ein Commit aus der App gehört der Session:** nach dem Commit schreibt der Core die neue Commit-ID mit `db::session_commits::insert_all` für diese Session. Ohne das verschwänden die Dateien aus den Changes, weil `attribution::is_open` nur eigene Commits als „committet“ erkennt (ADR 014).
- **Ergänzen (Amend)** nur, wenn `HEAD` nicht im Upstream liegt (`git merge-base --is-ancestor HEAD @{u}` ≠ 0 oder kein Upstream); leere Nachricht → `--no-edit`.
- **Push** ohne Upstream: `git push -u <remote> <branch>`, `<remote>` = `origin`, sonst der einzige Remote; kein Remote → Fehler „Kein Remote eingerichtet“. Liegt etwas zum Holen vor (`behind > 0`), fragt die Oberfläche „Pull, dann Push“, statt einen abgelehnten Push zu provozieren.
- **Pull:** `git pull --no-rebase` (Merge-Commit, wenn nötig). Konflikte lässt Git im Arbeitsordner stehen; der Status meldet dann `operation: merge` mit den Konflikt-Dateien, die Oberfläche zeigt eine Zeile „Merge mit Konflikten · In VS Code öffnen · Merge abbrechen“ (`git merge --abort`). Entsprechend `rebase` mit „Rebase abbrechen“ (`git rebase --abort`). Diese Zeile ist nicht im Entwurf — sie ist die einzige freihändige Ergänzung (Gestaltung wie der Sperr-Hinweis, Farbe `--color-status-waiting`).
- **Fetch:** von Hand (⋯-Menü und Knopf im Verlauf), automatisch nach erfolgreichem Pull/Push, und einmal je Eintrag beim ersten Öffnen der Changes einer Session pro App-Lauf. Kein Zeitgeber. Der Tooltip an ↓/↑ nennt die Uhrzeit des letzten Fetch dieses App-Laufs („Stand vom letzten Fetch: 14:32“ bzw. „noch kein Fetch in dieser Sitzung“) — ↓/↑ sind ohne Fetch beliebig alt.
- **Anmeldung:** Git läuft wie heute ohne Konsole mit `GIT_TERMINAL_PROMPT=0`. Auf dieser Maschine ist `credential.helper=manager` (Git Credential Manager, eigenes Fenster) gesetzt — Push/Pull über HTTPS melden sich darüber an. Ohne Anmeldemöglichkeit liefert Git einen Fehler, den die Oberfläche als Satz zeigt.
- **Index-Sperre:** Läuft gerade ein Git-Befehl des Agenten, kann ein schreibender Befehl an `index.lock` scheitern. Der Core wiederholt einen schreibenden Befehl einmal nach 500 ms, wenn der Fehlertext `index.lock` enthält; danach Fehler „Git ist gerade beschäftigt — gleich noch einmal versuchen.“
- **Branch wechseln mit offenen Änderungen:** Dialog „Abbrechen · Mitnehmen · Beiseitelegen und wechseln“. Mitnehmen = `git switch <branch>` (scheitert Git, kommt sein Satz); Beiseitelegen = `git stash push -u -m "verwalter: vor Wechsel auf <branch>"`, dann `git switch`. Remote-Branch `origin/x` → `git switch --track origin/x`; existiert `x` lokal schon → `git switch x`. Ein Branch, der in einem anderen Worktree ausgecheckt ist, ist im Menü gesperrt.
- **Neuer Branch:** Name per `git check-ref-format --branch <name>` prüfen, dann `git switch -c <name>` vom aktuellen `HEAD`. „Neuer Branch als Ticket-Worktree“ (Phase 4) legt `<Haupt-Checkout>-wt-<name mit / → ->` neben dem Haupt-Checkout an und merkt ihn der Session (`db::session_ticket_worktrees`), damit er als eigener Eintrag erscheint; nur am Eintrag eines Haupt-Checkouts angeboten.
- **Nachrichtenvorschlag ✦ (Phase 5):** Einmal-Aufruf über `agents::claude::print::run_print` mit Haiku wie das TL;DR; Eingabe = Diff der angehakten Pfade, gekürzt auf 20 000 Zeichen, plus der Inhalt von `docs/conventions/commits.md` des Eintrags, falls vorhanden. In der Betriebsart „Autark“ ausgegraut wie das TL;DR.
- **Verlauf (Phase 5):** nur der aktuelle Branch, die letzten 50 Commits ab `HEAD`, dazu eingehende Commits (`HEAD..@{u}`) als eigene Zeile. Kein Schalter „alle Branches“.
- **Branch-Pille:** Branch des ersten Eintrags, `↓n`/`↑n` falls ungleich 0, Punkt bei uncommitteten Änderungen (eigene oder fremde), `+N` bei weiteren Einträgen mit Git; Tooltip listet alle Einträge. Klick öffnet die Changes.

## Kontrakt

### Typen (Rust, `src-tauri/src/git/model.rs`, `derive(TS)`, in `gen-bindings.rs` eintragen)

```rust
pub enum GitOperation { None, Merge, Rebase }

pub struct GitBusySession { pub id: String, pub number: u32, pub name: String }

pub struct GitForeignFile { pub path: String, pub kind: ChangeKind, pub added: u32, pub deleted: u32, pub binary: bool }

pub struct GitOwnCommit {
    pub id: String,            // volle ID
    pub short_id: String,      // 7 Zeichen
    pub subject: String,
    pub pushed: bool,          // im Upstream enthalten; ohne Upstream false
    pub files: Vec<String>,    // relativ, mit '/'
}

pub struct GitEntryStatus {
    pub key: String,
    pub branch: Option<String>,        // None = losgelöster HEAD
    pub upstream: Option<String>,      // z. B. "origin/main"
    pub remote: Option<String>,        // Ziel für Push ohne Upstream
    pub ahead: u32,
    pub behind: u32,
    pub operation: GitOperation,
    pub conflicted: Vec<String>,
    pub foreign: Vec<GitForeignFile>,  // uncommittet, aber nicht von der Reichweite
    pub commits: Vec<GitOwnCommit>,    // eigene Commits seit der Basis, neueste zuerst
    pub head_pushed: bool,             // für „Ergänzen“
    pub last_fetch_ms: Option<f64>,    // letzter erfolgreicher Fetch in diesem App-Lauf (Phase 2 füllt es; Phase 1: None)
    pub error: Option<String>,
}

pub struct GitSessionStatus {
    pub entries: Vec<GitEntryStatus>,  // Reihenfolge wie SessionChanges.repositories
    pub busy: Vec<GitBusySession>,     // Sessions des Vorhabens in Starting/Running/Waiting
}

pub struct GitBranch { pub name: String, pub remote: bool, pub current: bool, pub worktree: Option<String> /* Ordnername, wenn anderswo ausgecheckt */ }

pub enum GitSwitchMode { Plain, Stash }

pub struct GitLogCommit {
    pub id: String, pub short_id: String, pub parents: Vec<String>, pub author: String,
    pub time: i64, pub subject: String, pub refs: Vec<String> /* aus %D, ohne "HEAD -> " */,
    pub own: bool, pub pushed: bool,
}

pub struct GitLog { pub commits: Vec<GitLogCommit>, pub incoming: Vec<GitLogCommit> }
```

`ChangeKind` aus `changes::model`. Alle Felder `camelCase` über `serde(rename_all)`.

### Commands (`src-tauri/src/commands/git.rs`, alle `async`, in `lib.rs` registrieren)

| Command | Parameter | Ergebnis | Phase |
|---|---|---|---|
| `git_status` | `session_id` | `GitSessionStatus` | 1 |
| `git_branches` | `session_id, key` | `Vec<GitBranch>` | 1 |
| `git_commit` | `session_id, key, paths: Vec<String>, message: String, push: bool, amend: bool` | `()` | 2 |
| `git_push` / `git_pull` / `git_fetch` | `session_id, key` | `()` | 2 |
| `git_switch` | `session_id, key, branch, mode: GitSwitchMode` | `()` | 2 |
| `git_create_branch` | `session_id, key, name` | `()` | 2 |
| `git_abort_operation` | `session_id, key` | `()` | 2 |
| `git_discard` | `session_id, key, path` | `()` | 4 |
| `git_stash_push` / `git_stash_list` / `git_stash_pop` | `session_id, key` (+ `index: u32` bei pop) | `()` / `Vec<String>` / `()` | 4 |
| `git_pull_rebase` | `session_id, key` | `()` | 4 |
| `git_merge` | `session_id, key, branch` | `()` | 4 |
| `git_delete_branch` | `session_id, key, branch, force: bool` | `()` | 4 |
| `git_create_ticket_worktree` | `session_id, key, name` | `()` | 4 |
| `git_open` | `session_id, key, target: GitOpenTarget (Explorer \| VsCode)` | `()` | 4 |
| `git_log` | `session_id, key` | `GitLog` | 5 |
| `git_suggest_message` | `session_id, key, paths` | `String` | 5 |

Fehler immer `CommandError` (`Git(String)` mit Git-Satz bzw. eigenem Satz). `git_delete_branch` ohne `force` auf einem nicht gemergten Branch → `CommandError::Git` mit Präfix `not-merged:` — die Oberfläche bietet dann „Trotzdem löschen“.

## Finale AK (Gesamtergebnis)

- In einer Session mit Repository `verwalter` zeigt die Kopfzeile hinter dem Status die Branch-Pille; ein Klick öffnet die Changes.
- In den Changes trägt jeder Git-Eintrag rechts Branch-Knopf, ↓n, ↑n, ⋯; darunter Commit-Feld und „Commit · N Dateien“.
- Eine vom Agenten geschriebene Datei ist angehakt; Commit mit Nachricht → sie verschwindet aus „Uncommitted“, erscheint unter „Committed“ mit „noch nicht gepusht“, ↑ zählt eins hoch. Push → ↑ 0, Markierung weg.
- Eine von Hand im Ordner geänderte Datei erscheint unter „N weitere Änderungen im Ordner — nicht von dieser Session“, nicht angehakt; angehakt und committet → sie ist im Commit.
- Während der Agent antwortet: Branch-Wechsel, Pull und Verwerfen sind ausgegraut, der Hinweis steht über dem Dateibaum; „Pausieren“ hebt die Sperre auf. Der Core lehnt dieselben Befehle ab, auch wenn die Oberfläche sie schickt.
- Branch-Wechsel mit offenen Änderungen fragt; „Beiseitelegen und wechseln“ legt einen Stash an.
- Die Übersicht zeigt je Eintrag ↓/↑ und für das erste Repository den Verlauf als Graph mit Branch- und Tag-Marken.
- `pnpm check` grün.

## Smoke-Checkliste (Abnahme durch Sascha am Plan-Ende)

Wackelstellen zuerst:

1. **Commit, während der Agent selbst Git benutzt** — in einer Session den Agenten „committe deine Änderungen“ ausführen lassen und gleichzeitig in den Changes eine fremde Datei committen. Erwartet: beide Commits entstehen; schlimmstenfalls kommt einmal „Git ist gerade beschäftigt“, der zweite Versuch klappt.
2. **Push/Pull mit Anmeldung** — in einem Repository, für das der Git Credential Manager noch nichts gespeichert hat, Push auslösen. Erwartet: das Anmeldefenster des Credential Managers erscheint, danach geht der Push durch; kein Hängen.
3. **Graph bei Merges** — in einem Repository mit Merge-Commits den Verlauf ansehen. Erwartet: Linien laufen ohne Lücken in den Merge hinein, keine Linie endet im Nichts.
4. Branch wechseln ohne Änderungen, mit Änderungen (beide Wege), auf einen Remote-Branch.
5. Neuen Branch anlegen; ungültigen Namen (`a..b`) → Satz statt Absturz.
6. Pull mit Konflikt (zwei Klone, dieselbe Zeile) → Zeile „Merge mit Konflikten“, „Merge abbrechen“ stellt den Stand wieder her.
7. Ergänzen auf einem ungepushten Commit; auf einem gepushten ausgegraut.
8. Verwerfen einer eigenen und einer fremden Datei (auch einer neuen, untracked).
9. Stash anlegen und zurückholen; Merge eines Branches; Branch löschen (gemergt, nicht gemergt mit „Trotzdem löschen“).
10. Ticket-Worktree anlegen → erscheint als eigener Eintrag in den Changes.
11. ✦ schlägt eine Nachricht im Format von `docs/conventions/commits.md` vor; in „Autark“ ausgegraut.
12. Vorhaben-Übersicht → Changes: keine Git-Bedienung (unverändert).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
