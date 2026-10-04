# Changes-Review: Syntaxfarben und Zeilen-Kommentare an den Agenten

Ziel: Der Diff in der Changes-Ansicht zeigt Syntaxfarben je Sprache. Jede Diff-Zeile lässt sich über ein „+“ am Zeilenrand kommentieren (wie bei GitLab-Merge-Requests); die Kommentare werden nicht einzeln abgeschickt, sondern in der Eingabeleiste des Chats gesammelt und gehen mit der nächsten Nachricht gemeinsam an den Agenten — je Kommentar mit Datei, Zeilennummer und Codezeile.

Design (verbindlich): [docs/design/2026-10-01_changes-review/](../../design/2026-10-01_changes-review/README.md) — Quellen in `canvas/`, klickbare Fassung https://claude.ai/artifact/Vvb1M3AsZTgtq3jMcfrcca.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 006](../../decisions/006-changes-und-diff.md) (eigener virtualisierter Diff), [ADR 007](../../decisions/007-anhaenge-skills-hintergrund.md) (Anhänge: Vorbild für Daten, die an einer Nachricht hängen). ADR 015 entsteht in Phase 1 aus „Festgelegte Entscheidungen“.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Syntaxfarben im Diff, ADR 015 | [phase-1-syntaxfarben.md](phase-1-syntaxfarben.md) | standard | complete |
| 2 | Core: Typ `ReviewComment`, `chat_send` mit Kommentaren, Text an den Agenten | [phase-2-core.md](phase-2-core.md) | standard | complete |
| 3 | Kommentieren im Diff: Store, „+“, Kommentarfeld, gesammelte Kommentare, Zahl am Reiter | [phase-3-diff.md](phase-3-diff.md) | heikel | complete |
| 4 | Chat: Karten in der Eingabeleiste, Senden, Karten in der gesendeten Nachricht, Doku | [phase-4-chat.md](phase-4-chat.md) | standard | pending |

