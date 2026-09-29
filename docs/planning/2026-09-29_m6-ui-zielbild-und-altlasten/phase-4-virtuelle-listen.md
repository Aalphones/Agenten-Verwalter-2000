# Phase 4 — Virtuelle Listen: Sidebar, Hintergrund-Panel, Scratchpad

Rating: standard. Muster und Bibliothek stehen fest (ADR 002, `FileTree.tsx`); keine neue Entscheidung.

## Kontext

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ → „Virtuelle Listen“
- Vorlage: `src/features/changes/FileTree.tsx` (`useVirtualizer`, `getItemKey`, `estimateSize`, `overscan`, absolut positionierte Zeilen, eslint-Ausnahme `react-hooks/incompatible-library` mit Kommentar) und `src/features/changes/buildFileRows.ts` (Gruppen → flache Zeilen mit `kind` und `key`, `isFirst` für den Abstand); dynamische Höhen per `measureElement` wie in `src/features/chat/ChatTimeline.tsx`
- Sidebar: `src/app/Sidebar.tsx` + `Sidebar.css` (`sidebar__list` hat heute `overflow: hidden` — Sessions unterhalb des Fensterrands sind nicht erreichbar; das behebt diese Phase), `src/app/SidebarItem.tsx` (Umbenennen im Feld, ⋯-/Rechtsklick-Menü als Popover), `src/features/sessions/sessionStatus.ts` (`GROUP_ORDER`, `GROUP_LABEL`, `STATUS_GROUP`)
- Hintergrund-Panel: `src/features/background/PanelLayout.tsx` + `.css` (`panel-layout__list`: höchstens 330 px, scrollt, 10 px Abstand zwischen Gruppen), `BackgroundGroup.tsx` + `.css`, `BackgroundRow.tsx`, `ProcessesTab.tsx` (Gruppen „LÄUFT“, „AUSGEFÜHRT“), `SubagentsTab.tsx`, `ScratchpadTab.tsx` + `buildScratchpadRows.ts`
- [ADR 002](../../decisions/002-typgenerierung-und-listen.md), [react.md](../../conventions/react.md)
- Vault-Fehlerklassen React gelesen: keine einschlägig.

## Abnahmekriterien

1. Sidebar, „Prozesse“, „Subagenten“ und Scratchpad rendern nur sichtbare Zeilen plus Überhang (`overscan` 12); das Aussehen bleibt pixelgleich zu vorher (gleiche Abstände zwischen Gruppen und Zeilen, gleiche Leer-Sätze).
2. Die Sidebar-Liste scrollt senkrecht, wenn sie länger als der Platz ist.
3. Tab läuft weiter durch alle Zeilen einer Liste: fokussiert Tab eine Zeile am Rand des gerenderten Bereichs, scrollt sie ins Bild und die nächsten Zeilen erscheinen.
4. Sidebar: Umbenennen (Doppelklick, F2, Rechtsklick, ⋯, `/rename`) funktioniert wie vorher; startet es für eine Session außerhalb des sichtbaren Bereichs, scrollt die Liste zu ihr (`scrollToIndex`, `align: 'auto'`), bevor das Feld den Fokus bekommt.
5. Hintergrund-Panel: Auswahl per Klick, „Im Chat besprechen“, Öffnen eines Eintrags über eine Verlaufszeile (`openItem`) scrollen die gewählte Zeile ins Bild.
6. `pnpm check` grün.

## Checkliste

### Sidebar

- [ ] `src/app/buildSidebarRows.ts`: `export type SidebarRow = { kind: 'group'; key: string; group: SessionGroup; count: number; isFirst: boolean } | { kind: 'session'; key: string; session: SessionSummary }`; `export function buildSidebarRows(sessions: readonly SessionSummary[]): SidebarRow[]` — für jede Gruppe aus `GROUP_ORDER` mit mindestens einer Session eine Überschriftszeile (`key` = `group:<Gruppe>`), dann ihre Sessions in der gegebenen Reihenfolge (`key` = `session:<id>`). Leere Gruppen entfallen wie bisher.
- [ ] `Sidebar.tsx`: `renderGroup` ersetzen durch Virtualisierung über `buildSidebarRows(sessions)`; Scroll-Element ist `sidebar__list` (Ref). `estimateSize`: Überschrift 26 px (+ 14 px ab der zweiten Gruppe), Session 44 px; gemessen wird per `measureElement` (`data-index` am Zeilen-Container). Der Leer-Satz „Noch keine Sessions.“ bleibt außerhalb der Virtualisierung.
- [ ] `Sidebar.css`: `sidebar__list` → `overflow-y: auto`, `display: block` statt Flex mit `gap`; der Abstand 14 px zwischen Gruppen wird `padding-top` der Überschriftszeile (`sidebar__group-title--spaced`, nicht bei `isFirst`), der Abstand 1 px zwischen Sessions `padding-bottom: 1px` der Session-Zeile. Die Überschrift behält ihre Klassen und Maße. Innerer Container `sidebar__rows` mit `position: relative; height: <getTotalSize()>px`, Zeilen `position: absolute; top: 0; left: 0; width: 100%; transform: translateY(<start>px)`.
- [ ] Umbenennen: `useEffect` auf `renamingId` — Index der Zeile `session:<renamingId>` suchen, `virtualizer.scrollToIndex(index, { align: 'auto' })`. Das Namensfeld in `SidebarItem` nimmt den Fokus wie bisher beim Einhängen.
- [ ] `SidebarItem` bleibt unverändert. Ein offenes ⋯-Menü schließt, wenn seine Zeile aus dem gerenderten Bereich scrollt — hinnehmen, in FINDINGS notieren, falls es stört.

