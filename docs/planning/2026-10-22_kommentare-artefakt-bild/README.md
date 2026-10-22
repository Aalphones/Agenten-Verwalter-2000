# Kommentare an Artefakt und Bild

Ziel: Review-Kommentare gibt es heute nur an Diff-Zeilen. Künftig lassen sich auch ein **Element in einem Artefakt** und ein **Bereich auf einem angehängten Bild** kommentieren. Alle drei Arten landen in derselben Liste der Eingabeleiste, haben dieselben Karten (mit einer Marke für die Art) und gehen mit der nächsten Nachricht an den Agenten. Entwurf: [artifacts/entwurf-kommentare-artefakt-bild.html](artifacts/entwurf-kommentare-artefakt-bild.html), vom User am 2026-10-22 freigegeben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Review-Kommentare“, „Artefakte“, „Anhänge“), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 015](../../decisions/015-changes-review.md) (Review-Kommentare), [ADR 026](../../decisions/026-artefakte.md) (Artefakt-Server und Sandbox). Fehlerklassen geprüft (Vault: TypeScript, React, Claude Code): keine einschlägig; für Rust, Tauri und WebView2 gibt es keine Einträge.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Kommentar-Ziel im Typ, Prüfung, Text an den Agenten, Bild erneut mitsenden; ADR 035 | [phase-1-core.md](phase-1-core.md) | standard | complete |
| 2 | Oberfläche: Karten, Liste und Store für alle drei Arten | [phase-2-karten.md](phase-2-karten.md) | standard | complete |
| 3 | Artefakt: Skript-Brücke im Server, Knopf „Kommentieren“, Markierung und Kommentarfeld | [phase-3-artefakt.md](phase-3-artefakt.md) | heikel | complete |
| 4 | Bild: Bildansicht mit Bereich aufziehen, Einstieg über die Anhang-Chips; Doku-Abschluss | [phase-4-bild.md](phase-4-bild.md) | standard | pending |

**Reihenfolge:** strikt 1 → 4. Umsetzung direkt auf `main`, ein Commit pro Phase; Scope `review` (Phase 3 `artifacts`, Phase 4 `attachments`). Vor jedem Commit `pnpm check` grün; `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine neuen Abhängigkeiten. Nach Änderungen an Typen über die Tauri-Grenze `pnpm bindings` und mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Erkenntnisse nach [FINDINGS.md](FINDINGS.md). Planabschluss mit Versions-Tag (Minor-Version) nach [releases.md](../../conventions/releases.md).

## Festgelegte Entscheidungen

- **Element statt Pixel beim Artefakt.** Der Agent ändert HTML, also nennt der Kommentar Datei, CSS-Pfad und Anfang des Elements. Kein Bildschirmfoto des Artefakts.
- **Brücke per `postMessage`.** Der Artefakt-Server hängt an jede HTML-Antwort ein kleines Skript an. Es bleibt passiv, bis der Verwalter den Kommentiermodus einschaltet, und meldet dann den Klick per `window.parent.postMessage`. Der Verwalter nimmt nur Nachrichten an, deren `event.source` das `contentWindow` des eigenen Rahmens ist und die das Kennzeichen `verwalter` tragen; die Herkunft ist bei der Sandbox immer `"null"` und wird nicht geprüft. Alle Felder sind fremde Daten: nur Zeichenketten, gekürzt, nie als HTML gerendert.
- **Kommentiermodus nur in der Session-Ansicht**, nicht in der Übersicht des Vorhabens (`currentSessionId === null`) und nicht im Vollbild.
- **Bereich in Bild-Pixeln** des Originalbilds, ganzzahlig. Ein kommentiertes Bild geht mit der Nachricht als Bild an den Agenten: liegt es unter den Anhängen dieser Nachricht, ohnehin; stammt es aus einer früheren Nachricht, legt `send` es erneut als Bild-Block bei (nur an den Agenten, nicht in den Chat-Eintrag).
- **Eine Liste, ein Store.** Alle Arten leben in `useReviewStore.collected`; die Art steckt im Feld `target` des `ReviewComment`. Alte Chat-Einträge ohne `target` gelten als Diff-Kommentar.
- **Überschrift an den Agenten:** „Review-Kommentare zu den Changes (N):“ bleibt, solange alle Kommentare Diff-Kommentare sind; sonst „Review-Kommentare (N):“.

## Kontrakt

Rust, `src-tauri/src/review/model.rs` (camelCase, `derive(TS)`):

```rust
/// Woran ein Review-Kommentar hängt (ADR 035). Fehlt das Feld in alten Einträgen, ist es ein Diff-Kommentar.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum CommentTarget {
    /// Zeile im Diff; Ort steht in den übrigen Feldern von `ReviewComment`.
    #[default]
    Diff,
    /// Element in einem Artefakt des Vorhabens.
    Artifact {
        /// Dateiname relativ zum Ordner `.artefakte`, mit `/`.
        file: String,
        /// CSS-Pfad des Elements, höchstens 300 Zeichen.
        selector: String,
        /// Sichtbarer Text des Elements, gekürzt auf 80 Zeichen, für die Karte.
        label: String,
    },
    /// Rechteck auf einem angehängten Bild.
    Image {
        /// Kennung des Anhangs (`Attachment.id`).
        attachment_id: String,
        /// Absoluter Pfad des Bilds zum Zeitpunkt des Kommentars.
        path: String,
        name: String,
        x: u32, y: u32, width: u32, height: u32,
        image_width: u32, image_height: u32,
    },
}
```

`ReviewComment` bekommt als erstes Feld `#[serde(default)] pub target: CommentTarget`. Für Artefakt- und Bild-Kommentare gilt: `repository_key = ""`, `repository_name = ""`, `kind = DiffLineKind::Context`, `line = 0`; `path` = Dateiname des Artefakts bzw. Name des Bilds; `code` = Anfang des Elements (Artefakt, höchstens 300 Zeichen, Leerraum zusammengezogen) bzw. `""` (Bild).