**Reihenfolge:** nach dem aktiven Plan „Sprachdiktat“ (STATE.md). Zum geparkten Plan „MCP-Dialog“ gibt es keine Abhängigkeit; beide fassen die Eingabeleiste an — dieser Plan setzt seinen Abschnitt **oben in den Rahmen der Eingabeleiste, vor die Anhänge**, also unabhängig von den Knöpfen in der unteren Leiste. Phasen strikt 1 → 2 → 3 → 4 (3 braucht die Typen aus 2). Umsetzung direkt auf `main`, ein Commit pro Phase, Commit-Scope `changes` (Phase 1) bzw. `review` (Phase 2–4; Phase 2 trägt ihn in [commits.md](../../conventions/commits.md) nach). Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` und die erzeugten Dateien mitcommitten. Erkenntnisse während der Umsetzung nach [FINDINGS.md](FINDINGS.md). Keine automatisierten Tests (Projektprofil); geprüft wird über die Smoke-Checkliste unten.

## Messungen (2026-10-01)

- `lowlight` (3.3, Sprachsatz `common`, schon Abhängigkeit über `rehype-highlight`) färbt 20.000 Zeilen Rust in ~100 ms, 400 Zeilen in ~4 ms (Node, gleiche V8 wie WebView2). Ein Diff hat höchstens 20.000 Zeilen (ADR 006) → einmal komplett färben beim Laden reicht, kein stückweises Färben.
- `lowlight.registered(<Dateiendung>)` erkennt direkt: `ts tsx js jsx mjs cjs rs py json md css scss html svg yml yaml toml sh sql kt cs go`; nicht: `ps1 cmd bat lock vue` → diese bleiben ungefärbt.

## Festgelegte Entscheidungen

Phase 1 schreibt daraus [ADR 015](../../decisions/015-changes-review.md) „Changes-Review: Syntaxfarben und Zeilen-Kommentare“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen). Vergeben sind 001–008, 010–012 auf der Platte, 009 im Plan „Sprachdiktat“, 013 im Plan „MCP-Dialog“ und 014 im Plan „Session-Changes“; dieser Plan schreibt 015. ADR 015 löst in [ADR 006](../../decisions/006-changes-und-diff.md) die Folge „Keine Syntaxfarben im Diff“ ab (sie war eine Folge der Entscheidung gegen Monaco, kein eigenes Verbot).

- **Syntaxfarben mit lowlight, je Abschnitt und Seite.** Die Sprache kommt aus der Dateiendung (`lowlight.registered`). Gefärbt wird je Abschnitt (zwischen zwei `@@`-Köpfen) die alte Seite (unverändert + gelöscht) und die neue Seite (unverändert + hinzugefügt) als zusammenhängender Text, dann zurück auf die Zeilen verteilt. Verworfen: (a) Zeile für Zeile färben — ein mehrzeiliger Kommentar oder String färbt dann nur seine erste Zeile; (b) die ganzen Dateien beider Fassungen laden — mehr Git-Aufrufe und Speicher für einen Gewinn nur am Abschnittsanfang. Die Farbzuordnung (`.hljs-*` → `--color-code-*`) wandert aus `CodeBlock.css` in eine gemeinsame `src/styles/syntax.css`.
- **Kommentare sammeln, nicht einzeln senden.** Ein Kommentar landet in einer flüchtigen Liste je Session (Zustand, wie Entwurfstext und Anhänge) und geht mit der nächsten Nachricht. Nach Neustart oder Absturz der App sind ungesendete Kommentare weg (Entscheidung Sascha, 2026-10-01). Verworfen: eigene SQLite-Tabelle — eine Phase mehr für einen seltenen Fall.
- **Ein Kommentar je Zeile.** Ein zweiter Klick auf eine kommentierte Zeile öffnet den vorhandenen Kommentar zum Bearbeiten. Kommentierbar: hinzugefügte, gelöschte und unveränderte Zeilen; nicht die Abschnittsköpfe. Nur Einzelzeilen, keine Bereiche (Entscheidung Sascha, 2026-10-01).
- **Zeile = Blickwinkel + Eintrag + Pfad + Seite + Nummer.** Seite „neu“ mit der neuen Nummer für hinzugefügte und unveränderte Zeilen, Seite „alt“ mit der alten Nummer für gelöschte. Der Blickwinkel gehört dazu, weil „Committed“ auf der neuen Seite den letzten Commit zeigt, „Alle“ das Arbeitsverzeichnis — dieselbe Nummer kann eine andere Zeile sein. Ein Kommentar erscheint im Diff nur im Blickwinkel, in dem er entstand; in der Eingabeleiste immer.
- **Kommentieren nur in der Changes-Ansicht einer Session.** In der Übersicht eines Vorhabens (Reiter „Changes“ ohne sichtbaren Chat) fehlt das „+“ — ein Kommentar dort würde unsichtbar in der neuesten Session landen.
- **Gesendet strukturiert, nicht als Text.** Die Kommentare hängen als Liste `comments` am Chat-Eintrag der Nachricht (wie `attachments`); der Chat zeigt sie als Karten. Den Text für den Agenten baut der Core beim Senden. Keine Migration: Chat-Einträge liegen als JSON in `chat_entries.payload`, das neue Feld hat `serde(default)`. Verworfen: Kommentare in die Nachricht hineinformatieren — der Verlauf zeigte dann rohen Markdown-Text.
- **Ort für den Agenten = absoluter Pfad.** Der Core löst den Eintrags-Schlüssel (`RepositoryChanges.key`) beim Senden in den Ordner auf (Haupt-Checkout, App-Worktree oder Ticket-Worktree) — dieselbe Prüfung wie `changes_file_diff`, dafür aus `commands/changes.rs` nach `changes/entry.rs` gezogen. Lässt sich ein Schlüssel nicht mehr auflösen (Worktree weg), nennt der Text `<Repository-Name>/<Pfad>` statt zu scheitern.
- **Während einer offenen Rückfrage keine Kommentare** — wie bei Anhängen ist die Antwort reiner Text. Neuer Fehler `CommentsWhileWaiting`.
- **Name:** Feature `review` in allen Schichten nach dem Namensschema der Code-Map (`src/features/review/`, `src/stores/review.ts`, `src-tauri/src/review/`); kein eigenes Command-Modul, die Kommentare reisen mit `chat_send`. In der Oberfläche „Review-Kommentare“.

## Kontrakt

### Typ (Rust, `src-tauri/src/review/model.rs`, derives und Attribute wie `Attachment` in `src-tauri/src/agents/event.rs`, in `src-tauri/examples/gen-bindings.rs` eintragen)

```rust
/// Ein Review-Kommentar zu einer Diff-Zeile der Changes-Ansicht; geht mit `chat_send` an den Agenten.
pub struct ReviewComment {
    /// `RepositoryChanges.key`: `"<Position>"` oder `"<Position>/<Ordner>"`.
    pub repository_key: String,
    /// `RepositoryChanges.name`, nur zur Anzeige und als Ersatz, wenn der Schlüssel nicht mehr auflösbar ist.
    pub repository_name: String,
    /// `FileChange.path`: relativ zum Repository bzw. Worktree, mit `/`.
    pub path: String,
    /// `Added`, `Deleted` oder `Context` — nie `Hunk`.
    pub kind: DiffLineKind,
    /// Neue Nummer; bei `Deleted` die alte.
    pub line: u32,
    /// Zeilentext ohne Vorzeichen, wie `DiffLine.text`.
    pub code: String,
    /// Der Kommentar, getrimmt, nicht leer.
    pub text: String,
}
```

TS (erzeugt): `ReviewComment = { repositoryKey: string, repositoryName: string, path: string, kind: DiffLineKind, line: number, code: string, text: string }`.

### Chat-Eintrag

`ChatEntry::User` bekommt hinter `skill` das Feld `#[serde(default)] comments: Vec<ReviewComment>` (TS: `comments: Array<ReviewComment>`). Einträge von vorher lesen sich mit leerer Liste.

