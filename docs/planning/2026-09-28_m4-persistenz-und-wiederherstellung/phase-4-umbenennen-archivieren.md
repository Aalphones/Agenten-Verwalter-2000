# Phase 4 — Umbenennen & Archivieren

**Status:** pending · **Rating:** standard (Entwurf und Kontrakt liegen fest; zwei Commands, ein Sidebar-Umbau)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Kontrakt „Tauri Commands (neu)“
- [Design-README](../../design/2026-09-28_hauptansichten/README.md) → „Verhalten“ (Punkt „Umbenennen“)
- Entwurfsquelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`: Sidebar-Zeile mit Umbenennen-Eingabe und Menü Zeilen 31–69, Menüeinträge Zeile 865–870 (`Umbenennen` mit Taste `F2`, `Archivieren`)
- Bestand: `src/app/Sidebar.tsx` + `Sidebar.css`, `src/app/App.tsx`, `src/features/sessions/useSessionSummaries.ts`, `src/components/Popover.tsx` (Menü-Hülle: Esc, Klick daneben, Fokus; Kind eines `position: relative`-Elements), `src/lib/sessions.ts` (Wrapper-Muster), `src/stores/sessions.ts`, `src-tauri/src/commands/sessions.rs`, `src-tauri/src/sessions/registry.rs` (`cancel`, `update`), `src-tauri/src/sessions/mod.rs` (`MAX_NAME_CHARS`)
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md)
- Fehlerklassen: Vault-Entities nicht lesbar. Bekannt aus dem Vorgängerplan und hier einschlägig: **Esc im Umbenennen-Feld darf die Session nicht pausieren** — der Esc-Listener in `ChatView` pausiert bei jedem Esc, der nicht `defaultPrevented` ist; das Eingabefeld ruft deshalb `event.preventDefault()`.
- Idiotensicherheit: Archivieren hat keine Rückgängig-Aktion in der Oberfläche; das Menü erklärt es per `title` („Blendet die Session aus der Liste aus. Verlauf und Arbeitsordner bleiben erhalten.“).

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` ändert nichts (keine neuen Typen über die Tauri-Grenze).
2. Doppelklick auf eine Sidebar-Zeile, F2 (bei geöffneter Session, Fokus nicht in einem Textfeld) oder Rechtsklick → „Umbenennen“: die Zeile wird zu einem Eingabefeld (Höhe 26 px, Rahmen 1 px Akzent, Radius 5 px, Zeile darunter „Enter speichert · Esc bricht ab“, Zeilenhintergrund `bg-selected`, links 30 px Einzug). Enter und Verlassen des Feldes speichern, Esc bricht ab; ein leerer oder unveränderter Name ändert nichts. Der neue Name steht sofort in Sidebar und Kopfzeile und bleibt nach einem Neustart.
3. Esc im Feld bricht nur das Umbenennen ab; eine laufende Session wird dabei **nicht** pausiert.
4. Rechtsklick auf eine Zeile öffnet ein Menü mit „Umbenennen“ (Taste F2 rechts) und „Archivieren“, unter der Zeile, 200 px breit, Esc und Klick daneben schließen es. Kein Kontextmenü des Browsers.
5. „Archivieren“ nimmt die Session sofort aus der Sidebar; war sie aktiv, öffnet sich die neueste verbleibende Session, sonst der Leerzustand. Ein laufender Agent der Session ist beendet. Nach einem Neustart bleibt sie weg; Zeile, Verlauf und Arbeitsordner existieren weiter.
6. Fehlt der Name (`session_rename` mit leerem Text) meldet der Core einen Fehler; die Oberfläche sendet leere Namen gar nicht erst.

## Checkliste

