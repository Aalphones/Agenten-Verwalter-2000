# Phase 6 — Figuren: Fach „Langer Lauf“ und drei Bewegungen

Status: complete. Rating: standard. Figurenpakete bekommen ein vorgegebenes Fach für lange Läufe und drei Bewegungen, die den Fortschritt zeigen. Vorlage: [artifacts/entwurf-befehle-verstehen.html](artifacts/entwurf-befehle-verstehen.html) mit Schalter „Figurenpaket“ an und der Auswahl „Bewegung“ (Anker `#fun,trek,fortschritt`, `#fun,charge,geschaetzt`, `#fun,reveal,skript`); die CSS-Regeln `.rider`, `.bar--trek`, `.bar__flag`, `.ring`, `.stage--reveal` und die `@keyframes` dort sind die Vorlage für die Bewegungen. Ab Werk bleibt alles aus (ADR 065).

## Kontext (lesen)

- [README.md](README.md) → Kontrakt („Figuren“, „Platzhalter“), [ADR 065](../../decisions/065-skins.md), [ADR 066](../../decisions/066-befehle-verstehen.md)
- `src-tauri/src/skins/model.rs` — `BuiltinSlot` (+ `ALL`), `Motion` (+ `ALL`), Grenzen; `validate.rs`; `matching.rs`; `tools.rs` (Beschreibungstexte der Werkzeuge nennen Fächer und Bewegungen, u. a. um Zeile 635), `tool_args.rs`, `tool_edit.rs`; `mod.rs` (Stelle um Zeile 189, die ein Fach für das Vorschaubild sucht)
- `src/features/skins/slotCatalog.ts`, `motionCatalog.ts`, `matchSlot.ts`, `useStatusFigure.ts`, `statusText.ts`, `figureLook.ts`, `FigureStage.tsx`, `SkinStage.tsx` + `.css`, `StageImage.tsx`, `FrozenImage.tsx`, `useSkinAnimations.ts`
- `src/features/skins/motions/motionMarkup.tsx` (`renderMotion`, Aufbau einer Bewegung wie `Sleep`), `motions.css` (Präfix `skin-a-`, Verhalten bei `skin-stage--still`)
- `src/features/skins/FiguresEditor.tsx`, `FigureSlotRow.tsx` — Liste der Fächer, Auswahl der Bewegung, Vorschau
- `src/features/runs/RunMeter.tsx` (Prop `rider`), `runTexts.ts`, `useRunView.ts` (Phase 5); `WorkingIndicator.tsx`, `ChatTimeline.tsx`, `AwaitedScriptLine.tsx`
- `docs/conventions/react.md`, `tailwind.md`, `rust.md`
- Fehlerklassen geprüft (Vault `frameworks/react`): keine einschlägig.

## AK

1. Der Editor zeigt das Fach „Langer Lauf“ zwischen „Befehl“ und „Web“; die Auswahl der Bewegung enthält „Läuft die Strecke ab“, „Lädt auf“ und „Wird sichtbar“ in jedem Fach. Ein Paket mit belegtem Fach lässt sich speichern, als ZIP exportieren und wieder importieren.
2. Läuft ein Shell-Befehl 5 s und passt kein eigenes Fach, zeigt die Statuszeile Figur, Bewegung und Text des Fachs „Langer Lauf“; hat das Paket das Fach nicht belegt, bleibt das Fach „Befehl“. Der Wechsel hält die Mindest-Standzeit von 4 s ein.
3. `Trek`: die Figur steht ohne eigene Bühne auf dem Balken an der Stelle des Fortschritts, am Ende der Spur eine Fahne; ohne Balken (kein Fortschritt, keine Schätzung) steht sie links in der Bühne und wippt. `Charge`: Ring um die Figur, gefüllt bis zum Fortschritt; ohne Fortschritt dreht ein Viertelbogen. `Reveal`: Schattenriss, von unten bis zum Fortschritt in Farbe; ohne Fortschritt zu 30 %.
4. Geschätzter Fortschritt (Balken schraffiert) bewegt die Figuren wie gemessener; „länger als üblich“ zählt als 100 %.
5. Mit abgeschalteten Animationen (`skin_animations` aus oder `prefers-reduced-motion`) steht die Figur ohne Wippen und Drehen an ihrer Position; die Position selbst folgt weiter dem Fortschritt.
6. Paket-Texte füllen `{befehl}`, `{fortschritt}`, `{rest}` und `{zeit}`; der Hinweis zu den Platzhaltern im Editor nennt sie.
7. Die Werkzeuge `skin_slot_set` und `skin_get` kennen `longrun` und die drei Bewegungen; ihre Beschreibungstexte nennen sie.
8. Ohne aktives Figurenpaket sieht die Statuszeile aus wie nach Phase 5.
9. `pnpm bindings` ausgeführt, `pnpm check` grün.

## Checkliste

### Kern

