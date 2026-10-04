# 015 — Changes-Review: Syntaxfarben und Zeilen-Kommentare

**Status:** angenommen · **Datum:** 2026-10-01

## Kontext

Der Diff in der Changes-Ansicht ist einfarbig: Hinzugefügtes grün, Gelöschtes rot, sonst Grundfarbe. Wer einen Diff prüft, liest dadurch langsamer, als nötig wäre. Außerdem gibt es keinen Weg, dem Agenten eine Rückmeldung zu einer bestimmten Zeile zu geben, ohne Pfad und Zeilennummer von Hand in den Chat zu tippen. [ADR 006](006-changes-und-diff.md) hat den Diff als eigene virtualisierte Ansicht festgelegt; „Keine Syntaxfarben im Diff“ war dort eine Folge der Entscheidung gegen Monaco, kein eigenes Verbot.

Messungen (2026-10-01): `lowlight` 3.3 mit dem Sprachsatz `common` (schon Abhängigkeit über `rehype-highlight`) färbt 20.000 Zeilen Rust in rund 100 ms, 400 Zeilen in rund 4 ms (Node, dieselbe V8 wie WebView2). Ein Diff hat höchstens 20.000 Zeilen (ADR 006), also reicht einmaliges Färben beim Laden. `lowlight.registered(<Dateiendung>)` erkennt `ts tsx js jsx mjs cjs rs py json md css scss html svg yml yaml toml sh sql kt cs go`; nicht erkannt werden `ps1 cmd bat lock vue` — diese bleiben ungefärbt.

## Optionen

- **Färben:** (a) je Abschnitt und Seite als zusammenhängender Text; (b) Zeile für Zeile; (c) die ganzen Dateien beider Fassungen laden.
- **Kommentare halten:** (1) flüchtige Liste je Session im Zustand; (2) eigene SQLite-Tabelle.
- **Kommentare senden:** (i) strukturiert als Liste am Chat-Eintrag, Text für den Agenten baut der Core; (ii) in die Nachricht hineinformatiert.
- **Ort für den Agenten:** absoluter Pfad oder Repository-relativer Pfad.

## Entscheidung

- **(a) Syntaxfarben mit lowlight, je Abschnitt und Seite.** Die Sprache kommt aus der Dateiendung (`lowlight.registered`). Gefärbt wird je Abschnitt (zwischen zwei `@@`-Köpfen) die alte Seite (unverändert + gelöscht) und die neue Seite (unverändert + hinzugefügt) als zusammenhängender Text, dann zurück auf die Zeilen verteilt. Gegen (b): ein mehrzeiliger Kommentar oder String färbt dann nur seine erste Zeile. Gegen (c): mehr Git-Aufrufe und Speicher für einen Gewinn nur am Abschnittsanfang. Die Farbzuordnung (`.hljs-*` → `--color-code-*`) liegt in einer gemeinsamen `src/styles/syntax.css`, die Codeblöcke im Chat und der Diff teilen.
- **(1) Kommentare sammeln, nicht einzeln senden.** Ein Kommentar landet in einer flüchtigen Liste je Session (Zustand, wie Entwurfstext und Anhänge) und geht mit der nächsten Nachricht. Nach Neustart oder Absturz der App sind ungesendete Kommentare weg. Gegen (2): eine Phase mehr für einen seltenen Fall.
- **Ein Kommentar je Zeile.** Ein zweiter Klick auf eine kommentierte Zeile öffnet den vorhandenen Kommentar zum Bearbeiten. Kommentierbar sind hinzugefügte, gelöschte und unveränderte Zeilen, nicht die Abschnittsköpfe. Nur Einzelzeilen, keine Bereiche.
- **Zeile = Blickwinkel + Eintrag + Pfad + Seite + Nummer.** Seite „neu“ mit der neuen Nummer für hinzugefügte und unveränderte Zeilen, Seite „alt“ mit der alten Nummer für gelöschte. Der Blickwinkel gehört dazu, weil „Committed“ auf der neuen Seite den letzten Commit zeigt, „Alle“ das Arbeitsverzeichnis — dieselbe Nummer kann eine andere Zeile sein. Ein Kommentar erscheint im Diff nur im Blickwinkel, in dem er entstand; in der Eingabeleiste immer.
- **Kommentieren nur in der Changes-Ansicht einer Session.** In der Übersicht eines Vorhabens (Reiter „Changes“ ohne sichtbaren Chat) fehlt das „+“ — ein Kommentar dort würde unsichtbar in der neuesten Session landen.
- **(i) Gesendet strukturiert, nicht als Text.** Die Kommentare hängen als Liste `comments` am Chat-Eintrag der Nachricht (wie `attachments`); der Chat zeigt sie als Karten. Den Text für den Agenten baut der Core beim Senden. Keine Migration: Chat-Einträge liegen als JSON in `chat_entries.payload`, das neue Feld hat `serde(default)`. Gegen (ii): der Verlauf zeigte dann rohen Markdown-Text.
- **Ort für den Agenten = absoluter Pfad.** Der Core löst den Eintrags-Schlüssel (`RepositoryChanges.key`) beim Senden in den Ordner auf (Haupt-Checkout, App-Worktree oder Ticket-Worktree) — dieselbe Auflösung wie `changes_file_diff`. Lässt sich ein Schlüssel nicht mehr auflösen (Worktree weg), nennt der Text `<Repository-Name>/<Pfad>` statt zu scheitern.
- **Während einer offenen Rückfrage keine Kommentare** — wie bei Anhängen ist die Antwort reiner Text. Neuer Fehler `CommentsWhileWaiting`.
- **Name:** Feature `review` in allen Schichten nach dem Namensschema der Code-Map (`src/features/review/`, `src/stores/review.ts`, `src-tauri/src/review/`); kein eigenes Command-Modul, die Kommentare reisen mit `chat_send`. In der Oberfläche „Review-Kommentare“.

## Konsequenzen

- Diffs von Dateien mit unbekannter Endung (`.ps1`, `.cmd`, `.lock`, ohne Endung) bleiben ungefärbt; eine neue Sprache braucht nur einen Eintrag im Sprachsatz von lowlight.
- Gefärbt wird der ganze Diff einmal beim Laden (höchstens 20.000 Zeilen, rund 100 ms); ein Diff wird nicht stückweise nachgefärbt.
- Eine neue `.hljs-*`-Klasse in `syntax.css` muss in `COLORED_CLASSES` (`src/lib/syntax.ts`) eingetragen werden, sonst färbt der Diff sie nicht.
- Ungesendete Review-Kommentare überleben keinen Neustart; gesendete bleiben als Teil des Chat-Eintrags erhalten.
- Alte Chat-Einträge lesen sich mit leerer Kommentar-Liste, eine Session aus der Zeit vor diesem Plan lädt ihren Verlauf unverändert.
