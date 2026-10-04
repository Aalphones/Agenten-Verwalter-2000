# Phase 3 — Oberfläche: Einstellungen, Eingabeleiste, Neues Vorhaben, Kontingent; Doku, Release

Ziel: Betriebsart und lokales Modell lassen sich in den Einstellungen wählen; Eingabeleiste, „Neues Vorhaben“ und Kopfzeile zeigen, dass lokal gearbeitet wird. Danach sind Glossar und Code-Map nachgezogen und der Plan ist abnahmebereit.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“, „Kontrakt“, „Finale Abnahmekriterien“.
- Phase 2 hat geliefert: Bindings `OperatingMode`, `LocalModel`, `LocalModelKind`, `LocalModels`, Felder `operatingMode`/`localModel` in `Settings`, `SettingsChange`-Varianten `operatingMode`/`localModel`, Wrapper `loadLocalModels()` in `src/lib/settings.ts`, Fehler `localModelUnavailable` (Text in `message`, die vorhandenen Fehlerwege in `Composer.describeError` und `commandErrorText` zeigen ihn ohne Änderung).
- `src/features/settings/SettingsView.tsx` (Abschnitt „Agent“, `OpenMenu`, `SelectButton`, `SettingRow`), `ColorSchemeSegment.tsx` (Vorbild für den Segment-Schalter), `src/components/ModelMenu.tsx` + `ModelMenu.css` (Vorbild für das Modell-Menü), `src/components/ModeMenu.tsx`, `src/features/chat/Composer.tsx`, `src/features/sessions/NewSession.tsx` (Schritt 3 „Agent“ und Zusammenfassung im Fuß), `src/app/SessionHeader.tsx` (`UsageButton`), `src/stores/settings.ts`, `src/lib/labels.ts`, `src/features/context/formatTokens.ts` (`formatThousands`).
- Konventionen: [react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (BEM-CSS je Komponente, nur Tokens aus `theme.css`).
- Design: Für die neuen Zeilen gibt es keinen Entwurf. Sie folgen dem Muster der vorhandenen Einstellungszeilen (Entwurf `docs/design/2026-09-28_hauptansichten/canvas/Settings.dc.html`): Beschriftung links mit i-Symbol, Bedienelement rechts.
- Fehlerklassen: Vault `frameworks/react.md` und `sprachen/typescript.md` — keine einschlägig (betreffen Tests bzw. `fetch`).

## AK der Phase

Die finalen AK 1, 2, 4, 5, 7 der README sind in der laufenden App erfüllt; dazu:

- Der Schalter „Betriebsart“ wirkt sofort in Eingabeleiste und Kopfzeile aller offenen Sessions (sie lesen den Store), ohne Neustart der App.
- Ohne gewähltes Modell zeigt „Lokales Modell“ „Kein Modell gewählt“; die Eingabeleiste zeigt dann ebenfalls „Kein Modell gewählt“, und Senden liefert den Satz aus Phase 2.
- Im `/`-Menü führt „Modell“ in der lokalen Betriebsart zum Satz „Das Modell wählst du in der Betriebsart „Claude Code + LM Studio“ in den Einstellungen.“ unter der Eingabeleiste, nicht zu einem leeren Menü.
- Hell und dunkel: neue Elemente nutzen nur vorhandene Tokens.

## Checkliste

### Texte und Hilfen

- [x] `src/lib/labels.ts`: `OPERATING_MODE_OPTIONS: readonly { id: OperatingMode; label: string }[]` = `[{ id: 'claude', label: 'Claude' }, { id: 'claudeCodeLocal', label: 'Claude Code + LM Studio' }]`; `localModelLabel(id: string | null): string` → `null` ergibt `'Kein Modell gewählt'`, sonst der Teil nach dem letzten `/` (ohne `/` die ganze Kennung).

### Einstellungen

- [x] `src/features/settings/OperatingModeSegment.tsx`: Kopie von `ColorSchemeSegment.tsx` mit `OPERATING_MODE_OPTIONS`, Props `value: OperatingMode`, `onChange`, `aria-label="Betriebsart"`, dieselben CSS-Klassen `settings-view__segment*`.
- [x] `src/features/settings/useLocalModels.ts`: `useLocalModels(isEnabled: boolean): { models: LocalModels | null; isLoading: boolean; reload: () => void }`. Lädt beim Einhängen und jedes Mal, wenn `isEnabled` auf `true` wechselt, sowie bei `reload()`; nur die jüngste Antwort zählt (Muster `requestRef` aus `src/features/usage/useUsage.ts`). Wirft `loadLocalModels` doch (sollte es nicht), wird daraus `{ baseUrl: '', models: [], error: commandErrorText(reason) }`.
- [x] `src/features/settings/LocalModelMenu.tsx` + `LocalModelMenu.css` (BEM `local-model-menu`, Stile analog `ModelMenu.css`): `Popover` mit `label="Lokales Modell"`, `placement="below"`, `align="start"`, Breite 380. Props `value: string | null`, `models: LocalModels | null`, `isLoading: boolean`, `onChange(id: string)`, `onReload()`, `onClose()`.
  - Kopf „Modelle in LM Studio“.
  - `isLoading && models === null` → Zeile „Lädt …“.
  - `models.error !== null` → Absatz `LM Studio nicht erreichbar unter ${models.baseUrl}. Läuft der lokale Server in LM Studio? (${models.error})`.
  - leere Liste ohne Fehler → „LM Studio meldet keine Sprachmodelle.“
  - je Modell ein `role="menuitemradio"`-Knopf wie in `ModelMenu`: Name = `id`, Hinweis bei geladenem Modell `${kind === 'vlm' ? 'Text und Bild' : 'Nur Text'} · Kontext ${formatThousands(loadedContextLength ?? maxContextLength)}`, bei nicht geladenem `disabled` mit Hinweis „Nicht geladen — in LM Studio laden“. Häkchen beim gewählten.
  - Fuß: Knopf „Neu laden“ (ruft `onReload`) und der Satz „Gilt ab der nächsten Nachricht jeder Session.“
- [x] `SettingsView.tsx`, Abschnitt „Agent“, als **erste** Zeile: `SettingRow label="Betriebsart"` mit `info="Claude: Modellanfragen gehen an dein Claude-Abo. Claude Code + LM Studio: dieselbe Claude-Kommandozeile mit Werkzeugen, Skills und Anweisungen, aber das Modell läuft lokal in LM Studio — für die Zeit, in der das Kontingent aufgebraucht ist. Gilt ab der nächsten Nachricht jeder Session."` und `OperatingModeSegment` (`save({ kind: 'operatingMode', value })`).
- [x] Direkt darunter, nur wenn `current.operatingMode !== 'claude'`: `SettingRow label="Lokales Modell"` mit `info="Ein in LM Studio geladenes Modell. Die Kontextlänge, mit der es dort geladen ist, gilt als Kontextfenster der Sessions. Adresse des Servers: Umgebungsvariable VERWALTER_LMSTUDIO_URL, sonst http://localhost:1234."`, `SelectButton` mit `value={localModelLabel(current.localModel)}`, Menü `LocalModelMenu` (`OpenMenu` um `'localModel'` erweitern; `onChange` → `save({ kind: 'localModel', value: id })` und Menü schließen). `useLocalModels(current.operatingMode !== 'claude')` auf Ebene von `SettingsView`.

### Eingabeleiste und Modus-Menü

- [x] `ModeMenu.tsx`: Prop `showEffort?: boolean` (Standard `true`); der Fuß mit `EffortDots` nur bei `showEffort`.
- [x] `Composer.tsx`: `const operatingMode = useSettingsStore((state) => state.settings?.operatingMode ?? 'claude');`, `const localModel = useSettingsStore((state) => state.settings?.localModel ?? null);`, `const isLocal = operatingMode !== 'claude';`.
  - `isLocal`: statt des Modell-Knopfs ein `<span className="composer__model composer__model--static" title="Modell der Betriebsart „Claude Code + LM Studio“ — ändern in den Einstellungen">{localModelLabel(localModel)}</span>`; kein `ModelMenu`, keine Denkaufwand-Angabe. CSS-Modifier `composer__model--static` in `Composer.css`: kein Hover-Hintergrund, `cursor: default`.
  - `ModeMenu` mit `showEffort={!isLocal}`.
  - `pickRow`, Zweig `row.kind === 'model'`: bei `isLocal` `setErrorMessage('Das Modell wählst du in der Betriebsart „Claude Code + LM Studio“ in den Einstellungen.')` statt `setOpenMenu('model')`.
- [x] `NewSession.tsx`, Schritt „Agent“: dieselben drei Store-Werte; bei `isLocal` statt Modell-Knopf und `ModelMenu` ein `<span className="new-session__model new-session__model--static">LM Studio · {localModelLabel(localModel)}</span>` (Modifier in `NewSession.css` wie oben); `ModeMenu` mit `showEffort={!isLocal}`; Zusammenfassung im Fuß nutzt bei `isLocal` `localModelLabel(localModel)` statt `modelName(model)`. Das gespeicherte Claude-Modell (`model`) geht unverändert an `create_project`.

### Kopfzeile

- [x] `SessionHeader.tsx`: `UsageButton` nur rendern, wenn `operatingMode === 'claude'` (Store wie oben). Ist das Kontingent-Fenster offen und die Betriebsart wechselt, schließt es mit (Zustand `isOpen` zurücksetzen, wenn `operatingMode !== 'claude'`).

### Doku

- [x] `docs/glossary.md`: Eintrag **Betriebsart** — „Woher der Agent sein Modell bekommt, für die ganze App in den Einstellungen: Claude (Claude-Abo) oder Claude Code + LM Studio (dieselbe Claude-Kommandozeile, Modell lokal in LM Studio). Nicht zu verwechseln mit dem Modus einer Session ([ADR 016](decisions/016-betriebsarten-und-lokales-modell.md)).“ Eintrag **Lokales Modell** — „Ein in LM Studio geladenes Sprach- oder Bildmodell, das in der Betriebsart Claude Code + LM Studio die Modellanfragen beantwortet; gewählt in den Einstellungen.“ Im Eintrag **Einstellungen** „Betriebsart und lokales Modell“ ergänzen.
- [x] `docs/code-map.md`, Zeile „Betriebsart und lokales Modell (LM Studio)“, Spalte Oberfläche: `src/features/settings/` (`OperatingModeSegment`, `LocalModelMenu`, `useLocalModels`), `localModelLabel`/`OPERATING_MODE_OPTIONS` in `src/lib/labels.ts`, Anzeige in `Composer`, `NewSession`, `SessionHeader` (Kontingent nur bei Claude), `ModeMenu` (`showEffort`). Zeile „Einstellungen“ um „Betriebsart, lokales Modell“ ergänzen.
- [x] `docs/PROJECT.md`, Scope „Agent“: „Claude als einziger Provider“ → „Claude als einziger Provider; Betriebsart Claude Code + LM Studio für ein lokales Modell ([ADR 016](decisions/016-betriebsarten-und-lokales-modell.md))“.
- [x] Commit `feat(settings): Betriebsart und lokales Modell in Einstellungen und Eingabeleiste`.
- [x] Smoke-Checkliste der README an den Benutzer übergeben (Abnahme macht er), danach Archivierung und Release nach [releases.md](../../conventions/releases.md) über `mode-implementing`.

## Report-Back