- [x] `skins/model.rs`: `BuiltinSlot::Longrun` nach `Shell` (auch in `ALL`, Länge 12); `Motion::Trek`, `Charge`, `Reveal` nach `Wave` (auch in `ALL`). Alle `match`-Stellen über beide Enums nachziehen (`validate.rs`, `matching.rs`, `tool_args.rs`, `tool_edit.rs`, `mod.rs`).
- [x] `skins/matching.rs`: Werkzeug → Fach bleibt unverändert (`Bash`/`PowerShell` → `Shell`); `Longrun` ist ein Fach ohne Werkzeug wie `Wait`, `Think`, `Commit`, `Station` — an denselben Stellen wie diese behandeln.
- [x] `skins/tools.rs`: Aufzählungen der Fächer und Bewegungen in den Beschreibungen und Schemas ergänzen; den Satz zu den Fächern mit festen Werkzeugen (um Zeile 635) um `longrun` erweitern.
- [x] `pnpm bindings`.

### Oberfläche

- [x] `slotCatalog.ts`: `'longrun'` in `BUILTIN_SLOT_IDS` nach `'shell'`; `PLAIN_TEXTS.longrun = '{ziel} …'`; `SLOT_LABELS.longrun = 'Langer Lauf'`.
- [x] `motionCatalog.ts`: `MOTION_LABELS` (`trek: 'Läuft die Strecke ab'`, `charge: 'Lädt auf'`, `reveal: 'Wird sichtbar'`); `FITTING_MOTION.longrun = 'trek'`; neue Konstante `PROGRESS_MOTIONS: ReadonlySet<Motion>` mit den dreien.
- [x] `useStatusFigure.ts`: Eingabe `runSince: number | null` (Start des laufenden Befehls). Ist das gewünschte Fach `shell` (also kein eigenes Fach) und `Date.now() − runSince ≥ LONGRUN_AFTER_MS` und hat das aktive Paket `longrun` belegt (Eingabe `hasLongrun: boolean`) → gewünschtes Fach `longrun`. Der Wechsel läuft über die vorhandene Taktung; für den Zeitpunkt einen Zeitgeber auf `runSince + LONGRUN_AFTER_MS` setzen und aufräumen.
- [x] `motionMarkup.tsx`: `renderMotion(motion, image, image2, still, progress: number | null = null)`; Komponenten `Charge` und `Reveal` (Koordinaten in der Bühne 104 × 64 wie die übrigen; Ring als `circle` mit `strokeDasharray`/`strokeDashoffset`, Farbe `var(--color-accent)`; `Reveal` mit zwei `StageImage`, das obere mit `clipPath: inset(<1 − progress> 0 0 0)`, das untere mit Klasse für `brightness(0)` und Deckkraft 0,32). `Trek` rendert in der Bühne nur den Stand-Fall (Figur wippt links).
- [x] `motions.css`: Klassen `skin-a-trek`, `skin-a-charge`, `skin-a-charge-spin`, `skin-a-reveal` nach der Vorlage im Entwurf; unter `skin-stage--still` und `prefers-reduced-motion: reduce` ohne Animation.
- [x] `SkinStage.tsx`, `FigureStage.tsx`: Prop `progress: number | null` durchreichen.
- [x] `RunMeter.tsx`: `rider` = Figur (nur Bild, 26 px hoch, `left: <Fortschritt> %`, `translateX(-50%)`, Übergang `--duration-base`) und Fahne am Ende der Spur; bei gesetztem `rider` 22 px Platz über dem Balken. `WorkingIndicator`/`ChatTimeline`/`AwaitedScriptLine`: ist die Bewegung des gezeigten Fachs `trek` und gibt es einen Balken → Figur als `rider`, keine Bühne vor dem Text; sonst Bühne mit `progress = view.fraction`.
- [x] `FigureSlotRow.tsx`/`FiguresEditor.tsx`: ist die gewählte Bewegung in `PROGRESS_MOTIONS`, steht unter der Vorschau ein Schieber „Fortschritt“ (0–100 %, `input type="range"` mit Beschriftung), der die Vorschau steuert; bei `trek` zeigt die Vorschau den `RunMeter` mit Figur. Der Hinweistext zu den Platzhaltern nennt die neuen.
- [x] `statusText.ts`: `isBuiltinSlot` deckt `longrun` automatisch; prüfen, dass ein eigenes Fach ohne Text weiter auf „Sonstiges“ fällt.

### Doku

- [x] `docs/decisions/065-skins.md`: unverändert; `docs/decisions/066-befehle-verstehen.md`: Abschnitt „Konsequenzen“ um einen Satz ergänzen, falls die Umsetzung vom Kontrakt abweicht.
- [x] `docs/code-map.md`, Zeile „Skins“: Fach `longrun`, `PROGRESS_MOTIONS`, `rider`.
- [x] `docs/glossary.md`: „Langer Lauf“ (Fach), „Bewegung mit Fortschritt“.

## Report-Back

- Abweichung: Die Klasse `skin-a-charge` gehört schon der Bewegung „Blitz ins Terminal“ (`zap`); der Ring heißt deshalb `skin-a-ring-fill`, `-spin`, `-pulse`.
- Neu: `FigureRider.tsx` (Figur auf dem Balken), `statusFigureParts.tsx` (entscheidet Bühne oder `rider` für Statuszeile und Warte-Zeile); `StageImage` nimmt `extraStyle` (Zuschnitt für „Wird sichtbar“).
- „Belegt“ heißt: das Paket hat einen Eintrag für `longrun`.
- Nur per `pnpm check` und `pnpm bindings` belegt, nicht in der echten App gelaufen (Trek-Vorschau im Editor, Ring-Geometrie bei unterschiedlichen Bildgrößen).
