# Phase 4 — Bild: Bildansicht mit Bereich aufziehen; Doku-Abschluss

Lesen: [README.md](README.md) (Kontrakt `CommentTarget::Image`, Schlüssel), Entwurf Abschnitt 2, `src/features/attachments/AttachmentChip.tsx` + `.css`, `AttachmentRow`, `src/components/Dialog.tsx` (Props `labelledBy`, `className`, `onClose`, `children`), `src/features/review/CommentBox.tsx`, `src/stores/review.ts`, `src/features/chat/UserMessage.tsx`, `src/features/chat/Composer.tsx`.

## AK der Phase

1. Das Vorschaubild eines Bild-Anhangs (`kind === 'image'`) in der Eingabeleiste und in gesendeten Nachrichten ist ein Knopf (Titel „Bild ansehen und kommentieren“); Klick öffnet die Bildansicht. Datei-Anhänge bleiben, wie sie sind.
2. Die Bildansicht ist ein `Dialog` (Breite bis 92 vw / 880 px Mindestbreite wo möglich): Kopf mit Name, `<Breite> × <Höhe>`, Satz „Bereich aufziehen, um ihn zu kommentieren“, Knöpfe „Originalgröße“ (schaltet zwischen eingepasst und 1:1 mit Scrollen) und „Schließen“. Darunter das Bild.
3. Ziehen mit gedrückter linker Maustaste zeichnet ein Rechteck (2 px Akzent, 10 % Akzentfläche) mit Maßschild `<w> × <h> bei <x>, <y>` in Bild-Pixeln. Unter 8 × 8 Bild-Pixeln gilt es als Klick und verwirft sich. Beim Loslassen öffnet sich das `CommentBox` am Rechteck (`fileLabel` = Name, `lineLabel` = `Bereich <n>`).
4. Schon gesammelte Bereiche dieses Bilds stehen als Rahmen mit Nummer im Bild; Klick auf einen Rahmen öffnet dessen Kommentar zum Bearbeiten.
5. „Zum Chat hinzufügen“ legt den Kommentar nach Kontrakt in die Liste der **aktuellen** Session (`upsert` mit `imageLineId`); Esc schließt erst ein offenes Kommentarfeld, dann die Ansicht.
6. Koordinaten stimmen in beiden Darstellungen (eingepasst und 1:1): Umrechnung über `naturalWidth / clientWidth`.

## Checkliste

- [ ] Neuer Ordner-Inhalt `src/features/attachments/ImageViewer.tsx` + `ImageViewer.css` (BEM `image-viewer__*`): Props `{ sessionId: string; attachment: Attachment; onClose: () => void }`. Zustand: `isActualSize`, `drag: { startX, startY, x, y } | null`, `pending: ImageRect | null`. Bild über `convertFileSrc(attachment.path)`; Pointer-Ereignisse mit `setPointerCapture` auf der Bildfläche; Umrechnung in eine reine Funktion `toImageRect(start, end, scale): ImageRect` in `src/features/attachments/imageRect.ts` (ganzzahlig, auf das Bild geklemmt).
- [ ] Zustand „welches Bild ist offen“ in `src/stores/attachments.ts`: `viewer: { sessionId: string; attachment: Attachment } | null`, Aktionen `openViewer`, `closeViewer`. Die Ansicht rendert `ChatView` einmal (eine Stelle), damit Eingabeleiste und Verlauf denselben Einstieg nutzen.
- [ ] `AttachmentChip.tsx`: neue Prop `onOpen?: () => void`; ist sie gesetzt und `kind === 'image'`, wird das Vorschaubild in einen `<button className="attachment-chip__open">` gelegt. `AttachmentRow` reicht `onOpen` je Anhang durch; `Composer` und `UserMessage` setzen es auf `openViewer(session.id, attachment)`.
- [ ] Kommentar bauen: `target = { kind: 'image', attachmentId: attachment.id, path: attachment.path, name: attachment.name, x, y, width, height, imageWidth: naturalWidth, imageHeight: naturalHeight }`, übrige Felder nach Kontrakt.
- [ ] Doc: `docs/code-map.md` Zeile „Anhänge“ um `ImageViewer`, `imageRect.ts`, `viewer` im Store ergänzen; `docs/glossary.md` neuer Eintrag **Bildansicht**: „Großansicht eines Bild-Anhangs; dort lassen sich Bereiche kommentieren (ADR 035).“
- [ ] Plan-Abschluss: README-Bottom-Sektionen füllen, Plan nach `docs/archive/2026-10/` verschieben, STATE.md nachziehen, Versions-Tag nach [releases.md](../../conventions/releases.md).
- [ ] `pnpm check` grün, Commit `feat(attachments): Bildansicht mit Bereichs-Kommentaren`.

## Report-Back
