# Phase 2 — Einstellung „Notiz“ und Reiter oben

**Rating:** standard

## Kontext (vor dem ersten Edit lesen)

- `README.md` dieses Plans (Kontrakt: `NotePlacement`, Reiter-Schlüssel `'note'`), Report-Back von Phase 1.
- `docs/decisions/054-einstellungen-kategorien-und-suche.md` (Katalog, Kategorien, ⓘ-Texte).
- Einstellung als Muster, Ende zu Ende: `src-tauri/src/settings/model.rs` (`TerminalPlacement`, Feld `terminal_placement`, `SettingsChange::TerminalPlacement`), `src-tauri/src/settings/mod.rs` (`KEY_TERMINAL_PLACEMENT`, `DEFAULT_SETTINGS`, `stored_or`, Arm in der Änderung), `src/features/settings/TerminalPlacementSegment.tsx`, `settingsCatalog.ts` (Eintrag `terminalPlacement`), `SettingsView.tsx` (`case 'terminalPlacement'`).
- Reiter: `src/stores/sessions.ts` (`SESSION_VIEWS`, `PROJECT_VIEWS`, `IMPLEMENTATION_VIEWS`), `src/app/SessionHeader.tsx` (Filter der `views` ab Zeile ~108, Reiter ab ~279), `src/app/ProjectHeader.tsx` (Filter ~79), `src/features/implementation/ImplementationHeader.tsx` (Filter ~49), `src/app/App.tsx` (`sessionViewShown`, `projectViewShown`, Hauptfläche ab ~570), `src/features/implementation/ImplementationView.tsx` (`activeViewShown` ~317).
- Phase-1-Bausteine: `src/features/notes/NotePane.tsx`, `PencilIcon.tsx`, `src/features/terminal/TerminalDock.tsx`.

## AK

1. Einstellungen, gleiche Kategorie und gleicher Abschnitt wie „Terminal“: Zeile „Notiz“ mit Segment „Im Terminal-Dock“ / „Als Reiter oben“; ⓘ-Text: „Wo die Notiz des Vorhabens erscheint. Sie liegt außerhalb des Arbeitsordners, Agenten sehen sie nicht.“ Standard „Im Terminal-Dock“; die Suche der Einstellungen findet die Zeile mit „notiz“.
2. Die Wahl übersteht einen Neustart (Schlüssel `note_placement` in der Tabelle der Einstellungen).
3. Bei „Als Reiter oben“ steht in der Kopfzeile von Session, Vorhaben-Übersicht und Umsetzung ein Reiter „✎ Notiz“ (Stift aus `PencilIcon`, Beschriftung „Notiz“) als letzter Reiter, immer sichtbar; Klick zeigt `NotePane` als Hauptfläche desselben Vorhabens.
4. Bei „Als Reiter oben“ zeigt das Dock weder Notiz-Reiter noch Stift-Knopf; ein Dock, das zuletzt die Notiz zeigte, zeigt das zuletzt erstellte Terminal.
5. Wird auf „Im Terminal-Dock“ umgestellt, während ein Reiter „Notiz“ oben aktiv ist, zeigt die Kopfzeile ohne Klick wieder Chat (Session), Übersicht (Vorhaben) bzw. Ablauf (Umsetzung).
6. Derselbe Text erscheint in beiden Anzeigeorten (eine Datei je Vorhaben); ein Wechsel zwischen Session und Umsetzung desselben Vorhabens verliert keine Tastendrücke (Speichern beim Unmount aus Phase 1).

## Checkliste

- [x] Rust: `NotePlacement { Dock, Tab }` in `settings/model.rs` (Derive wie `TerminalPlacement`), Feld `note_placement` in den Einstellungen, `SettingsChange::NotePlacement { value }`; in `settings/mod.rs` `KEY_NOTE_PLACEMENT = "note_placement"`, Standard `Dock`, Laden per `stored_or`, Schreiben im Änderungs-Arm wie bei `TerminalPlacement`. `pnpm bindings`.
- [x] `src/features/settings/NotePlacementSegment.tsx` als Kopie von `TerminalPlacementSegment.tsx` mit `dock`/`tab` und den Beschriftungen aus AK 1; Eintrag `notePlacement` in `settingsCatalog.ts` direkt hinter `terminalPlacement`; `case 'notePlacement'` in `SettingsView.tsx`.
- [x] `src/stores/sessions.ts`: `'note'` als letzter Eintrag in `SESSION_VIEWS`, `PROJECT_VIEWS`, `IMPLEMENTATION_VIEWS`.
- [x] Die drei Kopfzeilen: Filter lässt `'note'` nur zu, wenn `notePlacement === 'tab'` (aus `useSettingsStore`, Standard `'dock'`); Beschriftung „Notiz“ mit `PencilIcon` davor.
- [x] `App.tsx`: `sessionViewShown()` und `projectViewShown()` liefern bei `'note'` und `notePlacement !== 'tab'` `'chat'` bzw. `'overview'`; bei `'note'` und `'tab'` rendert die Hauptfläche `<NotePane projectId={…} />` für das Vorhaben der Session bzw. der Übersicht. `ImplementationView.tsx`: `activeViewShown()` analog mit Rückfall `'flow'`, Notiz-Fläche für das Vorhaben der Umsetzung.
- [x] `TerminalDock.tsx`: Notiz-Reiter, Stift-Knopf und `NOTE_TAB_ID`-Auswahl nur bei `notePlacement === 'dock'`; sonst ignoriert `shown` die Auswahl `NOTE_TAB_ID`.
- [x] `docs/code-map.md` Zeile „Notiz im Vorhaben“ und „Einstellungen“ (`note_placement`, `NotePlacementSegment`) nachziehen.

## Prüfung

- `pnpm check` grün (Summenzeile ins Report-Back). Keine automatisierten Tests (privates Profil).

## Report-Back

Phase 2 fertig. Einstellung `note_placement` (Rust, Bindings, Segment, Katalog „Notiz“ unter Darstellung). Reiter `'note'` in den drei Kopfzeilen nur bei „Als Reiter oben“; neue Hauptfläche `NoteView` (NotePane mit Fehlerzeile) in `App.tsx` und `ImplementationView.tsx`; Rückfall auf Chat/Übersicht/Ablauf automatisch, weil die Ansicht bei `dock` nicht als Notiz gilt. Dock blendet Notiz-Reiter und Stift-Knopf bei `tab` aus. `pnpm check` grün. Nicht in der echten App gelaufen. Abweichung: Katalog-Eintrag steht in der Kategorie „Allgemein/Darstellung“ hinter „Terminal“ (wie geplant); ein Reiter „Notiz“ bleibt in der Kopfzeile auch bei Wechsel der Einstellung nur im Store als `'note'` gemerkt, wird aber ohne `tab` nicht gezeigt.
