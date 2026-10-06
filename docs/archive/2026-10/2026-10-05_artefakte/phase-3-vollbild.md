# Phase 3 — Vollbild

**Status:** complete.

**Rating:** standard.

## Kontext

- [README des Plans](README.md) (Kontrakt: Sandbox, `artifactUrl`).
- Design: [docs/design/2026-10-05_artefakte/README.md](../../../design/2026-10-05_artefakte/README.md), Zeile „Vollbild“, und die Tafel [artefakte.html](../../../design/2026-10-05_artefakte/artefakte.html) (Knopf mit vier Ecken im Kopf der Vorschau, Overlay `.full`).
- `src/features/artifacts/ArtifactsView.tsx`, `ArtifactFrame.tsx` aus Phase 2; `src/stores/artifacts.ts`.
- `src/lib/colorScheme.ts` (Muster für `getCurrentWindow()` aus `@tauri-apps/api/window`), `src/components/Dialog.tsx` (Muster für `createPortal` nach `document.body`).
- `src-tauri/capabilities/default.json` (Rechte des Hauptfensters).

## Abnahmekriterien der Phase

1. Im Kopf der Vorschau steht zwischen „Neu laden“ und „Im Chat besprechen“ ein Knopf „Vollbild“ (Symbol mit vier Ecken, 28 × 28 px, `title` „Vollbild“).
2. Klick: das Fenster geht in den Vollbildmodus von Windows, und das gewählte Artefakt füllt die ganze Fläche (schwarzer Grund, iframe 100 % × 100 %, dieselbe Sandbox, dieselbe Adresse) — Sidebar, Kopfzeile und Liste sind verdeckt.
3. „Vollbild beenden“ (oben rechts, 12 px Abstand, dunkler halbdurchsichtiger Grund `rgb(20 20 20 / 0.82)`, Rahmen 1 px `#555`, Radius 8 px, Text 12 px `#eee`) ist beim Öffnen 2 s sichtbar und erscheint wieder für 2 s, sobald die Maus den obersten 8-px-Streifen berührt; ein Klick beendet das Vollbild.
4. Esc beendet das Vollbild, solange der Tastatur-Fokus nicht im Artefakt liegt (Tasten im Artefakt gehören der Seite: Pfeile und Leertaste blättern einen Vortrag).
5. Beenden — per Knopf, per Esc oder weil die Ansicht verlassen wird (Reiter-, Session- oder Vorhaben-Wechsel) — setzt das Fenster zurück auf die vorige Größe.
6. Speichert der Agent das Artefakt im Vollbild neu, lädt es dort ebenfalls nach (gleiche Adresse mit `?v=`).

## Checkliste

- [x] `src-tauri/capabilities/default.json`: `"core:window:allow-set-fullscreen"` in `permissions` ergänzen.
- [x] `src/stores/artifacts.ts`: `fullscreen: boolean`, `setFullscreen(value: boolean)`.
- [x] `src/features/artifacts/ArtifactFullscreen.tsx` + `ArtifactFullscreen.css` (BEM-Block `artifact-fullscreen`): Props `sessionId`, `item: Artifact`, `onClose: () => void`. Rendert per `createPortal(…, document.body)` ein `div` mit `position: fixed; inset: 0; z-index` über allen Dialogen der App (höchsten vorhandenen `z-index` in `src/` per Grep ermitteln, +10), darin `ArtifactFrame` (Phase 2) mit voller Größe, einen Streifen `div.artifact-fullscreen__edge` (`position: absolute; top: 0; left: 0; right: 0; height: 8px`) und den Knopf `button.artifact-fullscreen__exit` „Vollbild beenden“.
- [x] Effekt beim Einhängen: `getCurrentWindow().setFullscreen(true)`; Aufräumen: `getCurrentWindow().setFullscreen(false)`. Fehler beider Aufrufe nur `console.error` — das Overlay bleibt auch ohne Fenster-Vollbild nutzbar.
- [x] Sichtbarkeit des Knopfs: Zustand `isExitVisible`, beim Einhängen `true`; `mouseenter`/`mousemove` auf dem Streifen setzen `true`; je Anzeige ein Timer über `EXIT_VISIBLE_MS = 2000`, danach `false` (Klasse `artifact-fullscreen__exit--hidden` mit `opacity: 0; pointer-events: none; transition: opacity 0.25s`). Timer beim Aushängen löschen.
- [x] Esc: `keydown`-Listener auf `window` während das Overlay hängt, `event.key === 'Escape'` → `onClose()`.
- [x] `ArtifactsView.tsx`: Knopf „Vollbild“ (Symbol `<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>`, `viewBox="0 0 16 16"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `fill="none"`) setzt `setFullscreen(true)`; bei `fullscreen && item` rendert die Ansicht zusätzlich `<ArtifactFullscreen … onClose={() => setFullscreen(false)} />`. Beim Aushängen von `ArtifactsView` (Effekt-Aufräumen) `setFullscreen(false)`, damit ein Wechsel der Ansicht das Vollbild beendet.
- [x] `docs/code-map.md`, Zeile „Artefakte“: `ArtifactFullscreen` (Overlay + Fenster-Vollbild) ergänzen; im Abschnitt Core der Zeile die Berechtigung `core:window:allow-set-fullscreen` in `capabilities/default.json` nennen.

## Report-Back

Alle Punkte der Checkliste umgesetzt. `tsc`, `eslint` und `prettier` sauber. Abweichungen: `ArtifactFullscreen` bekommt `baseUrl` statt `sessionId` (die Adresse braucht nur die Liste); `ArtifactFrame` hat eine optionale `className`, weil das Vollbild den Rahmen ohne Rand zeigt; `z-index` über das neue Token `--z-fullscreen: 70` (höchstes vorhandenes war `--z-tooltip: 60`). Nicht im Fenster geprüft — Smoke 3 des Plans (Vollbild) steht offen.
