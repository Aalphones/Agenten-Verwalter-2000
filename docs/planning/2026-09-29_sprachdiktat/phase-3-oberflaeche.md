# Phase 3 — Oberfläche: Mikrofon-Knopf, Einrichten, Fehler, Doku-Abschluss

Rating: standard · Commit-Scope: `voice`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“, „Kontrakt“, „Finale Abnahmekriterien“, „Smoke-Checkliste“ — verbindlich. Report-Back von Phase 1 und 2 lesen.
- [docs/conventions/react.md](../../conventions/react.md), [docs/conventions/typescript.md](../../conventions/typescript.md), [docs/conventions/tailwind.md](../../conventions/tailwind.md) (Tokens + BEM-CSS pro Komponente).
- Code: `src/features/chat/Composer.tsx` + `Composer.css` (Eingabeleiste der Session, `errorMessage`, `handleKeyDown`, Klasse `composer__icon-button`, `composer__send` mit `--color-fg-on-accent`), `src/features/sessions/NewSession.tsx` + `NewSession.css` (Feld „Was soll erledigt werden?“, lokaler `text`-State, `errorMessage`, `handleTextKeyDown`), `src/features/chat/ChatView.tsx` (Esc-Pause über `window`-`keydown`, prüft `event.defaultPrevented`), `src/components/Popover.tsx` (Props `label`, `placement`, `align`, `width`, `onClose`, `autoFocus`), `src/features/attachments/AttachMenu.tsx` (Muster eines kleinen Popovers an einem Icon-Knopf), `src/lib/voice.ts` (Wrapper aus Phase 1 und 2), `src/lib/errors.ts` (`commandErrorText`), `src/styles/theme.css` (drei Blöcke: hell in `:root`, dunkel in `@media (prefers-color-scheme: dark) { :root:not(.light) }` und dunkel in `:root.dark`; das Farbschema schaltet seit M6 die Klasse `dark`/`light` an `<html>`), `src/lib/background.ts` (Muster Ereignis-Abo mit `UnlistenFn`).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Aussehen (Vorbild Claude-Code-Desktop, verbindlich)

- **Ort:** Das Mikrofon sitzt **in der Textzeile rechts oben**, nicht in der unteren Knopfleiste: das Textfeld und der Mikrofon-Bereich stehen nebeneinander in einer neuen Zeile `composer__input-row` (`display: flex; align-items: flex-start`), das Textfeld nimmt den Rest (`flex: 1; min-width: 0`). In „Neue Session“ genauso mit `new-session__input-row`. Die untere Knopfleiste bleibt unverändert.
- **Ruhe:** Mikrofon-Symbol (Umriss, 15 px, Strichstärke 1.4 wie `PlusIcon`) in einem 30×30-Knopf mit den Stilen von `composer__icon-button` (Farbe `--color-fg-secondary`, Hover `--color-bg-selected`), Abstand 10 px nach oben und rechts. Tooltip (`title`) „Diktieren (Strg+M)“.
- **Aufnahme:** Links vom Knopf erscheint eine Kapsel (Höhe 30 px, `border-radius: var(--radius-md)`, Hintergrund `--color-voice-subtle`, Innenabstand 0 8 px) mit **drei senkrechten Balken** (je 3 px breit, 3 px Abstand, abgerundet, Farbe `--color-voice`); ihre Höhe folgt dem Pegel: Balken 1/2/3 = `4 + level * 12 * f` px mit `f` = 0.6 / 1.0 / 0.75, `transition: height 60ms linear`. Der Knopf selbst ist gefüllt: Hintergrund `--color-voice`, Symbol `--color-fg-on-accent`. Kapsel und Knopf stoßen ohne Lücke aneinander (Kapsel rechts ohne Rundung, Knopf links ohne Rundung) — wie ein zusammenhängendes Element. Tooltip „Aufnahme beenden (Strg+M) · Esc verwirft das Diktat“.
- **Text während der Aufnahme:** Nach jeder Sprechpause erscheint der bisher erkannte Text im Feld an der Stelle, an der beim Start der Cursor stand (bzw. ersetzt die damalige Auswahl). Das Feld ist ab dem Start bis zum Ende des Diktats `readOnly` (sichtbar am unveränderten Aussehen, nur Tippen geht nicht — kein Ausgrauen, der wachsende Text soll lesbar bleiben); Senden ist gesperrt (Senden-Knopf `disabled`, Enter bzw. Strg+Enter wirkungslos).
- **Erkennung (nach dem Stopp):** Die Kapsel zeigt statt der Balken drei Punkte, die nacheinander aufleuchten (Opazität 0.3 ↔ 1, 900 ms, versetzt um 150 ms), Knopf bleibt gefüllt, aber `disabled`. Tooltip „Erkenne den Rest … · Esc verwirft das Diktat“. Das Feld bleibt `readOnly`, bis der Text da ist.
- **Gesperrt:** Session `cancelled`/`error` oder Diktat läuft in einer anderen Eingabe → Knopf `disabled`, Tooltip im zweiten Fall „Diktat läuft in einer anderen Eingabe“.
- **Bewegung reduziert** (`@media (prefers-reduced-motion: reduce)`): Balken fest auf mittlerer Höhe (10 px), keine Punkt-Animation.
- **Tokens:** in `src/styles/theme.css` neue semantische Tokens `--color-voice` (hell `var(--color-blue-600)`, beide Dunkel-Blöcke `var(--color-blue-400)`) und `--color-voice-subtle` (`color-mix(in srgb, <dieselbe Farbe> 16%, transparent)`), jeweils neben `--color-status-running`.

