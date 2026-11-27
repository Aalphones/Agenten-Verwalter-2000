# Phase 4 — Oberfläche: Einstellungen und Hinweis im Archiv

## Kontext

Lesen: [README.md](README.md) (Kontrakt, AK 5 und 6), `src/features/settings/settingsCatalog.ts` (jede Zeile = Eintrag in `ENTRY_DATA` + Zweig in `renderRow`), `src/features/settings/SettingsView.tsx` → Zweige `autoCompactStations` (Schalter) und `autoCompactThreshold` (Regler) als 1:1-Muster, `src/components/Slider.tsx`, `src/features/settings/SettingRow.tsx`, `src/features/settings/useSettings.ts`, `src/features/archive/ArchiveCard.tsx`, `src/features/archive/ArchiveDialog.tsx`, `src/lib/retention.ts` (aus Phase 3), `docs/conventions/react.md`, `docs/conventions/tailwind.md`, `docs/conventions/typescript.md`. Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): die dortigen Einträge betreffen Tests und Radix, hier keine einschlägig.

Kein Mockup vorhanden; die Struktur unten ist die verbindliche Vorgabe. Screen-Eigentümer der Einstellungsseite ist ADR 054 — diese Phase fügt sich in dessen Zeilen-Schema und baut keinen eigenen Container.

## Struktur

Kategorie `app`, neuer Abschnitt **„Aufräumen“**, drei Einträge in dieser Reihenfolge am Ende der Kategorie:

| Schlüssel | Label | Bedienelement | `isShown` |
|---|---|---|---|
| `archiveTrim` | „Beim Archivieren ausdünnen“ | `Switch`, Label „Bau-Ordner und große Dateien löschen“ | immer |
| `archivePurge` | „Archivierte Vorhaben löschen“ | `Switch`, Label „nach Ablauf der Frist löschen“ | immer |
| `archivePurgeDays` | „Löschen nach“ | `Slider` min 7, max 365, step 1, `format` → `„<n> Tage“`, darunter die Vorschau-Zeile | nur wenn `settings.archivePurge` |

ⓘ-Texte (wörtlich):

- `archiveTrim`: „Löscht beim Archivieren eines Vorhabens aus dessen Scratchpads, was sich wiederherstellen lässt oder nur Platz kostet: Bau-Ordner wie node_modules und target, Datenbank-Kopien, Modelle, Pakete und jede Datei ab 50 MB. Bilder, HTML-Seiten, Markdown, PDFs, Logs und Skripte bleiben, ebenso alle Artefakte und Anhänge. Bereits archivierte Vorhaben werden beim nächsten täglichen Lauf nachgeholt. Lässt sich nicht rückgängig machen.“
- `archivePurge`: „Löscht ein archiviertes Vorhaben endgültig, sobald es länger als die Frist im Archiv liegt: Verlauf, Werkzeug-Ausgaben, Scratchpads, Artefakte, Anhänge, Notiz und die Transkripte der Kommandozeile. Danach ist es weder im Archiv zu finden noch wiederherstellbar. Aktive Vorhaben sind nie betroffen; wer ein Vorhaben behalten will, holt es vor Ablauf aus dem Archiv. Der Lauf startet zehn Minuten nach dem App-Start und danach täglich — nie sofort beim Einschalten.“
- `archivePurgeDays`: „Wie lange ein Vorhaben nach dem Archivieren erhalten bleibt, 7 bis 365 Tage. Die Zeile darunter zeigt, wie viele Vorhaben der nächste Lauf mit dieser Frist löscht.“

Vorschau-Zeile unter dem Regler (Komponente `RetentionPreviewLine` in `src/features/retention/`, Hook `useRetentionPreview(days)` ruft `loadRetentionPreview` bei jeder Änderung des gespeicherten Werts): bei `projects === 0` „Der nächste Lauf löscht nichts.“, sonst „Der nächste Lauf löscht <n> Vorhaben mit <m> Sessions.“ — in der Warnfarbe des Design-Systems (Token für Warnungen aus `src/styles/`, kein eigener Farbwert). Während des Ladens leer, bei Fehler der Fehlersatz über `useActionError`.

Archiv-Karte (`ArchiveCard`): ist `settings.archivePurge` an, steht in der Meta-Zeile der Karte zusätzlich „wird am TT.MM.JJJJ gelöscht“ (`archivedAt + archivePurgeDays × 86 400 000`); liegt das Datum in der Vergangenheit, „wird beim nächsten Lauf gelöscht“. `ArchiveDialog` reicht dafür die Einstellungen aus `useSettings` an die Karte. Schalter aus → Zeile fehlt.

## Akzeptanzkriterien

- Unter „Einstellungen → App → Aufräumen“ stehen die drei Zeilen mit Labels, Bedienelementen und ⓘ-Texten wie oben; der Regler erscheint nur bei eingeschaltetem „Archivierte Vorhaben löschen“.
- Der Regler geht von 7 bis 365, zeigt „<n> Tage“ und speichert beim Loslassen; nach einem Neustart steht derselbe Wert.
- Die Vorschau-Zeile zeigt für den gespeicherten Wert die Zahlen aus `retention_preview` und wechselt nach dem Loslassen des Reglers.
- Die Suche der Einstellungsseite findet die drei Zeilen über „Archiv“, „löschen“ und „Aufräumen“ (`settingsSearch.ts` durchsucht Label und ⓘ-Text — prüfen, sonst Stichwörter ergänzen).
- Die Archiv-Karte zeigt bei eingeschaltetem Löschen das Datum bzw. „beim nächsten Lauf“, bei ausgeschaltetem nichts.
- Tastatur: beide Schalter und der Regler sind per Tab erreichbar, der Regler mit Pfeiltasten bedienbar (liefert `Slider` bereits).

## Checkliste

- [ ] `src/features/settings/settingsCatalog.ts`: drei Einträge in `ENTRY_DATA` nach der Tabelle; Zusammenfassung der Kategorie `app` um „Aufräumen“ ergänzen.
- [ ] `src/features/settings/SettingsView.tsx`: drei Zweige in `renderRow` nach den Mustern `autoCompactStations` und `autoCompactThreshold`; unter dem Regler `RetentionPreviewLine`.
- [ ] `src/features/retention/useRetentionPreview.ts`, `RetentionPreviewLine.tsx` (+ `.css` nach BEM-Konvention).
- [ ] `src/features/archive/ArchiveCard.tsx` und `ArchiveDialog.tsx`: Löschdatum nach der Struktur oben; Datumsformat über die vorhandene Formatierung der Karte.
- [ ] `docs/code-map.md`: Zeile „Aufbewahrung“ um die Oberfläche ergänzen (`src/features/retention/`, `src/lib/retention.ts`, Zeilen in `settingsCatalog.ts`, Hinweis in `ArchiveCard`).
- [ ] `pnpm check` grün.

## Report-Back
