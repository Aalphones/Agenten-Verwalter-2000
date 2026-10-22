# Phase 2 — Oberfläche: Karten, Liste und Store für alle drei Arten

Lesen: [README.md](README.md) (Kontrakt, Schlüssel), Entwurf [artifacts/entwurf-kommentare-artefakt-bild.html](artifacts/entwurf-kommentare-artefakt-bild.html) Abschnitt 3, `src/stores/review.ts`, `src/features/review/` (`ReviewCommentCard.tsx` + `.css`, `reviewLabels.ts`, `ReviewCommentList.tsx`), `src/features/chat/UserMessage.tsx`, `src/features/changes/DiffView.tsx` (Aufruf von `upsert`), [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md).

## AK der Phase

1. `ReviewCommentCard` zeigt im Kopf vor dem Ort eine Marke `Diff`, `Artefakt` oder `Bild` (Klasse `review-card__kind`, Stil wie im Entwurf: kleine Pille, `bg-hover`, 10,5 px, fett).
2. Ortstext (`whereLabel`): Diff unverändert; Artefakt `<file> · <selector-Ende> „<label>“` (Selector-Ende = letztes Glied nach `>`, getrimmt); Bild `<name> · Bereich <width> × <height> bei <x>, <y>`.
3. Code-Zeile: Diff unverändert; Artefakt zeigt `code` einfarbig ohne Vorzeichen (Klasse `review-card__code--element`, keine Syntaxfarben); Bild zeigt statt Code den Streifen `review-card__crop`: Vorschaubild 56 × 34 px (`convertFileSrc(path)`, `object-fit: cover`) mit dem Rechteck als 1,5-px-Rahmen in Akzentfarbe, maßstäblich über `object-position`/Prozentwerte, daneben „Bereich auf dem Bild markiert · das Bild geht mit“.
4. Bearbeiten und Entfernen funktionieren für alle Arten wie heute; gesendete Karten in `UserMessage` zeigen dieselben Zweige ohne Knöpfe.
5. Die Diff-Ansicht setzt beim Anlegen `target: { kind: 'diff' }`; sonst verhält sie sich unverändert.

## Checkliste

- [ ] `src/stores/review.ts`: `artifactLineId` und `imageLineId` nach Kontrakt exportieren (Typ `ImageTarget` = `Extract<CommentTarget, { kind: 'image' }>`; `ArtifactTarget` analog). Keine Änderung an `upsert`.
- [ ] `DiffView.tsx`: beim Bauen des `ReviewComment` `target: { kind: 'diff' }` ergänzen.
- [ ] `reviewLabels.ts`: `whereLabel` mit `switch (comment.target.kind)`; neue Funktion `kindLabel(target: CommentTarget): string` → `'Diff' | 'Artefakt' | 'Bild'`; neue Funktion `selectorTail(selector: string): string`.
- [ ] `ReviewCommentCard.tsx`: Marke vor `__where`; den Code-Block in eine Render-Funktion `renderBody(comment)` mit drei Zweigen nach AK 3 ziehen (React-Konvention: Bedingung über mehrere Zweige in eine Render-Funktion). CSS in `ReviewCommentCard.css`: `&__kind`, `&__code--element`, `&__crop`, `&__crop-thumb`, `&__crop-frame`.
- [ ] Für das Rechteck auf dem Vorschaubild: Container 56 × 34 px `position: relative; overflow: hidden`, Bild mit `width: 100%; height: 100%; object-fit: contain`, Rahmen absolut positioniert mit `left = x / image_width * 100 %` usw. (contain statt cover, damit die Prozentwerte stimmen; Hintergrund `bg-sidebar`).
- [ ] Doc: `docs/code-map.md` Zeile „Review-Kommentare“ um `artifactLineId`/`imageLineId`, `kindLabel`, `CommentTarget` (Core `review/model.rs`) ergänzen; `docs/glossary.md` Eintrag **Review-Kommentar**: „Kommentar zu einer Diff-Zeile, einem Element eines Artefakts oder einem Bereich auf einem Bild …“.
- [ ] `pnpm check` grün, Commit `feat(review): Karten für Artefakt- und Bild-Kommentare`.

## Report-Back