## Einrichten (Modell fehlt)

- Klick auf das Mikrofon bei `missing` öffnet ein `Popover` (`label="Diktieren einrichten"`, `placement="above"` in der Session bzw. `"below"` in „Neue Session“, `align="end"`, `width={300}`) mit:
  - Überschrift „Diktieren einrichten“.
  - Text: „Für das Diktieren wird einmalig ein Sprachmodell (574 MB) auf deinen Rechner geladen. Danach läuft die Erkennung ohne Internet — deine Aufnahme verlässt den Rechner nie.“
  - Knopf „Herunterladen“ (Stil wie der primäre Knopf in „Neue Session“).
- Während `downloading`: statt des Knopfs ein Fortschrittsbalken (`<progress>` mit `value`/`max`, gestylt mit `--color-voice`), darunter „42 % · 241 von 574 MB“ (MB = Bytes / 1 000 000, gerundet), Knopf „Abbrechen“. Das Popover darf geschlossen werden, der Download läuft weiter; das Mikrofon zeigt dann den Tooltip „Sprachmodell wird geladen … 42 %“ und öffnet bei Klick wieder das Popover.
- Fehler (`VoiceModelEvent.error` gesetzt): Text in `--color-status-error` (wie `composer__error`) im Popover, Knopf „Erneut versuchen“.
- Wechsel nach `ready`: Popover schließt sich, Fokus zurück ins Textfeld; Tooltip des Mikrofons wird „Diktieren (Strg+M)“. Kein automatischer Aufnahmestart.

## Abnahmekriterien