### Command

`chat_send(session_id: String, text: String, attachment_ids: Vec<String>, comments: Vec<ReviewComment>)`. TS-Wrapper `sendMessage(sessionId, text, attachmentIds, comments: ReviewComment[])` in `src/lib/chat.ts`. Neue Fehler-Variante `CommandError::CommentsWhileWaiting` („Review-Kommentare gehen erst, wenn die Rückfrage beantwortet ist“); ein Kommentar mit `kind == Hunk` oder leerem `text` → `CommandError::Internal`.

### Text an den Agenten (`review::agent_text`)

Ohne Kommentare bleibt der Text unverändert. Mit Kommentaren (Zeilenumbrüche `\n`, `<n>` ab 1):

```text
<getippter Text, falls nicht leer>

Review-Kommentare zu den Changes (<Anzahl>):

<n>. <Ort>
<Zaun>
<Vorzeichen><code>
<Zaun>
<Kommentar>

<n+1>. …
```

- Der Leerzeilen-Absatz vor „Review-Kommentare“ entfällt, wenn der getippte Text leer ist; ein `/skill` am Anfang des getippten Texts bleibt damit am Anfang der Nachricht.
- **Ort:** aufgelöster Ordner vorhanden → `<Ordner>\<Pfad mit \>:<line>` für `Added`/`Context`, `<Ordner>\<Pfad mit \> — gelöschte Zeile, vorher Zeile <line>` für `Deleted`. Ordner nicht auflösbar → `<repository_name>/<path>` statt des Pfads, Rest gleich.
- **Vorzeichen:** `+ ` für `Added`, `- ` für `Deleted`, zwei Leerzeichen für `Context`.
- **Zaun:** Backticks, so viele wie die längste Backtick-Folge in `code` plus eins, mindestens drei.
- Anhänge-Pfadliste (`attachments::message_content`) folgt wie bisher hinter dem gesamten Text.

## Finale Abnahmekriterien

