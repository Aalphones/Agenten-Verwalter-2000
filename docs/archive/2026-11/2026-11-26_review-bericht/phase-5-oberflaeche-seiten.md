# Phase 5 — Oberfläche: Reiter „Review“, Inhalt, Überblick, Phasen-Seite, Code mit Randnotizen

Rating: standard. Der Bericht ist in der App lesbar: Reiter „Review“ in der Umsetzungs-Ansicht und in jeder Station-Session mit Bericht, Leiste, Inhaltsverzeichnis, Überblick und je Phase eine Seite mit Ergebnis, Prüfzeile, Weg, Review-Befunden und Stopps samt Code. Schaubilder, Bilder und die Sichtabnahme zeigen in dieser Phase nur Unterschrift bzw. Bildschirm-Namen als Platzhalter (Phase 6), Kommentarknöpfe fehlen noch (Phase 7).

## Kontext (lesen)

- Entwurf (verbindlich): `artifacts/review-bericht-entwurf.html`, `artifacts/_review-bericht-entwurf/review.js` (Funktionen `pageOrder`, `hrefOf`, `tocHtml`, `renderBar`, `overviewHtml`, `phaseHtml`, `checksHtml`, `phaseGaps`, `findHtml`, `stopSection`, `codeBlock`, `rowsHtml`, `layoutNotes`, `footHtml`, Tastatur `step`), `entwurf.css` (Abschnitte `.rv`, `.rv-bar`, `.rv-toc`, `.toc-link`, `.rv-page`, `.rv-doc`, `.prose`, `.banner`, `.ov-*`, `details.way`, `.finds`, `.stop`, `.codegrid`, `.lines`, `tr.add|ctx|del|drun`, `.nmark`, `.anno`, `.checks`, `.ck`, `tr.nocov`); Ansicht im Artefakte-Reiter oder Browser, Abzüge `artifacts/_review-bericht-entwurf/*.png`
- [artifacts/README.md](artifacts/README.md) (was im Entwurf Beispiel ist und was entfällt)
- [README.md](README.md) → Kontrakt: Typen, Befehle, Ereignis
- `src/features/implementation/ImplementationView.tsx`, `ImplementationHeader.tsx` (Reiter Ablauf/Dateien/Artefakte), `src/app/SessionHeader.tsx` (`VIEW_LABEL`, `views`), `src/stores/sessions.ts` (`SESSION_VIEWS`), `src/app/App.tsx` (Weiche der Session-Ansichten)
- `src/features/changes/DiffView.tsx`, `highlightDiff`, `src/lib/syntax.ts` (`languageOf`, `highlightLines`) — Syntaxfarben der Zeilen
- `src/features/artifacts/ArtifactsView.tsx` (Muster: Ansicht mit eigener Leiste und Liste links)
- `docs/conventions/react.md`, `docs/conventions/tailwind.md`, `docs/conventions/typescript.md`, `src/styles/theme.css` (Tokens; Entwurfs-Tokens `--ui-*`/`--vw-*` auf die App-Tokens abbilden, keine neuen Rohfarben)
- Fehlerklassen (Vault `frameworks/css-architecture`): „Freiraum per Innenabstand reserviert, Liste quillt aus ihrem Feld“ — Inhaltsverzeichnis und Seite scrollen je für sich in einem Grid mit `minmax(0, 1fr)` und `min-height: 0`; prüfen per Fensterhöhe 600 px: kein zweiter Rollbalken an der Seite, letzte Zeile des Inhaltsverzeichnisses erreichbar.

## AK