1. Alle Punkte unter „Aussehen“ und „Einrichten“ sind so umgesetzt, in Hell- und Dunkelmodus.
2. Klick bzw. `Strg+M` (bei Fokus im Textfeld) startet ein Diktat. Beim Start merkt sich die Eingabe den Entwurf und die Auswahl des Textfelds (**Ausgangsstand**). Jedes `voice://partial` setzt den Entwurf auf `insertDictation(Ausgangsstand, Text des Ereignisses)` — der Text ersetzt die damalige Auswahl, mit einem Leerzeichen davor, wenn das Zeichen davor kein Leerraum ist, und einem danach, wenn das Zeichen danach kein Leerraum ist. Erneuter Klick → stoppt; der Rückgabewert von `stopDictation` wird genauso eingesetzt, danach Fokus im Feld, Cursor hinter dem eingefügten Text. Gesendet wird nichts.
3. Esc während Aufnahme oder Erkennung ruft `cancelDictation` und setzt den Entwurf auf den Ausgangsstand zurück (auch schon erschienener Text verschwindet); die Session wird nicht pausiert (Esc-Handler von `ChatView` sieht `defaultPrevented`).
3a. Während des Diktats (Aufnahme und Erkennung) ist das Feld `readOnly` und Senden gesperrt (Knopf und Tastatur); danach ist beides sofort wieder frei. Ein `voice://partial`, das eintrifft, wenn für diese Eingabe kein Diktat mehr läuft, wird ignoriert.
3b. Endet `stopDictation` mit einem Fehler außer `voiceCancelled`, bleibt der zuletzt angezeigte Text im Entwurf stehen (er ist echt erkannt) und die Fehlerzeile zeigt den Satz nach AK 5.
4. Nach 120 s Aufnahme stoppt die Oberfläche selbst (wie ein zweiter Klick).
5. Fehler aus `startDictation`/`stopDictation` erscheinen als Satz in der vorhandenen Fehlerzeile der jeweiligen Eingabe: `microphone` → „Mikrofon nicht verfügbar: <Text>. Prüfe in Windows unter Einstellungen → Datenschutz und Sicherheit → Mikrofon, ob Desktop-Apps zugreifen dürfen.“; `noAudio` → „Kein Ton vom Mikrofon — ist das richtige Eingabegerät in Windows eingestellt?“; `noSpeech` → „Keine Sprache erkannt.“; `voiceBusy` → „Es läuft schon ein Diktat.“; `voiceCancelled` → kein Text. `voiceModelMissing` öffnet stattdessen das Einrichten-Popover.
6. Wechselt man während einer Aufnahme die Session oder schließt „Neue Session“, wird das Diktat abgebrochen (`cancelDictation` beim Unmount des Mikrofon-Knopfs, der es gestartet hat).
7. `pnpm check` grün; Smoke-Checkliste im README ist vorbereitet (Sascha führt sie durch).

## Checkliste

### Zustand und Logik

