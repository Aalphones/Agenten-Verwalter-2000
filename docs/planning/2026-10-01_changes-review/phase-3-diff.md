# Phase 3 — Kommentieren im Diff

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“, „Kontrakt“ (Typ `ReviewComment`).
- [Design-README](../../design/2026-10-01_changes-review/README.md) und die Tafel `canvas/Main.dc.html` (Reiter „Changes“: Maße, Texte, Zustände) — verbindlich.
- `src/features/changes/DiffView.tsx` + `DiffView.css` (Stand nach Phase 1), `ChangesView.tsx` (rendert `DiffView` mit `key` je Datei und Blickwinkel), `src/app/App.tsx` (zwei Stellen rendern `ChangesView`: Vorhaben-Übersicht in `renderOverview`, Session-Ansicht), `src/app/SessionHeader.tsx` + `.css` (Reiter, `session-header__tab-count`).
- `src/stores/attachments.ts` und `src/stores/chat.ts` (Muster für einen Store je Session), `src/lib/syntax.ts` (Phase 1).
- `@tanstack/react-virtual`: `measureElement` misst jedes Element mit `data-index` per ResizeObserver nach — darauf beruht die wachsende Zeile.
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md), [typescript.md](../../conventions/typescript.md).
- Fehlerklassen geprüft (Vault `frameworks/react`, `frameworks/a11y`): keine einschlägig.

## Abnahmekriterien

Struktur nach Tafel (Reiter „Changes“):

- **„+“:** `<button>` 18 × 18 px, `border-radius: var(--radius-sm)`, Hintergrund `--color-accent`, Plus-Symbol 10 px in `--color-fg-on-accent`, absolut links 4 px / oben 1 px in der Zeile; unsichtbar (`opacity: 0`), sichtbar bei `:hover` der Zeile und `:focus-visible` des Knopfs. `aria-label` „Kommentar zu Zeile N“ bzw. „Kommentar zu Zeile N (alt)“, `title` „Kommentar zu dieser Zeile – wird im Chat gesammelt“. Nicht an `hunk`-Zeilen, nicht an der Kürzungs-Meldung, nicht wenn `canComment` falsch ist.
- **Kommentierte Zeile:** statt „+“ dauerhaft sichtbar ein Knopf gleicher Größe mit Sprechblasen-Symbol 12 px, Hintergrund `--color-accent-subtle`, Farbe `--color-accent-text`, `aria-label` „Kommentar zu Zeile N bearbeiten“; öffnet den Kommentar zum Bearbeiten.
- **Kommentarfeld** unter der Zeile: Rand 1 px `--color-accent`, Radius `--radius-lg`, Hintergrund `--color-bg-surface`, Abstand `4px 16px 8px 116px`, Schrift `--font-sans` 13 px. Kopf „Kommentar zu `<Dateiname>` · Zeile N“ (12 px, `--color-fg-muted`, Dateiname + Zeile in `--font-mono` 11.5 px). Textfeld mit `aria-label` „Kommentar“, Platzhalter „Was soll der Agent hier ändern oder erklären?“, mindestens 64 px hoch, senkrecht vergrößerbar, beim Öffnen fokussiert. Fußzeile: Hinweis „Wird im Chat gesammelt und mit deiner nächsten Nachricht gesendet · Strg+Enter hinzufügen · Esc abbrechen“ (11.5 px, gedämpft), Knöpfe „Abbrechen“ (umrandet) und „Zum Chat hinzufügen“ bzw. beim Bearbeiten „Speichern“ (Akzent, deaktiviert bei leerem Text).
- **Gesammelter Kommentar** unter der Zeile (wenn das Feld dort nicht offen ist): gleicher Abstand, Rand `--color-border-subtle`, Kopfzeile „Gesammelt · geht mit deiner nächsten Nachricht im Chat raus“ (11.5 px, gedämpft), Text mit erhaltenen Zeilenumbrüchen, Knöpfe „Bearbeiten“ und × (`aria-label` „Kommentar entfernen“).
- **Reiter „Chat“** in der Session-Kopfzeile: bei ≥ 1 gesammeltem Kommentar eine Zahl in einer Pille mit Hintergrund `--color-accent` und Schrift `--color-fg-on-accent`, `title` am Reiter „1 Kommentar wartet im Chat“ / „N Kommentare warten im Chat“.

