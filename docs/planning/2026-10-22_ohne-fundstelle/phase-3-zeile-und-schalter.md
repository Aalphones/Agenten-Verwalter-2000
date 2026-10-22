# Phase 3 — Abschlusszeile mit Sprung, Schalter; Doku-Abschluss

Lesen: [README.md](README.md) (Kontrakt `TurnSummary.unsourced`, Einstellung), Entwurf Abschnitte 1 und 2, `src/features/notices/` (`TurnSummaryLine.tsx` + `.css`, `NoticeBlock.tsx` Fall `turnSummary`, `noticeTexts.ts`), `src/features/chat/ChatTimeline.tsx` und `PinnedUserMessage` (wie dort zu einer `seq` gesprungen wird), `src-tauri/src/settings/model.rs` + `mod.rs`, `src/features/settings/SettingsView.tsx` (Abschnitt „Agent“), `src/components/Switch.tsx`.

## AK der Phase

1. Ist `notice.unsourced` nicht leer und der Schalter an, zeigt die Abschlusszeile den Knopf `turn-summary__unsourced` mit gepunktetem Strich davor und dem Text „1 Angabe ohne Fundstelle“ / „N Angaben ohne Fundstelle“ (N = Summe der Marken der geladenen Einträge; fehlt einer im geladenen Ausschnitt, N = Zahl der Einträge mit dem Text „N Antwortteile mit Angaben ohne Fundstelle“). Farbe `--color-waiting`.
2. Klick springt zum ersten Eintrag der Liste, jeder weitere Klick zum nächsten, nach dem letzten wieder zum ersten; nach dem Sprung erhält die erste `.unsourced`-Stelle des Eintrags den Fokus (zeigt die Erklärung).
3. Neue Einstellungszeile im Abschnitt „Agent“ nach „Standard-Modus“: Label „Angaben ohne Fundstelle“, ⓘ-Text „Unterstreicht Pfade, Datei:Zeile und Zahlen ab zwei Ziffern, die in keiner Werkzeug-Ausgabe derselben Antwort vorkommen.“, Bedienelement `Switch` mit Label „markieren“. Standard an; wirkt sofort.

## Checkliste

- [ ] Core: `Settings.mark_unsourced: bool`, `DEFAULT_SETTINGS` mit `true`, `KEY_MARK_UNSOURCED = "mark_unsourced"`, Lesen in `load` über `stored_or` (bool als JSON-Text `true`/`false`), `SettingsChange::MarkUnsourced { value: bool }` mit Zweig in `update`; `pnpm bindings`.
- [ ] `noticeTexts.ts`: `unsourcedText(count: number): string`, `unsourcedPartsText(count: number): string`.
- [ ] `TurnSummaryLine.tsx`: Props `unsourced: readonly number[]` und `onJump: (seq: number) => void`; Knopf nach AK 1 mit eigenem Index-Zustand für AK 2. `NoticeBlock.tsx` reicht `notice.unsourced` und einen Sprung-Rückruf durch, den `ChatTimeline` bereitstellt (dieselbe Mechanik wie der Sprung von `PinnedUserMessage`; danach `querySelector('[data-seq="<seq>"] .unsourced')?.focus()` — trägt das Eintrags-Element kein `data-seq`, dort ergänzen).
- [ ] Die Zählung N braucht die Einträge: `ChatTimeline` gibt `NoticeBlock` eine Funktion `markCount(seqs) -> number | null` mit, die aus den geladenen Einträgen summiert und `null` liefert, wenn einer fehlt.
- [ ] `SettingsView.tsx`: Zeile nach AK 3 mit `save({ kind: 'markUnsourced', value })`.
- [ ] Doc: `docs/glossary.md` neuer Eintrag **Ohne Fundstelle**: „Angabe in einer Antwort des Agenten (Pfad, Datei:Zeile, Zahl ab zwei Ziffern), die in keiner Werkzeug-Ausgabe derselben Antwort und nicht in der Nachricht des Nutzers vorkommt; im Verlauf gepunktet unterstrichen (ADR 036).“ `docs/code-map.md` Zeile „Einstellungen“ um den Schalter ergänzen.
- [ ] Plan-Abschluss: README-Bottom-Sektionen, Archiv, STATE.md, Versions-Tag.
- [ ] `pnpm check` grün, Commit `feat(settings): Schalter für Angaben ohne Fundstelle, Sprung aus der Abschlusszeile`.

## Report-Back
