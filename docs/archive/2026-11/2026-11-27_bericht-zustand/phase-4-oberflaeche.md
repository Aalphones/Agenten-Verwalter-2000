# Phase 4 — Oberfläche: Zustandsleiste, Seite nach Vorschlag C

Status: complete · Rating: standard · Modell: sonnet

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans (Kontrakt, finale AK, Abweichungen vom Entwurf), Report-Back der Phasen 1–3.
- **Entwurf (verbindlich):** `artifacts/bericht-ohne-eintraege.html` im Browser öffnen; Zustände über die Leiste oben („Station arbeitet“, „Zwischenstand geordnet“, „Haiku ordnet“, „Nichts berichtet“, „Geordnet“, „Fehlgeschlagen“), Hell/Dunkel, schmal unter 820 px. Maße und Farben stehen in `artifacts/_bericht-ohne-eintraege/entwurf.css` (Klassen `.state`, `.origin`, `.way*`, `.stop*`, `.code*`, `.note--haiku`, `.note--none`, `.tag*`, `.toc__*`, `.toast`). Die Entwurfsleiste selbst wird nicht gebaut.
- `src/features/report/ReportPhasePage.tsx` + `.css`, `ReportTidyHint.tsx` + `.css`, `ReportWay.tsx` + `.css`, `ReportDisclosure.tsx`, `ReportStop.tsx` + `.css`, `ReportCode.tsx` + `.css`, `ReportToc.tsx` + `.css`, `ReportView.tsx`, `ReportAcceptToast.tsx` + `.css` (Muster für den Hinweis), `ReportBar.css` → `&__accept` (Muster primärer Knopf), `reportTexts.ts`, `useReport.ts`, `useReportSend.ts` (Muster `sendMessage`).
- `src/lib/report.ts`, `src/lib/chat.ts` (`sendMessage`), `src/app/App.tsx` (`hasFreshReport`), `src/app/SessionHeader.tsx` und `src/features/implementation/ImplementationHeader.tsx` (Punkt am Reiter „Review“), `src/features/implementation/ImplementationView.tsx`.
- Konventionen: `docs/conventions/react.md`, `typescript.md`, `tailwind.md`.
- Fehlerklassen (Vault): `frameworks/react.md` → „`setState` direkt im Effect-Körper bricht die Lint-Prüfung“ — der Sekundenzähler setzt seinen State nur im `setInterval`-Callback, abgeleitete Werte (Zustand der Leiste) werden beim Rendern berechnet.

## AK der Phase

1. `reportTidyState(phase)` in `src/features/report/reportTidy.ts` liefert genau einen von `tidying` (`tidyingSince !== null`), `liveOpen` (Phase läuft, `tidiedAt === null`), `liveOrdered` (Phase läuft, `tidiedAt !== null`), `failed` (fertig, `tidyError !== null`), `ordered` (fertig, `ordered`), `empty` (fertig, sonst).
2. Die Komponente `ReportTidyState` ersetzt Laufbanner, `NO_RESULT_TEXT` und `ReportTidyHint` und zeigt je Zustand Titel, Unterzeile und Knöpfe wie im Entwurf (Texte unten); `NO_RESULT_TEXT`, `RUNNING_BANNER_TITLE`, `RUNNING_BANNER_TEXT` und `ReportTidyHint.*` sind gelöscht.
3. Herkunftszeile über dem Ergebnis: `ordered` mit `entries === 0` → „Haiku · aus Verlauf und Diff“, mit Einträgen → „Haiku · aus den Erklärungen der Station“; `liveOrdered` → „Haiku · Zwischenstand von HH:MM“; darunter (nur fertig) die Meldung der Station klein. Ohne Ordnung und fertig: „Meldung der Station · beim Fertigmelden, ungeordnet“ mit der Meldung als ruhigem Absatz.
4. Kopfzeile zeigt je `repositories`-Eintrag „Label · N Dateien +a −r“, äußere in Bernstein mit Titel „außerhalb des Vorhabens“, dahinter alle Kurz-Hashes.
5. Weg: läuft die Phase, ist er aufgeklappt; je Etappe Uhrzeit, Ort, Commit, „läuft“, Befehls-Beschreibungen, „+ N × gelesen oder gesucht“, „N × geändert“, Dateinamen, „zum Diff ↓“; Zusammenfassung „bisher N Etappen · M Aufrufe in K min“ bzw. „N Etappen · aus M Aufrufen in K min“.
6. Stopps aus dem Diff tragen in der Meta-Zeile „außerhalb des Vorhabens“ (wenn `outside`) und „Stopp aus dem Diff, nicht von der Station“; Code-Blöcke ohne Notiz zeigen am Rand „Keine Erklärung der Station.“ und den Link „Haiku erklären lassen“ (nicht während `tidying`); Notizen mit `label === "H"` im Ton von `--color-status-script` mit Kopf „Haiku · aus dem Diff“; `fresh` und `tidiedAt` → Schild „neu seit HH:MM“; `omittedRows > 0` → Zeile „Diff zu lang (N Zeilen)“ statt der Zeilen.
7. Inhaltsverzeichnis: zweite Zeile je Phase wie im Entwurf („läuft · nicht geordnet“, „läuft · geordnet HH:MM“, „Haiku ordnet …“, „ohne Erklärung“, „Ordnen fehlgeschlagen“); Punkt `tidying` blau pulsierend, `empty` als Ring, `failed` gefüllt bernstein; Bewegung aus bei `prefers-reduced-motion`.
8. Reiter „Review“ zeigt einen blauen Punkt mit Titel „Haiku ordnet“, solange eine Phase der Umsetzung geordnet wird — in `SessionHeader` und `ImplementationHeader`.
9. Endet eine Ordnung ohne Fehler, während der Bericht offen ist, erscheint unten rechts „Phase N geordnet.“ bzw. „Zwischenstand geordnet.“ mit „Ansehen“ (springt zur Phase) und Schließen; verschwindet nach 8 s.
10. Bei 390 px Breite keine waagerechte Bildlaufleiste der Seite; Knöpfe der Leiste mindestens 44 px hoch und volle Breite unter 600 px (wie im Entwurf).
11. `powershell -File scripts/check.ps1` endet mit `exit 0`.

