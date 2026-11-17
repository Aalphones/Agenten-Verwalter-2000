# Phase 7 — Verlauf lesbar: Zweckzeile und Was-Zeile

Rating: standard. Jeder Werkzeug-Block im Verlauf sagt, was getan wurde, und trägt als Kopf die kurze Zeile, die der Agent direkt davor geschrieben hat. Ein Absatz im Systemprompt bittet den Agenten um diese Zeile. Der Entwurf ist verbindlich für Aufbau, Reihenfolge, Texte und Farben: [artifacts/entwurf-verlauf-lesbar.html](artifacts/entwurf-verlauf-lesbar.html) (Ansicht „Neu“; Daten „Neue Session“ und „Alte Session“; Abschnitt „Sonderfälle“). Nichts wird gespeichert: Kopf und Was-Zeile entstehen beim Anzeigen aus den vorhandenen Einträgen und gelten damit auch für alte Sessions.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt („Verlauf lesbar“), [artifacts/README.md](artifacts/README.md) — Anker des Entwurfs
- `src/features/chat/buildBlocks.ts` — `ChatBlock`, `ToolEntry`; `ChatTimeline.tsx` — Aufruf von `buildBlocks`, `renderBlock`, `toolKey`, `expandedKeys`, `answerSeq`, `showsHandoff`, `activeFigures`, `customSlots`
- `src/features/chat/ToolGroup.tsx` + `.css`, `toolSummary.ts` (nach Phase 2: `toolLabel`; nach Phase 5: `tool-group__duration`, `durationMs`), `ToolDetail.tsx`, `TextBlock.tsx`
- `src/features/chat/handoff.ts` — `lastAnswerSeq` (der Text mit dieser `seq` trägt die „Weiter“-Leiste)
- `src/features/skins/slotCatalog.ts` (`BUILTIN_TOOL_SLOTS`), `matchSlot.ts` (`slotFor`, `CustomSlotMatch`), `figureLook.ts` (`lookFor`), `FigureStage.tsx` (`hasFigure`), `FrozenImage.tsx`, `skinImage.ts` (`skinImageUrl`)
- `src-tauri/src/agents/claude/process.rs` — `prompts`, `commands_prompt` (Phase 2), `scratchpad_prompt` als Muster
- `src/lib/bindings/ChatEntry.ts`, `SkinPack.ts`, `SlotLook.ts`
- `docs/conventions/react.md`, `typescript.md`, `tailwind.md`, `rust.md`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## Verstanden, bevor es ersetzt wird

- `groupTitle` und `groupSummary` (`toolSummary.ts`) liefern heute den Kopf „Werkzeuge · 6 Aufrufe“ bzw. bei einem Aufruf Werkzeugname und Ziel. Einziger Nutzer ist `ToolGroup.tsx`; beide entfallen. `groupDot` bleibt.
- Ein Block mit einem einzigen Aufruf braucht heute zwei Klicks bis zur Eingabe und Ausgabe (Gruppe auf, Zeile auf). Künftig einer; der Gruppen-Schlüssel dieses Blocks wird dann nicht mehr benutzt.
- Ein Text des Agenten ist heute immer ein eigener Block. An ihm hängen die Markierungen „ohne Fundstelle“ (`unsourced`, per `data-seq` angesprungen) und die „Weiter“-Leiste. Beides bleibt unberührt, weil solche Texte nie Kopf werden (Regel unten).
- Die Aufruf-Zeile zeigt heute das ganze Ziel (Pfad, Befehl) und schneidet es hinten ab. Künftig steht bei Dateien nur der Dateiname; der ganze Pfad bleibt im `title` und in `ToolDetail`.

## Struktur (aus dem Entwurf, prüfbar)

- Block mit Zweckzeile, von oben: Kopfzeile aus Zustandspunkt 8 px und der Zeile in `--font-size-md`, Gewicht 600, `--color-fg-primary` (bricht um, der Punkt bleibt an der ersten Zeile). Darunter der Rumpf mit Was-Zeile und Aufruf-Zeilen: links eine 1 px breite Linie in `--color-border` genau unter der Mitte des Punkts (`margin-left: 3.5px`, `padding-left: 12.5px`), die Kopf und Aufrufe verbindet. Im Rumpf trägt die Was-Zeile keinen eigenen Punkt.
- Block ohne Zweckzeile: keine Kopfzeile, keine Linie; der Zustandspunkt steht vor der Was-Zeile wie heute.
- Was-Zeile in `--font-size-sm` und `--color-fg-secondary`, von links: Zustandspunkt (nur ohne Zweckzeile) · je Art ein Teil aus Figur (nur mit Figurenpaket) und Zähltext, Teile durch `·` getrennt, der Trenner hängt am vorigen Teil · bei Fehlschlägen `n fehlgeschlagen` in `--color-status-error` · Pfeil. Die Zeile bricht zwischen den Teilen um.
- Aufgeklappt darunter die Aufruf-Zeilen, eingerückt um `--space-2xl` (mit Zweckzeile um `--space-xs`, die Linie rückt schon ein). Zeile von links: `⎿` · Figur (nur mit Figurenpaket) · Tätigkeit, fett, feste Spalte 76 px · Ziel · Zustandswort (`läuft`, `unterbrochen`, `fehlgeschlagen`) · Dauer (Phase 5) · Pfeil.
- Ziel: bei Dateien nur der Dateiname in Monospace und `--color-fg-primary`; bei Befehlen die Beschreibung in der Grundschrift, ohne Beschreibung der Befehl in Monospace; bei sonstigen Werkzeugen der Name (`Server · Werkzeug`); sonst das Ziel in Monospace. Das Ziel ist einzeilig mit Auslassung; das ungekürzte Ziel steht im `title`.
- Block mit genau einem Aufruf: statt der Was-Zeile die Aufruf-Zeile selbst ohne `⎿`, ohne Zweckzeile mit Zustandspunkt vorn; die Tätigkeit steht fett in `--color-fg-primary`. Der Klick klappt Eingabe und Ausgabe auf.
- Figur: 26 × 20 px, unbewegt (erstes Bild), `object-fit: contain`, `image-rendering: pixelated`.

