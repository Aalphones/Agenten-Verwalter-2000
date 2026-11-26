# Phase 6 — Oberfläche: Schaubilder mit Unterschied/Vorher/Nachher, Bilder mit Marken

Rating: standard. Mermaid-Schaubilder im Bericht zeigen, was neu ist, was entfällt und was sich ändert, umschaltbar zwischen Unterschied, Vorher und Nachher; Bilder zeigen nummerierte Marken mit Legende und öffnen groß.

## Kontext (lesen)

- Entwurf (verbindlich): `artifacts/_review-bericht-entwurf/review.js` (Funktionen `MARK`, `KIND_OF`, `mmdHasDiff`, `cssColor`, `mmdView`, `diagramBlock`, `drawDiagrams`, Bild-Teil von `blockHtml`, Lightbox), `entwurf.css` (`.diagram`, `.dseg`, `.dlegend`, `.shot`, `.mark`, `.lightbox`); Beispiele mit Markern in `daten.js` (Phase 2 Review „Weg eines Pfads bis zum Standardprogramm“, Stopp „Grenze“, Phase 3 „Range“)
- [README.md](README.md) → Kontrakt: Werkzeug `report_figure` (Marker `+ `, `- `, `~ `), Typen `ReportFigure`, `ReportMark`; „Von mir gesetzt“ (Mermaid-Version)
- `src-tauri/src/artifacts/viewers/mermaid.js` (wie die Betrachter Mermaid aufrufen und Fehler zeigen)
- `src/styles/theme.css` (Diagrammfarben `--color-chart-*`, Hell/Dunkel), `src/lib/colorScheme.ts`
- Phase-5-Dateien `src/features/report/*`
- Fehlerklassen geprüft: keine einschlägig.

## AK

1. Abhängigkeit `mermaid@10.9.1` per `pnpm add mermaid@10.9.1` (exakte Version, ohne `^`); geladen nur per `import('mermaid')` beim ersten sichtbaren Schaubild; `initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' })` mit `themeVariables` aus den App-Tokens; Farbwechsel hell/dunkel zeichnet neu.
2. `src/features/report/mermaidDiff.ts`: `hasDiff(code): boolean`; `mermaidView(code, mode: 'diff' | 'before' | 'after'): string` nach `mmdView` des Entwurfs: Vorher lässt `+ `-Zeilen weg, Nachher lässt `- `-Zeilen weg, beide entfernen die Marker; Unterschied behält alle Zeilen und färbt sie: Flowchart-Knoten per `classDef add|del|chg` und `class`, Kanten per `linkStyle <Index>` (Index = Reihenfolge der Kantenzeilen im erzeugten Text), Sequenz-Nachrichten per `rect rgba(…)`-Block; Farben als hex8 (`cssColor` des Entwurfs; rgba mit Kommas bricht `classDef`).
3. Schaubild-Block: Unterschrift, `by`, Schalter „Unterschied · Vorher · Nachher“ nur bei `hasDiff`, Legende (neu grün, entfällt rot gestrichelt, geändert orange) nur in „Unterschied“, eingeklappt „Quelltext“ mit dem Mermaid-Text ohne Umwandlung; Fehler beim Zeichnen → Hinweis „Schaubild nicht lesbar: <Meldung>“ plus Quelltext, der Rest der Seite bleibt.
4. Gewählte Ansicht je Schaubild im Store (flüchtig); Vorgabe „Unterschied“.
5. Bild-Block: Bild in voller Breite bis 900 px, Marken als nummerierte Kreise an `x/y` (in Prozent der Bildgröße umgerechnet), Legende darunter mit den Texten; Klick öffnet groß (Dialog mit Schließen und Escape), Marken bleiben an ihrer Stelle.
6. Review-Schaubilder (Phase 5, Platzhalter) und Schaubilder in Stopps nutzen denselben Block; ein Sprung auf einen Stopp scrollt nach dem Zeichnen erneut (AK 9 aus Phase 5 bleibt erfüllt).
7. Die drei Beispiele mit Markern aus `daten.js`, als Einträge in eine Datenbank-Kopie geschrieben (`report-probe` oder SQL), zeichnen in allen drei Ansichten hell und dunkel ohne Fehler; `pnpm check` grün.

## Checkliste

- [ ] `pnpm add mermaid@10.9.1`; `pnpm-lock.yaml` mit committen.
- [ ] `src/features/report/mermaidDiff.ts`, `useMermaid.ts` (Laden, Initialisieren, Zeichnen mit eindeutiger ID, Fehler), `ReportFigure.tsx` (Schaubild und Bild), `ReportLightbox.tsx`, CSS je Komponente.
- [ ] Platzhalter aus Phase 5 ersetzen.
- [ ] Doc: `docs/code-map.md` Zeile „Review-Bericht“ um `mermaidDiff.ts` und `ReportFigure`; `docs/glossary.md`: „Unterschied/Vorher/Nachher (Schaubild)“.
- [ ] `pnpm check`.

## Report-Back
