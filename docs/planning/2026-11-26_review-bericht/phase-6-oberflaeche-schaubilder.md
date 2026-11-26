# Phase 6 — Oberfläche: Schaubilder mit Unterschied/Vorher/Nachher, Bilder mit Marken, Sichtabnahme

Rating: standard. Mermaid-Schaubilder im Bericht zeigen, was neu ist, was entfällt und was sich ändert, umschaltbar zwischen Unterschied, Vorher und Nachher; Bilder zeigen nummerierte Marken mit Legende und öffnen groß; der Abschnitt „Sichtabnahme“ zeigt je Bildschirm die Fotos der Station neben dem Entwurf.

## Kontext (lesen)

- Entwurf (verbindlich): `artifacts/_review-bericht-entwurf/review.js` (Funktionen `MARK`, `KIND_OF`, `mmdHasDiff`, `cssColor`, `mmdView`, `diagramBlock`, `drawDiagrams`, Bild-Teil von `blockHtml`, `shotHtml`, Lightbox, `screenHtml`, `screensHtml`), `entwurf.css` (`.diagram`, `.dseg`, `.dlegend`, `.shot`, `.mark`, `.lightbox`, Abschnitt „Sichtabnahme“: `.sa-sec`, `.scr-view`, `.cmp`, `.dev`, `table.steps`, `.thumb`); Beispiel Sichtabnahme in `daten.js` Phase 5 (`screens`), Ansicht im Entwurf unter Phase 5; Beispiele mit Markern in `daten.js` (Phase 2 Review „Weg eines Pfads bis zum Standardprogramm“, Stopp „Grenze“, Phase 3 „Range“)
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
5. Bild-Block: Bild in voller Breite bis 900 px, Marken als nummerierte Rechtecke (`x, y, w, h` in Prozent der Bildgröße umgerechnet) mit Nummer, Legende darunter mit den Texten, darunter `text` als Kommentar; Klick öffnet groß (Dialog mit Schließen und Escape), Marken bleiben an ihrer Stelle.
5a. **Sichtabnahme** nach `screenHtml`: je Bildschirm Überschrift, Metazeile (`by`, Zahl der Ansichten und Klickpfade), `text` als Prosa; Kopfleiste mit Umschalter der Ansichten (Beschriftung `label`, nur bei mehr als einer) und Schalter „Entwurf daneben“ (nur, wenn die gewählte Ansicht `design` hat; Vorgabe an), sonst „kein Entwurfsbild“; Foto und Entwurf nebeneinander mit Unterschrift „Umsetzung“/„Entwurf“, unter 760 px Breite untereinander; schmale Fotos (`narrow`) höchstens 280 px breit, Einzelfotos ohne Vergleich höchstens 900 px; Legende der Marken; Zeile „Abweichung vom Entwurf“ mit Warnfarbe und Symbol bzw. „wie im Entwurf“ (nur, wenn ein Entwurfsbild existiert); Klickpfad als Tabelle `# · Öffnen · Tun · Erwartet · Bild` mit Vorschaubildern „vorher“/„nachher“ (Klick öffnet groß), unter 600 px als Liste mit Beschriftungen. Gewählte Ansicht und Schalter je Bildschirm im Store (flüchtig).
6. Review-Schaubilder (Phase 5, Platzhalter) und Schaubilder in Stopps nutzen denselben Block; ein Sprung auf einen Stopp scrollt nach dem Zeichnen erneut (AK 9 aus Phase 5 bleibt erfüllt).
7. Die drei Beispiele mit Markern aus `daten.js`, als Einträge in eine Datenbank-Kopie geschrieben (`report-probe` oder SQL), zeichnen in allen drei Ansichten hell und dunkel ohne Fehler; `pnpm check` grün.

## Checkliste

- [ ] `pnpm add mermaid@10.9.1`; `pnpm-lock.yaml` mit committen.
- [ ] `src/features/report/mermaidDiff.ts`, `useMermaid.ts` (Laden, Initialisieren, Zeichnen mit eindeutiger ID, Fehler), `ReportFigure.tsx` (Schaubild und Bild), `ReportLightbox.tsx`, CSS je Komponente.
- [ ] `ReportScreen.tsx`, `ReportSteps.tsx` und CSS je Komponente für die Sichtabnahme.
- [ ] Platzhalter aus Phase 5 ersetzen.
- [ ] Doc: `docs/code-map.md` Zeile „Review-Bericht“ um `mermaidDiff.ts` und `ReportFigure`; `docs/glossary.md`: „Unterschied/Vorher/Nachher (Schaubild)“, „Sichtabnahme“.
- [ ] `pnpm check`.

## Report-Back
