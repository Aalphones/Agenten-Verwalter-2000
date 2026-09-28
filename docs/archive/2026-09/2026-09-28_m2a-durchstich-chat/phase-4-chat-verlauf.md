# Phase 4 — Chat-Verlauf

**Status:** complete · **Rating:** heikel (virtualisierte Liste mit unten verankertem Verlauf, Nachladen nach oben und Live-Aktualisierung einzelner Einträge)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Kontrakt (`ChatEntry`, `ChatPage`, `chat://entry`, `seq`-Regel), Status-Maschine
- [Design-README](../../design/2026-09-28_hauptansichten/README.md) → „Verhalten“ (Verlauf) und „Layout-Maße“ (Chat-Spalte)
- Entwurfsquelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`: Verlauf Zeilen 136–292 (Nutzer-Nachricht 141–157, Text 158–160, Gedankengang 161–169, Werkzeug-Gruppe 170–191, Aufgaben 200–216, Rückfrage 247–264, Fehler 265–277, „arbeitet“ 284–290)
- [docs/conventions/react.md](../../conventions/react.md) → State (Chat-Verlauf nie im Store), Performance (virtualisiert), Effects (Abos aufräumen); [ADR 002](../../decisions/002-typgenerierung-und-listen.md) (`@tanstack/react-virtual`)
- Bestand aus Phase 2/3: `src/lib/chat.ts`, `src/lib/sessions.ts`, `src/app/App.tsx` (Platzhalter `app__content`), `src/components/StatusIcon.tsx`
- Vault-Fehlerklassen `frameworks/react.md`, `sprachen/typescript.md`: geprüft, keine einschlägig. `werkzeuge/claude-code.md` → „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“: Werkzeug-Zeilen im Zustand `interrupted` heißen „unterbrochen“, nie „nicht ausgeführt“.

## Abnahmekriterien der Phase

1. Der Chat einer Session steht in einer Spalte von höchstens 780 px, zentriert, Innenabstand 20/32/12 px, 14 px zwischen Blöcken; bei wenig Inhalt klebt der Verlauf unten.
2. Blöcke nach Entwurf: eigene Nachricht im Kasten (Rahmen, `--color-bg-surface`, Radius 8 px), Antworttext frei (13,5 px, Zeilenhöhe 1,65, Umbrüche erhalten), „Gedankengang · n s“ eingeklappt und aufklappbar, Werkzeug-Gruppe eingeklappt mit Punkt, Titel, Zusammenfassung, aufgeklappt `⎿`-Zeilen, Aufgabenliste mit Kästchen, Rückfrage-Kasten, Fehler-Kasten, „Claude arbeitet … · Esc unterbricht“ am Ende, solange der Agent läuft.
3. Neue und geänderte Einträge erscheinen ohne Neuladen; eine Werkzeug-Zeile wechselt von laufend (Punkt `--color-status-running`) auf fertig (`--color-status-completed`) bzw. Fehler (`--color-status-error`).
4. Steht die Ansicht unten, bleibt sie beim Eintreffen neuer Einträge unten. Hat der Nutzer nach oben gescrollt, springt sie nicht.
5. Beim Anlegen einer Session werden höchstens 200 Einträge geladen; Scrollen an den oberen Rand lädt die nächsten 200 älteren, die sichtbare Stelle bleibt dabei stehen.
6. Nur die sichtbaren Blöcke stehen im DOM (Entwicklerwerkzeuge: bei 80+ Werkzeug-Zeilen, aufgeklappt, deutlich weniger Knoten als Blöcke).
7. Rückfrage: Klick auf eine Option beantwortet sie (`answerQuestion`); danach sind die Knöpfe gesperrt und statt „Oder schreib unten eine eigene Antwort.“ steht „Antwort: <answer>“. Ziffern 1–9 wählen die Option der ältesten offenen Rückfrage, solange der Fokus nicht in einem Textfeld steht.
8. Fehler-Kasten: „Agent neu starten“ nur beim letzten Fehler-Eintrag und nur im Status `error`; „Protokoll anzeigen“ klappt die Zeilen aus `getSessionLog` auf.
9. Sessionwechsel zeigt sofort den Verlauf der neuen Session; Einträge anderer Sessions erscheinen nie.
10. `pnpm check` grün.

## Checkliste

### Daten

- [x] `pnpm add @tanstack/react-virtual` (aktuelle stabile Hauptversion; Version in FINDINGS notieren).
- [x] `src/features/chat/useChatEntries.ts`: `useChatEntries(sessionId: string): { entries: readonly ChatEntry[]; hasMore: boolean; loadingOlder: boolean; loadOlder: () => void }`.
  - Beim (Wechsel des) `sessionId`: Liste leeren, `getChatHistory(sessionId, null, 200)`; veraltete Antworten per `AbortController` verwerfen.
  - Abo `onChatEntry`: nur Ereignisse mit gleicher `sessionId`. Ist die Liste leer oder `seq` kleiner als die erste geladene → ignorieren; liegt `seq` im geladenen Bereich → Eintrag an seiner Stelle ersetzen; `seq === letzte + 1` → anhängen; größer → neueste Seite neu laden (Lücke).
  - `loadOlder`: nur wenn `hasMore` und nicht schon ladend: `getChatHistory(sessionId, ersteSeq, 200)`, vorn anfügen.
  - Einträge liegen nur im State dieses Hooks, nicht im Store.
- [x] `src/features/chat/buildBlocks.ts`: reine Funktion `buildBlocks(entries): ChatBlock[]` mit `type ChatBlock = { kind: 'entry'; key: string; entry: ChatEntry } | { kind: 'tools'; key: string; tools: ToolEntry[] }` (`ToolEntry` = `Extract<ChatEntry, { kind: 'tool' }>`); aufeinanderfolgende `tool`-Einträge bilden eine Gruppe, `key` = `seq` des ersten Eintrags als String.
- [x] `src/features/chat/toolSummary.ts`: `groupTitle(tools)`: alle gleiches `tool` → dieser Name, sonst „Werkzeuge“. `groupSummary(tools)`: genau ein Aufruf → sein `target`; sonst bei einheitlichem Werkzeug `Read`/`Write`/`Edit` → „n Dateien“, `Grep`/`Glob` → „n Suchen“, `Bash` → „n Befehle“, sonst „n Aufrufe“. `groupDot(tools)`: irgendein `failed` → Fehler, irgendein `running` → läuft, sonst fertig (ein `interrupted` ohne `failed` zählt als fertig, die Zeile zeigt „unterbrochen“).

### Ansicht (`src/features/chat/`)

- [x] `ChatView.tsx` + `.css`: Props `session: SessionSummary`; Spalte mit `ChatTimeline` (füllt den Rest) und einem leeren Platz `chat-view__composer` für Phase 6. `TextBlock` bleibt hier Klartext mit `white-space: pre-line`; Phase 5 stellt ihn auf Markdown um. In `App.tsx` den Platzhalter `app__content` durch `ChatView` ersetzen, `key={session.id}`, damit der Zustand beim Wechsel neu beginnt.
- [x] `ChatTimeline.tsx` + `.css` mit `useVirtualizer` von `@tanstack/react-virtual`:
  - `count` = Blöcke + 1, wenn Status `starting`/`running` (Zeile „arbeitet“ als letztes Element); `getItemKey` = Block-`key` bzw. `'working'`; `estimateSize` 40; `measureElement` für echte Höhen; `overscan` 8.
  - Scroll-Container füllt die Höhe; die innere Fläche hat `height = max(totalSize, Höhe des Containers)`; jedes Element sitzt per `transform: translateY(start + offset)` mit `offset = max(0, Containerhöhe − totalSize)` — so klebt wenig Inhalt unten (Laufzeitwerte per `style`, erlaubt laut tailwind.md). Innen jedes Element: Spalte höchstens 780 px, zentriert, seitlich 32 px, `padding-bottom` 14 px; oben 20 px und unten 12 px als Rand der Fläche.
  - Am Ende kleben: `stickToBottom`-Ref, im `scroll`-Handler `true`, wenn `scrollTop + clientHeight >= scrollHeight − 24`. Nach jeder Änderung der Blöcke (Layout-Effekt) bei `true` → `scrollToIndex(count − 1, { align: 'end' })`.
  - Nachladen: im `scroll`-Handler bei `scrollTop < 200` → `loadOlder()`. Vor dem Voranstellen `scrollHeight` merken; im Layout-Effekt nach dem Voranstellen `scrollTop += neueHöhe − alteHöhe`. Hält die Stelle damit nicht (Sprung sichtbar) → in FINDINGS mit Beobachtung, nicht mit einer zweiten Technik weiterbasteln.
  - `role="log"`, `aria-live="polite"`, `aria-label="Verlauf"`.
- [x] Block-Komponenten, je `.tsx` + `.css`, Struktur und Maße nach den Entwurfszeilen aus dem Kontext:
  - `UserMessage` (ohne Anhänge und Skill-Marke — M2b).
  - `TextBlock` (`white-space: pre-line`).
  - `ThinkingBlock`: Knopf „Gedankengang · n s“ mit `aria-expanded`, aufgeklappt kursiv mit linker Linie.
  - `ToolGroup`: Knopf mit Punkt 8 px (Farbe nach `groupDot`), Titel (600), Zusammenfassung, Pfeil rechts/unten, `aria-expanded`; aufgeklappt `⎿` + Werkzeugname (600) + Ziel in `--font-mono` 12 px einzeilig mit Auslassung; `interrupted` → dahinter „unterbrochen“ in `--color-fg-muted`, `failed` → Werkzeugname in `--color-status-error`. Standard eingeklappt.
  - `TodoList`: Punkt, „Aufgaben“, „n von m erledigt“, Einträge mit den drei Kästchen-Symbolen; `active` in `--color-fg-primary`, `done` und `todo` in `--color-fg-secondary`.
  - `QuestionBlock`: `role="group"`, `aria-label="Rückfrage des Agenten"`, Rahmen `--color-status-waiting`, Kopf „Claude wartet auf deine Entscheidung“ mit Wartet-Symbol. Eine Frage → ein Absatz + Optionsknöpfe mit Ziffer, Label, Hinweis. Mehrere Fragen → nacheinander im selben Kasten; `multiSelect`-Frage → Optionen schalten um (gewählt: Rahmen `--color-accent`), darunter Knopf „Antworten“ (28 px, Akzent). Gesendet wird, sobald jede Frage eine Antwort hat: `answerQuestion(sessionId, requestId, { kind: 'options', answers })` — `multiSelect`-Antworten mit `, ` verbunden. Bei `questionKind === 'permission'`: „Erlauben“ → `{ kind: 'allow' }`, „Ablehnen“ → `{ kind: 'deny', message: 'Der Benutzer hat abgelehnt.' }`. Beantwortet (`answer !== null`) → Knöpfe gesperrt, Fußzeile „Antwort: <answer>“.
  - `ErrorBlock`: `role="alert"`, Rahmen `--color-status-error`, Titel, Text, Knöpfe „Agent neu starten“ (Akzent, `restartSession`) und „Protokoll anzeigen“ / „Protokoll ausblenden“; aufgeklappt `<pre>` in `--font-mono` 12 px / 19 px auf `--color-bg-base`, höchstens 240 px hoch mit Scrollen, Inhalt aus `getSessionLog` beim Aufklappen geladen.
  - `WorkingIndicator`: Stern-Symbol, Text = Label des `active`-Eintrags der jüngsten geladenen Aufgabenliste, sonst „Claude arbeitet …“; dahinter „· Esc unterbricht“ in `--color-fg-muted`; Farbe `--color-accent-text`.
- [x] Ziffern-Tasten (AK 7): Listener auf `window` in `ChatTimeline`, ignoriert Ereignisse mit `defaultPrevented` und solche, deren Ziel ein `input`, `textarea` oder `[contenteditable]` ist; Cleanup.

### Doku

- [x] `docs/code-map.md`: Zeile Chat um `src/features/chat/` (Verlauf, Blöcke, `useChatEntries`) konkretisieren.
- [x] Design-README → „Abweichungen bis Meilenstein 3“ ergänzen: Werkzeug-Zeile „unterbrochen“; Rückfrage mit Mehrfachauswahl bekommt den Knopf „Antworten“; „Protokoll anzeigen“ klappt im Kasten auf; Tafeln `Waiting.dc.html`, `Error.dc.html` → „M2a“.

## Report-Back

- **Gebaut:** `src/features/chat/` — `ChatView`, `ChatTimeline` (virtualisiert, unten verankert, Nachladen nach oben, Ziffern-Tasten), Blöcke `UserMessage`, `TextBlock`, `ThinkingBlock`, `ToolGroup`, `TodoList`, `QuestionBlock`, `ErrorBlock`, `WorkingIndicator`; Logik `useChatEntries`, `buildBlocks`, `toolSummary`, `questionDraft`. `@tanstack/react-virtual` 3.14.13.
- **Abweichungen vom Plan:**
  - Leerer Seitenstand: ein Eintrag mit `seq` 0 wird angehängt, nicht ignoriert (die Plan-Regel „Liste leer → ignorieren“ hätte bei einer frischen Session die erste Nachricht verschluckt). Ereignisse, die eintreffen, während die neueste Seite lädt, werden gepuffert und danach angewendet; das Laden startet erst, wenn das Abo steht.
  - Am Ende kleben per `scrollTop = scrollHeight` statt `scrollToIndex(…, { align: 'end' })` — schließt den unteren Rand der Fläche ein und braucht keine Nachmess-Runden.
  - Auf-/zugeklappt, Protokoll offen und halbe Antworten einer Rückfrage liegen in `ChatTimeline`, nicht im Block: ein virtualisierter Block verlässt beim Scrollen das DOM und verlöre sonst seinen Zustand.
  - Füllt der Verlauf die Höhe nicht, lädt `ChatTimeline` Älteres sofort nach (ohne Scrollleiste gibt es kein Scroll-Ereignis).
  - Beantwortete Rückfrage: Kopf „Claude hat gefragt“, neutraler Rahmen (im Entwurf nicht gezeichnet; Design-README nachgezogen). Ziffern wirken auf die erste Frage ohne Auswahl, sonst auf die erste Mehrfachauswahl.
  - Lint: eine Zeilen-Ausnahme für `react-hooks/incompatible-library` am `useVirtualizer`-Aufruf (Warnung gilt dem React Compiler, den das Projekt nicht nutzt) — von Sascha freigegeben.
- **Nebenbefund, eigener Commit:** Seit Phase 3 wirkte keine verschachtelte BEM-Regel (`&__x`, `&--x`) — natives CSS-Nesting hängt nichts an den Elternnamen an. Behoben mit `postcss-nested` in `vite.config.ts`; Konvention nachgezogen.
- **Nicht in der App angesehen:** Scroll-Verhalten, Nachladen ohne Sprung und die Maße sind nur gebaut und durch die Prüfkette gelaufen — Prüfung im Smoke am Plan-Ende (Wackelstelle 1).
