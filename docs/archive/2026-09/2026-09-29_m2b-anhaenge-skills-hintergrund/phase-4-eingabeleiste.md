# Phase 4 — Oberfläche: Eingabeleiste mit Anhängen und `/`-Menü

**Status:** complete · **Rating:** standard (Entwurf und Kontrakt stehen; Sorgfalt bei Fokus und Tastatur im `/`-Menü und beim Hineinziehen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ → „Anhänge“ und „Skills und Befehle“, „Bewusst weggelassen“, „Kontrakt“ → „Oberfläche“
- Entwurf: [Entwurfs-README](../../design/2026-09-28_hauptansichten/README.md) (Abschnitte „Layout-Maße“ Zeilen „Eingabeleiste“ und „Menüs der Eingabeleiste“, „Verhalten“ Punkte Anhänge, `/`-Knopf, `/` im Eingabefeld). Quelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`:
  - Zeilen ~141–156: gesendete Nachricht mit Anhängen und Skill-Marke
  - ~192–199: Zeile „Skill … geladen“
  - ~298–338: `/`-Menü
  - ~340–347: `+`-Menü
  - ~383–405: Chips und Leiste der Eingabe
  - ~575–588: Aufgabenfeld unter „Neue Session“
  - ~1240–1300: Logik von Menü, Filter, Chips

  Bei Widerspruch zu den Maßen unten gilt die Quelle.
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (BEM, nur semantische Tokens, Inline-`style` nur für Laufzeitwerte)
- Bestand:
  - `src/features/chat/Composer.tsx` + `.css`, `src/features/chat/ChatView.tsx` (Esc pausiert, außer `defaultPrevented`), `src/features/chat/UserMessage.tsx` + `.css`, `src/features/chat/ChatTimeline.tsx` (Fall `'user'`)
  - `src/components/Popover.tsx` (fokussiert beim Öffnen das erste Element, verbraucht Esc in der Capture-Phase), `ModelMenu.tsx`, `ModeMenu.tsx`, `EffortDots.tsx`
  - `src/features/sessions/NewSession.tsx` + `.css`, `src/app/Sidebar.tsx` (lokaler Zustand `renamingId`), `src/app/SidebarItem.tsx`
  - `src/stores/sessions.ts`, `src/stores/chat.ts` (Muster Zustand-Store), `src/lib/labels.ts` (`modelName`, `effortLabel`)
  - `src/lib/attachments.ts`, `src/lib/skills.ts`, `src/lib/chat.ts`, `src/lib/sessions.ts`, `src/lib/errors.ts` (Stand Phase 1–2)
  - Tauri-APIs: `open` aus `@tauri-apps/plugin-dialog`, `getCurrentWebview().onDragDropEvent` aus `@tauri-apps/api/webview`, `convertFileSrc` aus `@tauri-apps/api/core`
- Fehlerklassen: Vault `frameworks/react.md` und `sprachen/typescript.md` gelesen — nicht einschlägig (Tests, `fetch`). Projekteigen:
  - **Popover stiehlt den Fokus:** `Popover` setzt beim Öffnen den Fokus auf das erste Element. Beim `/` im Eingabefeld muss der Fokus im Textfeld bleiben, sonst landet das nächste getippte Zeichen im Menü. Prüfen per AK 4.
  - **Esc pausiert die Session:** Das `/`-Menü muss Esc über `Popover` verbrauchen, dann pausiert `ChatView` nicht. Prüfen per AK 4.
  - **Hineinziehen ohne Pfad:** Mit aktivem Tauri-Drag-and-Drop kommen HTML-`drop`-Ereignisse ohne Dateipfade an. Pfade liefert nur `onDragDropEvent`.
  - **Synchrones `setState` im Effekt:** `eslint-plugin-react-hooks` 7 meldet es. Zustand nur in Callbacks setzen.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. Eingabeleiste nach Entwurf: unten links `+` und `/` (je 30 × 30 px, Radius 6 px, `fg-secondary`, gedrückt `bg-selected`), dann die Modell-Pille mit 4 px Abstand; rechts Modus und Senden. `+` hat Titel und Beschriftung „Bilder und Dateien hinzufügen“, `/` „Befehle und Skills – oder / ins Feld tippen“. Platzhalter „Nachricht an Claude … (/ für Skills)“.
3. Anhänge: `+` öffnet das Menü (330 px, ein Eintrag „Datei oder Bild anhängen …“ mit `Ctrl U`, Fußzeile nach README). Der Eintrag und Ctrl+U im Feld öffnen den Dateidialog (Mehrfachauswahl). Hineinziehen irgendwo ins Fenster, während der Chat sichtbar ist, und Ctrl+V eines Bildes fügen Chips hinzu. Die Chipzeile steht über dem Textfeld (Innenabstand 8 × 10 px, Lücke 6 px, Trennlinie `border-subtle`). Ein Chip ist 28 px hoch, Radius 5 px, `bg-hover`, Schrift 12 px; ein Bild zeigt eine Vorschau 28 × 20 px mit Radius 3 px, fetten Namen und `B×H`, eine Datei ein Symbol, fetten Namen und die Größe; × (20 × 20 px) entfernt den Chip und verwirft die Datei im Core. Während eines Zugs über das Fenster hat die Leiste den Fokusrahmen (Akzent + 3-px-Ring). Mit Chips und leerem Text lässt sich senden.
4. `/`: Der Knopf öffnet das Menü so breit wie die Leiste, 8 px über ihr, Radius 10 px, mit Filterfeld (30 px, `bg-base`) und den Abschnitten Kontext · Modell · Skills · Session (Abschnittstitel 12 px `fg-muted`, Zeilen mindestens 30 px, Liste höchstens 470 px mit Scrollen). Tippt man `/` in das leere Feld, öffnet dasselbe Menü nur mit Skills und Session, **ohne** Filterfeld, der Fokus bleibt im Textfeld, und jedes weitere Zeichen filtert. ↑/↓ bewegen die Markierung (`bg-hover`), Enter wählt, Esc schließt ohne Pause. Eine Skill-Zeile zeigt `/name` (Mono 12,5 px, `accent-text`, 150 px breit), die Beschreibung (`fg-muted`, abgeschnitten) und rechts „Benutzer“ bzw. „aus <Repository>“. Kein Treffer: „Nichts passt zu „<filter>“.“
5. Wählen: Ein Skill setzt `/name ` an den Anfang des Felds (ein schon vorhandenes `/…` am Anfang wird ersetzt) und fokussiert das Feld. „Datei oder Bild anhängen …“ öffnet den Dialog. „Modell wechseln …“ öffnet das Modellmenü. Der Denkaufwand ist direkt mit den fünf Punkten einstellbar. `/rename` startet das Umbenennen in der Sidebar, `/changes` öffnet Changes (nur bei Sessions mit Repository sichtbar), `/pause` pausiert (nur in `starting`, `running`, `waiting` sichtbar).
6. Status `waiting`: `+` ist gesperrt, mit Titel „Anhänge gehen erst, wenn die Rückfrage beantwortet ist“; Hineinziehen und Einfügen von Dateien tun nichts. Status `cancelled`/`error`: `+` und `/` gesperrt.
7. Verlauf: Eine gesendete Nachricht zeigt ihre Anhänge als Chips im Kasten (26 px hoch, Vorschau 26 × 18 px, ohne ×), auch nach einem App-Neustart. Eine Nachricht mit Skill zeigt `/name` als Marke (Mono 12,5 px, `accent-subtle`/`accent-text`, Radius 4 px) vor dem übrigen Text. Unter dem Kasten steht die Zeile „● Skill `<name>` geladen · aus deinem Benutzerordner“ bzw. „· aus <Repository>“ (Punkt 8 px `status-completed`, „Skill“ fett, Name als Marke 12 px, Rest 12,5 px `fg-muted`).
8. „Neue Session“: Das Aufgabenfeld steht nach Entwurf in einem Kasten mit Chipzeile, Textfeld und Leiste (`+`, `/`, dazu der Hinweis „Bilder und Dateien hineinziehen oder einfügen. Mit / startest du direkt mit einem Skill.“). Der Satz unter dem Kasten lautet „Der erste Satz wird zum Namen der Session (später per Rechtsklick änderbar), der ganze Text samt Anhängen zur ersten Nachricht an den Agenten.“ `/` (Knopf oder am Feldanfang) zeigt nur Skills: die des Benutzers und die der angehakten Repositories. „Abbrechen“ verwirft die Anhänge; „Starten“ schickt sie mit.

## Checkliste

### Stores und Hilfen

- [x] `src/stores/attachments.ts` nach Kontrakt (`pending`, `add`, `remove`, `clear`, `clearIds`), Muster `src/stores/chat.ts`.
- [x] `src/stores/sessions.ts`: `renamingId: string | null`, `startRename(sessionId)`, `stopRename()`. `src/app/Sidebar.tsx` nutzt diese statt des lokalen `useState` (F2, Doppelklick, Menü „Umbenennen“ rufen `startRename`, Speichern/Abbrechen `stopRename`).
- [x] `src/features/attachments/formatBytes.ts`: `< 1024` → `"<n> B"`, `< 1048576` → `"<gerundet> KB"`, sonst eine Nachkommastelle mit Komma + `" MB"` (`(1.5 * 1048576)` → `"1,5 MB"`).
- [x] `src/features/attachments/useAttachmentInput.ts`: `useAttachmentInput({ key: string, enabled: boolean, onError: (message: string) => void })` → `{ openPicker: () => void, handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void, isDragging: boolean }`.
  - `openPicker`: `open({ multiple: true, directory: false, title: 'Bilder und Dateien anhängen' })`; `null` → nichts; ein String wird zu `[string]`; dann `addAttachmentFiles` → `add(key, …)`.
  - Hineinziehen: solange `enabled`, in einem Effekt `getCurrentWebview().onDragDropEvent(…)` abonnieren (Aufräumen per zurückgegebenem `unlisten`). `enter`/`over` → `isDragging = true`, `leave` → `false`, `drop` → `false` und `addAttachmentFiles(payload.paths)`.
  - `handlePaste`: `event.clipboardData.files` leer → nichts tun (normales Text-Einfügen). Sonst `preventDefault`, je Datei `FileReader.readAsDataURL`, den Teil nach dem ersten Komma als Base64 an `addAttachmentBytes(file.name, …)`.
  - Nicht `enabled` → Picker, Einfügen und Hineinziehen tun nichts.
  - Fehler → `onError(commandErrorText(reason))`.
- [x] `src/features/attachments/AttachmentChip.tsx` + `.css`: Props `{ attachment: Attachment; size: 'input' | 'sent'; onRemove?: () => void }`. Bild: `<img src={convertFileSrc(attachment.path)} alt="">` in der Vorschaugröße (`object-fit: cover`), `B×H` aus `naturalWidth`/`naturalHeight` nach `onLoad` (davor die Größe). Datei: Dokument-Symbol wie im Entwurf und `formatBytes`. `onRemove` gesetzt → ×-Knopf mit `aria-label="<name> entfernen"`. Der Name hat einen `title` mit dem vollen Namen.
- [x] `src/features/attachments/AttachmentRow.tsx`: Liste von Chips mit `flex-wrap`.

### Skills-Menü

- [x] `src/features/skills/useSkills.ts`: `useSkills(source: { sessionId: string } | { repositoryIds: readonly string[] }, isActive: boolean)` → `{ skills: readonly SkillInfo[]; error: string | null }`. Lädt, sobald `isActive` von `false` auf `true` wechselt (jedes Öffnen frisch), über `listSessionSkills` bzw. `listRepositorySkills`. Eine späte Antwort für eine andere Quelle wird verworfen (laufende Nummer).
- [x] `src/features/chat/commandMenuRows.ts`:

  ```ts
  export type CommandScope = 'full' | 'slash' | 'skills';
  export type SessionCommand = 'rename' | 'changes' | 'pause';
  export type CommandRow =
    | { kind: 'attach' }
    | { kind: 'model' }
    | { kind: 'effort' }
    | { kind: 'skill'; skill: SkillInfo }
    | { kind: 'session'; command: SessionCommand };
  export interface CommandSection { title: 'Kontext' | 'Modell' | 'Skills' | 'Session'; rows: CommandRow[] }
  export function buildCommandSections(scope: CommandScope, filter: string, skills: readonly SkillInfo[], session: SessionSummary | null): CommandSection[];
  export function pickableRows(sections: readonly CommandSection[]): CommandRow[];   // alle außer 'effort'
  ```

  - `full`: alle vier Abschnitte; `slash`: Skills + Session; `skills`: nur Skills.
  - Filter: ohne Groß-/Kleinschreibung, als Teilstring in Beschriftung oder Beschreibung. Beschriftungen: attach „Datei oder Bild anhängen …“, model „Modell wechseln …“ (Beschreibung = Modellname), effort „Denkaufwand“, skill `/<name>` (Beschreibung = `description`), session `/rename` „Session umbenennen“, `/changes` „Changes-Ansicht öffnen“, `/pause` „Agent pausieren“.
  - `changes` nur bei `session.repositoryCount > 0`, `pause` nur in `starting`, `running`, `waiting`.
  - Leere Abschnitte entfallen.
- [x] `src/components/Popover.tsx`: neue optionale Props `autoFocus?: boolean` (Standard `true`; `false` → kein Fokuswechsel beim Öffnen und keine Rückgabe des Fokus beim Schließen) und `width` auch als `'anchor'` (Klasse `popover--anchor`: `left: 0; right: 0`, keine feste Breite).
- [x] `src/features/chat/CommandMenu.tsx` + `.css`: Props `{ sections: CommandSection[]; highlighted: CommandRow | null; onHighlight(row); onPick(row); showFilter: boolean; filter: string; onFilterChange(text); onClose(); session: SessionSummary | null; onEffortChange(effort) }`.
  - Rendert `Popover` (Label „Befehle und Skills“, `placement="above"`, `width="anchor"`, `autoFocus={showFilter}`).
  - Das Filterfeld (nur bei `showFilter`) behandelt ↑/↓/Enter selbst.
  - Die Effort-Zeile nutzt `EffortDots` mit `session.effort`.
  - Die rechte Spalte der Skill-Zeile: `origin.kind === 'user'` → „Benutzer“, sonst „aus <name>“.
  - Leerer Zustand: „Nichts passt zu „<filter>“.“; im Umfang `skills` ohne Filter und ohne Skills: „Keine Skills gefunden. Skills liegen in .claude\skills deines Benutzerordners oder eines Repositorys.“

### Eingabeleiste (`Composer.tsx`)

- [x] Zustand: `openMenu: 'model' | 'mode' | 'plus' | 'command' | null`, `commandFilter: string`, `highlighted: CommandRow | null`, `slashDismissed: boolean`.
- [x] Anhänge: `useAttachmentInput({ key: session.id, enabled: !isLocked && session.status !== 'waiting', onError: setErrorMessage })`; `pending = useAttachmentsStore(s => s.pending[session.id] ?? [])`. Die Chipzeile steht über dem Textfeld, sofern `pending` nicht leer ist. Klasse `composer__box--dragging` bei `isDragging`, gleiche Darstellung wie Fokus.
- [x] Senden: `canSend = (draft.trim() !== '' || pending.length > 0) && !isSending && !isLocked`. `sendMessage(session.id, draft.trim(), ids)`; danach `clearIds(session.id, ids)` (Anhänge, die während des Sendens dazukamen, bleiben).
- [x] `/` im Feld: `slashMatch = /^\/(\S*)$/.exec(draft)`. Das Menü im Umfang `slash` ist offen, wenn `slashMatch !== null && !slashDismissed && !isLocked`; Filter = `slashMatch[1]`. `slashDismissed` wird bei Esc bzw. `onClose` gesetzt und zurückgesetzt, sobald `draft` nicht mehr passt. Im `onKeyDown` des Textfelds bei offenem Slash-Menü: ↑/↓ verschieben `highlighted` in `pickableRows` (umlaufend), Enter ohne Ctrl wählt, jeweils mit `preventDefault`. Ohne Markierung gilt die erste wählbare Zeile als markiert.
- [x] `/`-Knopf: öffnet `openMenu = 'command'` im Umfang `full` mit Filterfeld.
- [x] `onPick`:
  - attach → `openPicker()`
  - model → `setOpenMenu('model')`
  - skill → Entwurf = `/${name} ` + Entwurf ohne ein führendes `/\S*\s?`, danach Fokus ins Textfeld
  - rename → `startRename(session.id)`
  - changes → `showView('changes')`
  - pause → `pauseSession(session.id)` (Fehler → `setErrorMessage`)
  - Danach Menü schließen; im Umfang `slash` bei Session-Befehlen den Entwurf leeren.
- [x] `+`-Knopf: `openMenu = 'plus'`, Popover „Hinzufügen“, 330 px, ein Eintrag und die Fußzeile. Ctrl+U im Textfeld → `openPicker()` mit `preventDefault`.
- [x] Platzhalter nach AK 2; Sperren nach AK 6.

### Verlauf

- [x] `src/features/chat/UserMessage.tsx`: Props `{ text: string; attachments: readonly Attachment[]; skill: SkillRef | null }`.
  - Chips (`size="sent"`) oben im Kasten.
  - Bei `skill` wird der führende Teil `/<name>` aus `text` als Marke gerendert, der Rest normal.
  - Unter dem Kasten die Skill-Zeile nach AK 7.
  - `ChatTimeline.tsx` übergibt `entry.attachments ?? []` und `entry.skill ?? null`.

### Neue Session (`NewSession.tsx`)

- [x] Aufgabenfeld in den Kasten nach Entwurf umbauen (Zeilen ~577–586): Chipzeile (nur mit Anhängen), Textfeld, Leiste mit `+`, `/` und Hinweis. Die Anhänge laufen über `useAttachmentInput({ key: NEW_SESSION_KEY, enabled: !isStarting, … })`. Das `/`-Menü im Umfang `skills` mit `useSkills({ repositoryIds }, isOpen)`; `/` am Feldanfang wie in der Eingabeleiste.
- [x] `canStart` bleibt an Text gebunden (der Name der Session entsteht aus dem Text). `createSession(text.trim(), pendingIds, repositoryIds, model, effort, mode)`; Erfolg → `clear(NEW_SESSION_KEY)` (Dateien sind verschoben); Abbrechen → für jeden Anhang `discardAttachment(id)` (Fehler ignorieren), dann `clear(NEW_SESSION_KEY)`.
- [x] Satz unter dem Kasten nach AK 8.

### Doku

- [x] `docs/code-map.md`: Zeile „Anhänge“ um die Oberfläche ergänzen (`src/features/attachments/`, `src/stores/attachments.ts`); Zeile „Skills“ um `src/features/skills/useSkills.ts`; Chat-Zeile um `CommandMenu`, `commandMenuRows`; Sessions-Zeile um `renamingId`; Geteilte UI-Bausteine: `Popover` mit `autoFocus`/`anchor`.

## Report-Back

Eingabeleiste, `/`-Menü und „Neue Session“ stehen wie geplant; `pnpm check` ist grün. Nur am Code geprüft, nie in der laufenden App: Fokus im Slash-Menü (bleibt im Textfeld), Esc ohne Pause, Hineinziehen mit `onDragDropEvent`, Vorschaubilder über das Asset-Protokoll.

Abweichungen:

- `Popover` bekam zusätzlich `className` (für die Innenabstände des `/`-Menüs).
- `useCommandMenu` (neu, `src/features/chat/`) bündelt Filter, Markierung und Slash-Logik für Eingabeleiste und „Neue Session“, damit beide nicht doppelt gebaut sind.
- Die Effort-Zeile im Menü zeigt `EffortDots` mit dem Denkaufwand der Session und ist keine wählbare Zeile.
