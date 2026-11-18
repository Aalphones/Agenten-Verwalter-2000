# Phase 4 — Datei ansehen: Änderung, ganze Datei, Schritte

Rating: standard. Die rechte Seite bekommt eine eigene Datei-Ansicht: Kopf mit Pfad und Aktionen, Umschalter „Änderung · Ganze Datei“, die Schritte der Datei, die ganze Datei mit markierten geänderten Zeilen, dazu Bild, Binärdatei, zu große und fehlende Datei. Aussehen: Entwurf, Bilder `02-aenderung.png` und `03-ganze-datei-zeile.png`.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (`FileContent`, Commands, Zusammenlegen der Einträge Punkt 2 und 3), Wackelstellen (Review-Kommentare)
- Entwurf: im Quelltext `renderFile`, `renderCode`, `parseDiff`, `splitLines`, `jump` und die CSS-Klassen `.fh`, `.steps`, `.code`, `.mk`, `.imgprev`
- `src/features/changes/DiffView.tsx` (Props, Virtualisierung, `canComment`, Kopf mit Schließen), `diffRows.ts`, `highlightDiff.ts`, `useFileDiff.ts`, `useGapExpansion.ts`
- `src/lib/syntax.ts` — `languageOf`, `highlightLines`, `SyntaxLine`; `src/styles/syntax.css`
- `src/features/review/` und `src-tauri/src/review/` — wie ein Kommentar seinen Ort bildet und beim Senden auflöst ([ADR 015](../../decisions/015-changes-review.md))
- `src/features/files/` aus Phase 3 (`FilesView.tsx`, `mergeGroups.ts`, `stores/files.ts`), `src/lib/files.ts`
- `src/lib/git.ts` — `gitOpen` (Muster für „Im Explorer öffnen“)
- `docs/conventions/react.md`, `typescript.md`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## Aufbau (verbindlich)

- **Kopf** (eine Zeile, bricht um): „← Übersicht“, der Pfad als anklickbare Glieder (`Repository / Ordner / … / Datei`, Datei fett; ein Klick auf ein Glied klappt den Ordner im Baum auf und setzt den Fokus dorthin), dann Zustand (`M Geändert +a −d` bzw. „Unverändert gegenüber <Basis>“), bei geänderten Dateien das Segment „Änderung · Ganze Datei“, „In VS Code öffnen“, „Pfad kopieren“. Kein Schließen-Kreuz.
- **Schritt-Zeile** (nur „Änderung“): Beschriftung „Geändert in“, Knopf „Gesamt · n Schritte“, je Schritt ein Knopf `#<Session-Nummer> <Kurz-ID>` mit Session-Name und Betreff im `title`; der gewählte hervorgehoben. Gibt es mehrere Fassungen der Datei (README, Zusammenlegen Punkt 2), davor ein Segment mit den Branch-Namen der Fassungen, die jüngste zuerst. Rechts „↑“ und „↓ Nächste Stelle“.
- **Änderung:** „Gesamt“ zeigt die vorhandene Diff-Darstellung (alte und neue Zeilennummer, Vorzeichen, Syntaxfarben, unveränderte Zeilen aufklappbar, Kommentare); ein Schritt zeigt denselben Aufbau aus `loadCommitDiff`, ohne Kommentieren und ohne Aufklappen unveränderter Zeilen.
- **Ganze Datei:** Zeilennummer, ein 5 px breiter Rand, Code mit Syntaxfarben; hinzugefügte oder geänderte Zeilen tragen den Rand in `--color-diff-add-fg`, eine Stelle, vor der Zeilen entfernt wurden, einen 3 px hohen Strich in `--color-diff-del-fg` am oberen Rand; beides mit `title`. Darüber die Zeile „Balken links = in diesem Vorhaben geändert“ und dieselben Sprungknöpfe. Eine angesprungene Zeile (Phase 6) ist mit `--color-bg-selected` hinterlegt, ihre Nummer fett.
- **Zustände statt Code:** Bild (Vorschau auf Schachbrett-Grund, Größe in KB), „Binärdatei – keine Vorschau“, „Zu groß zum Anzeigen (n MB)“, „Datei gibt es nicht mehr“ (gelöschte Datei: nur „Änderung“), „Nur Dateirechte geändert“ (Diff ohne Zeilen und nicht binär), „Kein Textvergleich“ (binär). Gekürzt: Zeile „Nur die ersten 20 000 Zeilen“.

## AK