## AK

1. Steht direkt vor einem Werkzeug-Block ein Text des Agenten aus einem Absatz mit höchstens 80 Zeichen, erscheint er als Kopf des Blocks (halbfett hinter dem Zustandspunkt, per Linie mit den Aufrufen verbunden) und nicht mehr als eigener Block; ein längerer oder mehrteiliger Text, ein Text mit Markierung „ohne Fundstelle“ und der Text mit der „Weiter“-Leiste bleiben eigene Blöcke.
2. Der Schlüssel eines Blocks mit Kopf ist die `seq` des Textes: Beginnt nach der Zeile der erste Aufruf, bleibt die Stelle im Verlauf stehen und ein ans Ende gescrollter Verlauf bleibt am Ende.
3. Die Was-Zeile zählt je Art in der Reihenfolge des ersten Auftretens mit den Texten des Kontrakts; Dateien zählen je Pfad einmal. Die sechs Aufrufe `Write` ×5 und `Edit` ×1 auf sechs Dateien ergeben „6 Dateien bearbeitet“; sechsmal `Edit`, davon viermal dieselbe Datei, plus `Write` und `Bash` ergeben „4 Dateien bearbeitet · 1 Befehl“.
4. Ein Fehlschlag steht als „1 fehlgeschlagen“ in der Was-Zeile und als Wort an seiner Zeile; `läuft` und `unterbrochen` stehen als Wort an der Zeile.
5. Aufgeklappt zeigt jede Zeile Tätigkeit und Ziel nach „Struktur“: bei `…\planning\2026-11-17_befehle-verstehen\phase-5-anzeige.md` steht `phase-5-anzeige.md`, der ganze Pfad im `title`. `mcp__verwalter__implementation_create` heißt „verwalter · implementation_create“.
6. Ein Block mit einem Aufruf zeigt Eingabe und Ausgabe nach einem Klick.
7. Mit aktivem Figurenpaket steht vor jedem Teil der Was-Zeile und vor jeder Aufruf-Zeile das unbewegte Bild des Fachs; ein eigenes Fach, das auf den Aufruf passt, gewinnt an der Aufruf-Zeile. Ohne Paket oder ohne Bild im Fach steht nichts.
8. Ein neu gestarteter Agent bekommt den Absatz „Zweck“ aus dem Kontrakt im `--append-system-prompt`, in allen Betriebsarten.
9. Hell und dunkel: Text ≥ 4,5:1; kein Zustand nur über Farbe.
10. `pnpm check` grün.

## Checkliste

### Kern

- [ ] `process.rs`: `fn purpose_prompt() -> String` mit dem Text aus dem Kontrakt (wortgleich) und einem Kommentar, warum es ihn gibt (ohne die Zeile steht im Verlauf nur, was getan wurde, nicht wozu); immer in `prompts` aufnehmen, direkt nach `commands_prompt()`.

### Oberfläche

