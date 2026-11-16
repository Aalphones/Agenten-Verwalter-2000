# Phase 3 — Figuren im Chat: Bühne, Bewegungen, Feier-Momente

Rating: standard. Ist ein Figurenpaket aktiv, steht in der Statuszeile die Figur des Fachs mit ihrer Bewegung; Feier-Momente erscheinen bei Commit und fertiger Station. Die Bühne ist auch der Baustein für die Vorschau im Editor (Phase 4).

## Kontext (lesen)

- [README.md](README.md) → Kontrakt; [phase-1-statuszeile.md](phase-1-statuszeile.md) (Taktung, `useStatusFigure`, `slotFor`)
- **Entwurf** [artifacts/entwurf-skins.html](artifacts/entwurf-skins.html): CSS-Abschnitt „Bewegungen“ (alle `@keyframes` und `.a-*`-Klassen), JS-Funktion `stageHtml` (SVG je Bewegung, Koordinaten in einer Bühne 104 × 64), `.stage`/`.stage__in` (Verkleinerung 0,55 bzw. 0,48), `freeze` (GIF einfrieren über Canvas)
- `src/features/background/ScratchpadTab.tsx` — `convertFileSrc` für Dateien unter `%USERPROFILE%\.verwalter`
- `src/stores/settings.ts`, `src/features/settings/useSettings.ts` — Einstellungen in der Oberfläche
- `src/features/chat/ChatView.tsx` (Eingabeleiste, Platz für die Feier-Meldung), `ChatTimeline.tsx`
- `docs/conventions/react.md`, `tailwind.md` (BEM-CSS je Komponente)

## AK

1. Figurenpaket aktiv und Fach mit Bild → links in der Statuszeile die Bühne (57 × 35 px), Bild pixelgenau (`image-rendering: pixelated`), Höhe `min(56, natürliche Höhe × 1,5)` in Bühnenkoordinaten.
2. Alle 19 Bewegungen aus `Motion` sind gebaut: die 13 aus dem Entwurf 1:1 und sechs neue (unten). Unbekannte/fehlende Bilder → Fach ohne Figur, Text bleibt.
3. Animationen aus (`skinAnimations === false`, oder `null` und `prefers-reduced-motion: reduce`) → keine CSS-Bewegung, GIFs als erstes Bild eingefroren.
4. Texte kommen aus dem Fach des Pakets (zufällig je Anzeige, beim Denken nach Index), leer → sachlicher Text; eigene Fächer werden vor den vorgegebenen geprüft.
5. „Wartet auf Skript“ (`session.awaitedScript !== null`) zeigt bei aktivem Figurenpaket unter dem Verlauf die Statuszeile mit Fach `wait`, `{ziel}` = Befehl, `{zeit}` = laufende Dauer `m:ss`.
6. Feier-Moment (nur mit Figurenpaket und `skinCelebrations`): ein Werkzeug-Eintrag wechselt live von `running` zu `done` und ist (a) `Bash`/`PowerShell` mit Ziel passend zu `*git*commit*` → Fach `commit`, `{commit}` = erste 7 Zeichen eines 7–40-stelligen Hex-Worts aus dem Beginn der Ausgabe, sonst leer; (b) `mcp__verwalter__implementation_complete_station` → Fach `station`. Höchstens eine Meldung je Antwort (bis zur nächsten Benutzernachricht); beim Laden alter Verläufe keine.
7. Die Meldung steht 5 s über der Eingabeleiste (`role="status"`), mit Bühne „klein“ (50 × 31 px) und Text; nie über dem Verlauf.

## Checkliste

### Zustand

- [x] `src/stores/skins.ts` (Zustand, flüchtig): `activeFigures: SkinPack | null`, `activeStyle: SkinPack | null`, `setActive(...)`. Für Phase 4 schon anlegen: `editingPackId: string | null`, `openSlot: string | null`, `styleScheme: 'dark' | 'light'`, `showToolNames: boolean`.
- [x] `src/features/skins/useActiveSkins.ts`: einmal in `src/app/App.tsx` aufrufen; lädt bei Start, bei Änderung von `skinFigures`/`skinStyle` und bei `skins://changed` die aktiven Pakete per `skinsGet`; ID `null` → `null`.
- [x] `src/features/skins/skinImage.ts`: `skinImageUrl(pack, file)` = `convertFileSrc(pack.dir + '\\' + file) + '?v=' + encodeURIComponent(pack.changedAt)`.
- [x] `src/features/skins/useSkinAnimations.ts`: `boolean` aus `settings.skinAnimations ?? !matchMedia('(prefers-reduced-motion: reduce)').matches` (mit Abo auf die Media-Query).

