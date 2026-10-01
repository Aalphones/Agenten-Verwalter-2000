# Phase 4 — Chat: Karten in der Eingabeleiste, Senden, Karten in der gesendeten Nachricht

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“, „Kontrakt“, „Finale Abnahmekriterien“, „Smoke-Checkliste“.
- [Design-README](../../design/2026-10-01_changes-review/README.md) und die Tafel `canvas/Main.dc.html` (Reiter „Chat“: Eingabeleiste und gesendete Nachricht) — verbindlich.
- `src/features/chat/Composer.tsx` + `.css` (`canSend`, `send`, `placeholderFor`, Rahmen `composer__box` mit `AttachmentRow` oben), `src/features/chat/UserMessage.tsx` + `.css`, `src/features/chat/ChatTimeline.tsx` (`renderEntry`, Fall `user`).
- `src/stores/review.ts`, `src/features/review/reviewLabels.ts` (Phase 3), `src/lib/syntax.ts` (`languageOf`, `highlightLine`, Phase 1), `src/lib/chat.ts` (`sendMessage` mit `comments`, Phase 2).
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md), [releases.md](../../conventions/releases.md) (gilt beim Archivieren).
- Fehlerklassen geprüft (Vault `frameworks/react`): keine einschlägig.

## Abnahmekriterien

Struktur nach Tafel (Reiter „Chat“):

- **Abschnitt in der Eingabeleiste** (nur bei ≥ 1 gesammeltem Kommentar), ganz oben im Rahmen `composer__box`, vor den Anhängen, Innenabstand `10px 10px 0`: Kopfzeile „Review-Kommentare“ (12 px, fett) · „N · gehen mit der nächsten Nachricht raus“ (12 px, gedämpft) · rechts Knopf „Alle entfernen“. Darunter die Karten mit 6 px Abstand; der Kartenbereich ist höchstens 300 px hoch und scrollt dann.
- **Karte** (Rand `--color-border-subtle`, Radius `--radius-lg`, Hintergrund `--color-bg-base`): Kopf mit Ort `whereLabel(...)` in `--font-mono` 11.5 px gedämpft, einzeilig mit Auslassungspunkten, rechts Stift-Knopf (`aria-label` „Kommentar bearbeiten“) und ×-Knopf (`aria-label` „Kommentar entfernen“), je 24 × 24 px; darunter die Codezeile einzeilig in `--font-mono` 12 px auf dem Hintergrund ihrer Zeilenart (`--color-diff-add-bg` / `--color-diff-del-bg` / ohne), Vorzeichenspalte 20 px (`+`/`-` in `--color-diff-add-fg`/`--color-diff-del-fg`), Syntaxfarben nach Dateiendung, abgeschnitten mit Auslassungspunkten; darunter der Kommentar mit erhaltenen Zeilenumbrüchen.
- **Bearbeiten in der Karte:** Stift ersetzt den Kommentartext durch ein Textfeld (vorbelegt, fokussiert) mit „Abbrechen“ und „Speichern“; Speichern mit leerem Text geht nicht; Esc bricht ab, Strg+Enter speichert.
- **Platzhalter** des Eingabefelds bei ≥ 1 Kommentar: „Nachricht zu den Kommentaren (optional) …“.
- **Gesendete Nachricht:** in der Blase zuerst der getippte Text (falls vorhanden), dann „1 Review-Kommentar“ / „N Review-Kommentare“ (11.5 px, gedämpft), dann die Karten ohne Knöpfe.

Verhalten:

- Senden geht, sobald Text, Anhänge **oder** Kommentare da sind; es schickt alle gesammelten Kommentare in ihrer Reihenfolge mit. Nach Erfolg sind genau die gesendeten Kommentare aus der Liste entfernt (später dazugekommene bleiben), die Zahl am Reiter sinkt entsprechend; bei Fehler bleibt alles stehen und die Fehlerzeile erscheint.
- Bearbeiten und Entfernen in der Eingabeleiste wirken sofort auch im Diff (gleicher Store).
- Alte Nachrichten ohne Kommentare sehen aus wie vorher.