## Texte (in `reportTexts.ts`)

| Zustand | Titel | Unterzeile | Knöpfe |
|---|---|---|---|
| `liveOpen` | Läuft · noch nicht geordnet. | `<Stationslabel> arbeitet seit N min · bisher F Dateien geändert, E Erklärungen · Haiku ordnet automatisch am Phasenende` | primär „Zwischenstand ordnen“ |
| `liveOrdered` | Läuft · Zwischenstand von HH:MM. | `Station arbeitet weiter · seitdem F Dateien geändert, E neue Erklärungen` bzw. `seitdem nichts Neues` · `am Phasenende ordnet Haiku erneut` | sekundär „Neu ordnen“, nur wenn F + E > 0 |
| `tidying` | Haiku ordnet den Zwischenstand. (läuft) / Haiku ordnet. (fertig) | `seit S s · Abbruch nach 2 min · du kannst weiterlesen` | sekundär „Abbrechen“ |
| `empty` | Keine Erklärung der Station. | `<Stationslabel> hat 0 Einträge in den Bericht geschrieben · Haiku hatte nichts zu ordnen` | sekundär „Station nachfragen“, primär „Aus Verlauf ordnen“ |
| `failed` | Ordnen fehlgeschlagen. | `tidyError` · `die Meldung der Station bleibt stehen` | sekundär „Neu ordnen“ (mit der bestehenden Rückfrage `RETIDY_FINISHED_CONFIRM`, wenn `checks !== null`) |
| `ordered` | — (keine Leiste) | — | in der Herkunftszeile bei `entries === 0` zusätzlich „Station nachfragen“ als Link |

„F Dateien“ = `filesSince` (bzw. vor einer Ordnung die Dateizahl aus `repositories`), „E“ = `entriesSince` bzw. `entries`. Zahlen mit `pluralize`.

## Checkliste