### Hintergrund-Panel

- [ ] `PanelLayout.tsx`: neue Prop `listRef: RefObject<HTMLDivElement | null>`, an `panel-layout__list` gehängt. `PanelLayout.css`: `panel-layout__list` → `display: block` ohne `gap` (Abstand übernimmt die Überschriftszeile wie in der Sidebar: 10 px = `--space-lg` als `padding-top` ab der zweiten Gruppe).
- [ ] `src/features/background/buildPanelRows.ts`: `export type PanelRow<T> = { kind: 'group'; key: string; title: string; titleHint?: string; isFirst: boolean } | { kind: 'empty'; key: string; text: string } | { kind: 'item'; key: string; item: T }`; `export interface PanelGroup<T> { title: string; titleHint?: string; items: readonly T[]; emptyText: string | null; itemKey: (item: T) => string }`; `export function buildPanelRows<T>(groups: readonly PanelGroup<T>[]): PanelRow<T>[]` (je Gruppe Überschrift, dann Einträge, dann Leer-Satz, wenn `emptyText !== null`).
- [ ] `src/features/background/VirtualPanelList.tsx`: generisch `<T,>({ rows, listRef, renderItem, estimateItem, selectedKey })` — virtualisiert über `listRef`, rendert Überschrift und Leer-Satz mit den Klassen aus `BackgroundGroup.css` (`background-group__title`, `background-group__empty`), Einträge über `renderItem(item)`; `estimateSize` Überschrift 22 px, Leer-Satz 24 px, Eintrag `estimateItem(item)`; Höhen per `measureElement`. Ändert sich `selectedKey`, `scrollToIndex(index, { align: 'auto' })`.
- [ ] `ProcessesTab.tsx`: `list` aus zwei `PanelGroup`s („LÄUFT“ mit `groups.running`, „AUSGEFÜHRT“ mit `groups.executed`, Leer-Sätze wie bisher, `itemKey: (item) => item.id`) über `buildPanelRows` + `VirtualPanelList`; `renderRow` bleibt, liefert aber keinen `key` mehr (den setzt die Liste); Eintrag geschätzt 42 px. `useRef` für `listRef`, an `PanelLayout` und `VirtualPanelList`.
- [ ] `SubagentsTab.tsx`: eine Gruppe, sonst wie Prozesse; Eintrag geschätzt 42 px.
- [ ] `ScratchpadTab.tsx`: eine Gruppe mit `title`/`titleHint` wie bisher an `BackgroundGroup`, Einträge = `rows`, `itemKey: (row) => row.path`, Leer-Satz aus der bestehenden Funktion (Zeile um 157); Eintrag geschätzt 26 px. Was heute nach der Zeilenliste in der `BackgroundGroup` steht (Zeilen 166–175 prüfen, z. B. Hinweis auf gekürzte Liste), wird eine eigene Zeile der Art `empty` am Ende.
- [ ] `BackgroundGroup.tsx`: wird danach nicht mehr verwendet → löschen, `BackgroundGroup.css` in `VirtualPanelList.css` umbenennen (Klassen behalten ihren Namen `background-group__…`, damit nichts anderes umzubenennen ist) und dort importieren.

### Doku

- [ ] Code-Map: „App-Rahmen“ um `buildSidebarRows`; „Hintergrund“: `BackgroundGroup` raus, `VirtualPanelList`, `buildPanelRows` rein, `PanelLayout` mit `listRef`.
- [ ] ADR 002: Abschnitt zu virtuellen Listen um die Aufzählung der virtualisierten Listen (Verlauf, Dateibaum, Diff, Sidebar, Hintergrund-Listen, Scratchpad) und den Verweis auf ADR 008 ergänzen.

## Report-Back