Verhalten:

- Strg+Enter im Feld sammelt (bzw. speichert), Esc schließt das Feld ohne Änderung; beide Tasten laufen nicht weiter zu anderen Handlern.
- Ein Kommentar je Zeile: „+“ auf einer kommentierten Zeile gibt es nicht, der Sprechblasen-Knopf öffnet den vorhandenen.
- Gesammelte Kommentare erscheinen nur im Blickwinkel, in dem sie entstanden; Wechsel von Datei oder Blickwinkel und zurück zeigt ein offenes Feld samt Text wieder.
- Das Öffnen, Wachsen (Tippen, Ziehgriff) und Schließen des Felds verschiebt die folgenden Zeilen sauber; nichts überlappt, auch nach Weg- und Zurückscrollen in einem Diff mit > 2.000 Zeilen.
- In der Changes-Ansicht der Vorhaben-Übersicht gibt es kein „+“ und keine Karten.

## Checkliste

### Store

- [ ] Neue Datei `src/stores/review.ts`:
  - `export interface CollectedComment { id: string; lineId: string; comment: ReviewComment; }` — `id` aus `crypto.randomUUID()`.
  - `export interface OpenCommentBox { lineId: string; text: string; }`
  - `export function lineIdOf(scope: ChangeScope, repositoryKey: string, path: string, kind: DiffLineKind, line: number): string` → `` `${scope}|${repositoryKey}|${path}|${kind === 'deleted' ? 'old' : 'new'}${String(line)}` ``.
  - State: `collected: Record<string, CollectedComment[]>` (Doc: „Gesammelte, noch nicht gesendete Review-Kommentare je Session; flüchtig wie der Entwurf.“) und `boxes: Record<string, OpenCommentBox | null>` (offenes Kommentarfeld je Session).
  - Aktionen: `upsert(sessionId, lineId, comment)` — ersetzt `comment` des Eintrags mit gleicher `lineId` (behält `id` und Position), sonst anhängen; `updateText(sessionId, id, text)`; `remove(sessionId, id)`; `clear(sessionId)`; `clearIds(sessionId, ids: readonly string[])`; `openBox(sessionId, box: OpenCommentBox)`; `setBoxText(sessionId, text)`; `closeBox(sessionId)`. Schreibweise wie `src/stores/attachments.ts`.

### Bausteine

- [ ] Neuer Ordner `src/features/review/`:
  - `reviewLabels.ts`: `lineLabel(kind: DiffLineKind, line: number): string` → „Zeile N“ bzw. „Zeile N (alt)“ für `deleted`; `fileName(path: string): string` (Teil nach dem letzten `/`); `whereLabel(comment: ReviewComment): string` → `` `${comment.repositoryName} / ${comment.path} · ${lineLabel(comment.kind, comment.line)}` `` (für Phase 4).
  - `CommentBox.tsx` + `CommentBox.css` (BEM-Block `comment-box`): Props `{ fileLabel: string; lineLabel: string; text: string; isEditing: boolean; onChange: (text: string) => void; onSubmit: () => void; onCancel: () => void; }`. Textfeld mit `autoFocus`; `onKeyDown`: `Escape` → `event.stopPropagation(); onCancel()`, `Enter` mit `ctrlKey` → `event.preventDefault(); event.stopPropagation(); onSubmit()` (nur bei nicht leerem Text). Aussehen laut AK.
  - `CollectedNote.tsx` + `CollectedNote.css` (Block `collected-note`): Props `{ text: string; onEdit: () => void; onRemove: () => void; }`. Aussehen laut AK.
  - Symbole als Inline-SVG wie im Bestand (`DiffView`-Schließen-Knopf): Plus (Pfade `M5 1.5v7`, `M1.5 5h7`, viewBox 10), Sprechblase (`M2 2.5h8v5.5H5.5L3 10V8H2z`, viewBox 12), × (`M3 3l6 6`, `M9 3l-6 6`, viewBox 12) — wie in der Tafel.

### Diff-Ansicht

