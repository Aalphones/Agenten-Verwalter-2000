# Phase 5 — Oberfläche: Hintergrund-Panel, Verlaufszeilen, Doku-Abschluss

**Status:** complete · **Rating:** standard (Entwurf und Kontrakt stehen; Sorgfalt beim Nachladen und bei der Zuordnung Verlaufszeile → Panel-Eintrag)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ → „Hintergrund“, „Bewusst weggelassen“, „Kontrakt“ (Typen Phase 3, `src/stores/background.ts`)
- Entwurf: [Entwurfs-README](../../design/2026-09-28_hauptansichten/README.md) (Zeile „Hintergrund-Panel“ unter „Layout-Maße“, Punkte „Hintergrund“ und „Im Verlauf“ unter „Verhalten“). Quelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`:
  - Zeilen ~109–114: Kopfzeilen-Knopf
  - ~227–246: Verlaufszeilen Agent/Bash
  - ~684–737: Panel-Markup mit allen Maßen
  - ~978–1003: Beispieldaten
  - ~1349–1410: Panel-Logik (Gruppen, Detail, Aktionen, Zähler)

  Bei Widerspruch zu den Angaben unten gilt die Quelle.
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md)
- Bestand:
  - `src/app/App.tsx` (`renderMain`), `src/app/SessionHeader.tsx` + `.css`
  - `src/features/chat/ChatTimeline.tsx`, `buildBlocks.ts` (Werkzeug-Gruppen), `ToolGroup.tsx`, `toolSummary.ts`
  - `src/features/changes/useSessionChanges.ts` (Muster: Nachladen mit Takt, laufende Nummer, Fokus-Ereignis), `src/features/changes/buildFileRows.ts` (Muster: Baum aus flacher Pfadliste)
  - `src/components/CodeBlock.tsx` (wie „Kopieren“ in die Zwischenablage schreibt), `src/components/ExternalLink.tsx` (Öffnen im Standardbrowser)
  - `src/stores/chat.ts` (`setDraft`), `src/stores/sessions.ts` (`showView`)
  - `src/lib/background.ts` (Phase 3), `src/lib/errors.ts`
  - `revealItemInDir` aus `@tauri-apps/plugin-opener` (Berechtigung `opener:default` enthält `allow-reveal-item-in-dir`)
- Fehlerklassen: Vault `frameworks/react.md` gelesen — nicht einschlägig. Projekteigen:
  - **Veraltete Antwort überschreibt neue:** Ereignis, Takt und Session-Wechsel können Ladevorgänge überlappen lassen. Jede Antwort trägt eine laufende Nummer, nur die jüngste zählt (Muster `useSessionChanges`). Prüfen per AK 6.
  - **Takt läuft weiter, obwohl niemand hinsieht:** Nachladen der Ausgabe nur bei offenem Panel, sichtbarem Reiter und laufendem gewähltem Eintrag; Scratchpad nur bei sichtbarem Reiter.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. Kopfzeile: Rechts, vor dem Kontext-Balken, steht der Knopf (28 px hoch, Innenabstand 0 10 px, Rahmen `border`, Radius 6 px, 12 px). Er zeigt „n im Hintergrund“ mit blauem Punkt (`status-running`, Kreis mit Hof, 10 px) bei n laufenden Prozessen + Subagenten, sonst nur „Hintergrund“. Er hat das Terminal-Symbol, den Titel „Dev-Server, Subagenten, ausgeführte Skripte und Scratchpad dieser Session“ und `aria-pressed`; gedrückt `bg-selected`. Klick öffnet und schließt das Panel.
3. Panel rechts neben Chat bzw. Changes: 440 px, `bg-sidebar`, linke Linie `border-subtle`. Kopf 44 px mit Reiter-Segment „Prozesse · Subagenten · Scratchpad“ (Zähler 11 px `fg-muted`) und × „Hintergrund schließen“. Darunter die Liste (höchstens 330 px, scrollt, Gruppentitel 11 px Großbuchstaben `fg-muted`), darunter das Detail: Titel, Meta-Zeile, Ergebnis, Aktionen (26 px, Rahmen), Ausgabe in `font-mono` 12 px / 19 px auf `bg-base`. Das Panel bleibt beim Session-Wechsel offen und zeigt die neue Session.
4. Prozesse: Gruppe „LÄUFT“ (● blau, Befehl in Mono, Unterzeile „<Adresse> · seit <Laufzeit>“, rechts „läuft“) und „AUSGEFÜHRT“ (✓ grün bzw. ✕ rot, Befehl, Unterzeile „<Uhrzeit> · <Dauer>“, rechts „Exit n“ bei n ≠ 0, „angehalten“ bzw. „unterbrochen“ bei diesen Zuständen). Leer: „Keine laufenden Prozesse.“ bzw. „Noch keine Befehle ausgeführt.“ Detail eines laufenden Prozesses: Meta „läuft seit <Laufzeit> · <Adresse>“, Aktionen „Im Browser öffnen“ (nur mit Adresse) und „Beenden“ (Fehlerfarbe); die Ausgabe lädt alle 2 s nach und steht unten verankert. Detail eines beendeten: Meta „<Uhrzeit> · <Dauer> · Exit-Code n“ (ohne Code: „Exit-Code unbekannt“), Aktionen „Im Chat besprechen“ und „Ausgabe kopieren“.
5. Subagenten: Gruppe „SUBAGENTEN DIESER SESSION“, Zeile mit ● (läuft) bzw. ✓/✕/Pause-Symbol, Aufgabe, Unterzeile „<Typ> · <Modell> · n Aufrufe · <Dauer>“, rechts „läuft“/„fertig“/„fehlgeschlagen“/„angehalten“/„unterbrochen“. Leer: „Keine Subagenten gestartet.“ Detail: Meta „<Typ> · <Modell> · läuft seit / fertig nach <Dauer> · n Werkzeugaufrufe“, Ergebnis als Absatz, Schritte als `⎿ <Werkzeug>  <Ziel>`-Zeilen im Ausgabebereich. Aktionen: laufend „Anhalten“ (Fehlerfarbe), sonst „Ergebnis im Chat besprechen“.
6. Scratchpad: Gruppentitel = Pfad des Ordners (abgeschnitten, voller Pfad als `title`). Baum mit Ordnern (▾, nicht wählbar) und Dateien (▣ bei Bildern, ≡ sonst, Einzug 8 px + 18 px je Ebene, Unterzeile „<Größe> · <Uhrzeit>“). Leer: „Der Scratchpad-Ordner ist leer.“; unbekannt: „Der Agent hat noch keinen Scratchpad-Ordner gemeldet — er entsteht beim ersten Start.“ Detail: Meta „<Größe> · geändert <Uhrzeit> · im Scratchpad der Session“, Vorschau als Text oder Bild (`convertFileSrc`), „Keine Textvorschau“ bei Binärdateien, „Gekürzt …“ bei großen. Aktionen „Im Chat besprechen“ und „Im Explorer zeigen“. Schneller Wechsel zwischen zwei Sessions zeigt nie Dateien der vorigen.
7. Verlauf: Ein `Agent`-Werkzeugaufruf mit Subagent-Eintrag erscheint nicht in einer Werkzeug-Gruppe, sondern als eigene Zeile „● Agent `<Typ>` <Aufgabe> · <Status> · n Aufrufe ›“ (Punkt in Statusfarbe). Ein Hintergrund-Bash erscheint als „● Bash im Hintergrund `<Befehl>` → <Adresse> ›“ (Adresse in `accent-text`, fehlt sie: ohne Pfeil-Teil). Beide haben den Titel „Im Hintergrund-Panel öffnen“; ein Klick öffnet das Panel im passenden Reiter mit genau diesem Eintrag gewählt.
8. „Im Chat besprechen“ schaltet auf den Chat und hängt an den Entwurf „Zu `<Befehl>`: “ bzw. „Zu Subagent „<Aufgabe>“: “ bzw. „Zu <Dateiname im Scratchpad>: “ an; der Fokus steht im Textfeld.

## Checkliste

### Daten

- [x] `src/stores/background.ts` nach Kontrakt. `openItem(sessionId, item)` setzt `isOpen = true`, `tab` nach `item.kind` (`subagent` → `subagents`, sonst `processes`) und die Auswahl.
- [x] `src/features/background/useSessionBackground.ts`: `useSessionBackground(sessionId: string | null)` → `{ background: SessionBackground | null; error: string | null }`. Lädt beim Wechsel der Session und bei jedem `onBackgroundChanged` mit passender `sessionId`; laufende Nummer gegen veraltete Antworten. Der Hook läuft auch bei geschlossenem Panel, weil Kopfzeile (Zähler) und Verlauf (Zeilen) die Daten brauchen; die Listen sind klein, Ausgaben lädt er nicht.
- [x] `src/features/background/useItemOutput.ts`: `useItemOutput(sessionId, item: BackgroundItem | null, isVisible: boolean)` → `TextPreview | null`. Lädt `loadBackgroundOutput` beim Wählen. Solange `isVisible` und `item.state === 'running'` und `item.kind === 'process'` gilt, lädt er alle 2000 ms nach. Für `subagent` lädt er nichts.
- [x] `src/features/background/useScratchpad.ts`: `useScratchpad(session: SessionSummary | null, isVisible: boolean)` → `{ listing: ScratchpadListing | null; error: string | null }`. Lädt bei Sichtbarwerden, danach alle 5000 ms, solange sichtbar und `session.status` in `starting`, `running`, `waiting`.
- [x] `src/features/background/backgroundLabels.ts`: `stateLabel(state)` → `läuft` / `fertig` / `fehlgeschlagen` / `angehalten` / `unterbrochen`; `formatDuration(ms)` → „0,4 s“ unter 60 s (eine Nachkommastelle, Komma), sonst „m:ss“, ab einer Stunde „h:mm:ss“; `formatTime(ms)` → „HH:MM“ (lokal).
- [x] `src/features/background/buildScratchpadRows.ts`: aus `ScratchpadEntry[]` (flach, nach Pfad sortiert) die Zeilen `{ path, name, depth, isDir, isImage, sizeBytes, modifiedMs }` für die Anzeige; `isImage` nach denselben fünf Endungen wie bei Anhängen.

### Kopfzeile und Rahmen

- [x] `src/app/SessionHeader.tsx`: Knopf nach AK 2 zwischen Reitern und Kontext-Balken; Zähler = laufende `process` + laufende `subagent` aus `useSessionBackground`.
- [x] `src/app/App.tsx`: Neben der Session-Ansicht (Chat bzw. Changes) das Panel rendern, wenn `isOpen` und eine Session aktiv ist. Layout: der bisherige Inhaltsbereich wird `flex: 1; min-width: 0`, das Panel `flex-shrink: 0`.

### Panel

- [x] `src/features/background/BackgroundPanel.tsx` + `.css`: Kopf, Reiter (`role="tablist"`, `role="tab"`, `aria-selected`), × (`aria-label="Hintergrund schließen"`), Liste, Detail nach AK 3.
  - Ist kein Eintrag gewählt oder existiert der gewählte nicht mehr, gilt der erste der Liste (wie im Entwurf).
  - Die Listeneinträge sind Knöpfe mit `aria-current`.
- [x] `ProcessesTab.tsx`: Gruppen und Detail nach AK 4.
  - „Im Browser öffnen“ öffnet die Adresse wie `ExternalLink` (Standardbrowser).
  - „Beenden“ ruft `stopBackgroundItem` auf.
  - „Ausgabe kopieren“ schreibt `output.text` wie `CodeBlock` in die Zwischenablage und zeigt 1,5 s lang „Kopiert“ auf dem Knopf.
  - Die Ausgabe ist ein `pre` mit `overflow: auto`, beim Nachladen unten verankert, solange der Nutzer nicht hochgescrollt hat.
  - `missing` → „Ausgabe nicht mehr verfügbar.“; `truncated` → erste Zeile „Gekürzt — nur das Ende wird gezeigt.“
- [x] `SubagentsTab.tsx`: Liste und Detail nach AK 5; „Anhalten“ → `stopBackgroundItem`.
- [x] `ScratchpadTab.tsx`: Baum und Vorschau nach AK 6.
  - Text über `readScratchpadFile`.
  - Bilder über `<img src={convertFileSrc(<dir>\<path mit Backslashes>)}>`, `object-fit: contain`, 14 px Rand, Rahmen `border`, Radius 6 px.
  - „Im Explorer zeigen“ → `revealItemInDir(<voller Pfad>)`.
- [x] Fehler aus Aktionen stehen als Zeile (`role="alert"`, `status-error`, 12 px) unter den Aktionen.
- [x] Jede Aktion hat einen erklärenden `title`:
  - „Beenden“: „Hält den Prozess an. Der Agent erfährt davon.“
  - „Anhalten“: „Hält den Subagenten an. Der Agent erfährt davon.“
  - „Im Chat besprechen“: „Setzt einen Verweis in das Eingabefeld.“
  - „Im Explorer zeigen“: „Öffnet den Ordner im Windows-Explorer.“

### Verlaufszeilen

- [x] `buildBlocks.ts`: neuer Block `{ kind: 'background'; tool: ToolEntry; item: BackgroundItem }`. Eine Werkzeug-Zeile, deren `toolUseId` zu einem Eintrag mit `kind` `process` oder `subagent` gehört, wird aus der Werkzeug-Gruppe herausgelöst: Die Gruppe davor endet, der Hintergrund-Block folgt, danach beginnt eine neue Gruppe. `buildBlocks` bekommt dafür eine `ReadonlyMap<string, BackgroundItem>` (Schlüssel `toolUseId`) als zusätzlichen Parameter; `ChatTimeline` baut sie aus `useSessionBackground`.
- [x] `src/features/chat/BackgroundLine.tsx` + `.css`: Darstellung nach AK 7 (Entwurf Zeilen ~227–246). Punktfarbe nach Zustand: `running` `status-running`, `completed` `status-completed`, `failed` `status-error`, `stopped` und `interrupted` `status-paused`. Klick → `openItem(sessionId, item)`.

### Im Chat besprechen

- [x] Hilfsfunktion `mentionInChat(sessionId, label)` in `src/features/background/mention.ts`: `showView('chat')`, `setDraft(sessionId, draft + 'Zu ' + label + ': ')` (Leerzeichen davor, wenn der Entwurf nicht leer ist und nicht auf Leerraum endet), danach Fokus auf `#composer-input` (nach dem nächsten Frame).

