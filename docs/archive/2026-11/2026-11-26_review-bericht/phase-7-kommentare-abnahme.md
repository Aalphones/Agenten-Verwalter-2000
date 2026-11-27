# Phase 7 — Kommentare und Abnahme

Status: complete

Rating: standard. Aus dem Bericht kommentiert der Benutzer Codezeilen, Stopps, Schaubilder und Bildbereiche; die Kommentare sammeln sich im Bericht und gehen mit „Kommentare senden“ an eine Rückfrage zur Umsetzung (frische Session mit Lagebericht, ADR 048) — nicht an eine Station, deren Cache kalt oder die schon fertig ist. Die Rückfrage bespricht die Kommentare und ergänzt bei Bedarf Stationen. „Abnehmen“ schließt die Abnahme-Station.

## Kontext (lesen)

- Entwurf (verbindlich): `artifacts/_review-bericht-entwurf/review.js` (Composer `#cpop`: `openComposer`, `saveComment`, `closeComposer`; Liste `#clist`; Knöpfe `#btnSend`, `#btnAccept` mit Rückgängig-Toast; `data-act="cstop"`, Zeilen-Plus, „Bereich kommentieren“ in der Lightbox), `review-bericht-entwurf.html` (Leiste `.rv-bar .acts`, `#cpop`)
- **Abweichung vom Entwurf:** Der Entwurf schickt Kommentare an die Station („geht mit der nächsten Nachricht an die Station“, `review.js:98`, Toast „… als Hinweis mit“ `review.js:888`). Ziel, Hinweistexte und Abnehmen gelten nach AK 2–6 dieser Datei, nicht nach dem Entwurf; Aufbau und Optik bleiben verbindlich.
- [README.md](README.md) → Kontrakt: „Kommentarziel“ mit „Empfänger“
- `src-tauri/src/review/model.rs` (`CommentTarget`, `ReviewComment`), `src-tauri/src/review/mod.rs` (`validate`, `agent_text`), `src-tauri/src/tldr/transcript.rs` (Zeilen der Kommentare im TL;DR-Text)
- `src/stores/review.ts` (`useReviewStore`: `upsert`, `remove`, `clear`, `openBox`, `closeBox`; `lineIdOf`, `artifactLineId`, `imageLineId`), `src/features/review/` (`CommentBox`, `ReviewCommentCard`, `ReviewCommentList`, `reviewLabels` mit `whereLabel`, `kindLabel`)
- `src/features/changes/DiffView.tsx` (wie eine Diff-Zeile einen Kommentar bekommt), `src/features/attachments/ImageViewer.tsx` (Bereich auf einem Bild wählen)
- `src/lib/chat.ts` (`sendMessage` mit `comments`), `src/lib/implementation.ts` (`completeStationByUser`, `createInquiry`)
- Rückfrage (ADR 048, `docs/decisions/048-umsetzung.md`): `src/features/implementation/useInquiry.ts` (Muster: anlegen, Anhang in den Store, Session öffnen), `src-tauri/src/sessions/registry/implementation.rs` (`new_inquiry`, `report_update` — frischt den Lagebericht beim Senden selbst auf; `implementation_of_session`), `src-tauri/src/implementation/report.rs` (`INQUIRY_LINE`), `src-tauri/src/implementation/changes.rs` (`propose`: lehnt bei `finished_at` ab), `SessionSummary.inquiryOf` (`src-tauri/src/sessions/model.rs`)
- Phase-5/6-Dateien `src/features/report/*`
- Fehlerklassen geprüft: keine einschlägig.

## AK

