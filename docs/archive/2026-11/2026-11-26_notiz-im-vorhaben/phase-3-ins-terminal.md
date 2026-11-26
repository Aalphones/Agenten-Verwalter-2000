# Phase 3 — Ins Terminal

**Rating:** standard
**Status:** complete

## Kontext (vor dem ersten Edit lesen)

- `README.md` dieses Plans, Report-Backs von Phase 1 und 2.
- `src/features/notes/NotePane.tsx` (Leiste mit freiem Bereich links), `useProjectNote.ts`.
- `src/lib/terminal.ts` (`writeTerminal`, `listTerminals`), `src/features/terminal/useProjectTerminals.ts` (Liste je Vorhaben, `TerminalInfo.running`), `src/stores/terminal.ts` (`selected`, `isOpen`, `toggle`, `select`, `NOTE_TAB_ID`), `src/features/terminal/terminalInstances.ts` (`show` ruft `instance.term.focus()`), `TerminalPane.tsx`.
- `src/app/App.tsx` (Kurzbefehl `Strg+Ö` öffnet das Dock — Muster für Tastatur-Abfangen, damit `Strg+Enter` nicht doppelt wirkt).

## AK

1. Die Notiz-Leiste zeigt links den Knopf „Ins Terminal“ (Titel „Markierte Zeile bzw. Zeile unter dem Cursor ins Terminal schreiben, ohne Enter (Strg+Enter)“).
2. Ziel ist das gewählte Terminal des Vorhabens (`selected[projectId]`), wenn es läuft, sonst das zuletzt erstellte laufende; der Titel nennt das Ziel („… in Terminal 2“).
3. Gesendet wird die Auswahl im `<textarea>`; ist nichts markiert, die ganze Zeile unter dem Cursor. Zeilenende (`\r`, `\n`) am Rand wird entfernt; es wird **kein** Enter gesendet.
4. Enthält die Auswahl einen Zeilenumbruch, ist der Knopf gesperrt mit Titel „Nur eine Zeile — mehrere Zeilen würden einzeln ausgeführt“; `Strg+Enter` tut dann nichts.
5. Läuft kein Terminal, ist der Knopf gesperrt mit Titel „Kein laufendes Terminal — im Dock mit + eines starten“.
6. Nach dem Senden: Dock-Modus → das Ziel-Terminal wird gewählt und hat den Fokus; Reiter-oben-Modus → das Dock öffnet sich, falls zu, wählt das Ziel und gibt ihm den Fokus. Weiteres Tippen landet im Terminal.
7. `Strg+Enter` im `<textarea>` wirkt wie der Knopf und fügt keinen Zeilenumbruch in die Notiz ein.
8. Leere Zeile (nur Leerraum) → Knopf gesperrt, Titel „Leere Zeile“.

## Checkliste

- [x] `src/features/notes/lineToSend.ts`: reine Funktion `lineToSend(text: string, selectionStart: number, selectionEnd: number): { kind: 'ok'; line: string } | { kind: 'multiline' } | { kind: 'empty' }` nach AK 3, 4, 8.
- [x] `src/features/notes/useSendTarget.ts`: liefert für `projectId` das Ziel-`TerminalInfo | null` nach AK 2 (nutzt `useProjectTerminals` und `useTerminalStore`).
- [x] `NotePane.tsx`: Auswahl per `onSelect`/`onKeyUp`/`onClick` des `<textarea>` in einem State halten; Knopf nach AK 1, 4, 5, 8; `onKeyDown` fängt `Strg+Enter` ab (`preventDefault`, `stopPropagation`); Senden ruft `flush()` aus `useProjectNote`, dann `writeTerminal(target.id, line)`, dann `select(projectId, target.id)` und, wenn das Dock zu ist, `toggle()`. Fehler aus `writeTerminal` → Fehlersatz per `commandErrorText` in der Notiz-Leiste.
- [ ] Fokus: Wird das Ziel-Terminal durch `select` angezeigt, ruft `terminalInstances.show` bereits `focus()`. War es schon sichtbar (Reiter-oben-Modus, Dock offen), in `terminalInstances.ts` `export function focusTerminal(terminalId: string): void` ergänzen (holt die vorhandene Instanz, ruft `term.focus()`, tut nichts ohne Instanz) und nach dem Senden aufrufen.
- [x] `docs/code-map.md` Zeile „Notiz im Vorhaben“ um „Ins Terminal“ (`lineToSend`, `useSendTarget`) ergänzen; `docs/glossary.md` Begriff „Ins Terminal“.

## Prüfung

- `pnpm check` grün (Summenzeile ins Report-Back). Keine automatisierten Tests (privates Profil).

## Report-Back

Phase 3 fertig: `lineToSend`, `useSendTarget`, Knopf und Strg+Enter in `NotePane`, `focusTerminal`; `pnpm check` grün (eslint, tsc, prettier, build, cargo fmt, clippy). Nicht in der echten App gelaufen; Wackelstelle: Fokus nach dem Senden (`NotePane.tsx`, `requestAnimationFrame` + `focusTerminal`).