- [x] `src/lib/report.ts`: `cancelTidy(phaseId)` → `report_cancel_tidy`, `tidyingPhases(implementationId)` → `report_tidying`; `onReportChanged(callback: (implementationId: string, tidyingPhaseIds: string[]) => void)`; bestehende Aufrufer anpassen.
- [x] `src/features/report/reportTidy.ts`: `reportTidyState` (AK 1), `formatClock(ms)` („HH:MM“).
- [x] `src/features/report/useReportTidying.ts`: `useReportTidying(implementationId: string | null): readonly string[]` — Startwert über `tidyingPhases`, danach aus dem Ereignis; `[]` ohne ID.
- [x] `ReportTidyState.tsx` + `.css` nach Entwurf (`.state`, `.state--running`, `.state--empty`, `.state__bar`, `.spin`; Farben über `--color-status-running` bzw. `--color-status-waiting`); Sekundenzähler mit `setInterval` im Effect, `setState` nur im Callback; Aktionen über `useActionError` wie in `ReportTidyHint`: `retidyReport`, `cancelTidy`, „Station nachfragen“ = `sendMessage(phase.stationSessionId, ASK_STATION_TEXT, [], [])`, danach Knopftext „Nachfrage gesendet“ und deaktiviert.
- [x] `ASK_STATION_TEXT`: „Erkläre deine Änderungen dieser Phase nachträglich im Review-Bericht: je zusammengehöriger Änderung ein mcp__verwalter__report_note mit dem Warum in zwei, drei Sätzen und at auf die Stelle. Melde die Station nicht erneut fertig.“
- [x] `ReportPhasePage.tsx`: `renderResult` → Leiste + Herkunftszeile + Ergebnis (AK 3); Kopfzeile nach AK 4 (`repositories` leer → bisherige Anzeige); `ReportChecks` nur, wenn Phase fertig.
- [x] `ReportDisclosure`: Prop `defaultOpen?: boolean` → `<details open={…}>` nur beim ersten Rendern (unkontrolliert, Attribut über `defaultOpen` per Ref setzen, damit der Browser das Auf-/Zuklappen weiter selbst hält).
- [x] `ReportWay.tsx` + `.css` nach AK 5 und Entwurf (`.way__text`, `.way__time`, `.way__calls`, `.way__files`, Schild `läuft` im Ton `--color-status-running`).
- [x] `ReportStop.tsx`, `ReportCode.tsx` + `.css` nach AK 6; Ton `report-code__tone--haiku` (`--report-tone: var(--color-status-script)`); `tidiedAt` und `isTidying` über Props von `ReportPhasePage` durchreichen.
- [x] `ReportToc.tsx` + `.css` nach AK 7 (zweite Zeile `report-toc__state`, Punkte `--tidying`, `--empty`, `--failed`).
- [x] Reiter-Punkt (AK 8): `App.tsx` und `ImplementationView.tsx` berechnen `isReportTidying = useReportTidying(<Umsetzung>).length > 0` und reichen es an `SessionHeader` bzw. `ImplementationHeader`; dort neben dem bestehenden Frisch-Punkt `session-header__tab-dot--tidying` bzw. das Gegenstück, Titel `TIDYING_TAB_TITLE = 'Haiku ordnet'`, Farbe `--color-status-running`; sind beide fällig, zeigt der Reiter nur den blauen Punkt.
- [x] Hinweis nach dem Ordnen (AK 9): `ReportTidyToast.tsx` nach dem Muster `ReportAcceptToast`; `ReportView` merkt sich die zuletzt geordneten Phasen-IDs (vorher in `tidyingPhaseIds`, jetzt nicht mehr, `tidyError === null`).
- [x] Selbstprüfung: Vite-Prüfseite im Scratchpad (nicht im Repo) mit nachgestellter `ReportView`-Antwort je Zustand; Bilder per Headless-Edge hell und dunkel bei 390 und 1366 px, neben den Entwurf gelegt; Abweichungen im Report-Back.
- [x] `docs/glossary.md`: „Zustandsleiste des Berichts“. `scripts/check.ps1` grün; Commit mit einzeln genannten Dateien.

## Report-Back

AK 1–11 am Code und an der Prüfseite abgeglichen; `scripts/check.ps1` endet mit `exit 0`.

**Selbstprüfung:** Vite-Prüfseite im Scratchpad mit nachgestellter `report_load`-Antwort, Bilder je Zustand hell und dunkel bei 390 und 1366 px. Gemessen bei 390 px: Dokument und Seite 390/390 (keine waagerechte Bildlaufleiste), Leistenknöpfe 44 px hoch, ein Knopf 331 px breit, zwei Knöpfe teilen sich die Zeile. Klickpfade: „Ansehen“ springt vom Überblick zur Phase und schließt den Hinweis, ohne Klick ist er nach 8,5 s weg, „zum Diff ↓“ rollt zum Stopp; keine Laufzeitfehler.

**Abweichungen von Checkliste und Entwurf:**

- Der Hinweis nach dem Ordnen liest den Bericht statt `tidyingPhaseIds`: er erscheint nur, wenn `tidiedAt` neuer ist als der beobachtete Beginn (`useTidyNotice`). So bleibt er nach Abbruch und bei „nichts zu ordnen“ aus.
- Die Rückfrage `RETIDY_FINISHED_CONFIRM` gilt für jedes Ordnen einer fertigen Phase mit Prüfwerten, auch „Aus Verlauf ordnen“ und „Haiku erklären lassen“: jedes überschreibt die Prüfwerte. Der Entwurf zeigt dort keine Rückfrage.
- Laufende Phase mit `tidyError`: Fehlerzeile in der Leiste, „Neu ordnen“ auch ohne Neuigkeit (AK 1 kennt dort keinen Fehlerzustand).
- Fertig, ungeordnet, aber mit Einträgen: Titel „Noch nicht geordnet.“ mit der echten Zahl.
- „arbeitet seit N min“ kommt aus der ersten Etappe des Wegs und entfällt ohne sie.
- „Keine Erklärung der Station“ steht nur an Stopps aus dem Diff, in denen kein Block eine Notiz hat. Blöcke mit `extern:`-Schlüssel haben keinen Knopf „Im Reiter Dateien“; Zeilen-Kommentare nennen den Pfad ohne `extern:`.
- Der Weg hat Nummern wie im Entwurf; die Grundstile hatten sie auch dem Weg aus Haikus Ordnung genommen.

**Grenzen:** Nicht in der laufenden App und nicht gegen echte Daten gelaufen. Der blaue Punkt am Reiter „Review“ ist nur am Code geprüft (die Prüfseite zeichnet die Kopfzeilen nicht). „Station nachfragen“ und „Abbrechen“ wurden nicht ausgelöst.
