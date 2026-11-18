# Phase 5 — Suche und Strg P

Rating: standard. Das Suchfeld oben rechts in der Leiste findet Dateien aller Repositories des Vorhabens nach Name und Pfad; Strg P setzt aus jeder Ansicht den Fokus hinein. Aussehen: Entwurf, Bild `04-suche.png`.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Suche, `MAX_RESULTS`, Linux und macOS)
- Entwurf: im Quelltext `searchFiles`, `renderResults`, die Tastatur-Behandlung für `#q` und die CSS-Klassen `.search`, `.results`, `.res`
- `src/features/files/` aus Phase 3 und 4 — `FilesToolbar.tsx`, `useRepoTrees.ts`, `mergeGroups.ts`, `stores/files.ts` (`query`)
- `src/app/App.tsx` — die vorhandenen Tastenkürzel (Strg N bei `event.key.toLowerCase() === 'n'`, Strg Ö, Strg ;) als Muster für Ort und Form
- `src/features/terminal/terminalInstances.ts` — wie das Terminal Tastenkürzel durchlässt (Strg Ö), damit Strg P auch aus dem Terminal greift
- `docs/conventions/react.md`
- Fehlerklassen geprüft (Vault `frameworks/react`): keine einschlägig.

## Aufbau (verbindlich)

- **Feld:** rechts in der Leiste, 28 px hoch, Lupe links, Platzhalter „Datei suchen“, rechts die Marke „Strg P“; unter 780 px Breite des Reiters eigene Zeile in voller Breite.
- **Liste:** klappt unter dem Feld auf, rechts bündig, höchstens 580 px breit und 60 % der Fensterhöhe hoch. Kopf: „n Treffer in m Dateien“ bzw. bei leerem Feld „Zuletzt geändert“, bei mehreren Repositories rechts „über alle Repositories“. Je Treffer: Typ-Kürzel, Dateiname (der Treffer im Namen unterstrichen und fett), Ordner gedämpft und von links gekürzt, bei mehreren Repositories davor der Name des Repositorys, rechts `+a −d` und Buchstabe bei geänderten Dateien. Fuß: „↑ ↓ wählen · Enter öffnen · Esc schließen · ohne ignorierte Dateien“ und, wenn gekürzt, „die ersten 40 von n“.
- **Kein Treffer:** „Keine Datei gefunden. Gesucht wird im Dateinamen und im Pfad, nicht im Inhalt.“

## AK

1. Strg P wechselt bei sichtbarem Vorhaben mit Repository in den Reiter „Dateien“, setzt den Fokus ins Feld und markiert dessen Inhalt; der Druckdialog des Webviews erscheint nicht. Ohne Repository tut das Kürzel nichts.
2. Beim ersten Fokus lädt die Suche die Bäume aller Gruppen, die noch nicht geladen sind; bis dahin steht „Dateien werden gelesen …“ in der Liste.
3. Reihenfolge und Auswahl der Treffer folgen der Wertung der README; `Readme.md` und `README.md` sind zwei Treffer.
4. Pfeil ab/auf bewegt die Markierung (die gewählte Zeile bleibt im sichtbaren Bereich), Enter öffnet die Datei, klappt ihre Ordner im Baum auf und zeigt die Zeile; ist die Datei unverändert und der Baum steht auf „Geändert“, wechselt er auf „Alle Dateien“. Esc schließt die Liste und gibt den Fokus zurück.
5. Ein Klick außerhalb schließt die Liste; der Suchtext bleibt je Session erhalten, bis eine Datei gewählt wird.
6. Mit 50 000 Pfaden reagiert die Liste beim Tippen ohne spürbare Pause: die Wertung läuft höchstens einmal je Tastendruck über die Pfade und hält nur die besten `MAX_RESULTS`.
7. `pnpm check` grün.

## Checkliste

- [x] `src/features/files/searchFiles.ts`: reine Funktion `searchFiles(query, groups, trees)` nach Kontrakt; `SearchHit = { group; entryKey; path; change: FileChange | null; nameMatch: [number, number] | null }`. Für geänderte Dateien `entryKey` der gezeigten Fassung, sonst der Anker.
- [x] `src/features/files/FileSearch.tsx` + `.css`: Feld und Liste nach „Aufbau“, `role="combobox"` am Feld, `role="listbox"` an der Liste, `aria-activedescendant` für die Markierung.
- [x] `useRepoTrees.ts`: Funktion `loadAll()` für AK 2.
- [x] `FilesToolbar.tsx`: `FileSearch` rechts einhängen.
- [x] `src/app/App.tsx`: Tastenkürzel Strg P neben Strg N; ruft `showView('files')` bzw. `showProjectView('files')` und setzt über ein Signal im `files`-Zustand (`focusSearch: number`, hochgezählt) den Fokus. `event.preventDefault()` immer, wenn das Kürzel greift.
- [x] `src/features/terminal/terminalInstances.ts`: Strg P an die App durchlassen wie Strg Ö.
- [x] Hilfetext: `title` am Feld „Datei suchen (Strg P)“.
- [x] `pnpm check`.
- [x] Doku: kein Dokument nennt Tastenkürzel (Suche nach „Strg N“ in `docs/` und README ohne Treffer in lebenden Dateien); Code-Map-Zeile „Dateien“ um `FileSearch`, `searchFiles` ergänzt. Die README des Projekts nennt „Dateien“ noch nicht — Phase 7.

## Report-Back

Phase 5 complete. Abweichungen vom Plan, beide klein:

- `searchFiles` liefert `{ hits, matchCount, fileCount, pendingGroups }` statt nur `SearchHit[]`, weil der Kopf „n Treffer in m Dateien“ und „Dateien werden gelesen …“ die Zahlen brauchen; `SearchHit` trägt zusätzlich `stat` (Zeilenzahlen im gewählten Blickwinkel).
- Der Zustand hat neben `focusSearch` ein `focusDone`: so wird das Strg-P-Signal auch bedient, wenn der Reiter erst durch das Kürzel erscheint, und beim späteren Wiederöffnen des Reiters nicht erneut.
- `RepoTree` scrollt eine von außen gewählte Datei (Suche, später Chat-Link) in den sichtbaren Bereich.
- Strg P ohne Repository ruft `preventDefault` nicht auf (Plan: „tut nichts“).
- Wackelstelle: `FileSearch.tsx` Tastatur-/Fokus-Zusammenspiel (Esc gibt den Fokus an das vorher fokussierte Element zurück, Klick in die Liste behält den Fokus im Feld) und Scroll zur Zeile in `RepoTree.tsx` sind nur per `pnpm check` belegt, nicht in der echten App gelaufen. Keine Leistungsmessung mit 50 000 Pfaden (Wertung läuft einmal je Tastendruck, Index je Baum zwischengespeichert).
