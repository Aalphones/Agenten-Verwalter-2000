# Phase 5 — Verlauf als Graph, Nachrichtenvorschlag, Abschluss

Ziel: Die Übersicht rechts in den Changes zeigt je Eintrag ↓/↑ und den Verlauf des aktuellen Branches als Graph mit Branch- und Tag-Marken und eingehenden Commits; ✦ im Commit-Feld schlägt eine Nachricht vor. Danach Doku, Archivierung und Release.

## Kontext

- **Entwurf:** [git-werkzeuge.html](../../../design/2026-10-05_git-werkzeuge/git-werkzeuge.html) — `renderDetail` (Übersicht, Verlauf), `laneSvg` (Zeichnung einer Graph-Zeile, nur für den Entwurf mit fest verdrahteten Spuren — die App rechnet die Spuren, siehe unten), Knopf ✦ im Commit-Feld.
- [README.md](README.md): „Festgelegte Entscheidungen“ (Verlauf, Nachrichtenvorschlag), „Kontrakt“ (`GitLog`, `GitLogCommit`, `git_log`, `git_suggest_message`).
- `src/features/changes/ChangesOverview.tsx` (Übersicht heute: Überschrift, Reichweiten-Text, je Repository Name + Branch + Basis).
- `src-tauri/src/sessions/registry/tldr.rs` — `ask_haiku` (Einmal-Aufruf mit Haiku, Betriebsart prüfen, „Autark“ → Fehler), `find_claude`-Aufruf vor `ask_haiku`; `src-tauri/src/agents/claude/print.rs` — `PrintRequest`, `run_print`.
- `src/features/tldr/` — wie die Oberfläche „Autark“ für das TL;DR erkennt und den Knopf ausgraut (Muster übernehmen).
- [docs/conventions/releases.md](../../../conventions/releases.md) (Versions-Commit und Tag am Plan-Ende, AGENTS.md Regel 6).
- Fehlerklassen: Vault `werkzeuge/git.md` — „Negativbefund aus einer nicht aktualisierten Historie“: eingehende Commits sind nur so aktuell wie der letzte Fetch → Fetch-Knopf im Kopf des Verlaufs, Uhrzeit im Tooltip.

## AK der Phase

- **Übersicht (nur Reichweite Session):** je Eintrag-Zeile rechts `↓n ↑m` in `--color-accent-text` bzw. „synchron“ in `--color-fg-muted` (ohne Upstream: „nicht veröffentlicht“).
- **Verlauf** unter der Übersicht für den ersten Eintrag bzw. — bei gesetztem Repository-Filter — für den gefilterten: Kopf „VERLAUF · <Name>“ (12 px, Großbuchstaben, `--color-fg-secondary`) mit Fetch-Knopf rechts (Tooltip „Fetch — Remote abfragen, nichts ändern · Stand: HH:MM“). Gibt es eingehende Commits: gestrichelte Zeile „↓ N eingehende(r) Commit(s) auf <upstream>“ + Kurz-ID des neuesten + Knopf „Pull“ (bei `busy` ausgegraut). Darauf bis zu 50 Zeilen à 22 px: Graph-Spalte, Betreff (die erste Zeile fett), „diese Session“ in `--color-accent-text` 10.5 px bei `own`, Marken, Autor rechts gedimmt. Tooltip einer Zeile: Betreff, bei `!pushed` „ — noch nicht gepusht“.
- **Marken:** lokaler Branch → Pille gefüllt `--color-accent` mit Branch-Symbol; Remote-Branch → Rand `--color-border`, Wolken-Symbol; Tag → Rand, Text `--color-fg-muted`. `HEAD` und `<remote>/HEAD` erscheinen nicht.
- **Graph:** Spurabstand 10 px, erste Spur bei x = 9 px; Spurfarben zyklisch `--color-chart-1` … `--color-chart-7`; Punkt Radius 3.6 px gefüllt in Spurfarbe, nicht gepushte Commits als Ring (Radius 3.8 px, Rand 1.8 px `--color-accent`, Füllung `--color-bg-base`). Ein Merge-Commit zieht die Linie seines zweiten Elternteils als Kurve in die Nachbarspur; die Spur läuft bis zu dem Commit, der dieser Elternteil ist, und mündet dort als Kurve zurück. Keine Linie endet ohne Punkt, außer am unteren Rand nach dem 50. Commit.
- **✦** rechts oben im Commit-Feld (Symbol 14 px, Knopf 24 px): Tooltip „Nachricht vorschlagen lassen (nach docs/conventions/commits.md)“; Klick → Knopf dreht sich, danach steht der Vorschlag im Feld (ersetzt den Inhalt). Ausgegraut, wenn nichts angehakt ist oder die Betriebsart „Autark“ ist (Tooltip wie beim TL;DR in „Autark“). Fehler → Fehlerzeile „Vorschlag fehlgeschlagen: …“.
- `pnpm check` grün; Plan archiviert, Version angehoben, Tag gesetzt.