1. `CommentTarget::Report` nach Kontrakt im Core (Tag `kind: "report"`), `validate` prüft Längen (`label` ≤ 80, `phase_key` ≤ 12), `agent_text` schreibt `Review-Bericht, Phase <key>, <label> (n<entry>): <Kommentar>` (ohne `entry` ohne Klammer); TL;DR-Zeilen und `reviewLabels` (`whereLabel`, `kindLabel` „Bericht“) kennen die Variante; `pnpm bindings`.
2. **Ziel ist die Rückfrage der Umsetzung**, egal ob der Bericht in einer Station-Session oder in der Umsetzungs-Ansicht offen ist: die neueste nicht archivierte Session mit `inquiryOf` = Umsetzung (auch eine von Hand angelegte Rückfrage zählt); gibt es keine, legt „Kommentare senden“ eine an. Die Leiste nennt das Ziel im Titel des Knopfs („geht an Rückfrage #<Nr>“ bzw. „geht an eine neue Rückfrage“). Kommentare an Stationen gehen aus dem Bericht nie.
2a. **Core:** `implementation_of_session` nimmt für eine Session ohne `station_of` zuerst ihr `inquiry_of` und erst danach `latest_of_project` — sonst plant eine Rückfrage in einem Vorhaben mit mehreren Umsetzungen die falsche um.
3. **Kommentieren:** „+“ an jeder Zeilennummer eines Code-Blocks (`Add` und `Context`; Ziel `Diff` mit Repository-Schlüssel, Pfad, neuer Zeile), Knopf „Kommentar“ in der Metazeile jedes Stopps (Ziel `Report` mit `entry` = Lead des Stopps, `label` = Titel), Knopf „Kommentar“ an jedem Schaubild und jedem Bildschirm der Sichtabnahme (Ziel `Report` mit `entry` = Eintrag, `label` = Bildschirm-Name) und „Bereich kommentieren“ an jedem Foto und in der großen Bildansicht (Ziel `Report` mit `entry` = Eintrag, `label` = Unterschrift; beim Bereich der Bereich als Prozentangabe im Kommentartext „[Bereich x %, y %, b %, h %]“). Das Kommentarfeld öffnet an der Stelle (Popover), Strg+Enter sammelt, Escape schließt; Hinweis „geht mit „Kommentare senden“ an die Rückfrage zur Umsetzung“.
4. Gesammelte Kommentare liegen in `useReviewStore` unter dem Schlüssel `report:<implementationId>` (nicht unter einer Session), erscheinen an ihrer Stelle im Bericht (Karte unter der Zeile bzw. am Ende des Stopps) und als Zahl in der Leiste; Klick auf die Zahl öffnet die Liste (Bearbeiten, Entfernen über die bestehenden Karten).
5. **„Kommentare senden“** (aktiv ab einem Kommentar), Hook `useReportSend.ts`: (a) Ziel nach AK 2 bestimmen; fehlt es, `createInquiry(implementationId)` und dessen `attachment.id` mitsenden; eine bestehende Rückfrage bekommt den aufgefrischten Lagebericht vom Core selbst (`report_update`). (b) `sendMessage(ziel, SEND_TEXT, anhang, kommentare)` mit `SEND_TEXT` wörtlich: „Kommentare aus dem Review-Bericht dieser Umsetzung. Ordne sie mit mir ein. Braucht es Nacharbeit, schlag die Stationen vor und ergänze sie nach meinem Okay mit implementation_set_phases.“ (c) `clear("report:<id>")`, dann die Rückfrage öffnen (wie `useInquiry`: `onSessionCreated` bzw. Auswahl der Session). Fehler als Fehlersatz in der Leiste (`useActionError`); bei Fehler bleiben die Kommentare gesammelt.
6. **„Abnehmen“** nur sichtbar, wenn `acceptance` existiert und die Station bereit ist bzw. auf den Benutzer wartet; **gesperrt, solange gesammelte Kommentare existieren** (Titel des Knopfs: „Erst Kommentare senden oder entfernen — nach der Abnahme lassen sich keine Stationen mehr ergänzen.“). Sonst ruft er `completeStationByUser` mit Ergebnis „Abgenommen im Review-Bericht“; 8 Sekunden Hinweis mit „Rückgängig“ vor dem Aufruf (Rückgängig bricht ab). Nach der Abnahme zeigt die Leiste „abgenommen · <Datum Uhrzeit>“, Kommentar-Knöpfe verschwinden.
7. Hell und dunkel, 1440 und 900 px; `pnpm check` grün.

## Checkliste

- [x] Core: `review/model.rs` Variante, `review/mod.rs` `validate`/`agent_text`, `tldr/transcript.rs`; `implementation_of_session` mit `inquiry_of` vor `latest_of_project` (AK 2a); `pnpm bindings`.
- [x] `src/stores/review.ts`: `reportLineId(phaseKey, entry)`, Schlüssel `reportCommentKey(implementationId)` = `report:<id>`; `src/features/review/reviewLabels.ts` Variante.
- [x] `src/features/report/`: `ReportCommentPopover.tsx`, Kommentarknöpfe in `ReportCode.tsx`, `ReportStop.tsx`, `ReportFigure.tsx`, `ReportLightbox.tsx`; Leiste `ReportBar.tsx` mit Zahl, Liste, „Kommentare senden“, „Abnehmen“ (gesperrt bei Kommentaren); `useReportTarget.ts` (Rückfrage aus den Session-Zusammenfassungen), `useReportSend.ts` (AK 5).
- [x] Doc: `docs/code-map.md` Zeilen „Review-Bericht“ und „Review-Kommentare“ (Variante `Report`); `docs/glossary.md`: „Abnehmen (Bericht)“, Eintrag „Rückfrage (Umsetzung)“ um „bekommt die Kommentare aus dem Review-Bericht“ ergänzen; ADR 073 um den Absatz „Kommentare an die Rückfrage“ ergänzen.
- [x] `pnpm check`.

## Report-Back

Ergebnis: Kommentare an Codezeilen („+“), Stopps, Schaubildern, Bildschirmen und Bildbereichen (Zeichen-Ebene auf dem Foto, auch in der Lightbox) werden unter `report:<Umsetzung>` gesammelt und mit „Kommentare senden“ an die Rückfrage der Umsetzung geschickt (sonst neu angelegt); „Abnehmen“ schließt die Abnahme-Station nach 8 s Rückgängig. `pnpm check` grün; Oberfläche nicht in der echten App gelaufen.

Abweichungen vom Plan:
- `reportLineId(phaseKey, entry, label, area?)` statt `(phaseKey, entry)`: Stopps ohne Eintrag und mehrere Bildbereiche je Bild brauchen eine eigene ID.
- `useReportSend` leert mit `clearIds` nur die gesendeten Kommentare, nicht den ganzen Schlüssel: was während des Sendens dazukam, bleibt gesammelt.
- `EntryTarget.slot`: gleichnamige Stopps ohne Lead kollidierten in der ID.
- Abnahme-Zustand (sichtbar, gesperrt, „abgenommen“) kommt aus dem Live-Stand der Umsetzung, nicht aus `report.acceptance.state`: der Bericht lädt nur bei `report://changed` neu, ein Station-Abschluss löst das nicht aus.
- „Bereich kommentieren“ ist ein Knopf in der Werkzeugzeile des Fotos mit Zeichen-Ebene (Rahmen aufziehen, Enter = Bildmitte), nicht im Kopf.
- Bild-Einträge in Schritten und Klickpfad haben keinen Bereichskommentar; Marken tragen keinen eigenen Kommentarknopf.
- Kommentarfeld, Hinweis „Abgenommen“ und Liste hängen per Portal am `body` (der Bericht-Container hat `container-type`, das verschiebt `position: fixed`).

Wackelstellen: Zeichen-Ebene in `ReportPicture.tsx` (Pointer-Capture plus `click`) und Kommentarfeld in der Lightbox (Escape schließt zuerst das Feld) sind nur per Typecheck belegt.