- [ ] `ChangesView.tsx`: neue Prop `canComment: boolean`, an `DiffView` durchreichen. `App.tsx`: in `renderOverview` `canComment={false}`, in der Session-Ansicht `canComment`.
- [ ] `DiffView.tsx`: Prop `canComment: boolean`. Aus dem Store je `sessionId`: die gesammelten Kommentare und `boxes[sessionId]`. `const commentsByLine = useMemo(() => new Map(collected.map(c => [c.lineId, c])), [collected])`.
- [ ] Zeilen-Element umbauen: Das virtuelle Element ist jetzt ein Wrapper `diff-view__row` (absolut, `transform`, `ref={virtualizer.measureElement}`, `data-index`); darin die bisherige `diff-view__line` (jetzt `position: relative`, nicht mehr absolut) und darunter — nur wenn `canComment` und die Zeile kommentierbar ist — entweder `<CommentBox>` (offenes Feld hat diese `lineId`) oder `<CollectedNote>` (Kommentar zu dieser `lineId` vorhanden). In `DiffView.css` die Positionierung von `&__line` auf `&__row` verlegen; Zeilenhöhe bleibt `min-height: 20px`.
- [ ] Je Zeile: `lineId = lineIdOf(scope, repository.key, file.path, line.kind, line.kind === 'deleted' ? line.oldLine : line.newLine)` (Zahl ist bei kommentierbaren Zeilen nie `null`; sonst nicht kommentierbar).
- [ ] Knopf in `diff-view__line` (BEM `diff-view__comment`, Modifier `--collected`): „+“ → `openBox(sessionId, { lineId, text: '' })`; Sprechblase → `openBox(sessionId, { lineId, text: vorhandener.comment.text })`. CSS: `.diff-view__comment { opacity: 0 }`, `.diff-view__line:hover .diff-view__comment, .diff-view__comment:focus-visible, .diff-view__comment--collected { opacity: 1 }`; Fokusring wie `diff-view__close`.
- [ ] `CommentBox`-Handler: `onChange` → `setBoxText`; `onCancel` → `closeBox`; `onSubmit` → `upsert(sessionId, lineId, { repositoryKey: repository.key, repositoryName: repository.name, path: file.path, kind: line.kind, line: <Nummer>, code: line.text, text: text.trim() })`, dann `closeBox`. `isEditing` = es gibt schon einen Kommentar zu dieser `lineId`. `fileLabel` = `fileName(file.path)`.
- [ ] `CollectedNote`-Handler: `onEdit` wie Sprechblase, `onRemove` → `remove(sessionId, id)`.
- [ ] Nach Öffnen eines Felds muss es sichtbar sein: das fokussierte Textfeld scrollt der Browser ins Bild; prüfen an der letzten Zeile eines langen Diffs. Reicht das nicht, nach dem Öffnen `virtualizer.scrollToIndex(index, { align: 'auto' })` (Befund in FINDINGS.md).

### Reiter

- [ ] `SessionHeader.tsx`: Zahl aus `useReviewStore((state) => state.collected[session.id]?.length ?? 0)`. Am Reiter `chat` bei Zahl > 0 `<span className="session-header__tab-count session-header__tab-count--review">{formatCount(n)}</span>` und `title` laut AK. CSS-Modifier in `SessionHeader.css`: Hintergrund `--color-accent`, Farbe `--color-fg-on-accent`, sonst wie `__tab-count`.

### Doku

- [ ] `docs/code-map.md`, Zeile „Review-Kommentare“, Oberfläche: `src/stores/review.ts` (gesammelte Kommentare und offenes Feld je Session, `lineIdOf`), `src/features/review/` (`CommentBox`, `CollectedNote`, `reviewLabels`), Anschluss in `DiffView` (`canComment`) und am Reiter in `SessionHeader`. Zeile „Changes“: `DiffView` rendert je Zeile einen Wrapper mit Kommentarfeld bzw. gesammeltem Kommentar.
- [ ] `docs/glossary.md`: Begriffe **Review-Kommentar** (Kommentar zu einer Diff-Zeile; wird in der Eingabeleiste gesammelt und mit der nächsten Nachricht an den Agenten geschickt, mit absolutem Pfad, Zeilennummer und Codezeile; im Code `ReviewComment`) und **Gesammelte Kommentare** (noch nicht gesendete Review-Kommentare einer Session; flüchtig, gehen beim Neustart der App verloren).
- [ ] Commit `feat(review): comment on diff lines`.

## Report-Back