## Checkliste

### Core: Verlauf

- [x] `git/mod.rs` `log_graph(dir) -> String`: `log --topo-order -n 50 --format=%H%x00%P%x00%an%x00%at%x00%D%x00%s%x1e HEAD` über `run_raw`; `incoming(dir, upstream) -> String`: dasselbe Format mit `HEAD..<upstream>`.
- [x] `git/log.rs` `pub fn read(dir, own: &HashSet<String>, unpushed: &HashSet<String>, upstream: Option<&str>) -> Result<GitLog>`: Datensätze an `\x1e` trennen, Felder an `\0`; `parents` an Leerzeichen; `refs` aus `%D` an `, ` trennen, `HEAD -> x` → `x`, `HEAD` und `*/HEAD` weglassen, `tag: v1` → `tag: v1` unverändert durchreichen (die Oberfläche erkennt Tags am Präfix); `own` = in `own`; `pushed` = Upstream vorhanden und nicht in `unpushed`. `incoming` nur bei Upstream, `own: false`, `pushed: true`.
- [x] Command `git_log(session_id, key)`: `entry_dir`, `own` aus `changes_input(...).own.commits`, `unpushed`/`upstream` wie in `status.rs`. Registrieren, Wrapper `loadGitLog`.

### Core: Nachrichtenvorschlag

- [x] `ask_haiku` aus `sessions/registry/tldr.rs` nach `agents/claude/print.rs` verschieben (`pub fn ask_haiku<T: DeserializeOwned>(app, exe, system_prompt, json_schema, input) -> Result<T, String>`), TL;DR ruft ihn von dort; Verhalten unverändert. Der Fehlertext für „Autark“ wird zum Parameter `autark_message: &str` (TL;DR übergibt seinen bisherigen Satz).
- [x] `git/actions.rs` `suggest_input(dir, paths) -> Result<String>`: je Pfad `git::diff_index_patch(dir, "HEAD", path)`; leer und untracked → „Neue Datei <path>:“ + die ersten 200 Zeilen; alles verketten, auf 20 000 Zeichen kürzen (Hinweis „[gekürzt]“). Davor, falls `<dir>/docs/conventions/commits.md` existiert, „Konvention:\n<Inhalt, max. 8 000 Zeichen>\n\nDiff:\n“.
- [x] Command `git_suggest_message(session_id, key, paths)`: `find_claude` wie beim TL;DR, dann `ask_haiku` mit Systemprompt „Schreibe eine Commit-Nachricht für den folgenden Diff. Halte dich an die Konvention, falls angegeben, sonst an Conventional Commits. Betreff im Imperativ, höchstens 72 Zeichen. Einen Body nur, wenn der Betreff nicht reicht; jeder Absatz eine Zeile. Antworte nur mit der Nachricht.“, Schema `{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}`, Zeitlimit 60 s. Rückgabe `message` getrimmt. Registrieren, Wrapper `suggestGitMessage`.