### Bühne und Bewegungen

- [x] `src/features/skins/SkinStage.tsx` + `SkinStage.css`: Props `{ motion: Motion; image: string | null; image2: string | null; size: 'line' | 'toast'; still: boolean }`. Aufbau wie im Entwurf: äußere `.skin-stage` (57 × 35 bzw. 50 × 31), innere `.skin-stage__inner` 104 × 64, `transform: scale(.55)` bzw. `.48`, `transform-origin: left bottom`. `image === null` → `null` rendern. Bei `still` die Klasse `skin-stage--still` (setzt `animation: none` für alle Kinder, Endzustände wie `body.still`-Regeln im Entwurf) und `FrozenImage` statt `<img>`.
- [x] `src/features/skins/FrozenImage.tsx`: lädt das Bild, zeichnet es nach `load` auf ein `<canvas>` gleicher Größe, gleiche Klassen/Stile.
- [x] `src/features/skins/motions/motionMarkup.tsx`: `renderMotion(motion, imgA, imgB)` – je Bewegung das JSX, übertragen aus `stageHtml` (gleiche Koordinaten, gleiche Klassen); der Pokéball von `summon` wird durch einen neutralen Ball ersetzt: SVG-Kreis r = 9, obere Hälfte `var(--color-accent)`, untere `#f0f0f0`, Mittelstrich und Knopf — kein fremdes Bild im Repository.
- [x] `src/features/skins/motions/motions.css`: alle `@keyframes`/`.a-*` aus dem Entwurf, Präfix `skin-` vor jedem Namen (`skin-a-vine`, `@keyframes skin-vine`).
- [x] Neue Bewegungen (in derselben Bühne 104 × 64, Figur links bei `left: 4px`):
  - `webShot` „Netz schießen“: Linie von (40, 30) nach (92, 22), `stroke-dasharray` 60, läuft 0–40 % aus; bei 45–70 % wächst am Ende ein Netz (8 Speichen Länge 10, zwei Ringe r = 4 und 8, Strichfarbe `#e8e8e8`) von `scale(0)` auf `scale(1)`; 90–100 % ausblenden; 2 s, endlos.
  - `shield` „Schild-Wurf“: Scheibe (drei konzentrische Kreise r = 9/6/3 in `var(--color-accent)`, `#f0f0f0`, `var(--color-accent)`) startet bei (40, 34), fliegt im Bogen nach (92, 30) und zurück (`translate` mit Zwischenpunkt (66, 14) bei 25 % und 75 %), dreht sich 720°; 2,4 s.
  - `beam` „Strahl“: Rechteck von (40, 28) Breite 0 → 56, Höhe 4, Verlauf `#ffffff` → `var(--color-accent)`, bei 55–80 % voll sichtbar, Leuchtpunkt r = 4 am Ursprung pulsiert; 1,8 s.
  - `sparkle` „Zauberstaub“: sechs 4-Zack-Sterne (Größe 6) an (44,10), (60,22), (52,40), (76,12), (84,34), (70,50), je `scale 0 → 1 → 0` über 0,8 s, Verzögerung 0,15 s Schritte; Takt 2 s.
  - `frost` „Eiskristalle“: drei Schneeflocken (6 Arme Länge 5, `#bfe3ff`) fallen von y = 0 nach y = 60 bei x = 52/70/88 mit Drehung 180°, versetzt 0/0,8/1,6 s; Figur bekommt bei 40–60 % `filter: hue-rotate(180deg) saturate(.6)`; 3 s.
  - `wave` „Welle“: Sinuslinie unter der Figur (Pfad über x 0–104, y 56 ± 4, Strich `#5aa0d8` 2 px), `stroke-dashoffset` läuft durch; Figur wippt mit (`bob`); 2,4 s.
- [x] `src/lib/bindings/Motion.ts` kommt aus `pnpm bindings`; `src/features/skins/motionCatalog.ts`: `MOTION_LABELS` (deutsche Namen wie im Entwurf plus „Netz schießen“, „Schild-Wurf“, „Strahl“, „Zauberstaub“, „Eiskristalle“, „Welle“) und `FITTING_MOTION: Record<BuiltinSlotId, Motion>` (search `vine`, read `float`, write `squish`, shell `zap`, web `fly`, agent `summon`, other `bob`, wait `sleep`, think `ponder`, commit `wobble`, station `evolve`).