TypeScript, `src/stores/review.ts` — Schlüssel für `upsert` (`lineId`):

- Diff: unverändert `lineIdOf(...)`.
- Artefakt: `` `artifact|${file}|${selector}` `` (neue Funktion `artifactLineId(file: string, selector: string): string`).
- Bild: `` `image|${attachmentId}|${x},${y},${width},${height}` `` (neue Funktion `imageLineId(target: ImageTarget): string`).

Nachrichten zwischen Artefakt-Seite und Verwalter (alle mit `verwalter: 1`):

| Richtung | `type` | Felder |
|---|---|---|
| Verwalter → Seite | `mode` | `on: boolean` |
| Verwalter → Seite | `marks` | `marks: { n: number; selector: string }[]` |
| Seite → Verwalter | `pick` | `selector: string`, `snippet: string`, `label: string`, `rect: { x: number; y: number; width: number; height: number }` (Ansichtskoordinaten im Rahmen) |
| Seite → Verwalter | `ready` | — (nach dem Laden; der Verwalter schickt darauf `mode` und `marks` erneut) |

## Finale AK

1. Im Reiter „Artefakte“ einer Session schaltet „Kommentieren“ den Modus ein; Klick auf ein Element öffnet das Kommentarfeld, „Zum Chat hinzufügen“ legt eine Karte mit Marke „Artefakt“ in die Eingabeleiste.
2. Ein Klick auf das Vorschaubild eines Bild-Anhangs (Eingabeleiste oder gesendete Nachricht) öffnet die Bildansicht; ein aufgezogener Bereich ergibt nach dem Kommentieren eine Karte mit Marke „Bild“.
3. Beim Senden steht jeder Kommentar im Format aus dem Entwurf (Abschnitt 4) im Text an den Agenten; ein kommentiertes Bild aus einer früheren Nachricht geht als Bild-Block mit.
4. Alte Chat-Einträge mit Diff-Kommentaren laden und zeigen sich unverändert.
5. Eine Artefakt-Seite außerhalb des Kommentiermodus und jede Nachricht aus einem fremden Fenster bewirken nichts.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
