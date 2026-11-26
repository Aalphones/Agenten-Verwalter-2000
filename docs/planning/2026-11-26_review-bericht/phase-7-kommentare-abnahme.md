# Phase 7 — Kommentare und Abnahme

Rating: standard. Aus dem Bericht kommentiert der Benutzer Codezeilen, Stopps, Schaubilder und Bildbereiche; die Kommentare sammeln sich als Review-Kommentare der Ziel-Session und gehen mit „Kommentare senden“ oder der nächsten Nachricht an sie. „Abnehmen“ schließt die Abnahme-Station.

## Kontext (lesen)

- Entwurf (verbindlich): `artifacts/_review-bericht-entwurf/review.js` (Composer `#cpop`: `openComposer`, `saveComment`, `closeComposer`; Liste `#clist`; Knöpfe `#btnSend`, `#btnAccept` mit Rückgängig-Toast; `data-act="cstop"`, Zeilen-Plus, „Bereich kommentieren“ in der Lightbox), `review-bericht-entwurf.html` (Leiste `.rv-bar .acts`, `#cpop`)
- [README.md](README.md) → Kontrakt: „Kommentarziel“
- `src-tauri/src/review/model.rs` (`CommentTarget`, `ReviewComment`), `src-tauri/src/review/mod.rs` (`validate`, `agent_text`), `src-tauri/src/tldr/transcript.rs` (Zeilen der Kommentare im TL;DR-Text)
- `src/stores/review.ts` (`useReviewStore`: `upsert`, `remove`, `clear`, `openBox`, `closeBox`; `lineIdOf`, `artifactLineId`, `imageLineId`), `src/features/review/` (`CommentBox`, `ReviewCommentCard`, `ReviewCommentList`, `reviewLabels` mit `whereLabel`, `kindLabel`)
- `src/features/changes/DiffView.tsx` (wie eine Diff-Zeile einen Kommentar bekommt), `src/features/attachments/ImageViewer.tsx` (Bereich auf einem Bild wählen)
- `src/lib/chat.ts` (`sendMessage` mit `comments`), `src/lib/implementation.ts` (`completeStationByUser`)
- Phase-5/6-Dateien `src/features/report/*`
- Fehlerklassen geprüft: keine einschlägig.

## AK

1. `CommentTarget::Report` nach Kontrakt im Core (Tag `kind: "report"`), `validate` prüft Längen (`label` ≤ 80, `phase_key` ≤ 12), `agent_text` schreibt `Review-Bericht, Phase <key>, <label> (n<entry>): <Kommentar>` (ohne `entry` ohne Klammer); TL;DR-Zeilen und `reviewLabels` (`whereLabel`, `kindLabel` „Bericht“) kennen die Variante; `pnpm bindings`.
2. **Ziel-Session:** in einer Station-Session deren Session; in der Umsetzungs-Ansicht die Session der zuletzt gestarteten Station mit Session. Die Leiste nennt das Ziel im Titel des Knopfs („geht an #<Nr> <Stage>“).
3. **Kommentieren:** „+“ an jeder Zeilennummer eines Code-Blocks (`Add` und `Context`; Ziel `Diff` mit Repository-Schlüssel, Pfad, neuer Zeile), Knopf „Kommentar“ in der Metazeile jedes Stopps (Ziel `Report` mit `entry` = Lead des Stopps, `label` = Titel), Knopf „Kommentar“ an jedem Schaubild und „Bereich kommentieren“ in der großen Bildansicht (Ziel `Report` mit `entry` = Eintrag, `label` = Unterschrift; beim Bereich der Bereich als Prozentangabe im Kommentartext „[Bereich x %, y %, b %, h %]“). Das Kommentarfeld öffnet an der Stelle (Popover), Strg+Enter sammelt, Escape schließt; Hinweis „geht mit der nächsten Nachricht an die Station“.
4. Gesammelte Kommentare erscheinen an ihrer Stelle im Bericht (Karte unter der Zeile bzw. am Ende des Stopps) und als Zahl in der Leiste; Klick auf die Zahl öffnet die Liste (Bearbeiten, Entfernen über die bestehenden Karten). Dieselben Kommentare stehen in der Eingabeleiste der Ziel-Session (bestehende `ReviewCommentList`).
5. **„Kommentare senden“** (aktiv ab einem Kommentar) schickt `sendMessage(ziel, "Kommentare aus dem Review-Bericht.", [], kommentare)` und leert die gesammelten; Fehler als Fehlersatz in der Leiste (`useActionError`).
6. **„Abnehmen“** nur sichtbar, wenn `acceptance` existiert und die Station bereit ist bzw. auf den Benutzer wartet; ruft `completeStationByUser` mit Ergebnis „Abgenommen im Review-Bericht“ (bzw. „… mit <n> Kommentaren als Hinweis“, die dann vorher gesendet werden); 8 Sekunden Hinweis mit „Rückgängig“ vor dem Aufruf (Rückgängig bricht ab, ohne etwas zu senden). Nach der Abnahme zeigt die Leiste „abgenommen · <Datum Uhrzeit>“, Kommentar-Knöpfe verschwinden.
7. Hell und dunkel, 1440 und 900 px; `pnpm check` grün.

## Checkliste

- [ ] Core: `review/model.rs` Variante, `review/mod.rs` `validate`/`agent_text`, `tldr/transcript.rs`; `pnpm bindings`.
- [ ] `src/stores/review.ts`: `reportLineId(phaseKey, entry)`; `src/features/review/reviewLabels.ts` Variante.
- [ ] `src/features/report/`: `ReportCommentPopover.tsx`, Kommentarknöpfe in `ReportCode.tsx`, `ReportStop.tsx`, `ReportFigure.tsx`, `ReportLightbox.tsx`; Leiste `ReportBar.tsx` mit Zahl, Liste, „Kommentare senden“, „Abnehmen“; `useReportTarget.ts` (Ziel-Session).
- [ ] Doc: `docs/code-map.md` Zeilen „Review-Bericht“ und „Review-Kommentare“ (Variante `Report`); `docs/glossary.md`: „Abnehmen (Bericht)“.
- [ ] `pnpm check`.

## Report-Back