- Ein Diff einer `.ts`-, `.tsx`-, `.rs`- oder `.css`-Datei zeigt Syntaxfarben in Hell und Dunkel; mehrzeilige Kommentare und Strings sind über alle ihre Zeilen gefärbt; eine `.ps1`-Datei bleibt ungefärbt und fehlerfrei.
- In der Changes-Ansicht einer Session erscheint beim Überfahren oder Fokussieren einer Zeile (außer `@@`-Köpfen) das „+“; in der Changes-Ansicht der Vorhaben-Übersicht nicht.
- Kommentar schreiben, „Zum Chat hinzufügen“ (oder Strg+Enter): Karte unter der Zeile, Sprechblase am Rand, Zahl am Reiter „Chat“ steigt; Esc oder „Abbrechen“ verwirft das Feld.
- Gesammelte Kommentare stehen in der Eingabeleiste als Karten; Bearbeiten in der Karte, Entfernen einzeln und „Alle entfernen“ wirken auch zurück auf den Diff.
- Senden schickt Text, Kommentare und Anhänge als eine Nachricht; der Verlauf zeigt den Text und darunter die Karten; die gesammelte Liste ist danach leer, die Zahl am Reiter weg.
- Der Agent bekommt je Kommentar den absoluten Pfad mit Zeilennummer, die Codezeile und den Kommentar im Format des Kontrakts.
- Senden mit Kommentaren während einer offenen Rückfrage zeigt „Review-Kommentare gehen erst, wenn die Rückfrage beantwortet ist.“ und behält die Kommentare.
- Eine Session aus der Zeit vor diesem Plan lädt ihren Verlauf unverändert.

## Smoke-Checkliste (macht Sascha am Plan-Ende; Wackelstellen zuerst)

1. **Kommentarfeld in einem langen Diff** (Wackelstelle: virtualisierte Liste mit wachsender Zeile). Eine Datei mit > 2.000 geänderten Zeilen öffnen, bei Zeile ~1.500 das Feld öffnen, mehrere Zeilen tippen, das Feld mit dem Ziehgriff größer ziehen, weg- und zurückscrollen: keine überlappenden oder springenden Zeilen, Text und Fokusposition bleiben, unter dem Feld geht der Diff lückenlos weiter.
2. **Pfad beim Agenten** (Wackelstelle: Schlüssel → Ordner). Je einen Kommentar in einem Haupt-Checkout und — falls vorhanden — in einem Ticket-Worktree sammeln, senden mit „Wiederhole wörtlich die Ortsangaben aus meinen Review-Kommentaren.“: die Antwort nennt existierende absolute Pfade mit den richtigen Zeilennummern.
3. **Färbung verschachtelter Ausdrücke** (Wackelstelle: Abbildung der lowlight-Spans auf Zeilen). Ein TS-Diff mit Template-String `` `${a} text` `` über zwei Zeilen und ein TSX-Diff mit JSX: der String ist durchgehend in String-Farbe, `${a}` innen nicht; JSX-Tags sind lesbar gefärbt.
4. Ein Kommentar auf eine gelöschte Zeile: Karte zeigt „Zeile N (alt)“, die Codezeile mit `-` auf rotem Grund.
5. Kommentar im Blickwinkel „Alle“ sammeln, auf „Committed“ wechseln: dort keine Karte an der Zeile, in der Eingabeleiste weiterhin da.
6. Feld offen und Text getippt, andere Datei öffnen, zurück: Feld und Text sind wieder da.
7. Kommentar in der Eingabeleiste bearbeiten → im Diff steht der neue Text; im Diff entfernen → Karte in der Eingabeleiste weg.
8. Nur Kommentare, kein Text: Senden geht; mit Text: Text steht oben in der Blase.
9. Rückfrage des Agenten offen, Kommentare gesammelt, Senden: Fehlerzeile wie in den AK, Kommentare bleiben.
10. App neu starten: alte Nachrichten mit Kommentaren zeigen ihre Karten weiterhin; ungesendete Kommentare sind weg.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