- [ ] `src/stores/voice.ts` (Zustand, nur flüchtig): `phase: 'idle' | 'recording' | 'transcribing'`, `owner: string | null` (Schlüssel der Eingabe, die gerade diktiert: Session-ID bzw. `'new-session'`), `level: number`, `modelState: VoiceModelState | null`, `downloadError: string | null`, Setter je Feld. Pegel nur hier, damit nur der Knopf bei 20 Hz neu zeichnet.
- [ ] `src/features/voice/insertDictation.ts`: `export interface DictationBase { value: string; start: number; end: number }` (der Ausgangsstand) und reine Funktion `insertDictation(base: DictationBase, text: string): { value: string; caret: number }` nach AK 2 — rechnet immer vom Ausgangsstand aus, nie vom aktuellen Entwurf, damit wiederholte Ereignisse den Text ersetzen statt ihn zu stapeln.
- [ ] `src/features/voice/useVoiceModel.ts`: lädt beim ersten Einbinden `loadVoiceModelState()` in den Store und abonniert `onVoiceModel` (Abo einmal pro App: das Abo lebt in `src/app/App.tsx` über diesen Hook, nicht in jedem Knopf).
- [ ] `src/features/voice/useDictation.ts`: Parameter `{ owner: string; sessionId: string | null; inputRef: RefObject<HTMLTextAreaElement | null>; getValue: () => string; setValue: (next: string) => void; onError: (message: string | null) => void; onNeedsSetup: () => void }`. Liefert `{ phase (für diesen Besitzer, sonst 'idle'), isBlocked (anderer Besitzer aktiv), toggle, cancel }`.
  - Ausgangsstand in einem `useRef<DictationBase | null>`.
  - `toggle` bei `idle`: `onError(null)`; Ausgangsstand festhalten: `value = getValue()`, `start/end` = `selectionStart/End` aus `inputRef` (fehlt das Element → beide `value.length`); dann `startDictation(sessionId)`; Erfolg → Store `recording`, `owner`; 120-s-Zeitgeber starten; `voiceModelMissing` → Ausgangsstand verwerfen, `onNeedsSetup()`; anderer Fehler → Ausgangsstand verwerfen, `onError(Text nach AK 5)`.
  - Text-Abo `onVoicePartial` solange `phase !== 'idle'` für diesen Besitzer (ab Start bis Ende, also auch während `transcribing`): Handler prüft zuerst im Store (`useVoiceStore.getState()`), ob `owner` noch dieser Besitzer und `phase !== 'idle'` ist, sonst nichts tun (AK 3a); dann `setValue(insertDictation(base, event.text).value)`.
  - `toggle` bei `recording`: Zeitgeber löschen, Store `transcribing`, `stopDictation()`; Erfolg → `insertDictation(base, text)`, `setValue`, danach im nächsten Frame `focus()` und `setSelectionRange(caret, caret)`; Fehler → `onError` (bei `voiceCancelled` nichts), Entwurf **nicht** zurücksetzen (AK 3b). Immer am Ende Store `idle`, `owner null`, `level 0`, Ausgangsstand verwerfen.
  - Pegel-Abo `onVoiceLevel` nur solange `phase === 'recording'` für diesen Besitzer.
  - Esc: solange `phase !== 'idle'` für diesen Besitzer ein `keydown`-Listener auf `window` **in der Capture-Phase** (`addEventListener('keydown', h, true)`); bei `Escape` → `preventDefault()`, `stopPropagation()`, `cancel()`.
  - `cancel`: `cancelDictation()`, Zeitgeber löschen, `setValue(base.value)` (Ausgangsstand zurück, AK 3), Store zurücksetzen, Ausgangsstand verwerfen. Das laufende `stopDictation` liefert danach `voiceCancelled` und ändert nichts mehr.
  - Unmount bei aktivem Diktat: `cancelDictation()` und Store zurücksetzen, aber **kein** `setValue` (die Eingabe ist weg; ein Entwurf im Chat-Store behält den zuletzt angezeigten Text — bewusst, der Nutzer hat die Session gewechselt, nicht verworfen) (AK 6).
- [ ] Fehlertexte: die Texte aus AK 5 in `src/lib/errors.ts` `commandErrorText` als neue `case`-Zweige (`microphone`, `noAudio`, `noSpeech`, `voiceBusy`, `voiceModelMissing` mit „Sprachmodell fehlt.“); `useDictation` nutzt `commandErrorText`.

### Bauteile

- [ ] `src/features/voice/VoiceButton.tsx` + `VoiceButton.css` (BEM-Block `voice-button`): Props `{ owner, sessionId, inputRef, getValue, setValue, onError, disabled }`; nutzt `useDictation`; rendert Kapsel (Balken oder Punkte) + Knopf nach „Aussehen“, `aria-label` = Tooltip-Text, `aria-pressed={phase === 'recording'}`; hält den Zustand „Einrichten offen“ lokal und rendert `VoiceSetup` im eigenen `position: relative`-Anker. `Strg+M` registriert `VoiceButton` selbst als `keydown`-Listener auf `inputRef.current` (hinzufügen/entfernen in einem Effekt; `event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'm'` → `preventDefault()`, `toggle()`; bei `disabled` nichts). Die Eltern ändern ihre `handleKeyDown` nicht.
- [ ] `src/features/voice/VoiceSetup.tsx` + `VoiceSetup.css`: Popover-Inhalt nach „Einrichten“, liest `modelState`/`downloadError` aus dem Store, ruft `downloadVoiceModel`/`cancelVoiceModelDownload`; schließt sich bei `ready` über `onClose`.
- [ ] Mikrofon- und Punkte-Symbole als lokale SVG-Funktionen in `VoiceButton.tsx` (Muster `PlusIcon` in `Composer.tsx`).