### Doku-Abschluss

- [x] Entwurfs-README `docs/design/2026-09-28_hauptansichten/README.md`:
  - Tafel-Tabelle: `Attach`, `Cmd`, `Slash` → „M2b“; `BgProc`, `BgAgents`, `BgScratch` → „M2b“; `NewSession` bleibt.
  - „Abweichungen vom Entwurf“: „Fehlt ganz“ ohne Hintergrund-Knopf, `+`, `/`. Neue Punkte aus README „Bewusst weggelassen“, dazu:
    - Scratchpad-Pfad ist Claudes Ordner unter `%TEMP%`
    - Prozess-Meta ohne Repository
    - „Ausgeführt“ heißt leer „Noch keine Befehle ausgeführt.“
    - Status „angehalten“/„unterbrochen“ in Liste und Verlauf
    - Platzhalter „(/ für Skills)“
  - „Platzhalter im Entwurf“: den Satz zum Scratchpad-Pfad durch den Verweis auf ADR 007 ersetzen.
  - „Offene technische Fragen“ auf den Stand von GAPS bringen.
- [x] `docs/PROJECT.md`: Stack-Tabelle unverändert. „Offene Fragen“ um die verwaisten Hintergrundprozesse ergänzen, falls die Smoke-Abnahme sie bestätigt (sonst Verweis auf GAPS). Meilenstein 2b als gebaut kennzeichnen (Formulierung wie bei M1b: „— gebaut am <Datum>“).
- [x] `AGENTS.md`: Keine neue Regel. In der Befehls-Tabelle die Zeile `VERWALTER_IDLE_SECONDS` ergänzen: „…; eine Session mit laufendem Hintergrundprozess oder Subagent gilt nicht als ruhend“.
- [x] `docs/code-map.md`: Kopf-Absatz „Stand: Meilenstein 2b …“ neu fassen; Hintergrund-Zeile um die Oberfläche ergänzen (`src/features/background/`, `src/stores/background.ts`, `BackgroundLine`); App-Rahmen-Zeile um den Hintergrund-Knopf und das Panel.
- [x] `docs/glossary.md`: neuer Begriff **Hintergrund-Panel**: „Seitenpanel einer Session (440 px) mit den Reitern Prozesse, Subagenten, Scratchpad; geöffnet über den Knopf ‚Hintergrund‘ in der Kopfzeile oder eine Verlaufszeile.“
- [x] README dieses Plans: Status der Phasen, Bottom-Sektionen (Summary, Files touched, Commits, Deviations, Follow-ups) füllen.

## Report-Back

Gebaut wie geplant, mit fünf bewussten Abweichungen:

- `useItemOutput` und `useScratchpad` haben keinen Parameter `isVisible`: Der Reiter wird nur gerendert, solange er sichtbar ist, und der Takt endet mit dem Unmounten. Ein Parameter, der immer `true` wäre, wäre toter Code.
- `useScratchpad` nimmt die `SessionSummary` statt `SessionSummary | null`; das Panel gibt es nur mit aktiver Session.
- Ein Vordergrund-Befehl, den die Kommandozeile selbst in den Hintergrund schiebt, steht nur einmal im Panel (als `process`); der `command` mit gleicher `toolUseId` wird ausgeblendet.
- „Ausgeführt“ zeigt das Neueste zuoberst (der Entwurf hat nur Beispieldaten in Startreihenfolge).
- Der Reiter „Scratchpad“ zeigt keine Zahl, solange er nicht offen ist — die Dateiliste lädt nur der sichtbare Reiter.

Nur von `pnpm check` und am Code geprüft, nicht in der laufenden App (siehe Smoke-Checkliste in der README).