### Oberfläche

- [x] `src/features/git/gitGraph.ts` — `layoutGraph(commits: GitLogCommit[]): GraphRow[]`, reine Funktion. Algorithmus (Zeilen neueste zuerst, `lanes: (string | null)[]` = erwartete nächste Commit-ID je Spur):
  1. `lane` = Index von `commit.id` in `lanes`; fehlt → erster `null`-Platz, sonst neue Spur am Ende.
  2. `mergingIn` = alle anderen Indizes mit `lanes[i] === commit.id`; diese Plätze auf `null` setzen.
  3. `lanesBefore` = Kopie von `lanes` vor Schritt 2 (für durchlaufende Linien oben).
  4. `lanes[lane] = parents[0] ?? null`.
  5. Für jeden weiteren Elternteil `p`: steht `p` schon in `lanes` an Index `j` → `branchingOut.push(j)`; sonst erster `null`-Platz (oder neue Spur) `k`, `lanes[k] = p`, `branchingOut.push(k)`.
  6. `lanesAfter` = Kopie von `lanes`; nachlaufende `null` am Ende abschneiden.
  `GraphRow = { lane, lanesBefore, lanesAfter, mergingIn, branchingOut, width }`, `width = 9 + 10 * max(lanesBefore.length, lanesAfter.length) + 6`.
- [x] `src/features/git/GraphCell.tsx` — SVG 22 px hoch: für jede Spur `i ≠ lane`, die in `lanesBefore` und `lanesAfter` belegt ist → senkrechte Linie oben→unten; Spur `lane`: Linie oben→Mitte, wenn `lanesBefore[lane] === commit.id`; Mitte→unten, wenn `lanesAfter[lane] !== null`; je `mergingIn` j: Kurve `M xj 0 C xj 11, xl 0, xl 11`; je `branchingOut` k: Kurve `M xl 11 C xl 22, xk 11, xk 22`; Punkt bzw. Ring nach den AK. Linienstärke 1.6 px, Farbe der Spur, in der die Linie liegt.
- [x] `src/features/git/GitHistory.tsx` (Kopf, eingehende Zeile, Zeilen, Marken) und `useGitLog(sessionId, key)` (lädt beim Mount, nach jeder Git-Aktion über denselben `reload`-Weg, nicht im 5-s-Takt).
- [x] `ChangesOverview.tsx`: bei `reach === 'session'` je Zeile die ↓/↑-Angabe und darunter `GitHistory`.
- [x] `GitCommitBox.tsx`: ✦-Knopf nach den AK.

### Doc-Updates und Abschluss

- [x] `docs/code-map.md`: Zeile „Git-Werkzeuge“ vollständig (Graph, Vorschlag, `ask_haiku` in `print.rs`); Zeile „TL;DR“ auf den neuen Ort von `ask_haiku`.
- [x] `docs/glossary.md`: „Verlauf (Git)“ — die letzten 50 Commits des ausgecheckten Branches mit eingehenden Commits aus dem Upstream.
- [x] ADR 025 auf Endstand prüfen; `docs/design/2026-10-05_git-werkzeuge/README.md` Status „umgesetzt in Plan Git-Werkzeuge, vX.Y.Z“.
- [x] Smoke-Checkliste aus der README an Sascha übergeben (Abgleich macht er).
- [x] Archivieren und Release nach `mode-implementing` und [releases.md](../../../conventions/releases.md): Plan nach `docs/archive/<YYYY-MM>/`, Bottom-Sektionen der README füllen, `STATE.md` nachziehen, Minor-Version in den drei Dateien anheben, `chore(release)`-Commit, Tag `vX.Y.Z` pushen.

## Report-Back

Umgesetzt wie geplant; Abweichungen siehe README, „Deviations from plan“. `pnpm check` grün. Die Oberfläche ist nur per Lint, Typecheck und Build geprüft, nicht im Browser gesehen.