- [ ] `src-tauri/src/sessions/mod.rs`: `MAX_NAME_CHARS` auf `pub const` ändern.
- [ ] `registry.rs`: `pub fn rename(&self, app: &AppHandle, session_id: &str, name: &str) -> Result<(), CommandError>` — Name mit `trim()` bereinigen, leer → `Err(CommandError::Internal("Der Name darf nicht leer sein.".to_owned()))`, sonst auf `MAX_NAME_CHARS` Zeichen kürzen (`chars().take(..).collect::<String>()`); in `update(...)`: `state.name = name; outbox.summary_dirty = true; Ok(())`.
- [ ] `registry.rs`: `pub fn archive(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError>` — `self.cancel(app, session_id)?;` (beendet den Agenten, bekannte Fehler wie `AgentStopped` behandelt `cancel` selbst); `let session = self.get(session_id)?;` `session.database.with(|connection| sessions::archive(connection, session_id, now_ms()))?;` `self.lock_sessions().remove(session_id);` — die Datenbank-Zeile zuerst, die Map danach.
- [ ] `commands/sessions.rs`: `session_rename` und `session_archive` nach dem Muster der vorhandenen (async, `tauri::AppHandle`, `State<SessionRegistry>`, Parameter `session_id`, bei Rename `name: String`); in `lib.rs` in `generate_handler![…]` eintragen.
- [ ] `src/lib/sessions.ts`: `renameSession(sessionId: string, name: string): Promise<void>` und `archiveSession(sessionId: string): Promise<void>` (Muster `cancelSession`, JSDoc mit `@throws … sessionNotFound`).
- [ ] `useSessionSummaries.ts`: zusätzlich `removeSession: (sessionId: string) => void` (filtert die Liste, `useCallback`), im Rückgabetyp `SessionSummaries` ergänzen.
- [ ] `src/app/SidebarItem.tsx` + `SidebarItem.css` (neu; die Zeile aus `Sidebar.tsx` `renderItem` zieht dorthin um, BEM-Block `sidebar-item`, Styles der bisherigen `sidebar__item*`/`__status`/`__text`/`__name`/`__meta`-Regeln mitnehmen und in `Sidebar.css` löschen). Props: `session`, `isActive`, `isRenaming`, `onSelect()`, `onStartRename()`, `onCommitRename(name: string)`, `onCancelRename()`, `onArchive()`. Verhalten:
  - Normalzustand: die bisherige Zeile als `<button>`; `onDoubleClick` → `onStartRename`; `onContextMenu` → `event.preventDefault()` und lokales `isMenuOpen`.
  - Das Menü ist ein `Popover` (`placement="below"`, `align="start"`, `width={200}`, `label={`Aktionen für ${session.name}`}`) mit zwei `<button role="menuitem">`: „Umbenennen“ + `<kbd>F2</kbd>`, „Archivieren“ (mit `title`-Erklärung s. o.). Die Hülle der Zeile ist ein `div` mit `position: relative` (BEM `sidebar-item`) — Popover braucht das als Anker. Menüpunkt-Klick ruft die Aktion und schließt das Menü. Menüpunkt-Maße: Höhe 28 px, Radius 5 px, Padding 0 10 px, `kbd` in `font-mono` 11 px `fg-muted`.
  - Umbenennen-Zustand: statt des Buttons das Eingabefeld samt Hinweiszeile (Maße AK 2), `autoFocus` und den Text markieren (`onFocus={(event) => event.target.select()}`), Beschriftung `aria-label="Neuer Name der Session"`, `maxLength={60}`, lokaler Text-State mit dem aktuellen Namen. `onKeyDown`: Enter → `event.preventDefault()`, `commit()`; Escape → `event.preventDefault()` (sonst pausiert der Chat), `cancel()`. `onBlur` → `commit()`. Damit Esc und das folgende Blur nicht doppelt wirken, merkt sich eine Ref (`isDoneRef`), ob schon entschieden wurde. `commit()`: Name `trim()`; leer oder gleich dem alten → `onCancelRename()`, sonst `onCommitRename(name)`.
- [ ] `Sidebar.tsx`: Zustand `renamingId: string | null`; rendert `SidebarItem` je Session. `onCommitRename(name)` → `renameSession(id, name).catch(console.error)` und `setRenamingId(null)`; `onArchive` → `archiveSession(id).then(() => onArchived(id)).catch(console.error)`. F2: `useEffect` mit `window`-`keydown`, ignoriert Ereignisse aus `input`/`textarea` (`event.target instanceof HTMLElement && event.target.closest('input, textarea')`) und `defaultPrevented`, sonst `setRenamingId(activeSessionId)`, wenn eine aktive Session existiert; Listener im Cleanup entfernen. Neue Prop `onArchived: (sessionId: string) => void`.
- [ ] `App.tsx`: `removeSession` aus dem Hook holen und als `onArchived` an die Sidebar geben. (Die Ableitung `currentSession` aus Phase 3 wählt danach automatisch die nächste Session.)
- [ ] Doku (im selben Commit): `docs/code-map.md` — Sessions-Zeile: `SidebarItem` ergänzen; `docs/design/…/README.md`, „Abweichungen“: „Menü einer Session ist ein `dialog` mit den zwei Einträgen, unter der Zeile ausgerichtet (kein 30-px-Einzug); Archivieren blendet aus, es gibt in Meilenstein 4 keine Archiv-Ansicht.“ `docs/glossary.md`: Eintrag „Archivieren“ — „Blendet eine Session aus der Liste aus; Verlauf und Arbeitsordner bleiben erhalten.“

## Report-Back