- [ ] `buildBlocks.ts`: `export type TextEntry = Extract<ChatEntry, { kind: 'text' }>`; die Variante `tools` von `ChatBlock` bekommt `purpose: TextEntry | null`. Neuer dritter Parameter `keepTextSeq: number | null`. Konstante `MAX_PURPOSE_CHARS = 80`. Beim Beginn einer neuen Gruppe: ist der letzte Block `kind: 'entry'` mit `entry.kind === 'text'`, `entry.text.trim().length <= MAX_PURPOSE_CHARS`, ohne `\n` im getrimmten Text, `entry.unsourced.length === 0` und `entry.seq !== keepTextSeq` → diesen Block entfernen, `purpose` = der Eintrag, `key` der Gruppe = `String(purpose.seq)`. Sonst `purpose: null`, Schlüssel wie bisher. Ein Aufruf mit Hintergrund-Eintrag (`kind: 'background'`) bekommt nie einen Kopf.
- [ ] `ChatTimeline.tsx`: `buildBlocks(entries, backgroundByToolUseId, showsHandoff ? answerSeq : null)` (`answerSeq` und `showsHandoff` dafür vor `blocks` berechnen); `ToolGroup` bekommt `purpose={block.purpose}`, `figures={activeFigures}`, `customSlots={customSlots}`.
- [ ] `toolSummary.ts`: `groupTitle`, `groupSummary` und `toolLabel` (Phase 2) löschen. Neu, alles reine Funktionen:
  - `builtinSlot(tool: string): BuiltinSlotId` = `BUILTIN_TOOL_SLOTS[tool] ?? 'other'`.
  - `groupParts(tools): GroupPart[]` mit `interface GroupPart { slot: BuiltinSlotId; label: string }`: Arten in der Reihenfolge des ersten Auftretens; Zahl = bei `read` und `write` die Anzahl verschiedener `target`, sonst die Anzahl der Aufrufe; Texte aus dem Kontrakt; besteht die Gruppe nur aus `other`, lautet der Text `<n> Aufrufe`.
  - `failedCount(tools): number`.
  - `toolVerb(tool: string): string` nach dem Kontrakt; ohne Eintrag `Werkzeug`.
  - `toolName(tool: string): string`: passt `^mcp__(.+?)__(.+)$`, dann `<1> · <2>`, sonst der Name.
  - `fileName(target: string): string`: alles hinter dem letzten `\` oder `/`; ohne Trenner das Ziel selbst.
- [ ] `src/features/skins/FrozenImage.tsx`: optionale Prop `fixedSize?: boolean` (Standard `false`); bei `true` setzt die Komponente weder Breite noch Höhe (die Klasse bestimmt die Größe), nur die Deckkraft 0 bis zum Laden.
- [ ] `src/features/skins/SlotThumb.tsx` + `.css` (Block `slot-thumb`): Props `{ pack: SkinPack | null; slot: string }`; `look = lookFor(pack, slot)`; ohne Paket oder `!hasFigure(look)` → `null`; sonst `<FrozenImage src={skinImageUrl(pack, look.image)} className="slot-thumb" style={{}} fixedSize />`. CSS: 26 × 20 px, `object-fit: contain`, `image-rendering: pixelated`, `flex-shrink: 0`.
- [ ] `ToolGroup.tsx` + `.css`: neue Props `purpose: TextEntry | null`, `figures: SkinPack | null`, `customSlots: readonly CustomSlotMatch[]`. Aufbau nach „Struktur“:
  - Kopf: `<div className="tool-group__head"><span className="tool-group__dot …" /><div className="tool-group__purpose"><TextBlock text={purpose.text} unsourced={[]} /></div></div>`; der Absatz darin ohne Außenabstand. Mit Kopf bekommt `.tool-group` die Klasse `tool-group--purpose`; Was-Zeile, Zeilen und `ToolDetail` liegen in `tool-group__body`, das die Linie trägt.
  - Eine eigene Komponente `ToolLine` in derselben Datei rendert die Aufruf-Zeile (Props `tool`, `figures`, `customSlots`, `isOpen`, `onToggle`, `isSingle`, `hasDot`); bei `isSingle` kein `⎿`, Klasse `tool-group__line--single` und – nur bei `hasDot` (Block ohne Zweckzeile) – der Zustandspunkt vorn. Figur an der Zeile: `SlotThumb` mit `slotFor(tool.tool, tool.target, customSlots)`.
  - Ziel je Art (`builtinSlot`): `read`/`write` → `fileName(tool.target)` in `tool-group__name`; `shell` → `tool.description` in `tool-group__name tool-group__name--prose`, ohne Beschreibung `tool.target` in Monospace; `other` → `toolName(tool.tool)` als Prosa; sonst `tool.target` in Monospace. Das Ziel trägt `title={tool.target}`, außer das Ziel ist leer; die Zeile behält `title={TOOL_TOGGLE_HINT}`.
  - Zustandswörter `läuft` (`running`), `fehlgeschlagen` (`failed`, in `--color-status-error`), `unterbrochen` (`interrupted`); die Dauer aus Phase 5 bleibt rechts davon.
  - Bei `tools.length === 1`: nur Kopf, `ToolLine` mit `isSingle` und darunter `ToolDetail`; aufgeklappt über `isToolExpanded`/`onToggleTool`. Sonst Was-Zeile als Umschalter (`groupParts`, je Teil `SlotThumb` des Fachs und Text, `failedCount`), darunter die Zeilen.
  - Überfahren färbt Umschalter und Zeile in `--color-fg-primary`; Fokusring wie heute.

### Doku

- [ ] `docs/glossary.md`: „Zweckzeile“, „Was-Zeile“.
- [ ] `docs/code-map.md`: Zeile „Chat“ (Kopf am Werkzeug-Block, `groupParts`, `ToolLine`), Zeile „Skins“ (`SlotThumb`).
- [ ] `docs/decisions/066-befehle-verstehen.md`: unverändert, außer die Umsetzung weicht vom Kontrakt ab.

## Report-Back