### Statuszeile und Warten

- [x] `src/features/skins/figureLook.ts`: `lookFor(pack: SkinPack | null, slot: string): SlotLook | null` (eigenes Fach per `id`, sonst `builtin` per `slot`); `customMatchers(pack)` → `CustomSlotMatch[]` für `slotFor`.
- [x] `ChatTimeline.tsx`: `useStatusFigure` bekommt `customMatchers(activeFigures)`; `WorkingIndicator.figure` = `<SkinStage size="line" …>` aus `lookFor`; Text: Paket-Text (`textIndex` beim Denken, sonst zufällig, gemerkt je Wechsel) → `fillText`.
- [x] Warten (AK 5): nach dem letzten Block, wenn `!isWorking && session.awaitedScript !== null && activeFigures !== null`, dieselbe `WorkingIndicator` mit Fach `wait`; Dauer sekündlich aus `awaitedScript.startedAt`.

### Feier-Momente

- [x] `src/features/skins/useCelebrations.ts`: Eingabe `entries`; merkt beim Einhängen alle `toolUseId` mit Endzustand; erkennt Übergang `running → done` (vorheriger Zustand je `toolUseId` in einem `useRef<Map>`), prüft AK 6, liefert `{ slot: 'commit' | 'station'; commit: string } | null` und `dismiss()`. Merker „schon gefeiert“ = `seq` der letzten Benutzernachricht.
- [x] Commit-Kurzkennung: Ausgabe über `loadToolDetail` (`src/lib/toolDetails.ts`) des Eintrags laden, Regex `/\b([0-9a-f]{7,40})\b/` auf die ersten 400 Zeichen.
- [x] `src/features/skins/Celebration.tsx` + `.css`: Kasten wie `.toast` im Entwurf (linke Kante 3 px `var(--color-status-completed)`, Fläche `var(--color-bg-surface)`, Rahmen `var(--color-border)`), 5 s, danach `dismiss()`; in `ChatView.tsx` direkt über der Eingabeleiste.

### Doku

- [x] `docs/code-map.md` Zeile „Skins“: Bühne, Bewegungen, Feier-Momente, `useActiveSkins`.
- [x] `docs/glossary.md`: „Bühne“, „Bewegung“, „Feier-Moment“.

## Report-Back

Status: complete. `pnpm check` (Lint, Typecheck, Prettier, Build, rustfmt, Clippy) grün; keine Tests (Profil private), nicht in der echten App gelaufen. `pnpm bindings` war nicht nötig (kein Rust geändert).

- Oberfläche: Store `stores/skins.ts`, `useActiveSkins` (in `App`), `SkinStage` mit 19 Bewegungen (`motions/`), Figur in der Statuszeile, `AwaitedScriptLine` für das Warten, `useCelebrations` + `Celebration` über der Eingabeleiste.
- Abweichungen: `renderMotion` trägt einen vierten Parameter `isStill` (die Figur wird je nach Zustand als Bild oder eingefrorene Zeichenfläche gebaut); `StatusFigure` hat zusätzlich `roll` (Zufallswert, gezogen beim Wechsel, wählt den Text); `useSecondTick` aus `useStatusFigure` in eine eigene Datei gezogen; neue Hilfsdateien `StageImage`, `FigureStage`, `statusText`; `WorkingIndicator` bekam `showsHint` (beim Warten ohne „Esc unterbricht“). Der Schild dreht sich 720° je Hin-und-zurück-Durchgang (nicht je Richtung).
- Die Meldung steht im Bereich der Eingabeleiste; solange sie da ist, wächst deren Höhe und der Verlauf rückt um die Meldung nach oben (nie darüber).
- Wackelstellen (nur per Typcheck/Lint/Build belegt): `useCelebrations.ts` (Übergang `running → done`, Merker je Antwort, Commit-Kennung aus der Ausgabe) und die Bild-Adresse mit Abfrage-Teil `?v=` in `skinImage.ts` (ob das Asset-Protokoll sie annimmt, ist nicht belegt). Der Entwurf wurde nicht pixelweise verglichen.