1. **Reiter:** `SESSION_VIEWS` um `'review'` (Beschriftung „Review“), sichtbar nur, wenn `reportOfSession(sessionId)` eine Umsetzung liefert; `ImplementationHeader` bekommt „Review“ als vierten Reiter, sichtbar, sobald die Umsetzung mindestens eine begonnene Phase hat. Ein Punkt am Reiter zeigt eine Phase, die seit dem letzten Öffnen des Reiters fertig wurde (Merker im Store, nur flüchtig).
2. **Aufbau** wie `.rv` im Entwurf: Leiste oben über die volle Breite (Titel „Review-Bericht“, Zustand, Metazeile „Umsetzung <Name> · <n> von <m> Phasen · …“), links Inhaltsverzeichnis 256 px, rechts die Seite mit höchstens 1120 px Inhaltsbreite; unter 760 px Breite ersetzt der Knopf „Inhalt“ die linke Spalte durch ein Blatt (Dialog).
3. **Zustand in der Leiste:** „wächst · Phase <key> läuft“, „wartet auf Abnahme“ (Abnahme-Station bereit), „abgenommen · <Datum Uhrzeit>“ (Abnahme-Station fertig), sonst „in Arbeit“.
4. **Inhaltsverzeichnis:** „Überblick“ plus genau eine Zeile je Phase (Nummer, Titel); laufende Phase mit pulsierendem Punkt, neu fertige mit Punkt, nicht begonnene Phasen als nicht klickbare, gedämpfte Zeile. Keine Unterkapitel.
5. **Überblick** nach `overviewHtml`: Kennzahlen (Phasen, Dateien, +/− Zeilen, Commits) aus den Phasen, in der Phasenliste je Phase mit Sichtabnahme der Link „Sichtabnahme: n Bildschirme, k mit Abweichung“, Zeile der Prüfwerte („Prüfkette grün in x von y Phasen · Tests a bestanden, b fehlgeschlagen · Phase … ohne Tests“), je Phase Ergebnis-Satz mit Link.
6. **Phasen-Seite** nach `phaseHtml`, in dieser Reihenfolge: Kicker „Phase <key> · <Station> · <Zeit>“, Titel, Metazeile (Dateien, +/−, Commits); laufende Phase: Banner „Läuft. Stopps entstehen beim Schreiben, Ergebnis und Weg ordnet Haiku am Phasenende.“; sonst Ergebnis als Einleitung, Prüfzeile (`checksHtml`: Chips Prüfkette, Tests, „neue Zeilen X % abgedeckt“, Mutation; Quelle; eingeklappt „Lücken · n Stellen im Code markiert“ mit Sprung zum Stopp), eingeklappt „Weg · n Etappen · k Umweg“ mit „zum Stopp ↓“; Abschnitt „Sichtabnahme · n Bildschirme · m Ansichten · k Abweichungen“ mit Platzhaltern je Bildschirm (nur wenn `screens` nicht leer); Abschnitt „Review <by> · x offen · y behoben“ mit offenen Befunden (Ort als Sprung zum Stopp bzw. in den Reiter „Dateien“), Platz für Review-Schaubilder, eingeklappt „y behoben“; dann alle Stopps; Fuß mit „← zurück“ / „weiter →“ zwischen Überblick und Phasen. `tidyError` erscheint als Hinweiszeile mit Knopf „Neu ordnen“ (`retidyReport`).
7. **Stopp** nach `stopSection`: Überschrift, Metazeile (Art mit Symbol, `by`), `look` als „Worauf achten“, `lead` als Prosa, dann die Blöcke.
8. **Code-Block** nach `codeBlock`/`rowsHtml`: Kopf mit Pfad, „+a −r“; Zeilen mit alter und neuer Nummer, `Add` grün, `Removed` rot mit durchgestrichener alter Nummer, Läufe von mehr als 6 entfernten Zeilen eingeklappt als „n entfernte Zeilen“ (aufklappbar); Syntaxfarben über `highlightLines`; Zeilen aus `uncovered` mit gelbem linken Rand und Titel „Von keinem Test ausgeführt“; Notizen als Nummernmarke an der ersten Zeile und als Randnotiz rechts (ab 940 px Seitenbreite, Lage nach `layoutNotes`: so nah an der Zeile wie möglich, ohne Überlappung) bzw. unter 940 px als Block direkt unter der letzten Zeile ihres Bereichs; Hover auf Marke oder Notiz hebt beide hervor. Art-Farben: Warum neutral, Risiko orange, Befund violett („Review #n · offen“), Mutant gelb („Mutant überlebt“). `moved`-Notizen unter dem Block mit „Stelle geändert“. Knopf „Im Reiter Dateien“ öffnet die Datei an der ersten Zeile.
9. **Sprünge:** ein Sprung auf einen Stopp (aus Weg, Lücken, Befunden; Ziel im Store `src/stores/report.ts`, keine URL) öffnet die Phasen-Seite und scrollt den Stopp nach oben, nach dem Zeichnen der Inhalte erneut, und hebt ihn kurz hervor; Pfeiltasten links/rechts bzw. `j`/`k` blättern zwischen Überblick und Phasen, nicht in Eingabefeldern.
10. **Laden:** `useReport(implementationId)` lädt per `loadReport`, lädt bei `report://changed` derselben Umsetzung neu und hält bis zur Antwort den alten Stand; Scrollstellung bleibt beim Nachladen.
11. Hell und dunkel, 1440 px und 900 px Fensterbreite ohne waagrechten Rollbalken der Seite; `pnpm check` grün.

## Checkliste

- [x] `src/stores/report.ts`: Seite je Umsetzung (`'overview' | phaseKey`), Sprungziel, gesehene Phasen je Umsetzung, Klappzustände nur flüchtig.
- [x] `src/features/report/`: `ReportView.tsx` (Rahmen), `ReportBar.tsx`, `ReportToc.tsx`, `ReportOverview.tsx`, `ReportPhasePage.tsx`, `ReportChecks.tsx`, `ReportWay.tsx`, `ReportReviewSection.tsx`, `ReportStop.tsx`, `ReportCode.tsx` (Zeilen, Faltung, Randnotizen), `layoutNotes.ts` (reine Funktion: Zeilenpositionen + Notizhöhen → Top-Werte), `useReport.ts`, `useReportOfSession.ts`, `reportTexts.ts`, je Komponente eine BEM-CSS-Datei (`report-…`).
- [x] Reiter in `SessionHeader.tsx`/`sessions.ts` und `ImplementationHeader.tsx`/`ImplementationView.tsx`; Weiche in `App.tsx` für die Session-Ansicht `review`.
- [x] Sprung „Im Reiter Dateien“ über die bestehende Navigation der Dateien-Ansicht (wie `DiffView` bzw. Dateiverweise im Chat; Fundstelle: `grep -n "showSessionView('files')" src/features/implementation/ImplementationView.tsx`).
- [x] Platzhalter für `ReportBlock::Figure` und Review-Schaubilder: Rahmen mit Unterschrift (wird in Phase 6 ersetzt).
- [x] Doc: `docs/code-map.md` Zeile „Review-Bericht“ Oberflächen-Teil; `docs/glossary.md`: „Reiter Review“.
- [x] `pnpm check`.

## Report-Back

Status: complete.

**Abweichungen von AK und Checkliste:**

- AK 2: Das Inhaltsverzeichnis weicht dem Knopf „Inhalt“ (Blatt als Dialog) ab 820 px Breite des Berichts (Container-Abfrage auf `report`), nicht 760 px; der Wert folgt der Breite, ab der die Seite neben dem Verzeichnis unter ~560 px fiele.
- AK 5: Der Überblick hat keine Zeile „Ziel“ und keine Landkarte — dafür liefert der Core keine Daten (Landkarte ist Beispiel im Entwurf). Prüfwerte-Zeile zählt nur fertige Phasen; eine laufende Phase zeigt die Prüfkette nie rot, nur das Banner.
- AK 8: Klappzustände („n entfernte Zeilen“, Weg, Lücken, behoben) leben im nativen `<details>` bzw. lokalen Zustand, nicht im Store; sie gehen beim Seitenwechsel verloren. Der Store hält Seite, Sprungziel und gesehene Phasen je Umsetzung.
- AK 1: Der Punkt am Reiter und die Sichtbarkeit in der Umsetzung kommen aus der `ImplementationView` (Phase begonnen / fertig, gespiegelt aus `assemble::phase_state`), nicht aus einem geladenen Bericht; der Bericht wird erst beim Zeigen des Reiters geladen. In der Station-Session steuert `reportOfSession` die Sichtbarkeit.
- „Neu ordnen“ fragt vor dem Überschreiben nach, sobald die Phase Prüfwerte hat (FINDINGS-Hinweis zu `report_retidy`).
- Schaubilder, Bilder und Sichtabnahme sind Platzhalter mit Unterschrift bzw. Bildschirm-Namen (Phase 6), keine Kommentarknöpfe (Phase 7).

**Belegt:** `scripts/check.ps1` (Formate, tsc, ESLint, Vite-Build, cargo fmt/clippy) grün. Die Höhen- und Überlaufkette wurde vor dem Schreiben des Layouts gegen `App.css` (`__content`: Spalte, `min-height: 0`) und `ImplementationView.css` gelesen.

**Nicht gelaufen:** Die Oberfläche wurde nicht gerendert — weder in der App noch in einer Vite-Prüfseite; Layout (1440/900 px, hell/dunkel, 600 px Höhe, Randnotizen ab 940 px) und Design-Abgleich mit dem Entwurf sind ungesehen. Der Weg mit echten Berichtsdaten (Laden, `report://changed`, Sprung in „Dateien“) ist nicht in der App gelaufen.

**Unsicherste Stelle:** `src/features/report/ReportCode.tsx:135` — die Höhen der Randnotizen werden im Layout-Effekt gemessen und per `layoutNotes` verteilt; wie das bei später umbrechendem Text, Fensterwechsel und Syntaxfarben-Nachladen im WebView2 aussieht, ist ungesehen.