### Einbau

- [ ] `src/app/App.tsx`: `useVoiceModel()` aufrufen.
- [ ] `Composer.tsx`: `<textarea>` in `<div className="composer__input-row">` packen, daneben `<VoiceButton owner={session.id} sessionId={session.id} inputRef={inputRef} getValue={() => useChatStore.getState().drafts[session.id] ?? ''} setValue={(next) => setDraft(session.id, next)} onError={setErrorMessage} disabled={isLocked} />`. CSS: `&__input-row { display: flex; align-items: flex-start; }`, `&__input { flex: 1; min-width: 0; }`. Sperre während des Diktats (AK 3a): `const isDictating: boolean = useVoiceStore((s) => s.owner === session.id && s.phase !== 'idle');`, am `<textarea>` `readOnly={isDictating}`, und `canSend` um `&& !isDictating` erweitern — `send()` prüft `canSend` schon, damit sind Knopf und Enter zugleich gesperrt.
- [ ] `NewSession.tsx`: genauso mit `new-session__input-row`, `owner="new-session"`, `sessionId={null}`, `getValue` über einen `useRef`, der `text` spiegelt (Wert zum Zeitpunkt des Aufrufs, nicht beim Rendern), `setValue={setText}`, `disabled={isStarting}`. Sperre: `isDictating` mit `s.owner === 'new-session'`, `readOnly={isDictating}` am Textfeld, `canStart` um `&& !isDictating` erweitern — `start()` prüft `canStart` schon (Knopf und Strg+Enter).
- [ ] Nach dem Plan „Vorhaben und Sessions“: `NewSession.tsx` ist die Seite „Neues Vorhaben“ (Diktat dort unverändert, `owner="new-session"`). Eine Session im Status „Neu“ zeigt den normalen `Composer`; `isLocked` in `Composer.tsx` (nur `cancelled`/`error`) bleibt unverändert, damit das Mikrofon dort nutzbar ist — nicht um `new` erweitern. Die Repository-Namen für die Erkennungshilfe (`voice_start(sessionId)`) sind für alle Sessions eines Vorhabens gleich.
- [ ] `theme.css`: Tokens nach „Aussehen“.

### Doku-Abschluss

- [ ] `docs/code-map.md`: Zeile „Diktieren“ um Oberfläche ergänzen (`src/features/voice/` mit `VoiceButton`, `VoiceSetup`, `useDictation`, `useVoiceModel`, `insertDictation`; `src/stores/voice.ts`; Einbau in `Composer` und `NewSession`); Stand-Satz am Kopf der Code-Map um Sprachdiktat ergänzen.
- [ ] `docs/glossary.md`: „Diktieren“ um die Bedienung ergänzen (Klick/Strg+M, Text erscheint satzweise schon während des Sprechens an der Cursorposition, Feld und Senden bis zum Ende gesperrt, Esc verwirft das ganze Diktat).
- [ ] `docs/design/2026-09-28_hauptansichten/README.md`: unter der Eingabeleiste einen Absatz „Mikrofon (ohne Tafel, gebaut nach Plan Sprachdiktat Phase 3, Vorbild Claude-Code-Desktop)“ mit den Maßen aus „Aussehen“.
- [ ] `AGENTS.md`: nichts (kein neuer Befehl); `docs/PROJECT.md`: Sprachdiktat als erledigte Erweiterung unter den Meilensteinen nachtragen („gebaut am <Datum>“) — Wortlaut analog zur Zeile 2b.
- [ ] README dieses Plans: Status-Spalte, „Summary“, „Files touched“, „Commits“, „Deviations“, „Follow-ups“ füllen; Smoke-Checkliste bleibt für Sascha.
- [ ] Commit `feat(voice): Mikrofon in der Eingabeleiste`.

## Report-Back