1. Eine geänderte Datei öffnet mit „Änderung“ und „Gesamt“; eine unveränderte mit „Ganze Datei“ ohne Segment und Schritt-Zeile. Ist ein Session-Filter gesetzt, öffnet „Änderung“ mit dem jüngsten Schritt dieser Session.
2. Die Schritt-Knöpfe sind genau die Commits aus dem Verlauf, die die Datei in dieser Gruppe ändern, älteste zuerst; ein Klick auf eine Datei unter einem Commit im Verlauf öffnet die Datei mit diesem Schritt.
3. „Ganze Datei“ markiert bei einer bearbeiteten Datei genau die Zeilen, die der Diff „Gesamt“ als hinzugefügt führt, und setzt den Strich dort, wo er nur Entferntes führt; bei einer neuen Datei entfallen Markierung und Sprungknöpfe.
4. „Nächste Stelle“ und „↑“ springen in „Änderung“ von Abschnitt zu Abschnitt, in „Ganze Datei“ von markierter Stelle zu markierter Stelle, und melden „Stelle i von n“ als Statustext (`role="status"`).
5. „← Übersicht“ und Esc schließen die Datei; die Übersicht steht an ihrer alten Stelle. Ein neues Nachladen der Changes lässt die Bildlaufposition der offenen Datei stehen.
6. „In VS Code öffnen“ ruft `openInEditor` mit dem Eintrag der gezeigten Fassung, in „Ganze Datei“ mit der obersten sichtbaren Zeile; „Pfad kopieren“ legt den Pfad relativ zum Repository in die Zwischenablage und meldet „Pfad kopiert“. Scheitert VS Code, steht die Meldung in der Fehlerleiste der Session.
7. Kommentieren geht in „Änderung · Gesamt“, sobald eine Session sichtbar ist, auch mit Reichweite `project`; ein gesendeter Kommentar nennt dem Agenten den absoluten Pfad der Datei im Ordner ihres Eintrags.
8. Eine Datei mit 20 000 Zeilen scrollt flüssig: nur sichtbare Zeilen stehen im DOM.
9. Ein symbolischer Link, der aus dem Repository zeigt, zeigt „Liegt außerhalb des Repositorys“ statt Inhalt.
10. `pnpm check` grün.

## Checkliste

- [ ] Wackelstelle Review-Kommentare prüfen (README) und, falls nötig, die Auflösung des Schlüssels in `src-tauri/src/review/` auf `ChangesReach::Project` stellen. Ergebnis im Report-Back.
- [ ] `src/features/changes/DiffView.tsx`: neue Props `canComment: boolean` (ersetzt `reach === 'session'`), `showHead: boolean` (Vorgabe `true`; `false` blendet den eigenen Kopf aus) und optional `lines: FileDiff` (vorgegebener Diff eines Schritts; dann kein eigenes Laden, kein Aufklappen, kein Kommentieren). `ChangesView` übergibt `canComment={reach === 'session'}` und bleibt sonst unverändert.
- [ ] `src/features/files/FileViewer.tsx` + `.css`: Kopf, Segment, Schritt-Zeile, Zustände nach „Aufbau“; wählt Fassung, Ansicht und Schritt aus `OpenTarget`.
- [ ] `src/features/files/useFileContent.ts`: `readFile` je `<Session>|<Eintrag>|<Pfad>`, neu laden bei neuem Ergebnis der Changes nur, wenn sich `changedAt` der Datei geändert hat.
- [ ] `src/features/files/WholeFile.tsx` + `.css`: virtualisierte Zeilen (`@tanstack/react-virtual`), Farben über `highlightLines(text, languageOf(path))` einmal je Inhalt (`useMemo`), Markierungen aus `changedLines.ts`.
- [ ] `src/features/files/changedLines.ts`: reine Funktion `changedLines(diff: FileDiff): { added: Set<number>; removedBefore: Set<number>; starts: number[] }` aus `DiffLine.kind` und `newLine`.
- [ ] `src/features/files/fileSteps.ts`: reine Funktion, die aus `ProjectHistory`, Gruppe und Pfad die Schritte liefert (älteste zuerst) samt Session-Nummer und -Name.
- [ ] Sprung zur Zeile: `OpenTarget.line` gesetzt → Ansicht „Ganze Datei“, `scrollToIndex(line − 1, { align: 'center' })`, Zeile hervorgehoben, bis eine andere Datei geöffnet wird.
- [ ] Esc im Reiter „Dateien“ schließt die offene Datei, wenn weder Session-Auswahl noch Suchliste noch ein Dialog offen ist.
- [ ] `FilesView` zeigt statt der `DiffView` aus Phase 3 den `FileViewer`.
- [ ] `pnpm check`.
- [ ] Doku: Code-Map-Zeile „Dateien (Oberfläche)“ um `FileViewer`, `WholeFile` ergänzen; in `docs/glossary.md` „Ganze Datei“ und „Fassung“.

## Report-Back