## Checkliste

### Karte und Liste

- [ ] `src/features/review/ReviewCommentCard.tsx` + `.css` (Block `review-card`): Props `{ comment: ReviewComment; onEdit?: (text: string) => void; onRemove?: () => void; }` — ohne `onEdit`/`onRemove` (gesendete Nachricht) keine Knöpfe und kein Bearbeiten. Bearbeiten-Zustand lokal (`useState` für `isEditing` und `editText`). Codezeile: `highlightLine(comment.code, languageOf(comment.path))` als Segmente wie in `DiffView` (Phase 1).
- [ ] `src/features/review/ReviewCommentList.tsx` + `.css` (Block `review-list`): Props `{ sessionId: string }`; liest `collected[sessionId]`, rendert nichts bei leerer Liste; Kopfzeile laut AK, „Alle entfernen“ → `clear(sessionId)`; je Eintrag `ReviewCommentCard` mit `onEdit={(text) => updateText(sessionId, entry.id, text)}` und `onRemove={() => remove(sessionId, entry.id)}`.

### Eingabeleiste

- [ ] `Composer.tsx`: `const collected = useReviewStore((state) => state.collected[session.id] ?? NO_COMMENTS)` (Konstante `NO_COMMENTS: CollectedComment[] = []` wie `NO_ATTACHMENTS`). `canSend` um `|| collected.length > 0` erweitern.
- [ ] Im Rahmen `composer__box` als erstes Kind `<ReviewCommentList sessionId={session.id} />`, dann wie bisher `AttachmentRow`.
- [ ] `send`: `const sentComments = collected; const commentIds = sentComments.map((entry) => entry.id);` → `sendMessage(session.id, text, attachmentIds, sentComments.map((entry) => entry.comment))`; im `then` zusätzlich `useReviewStore.getState().clearIds(session.id, commentIds)`.
- [ ] `placeholderFor`: neuer Parameter `hasComments: boolean`; ist er wahr und die Session weder abgebrochen noch im Fehler, „Nachricht zu den Kommentaren (optional) …“.

### Gesendete Nachricht

- [ ] `UserMessage.tsx`: Prop `comments: readonly ReviewComment[]`. Reihenfolge in `user-message__box`: Anhänge (wie bisher), Text (wie bisher), dann bei Kommentaren ein Abschnitt `user-message__comments` mit der Zählzeile laut AK und je Kommentar `<ReviewCommentCard comment={…} />`. Die Blase darf bei Kommentaren auf die Breite der Tafel wachsen (560 px); CSS-Modifier `user-message__box--with-comments`.
- [ ] `ChatTimeline.tsx`, Fall `user`: `comments={entry.comments}` durchreichen.

### Doku und Abschluss

- [ ] `docs/code-map.md`, Zeile „Review-Kommentare“, Oberfläche: `ReviewCommentCard`, `ReviewCommentList` in `src/features/review/`, Anschluss in `Composer` (oben im Rahmen, Senden) und `UserMessage`; Zeile „Chat“ um „gesammelte Review-Kommentare über der Eingabe“.
- [ ] `docs/PROJECT.md`: falls dort ein Meilenstein bzw. Scope-Punkt zur Changes-Ansicht steht, Satz zu Syntaxfarben und Review-Kommentaren ergänzen; sonst nichts.
- [ ] Commit `feat(review): collect review comments in the composer and show them in sent messages`.
- [ ] Smoke-Checkliste aus der README an Sascha übergeben (Wackelstellen 1–3 zuerst). Erst nach seiner Abnahme: Plan archivieren, Version laut [releases.md](../../conventions/releases.md) anheben (Minor), `chore(release)`-Commit, Tag, Push (AGENTS.md Regel 6).

## Report-Back
