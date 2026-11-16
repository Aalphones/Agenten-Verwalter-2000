# Plan: Skins – Figurenpakete und Stilpakete

Ziel: Die Statuszeile nennt immer das laufende Werkzeug. Wer möchte, gibt dem Verwalter einen Skin: ein **Figurenpaket** (Figur, Bewegung, Texte je Werkzeug, eigene Fächer mit Mustern, Feier-Momente, Denken) und ein **Stilpaket** (Farben hell/dunkel, Hintergrundbild Seitenleiste und Inhalt, App-Symbol). Pakete pflegt man auf der neuen Einstellungsseite „Skins“, lässt sie den Agenten über `skin_*`-Werkzeuge füllen und teilt sie als ZIP. Ab Werk ist alles aus. Grundsatz: [ADR 065](../../decisions/065-skins.md). Entwurf (verbindlich): [artifacts/entwurf-skins.html](artifacts/entwurf-skins.html).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Statuszeile nennt das Werkzeug, Taktung, Denken live | [phase-1-statuszeile.md](phase-1-statuszeile.md) | standard | complete |
| 2 | Speicher, Einstellungen und Bilder im Kern | [phase-2-kern.md](phase-2-kern.md) | heikel | complete |
| 3 | Figuren im Chat: Bühne, Bewegungen, Feier-Momente | [phase-3-figuren.md](phase-3-figuren.md) | standard | complete |
| 4 | Einstellungsseite „Skins“ mit Paketliste und Editoren | [phase-4-seite.md](phase-4-seite.md) | standard | complete |
| 5 | Stil anwenden: Farben, Hintergründe, App-Symbol | [phase-5-stil.md](phase-5-stil.md) | standard | complete |
| 6 | ZIP-Export und -Import | [phase-6-zip.md](phase-6-zip.md) | heikel | pending |
| 7 | Agenten-Werkzeuge `skin_*` hinter dem Schalter | [phase-7-werkzeuge.md](phase-7-werkzeuge.md) | heikel | pending |
| 8 | Tipps und Easter Eggs | [phase-8-extras.md](phase-8-extras.md) | mechanisch | pending |
| 9 | Pakete bauen: je Figuren- und Stilpaket für Pokémon, Disney, Marvel | [phase-9-pakete.md](phase-9-pakete.md) | standard | pending |

Reihenfolge fest: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Phase 9 baut keinen Code, sondern Pakete außerhalb des Repositorys mit den Werkzeugen aus Phase 7.

## Kontrakt

### Namensschema

Feature `skins`: `src/features/skins/`, `src/stores/skins.ts`, `src/lib/skins.ts`, `src-tauri/src/skins/`, `src-tauri/src/commands/skins.rs`, `src-tauri/src/db/skins.rs`. Werkzeugsatz `SkinTools` in `src-tauri/src/skins/tools.rs`, Präfix `skin_`. Ereignis `skins://changed` (Nutzlast: keine). Bildordner `<data_dir>\skins\<Paket-ID>\` (`data_dir` aus `filesystem::workspace`, also `%USERPROFILE%\.verwalter`).

### Typen (Rust, `src-tauri/src/skins/model.rs`, alle mit `ts-rs`, `serde(rename_all = "camelCase")`)

```rust
pub enum SkinKind { Figures, Style }                       // serde: "figures" | "style"
pub enum BuiltinSlot { Search, Read, Write, Shell, Web, Agent, Other, Wait, Think, Commit, Station }
pub enum Motion { None, Bob, Vine, Float, Squish, Zap, Fly, Summon, Sleep, Ponder, Wobble, Evolve, Popin,
                  WebShot, Shield, Beam, Sparkle, Frost, Wave }
pub struct SlotLook { pub image: Option<String>, pub image2: Option<String>, pub motion: Motion, pub texts: Vec<String> }
pub struct BuiltinSlotLook { pub slot: BuiltinSlot, pub look: SlotLook }
pub struct CustomSlot { pub id: String, pub name: String, pub tools: String, pub input: Option<String>, pub look: SlotLook }
pub struct FiguresData { pub custom: Vec<CustomSlot>, pub builtin: Vec<BuiltinSlotLook> }
pub struct StyleColors { pub base: String, pub sidebar: String, pub surface: String, pub fg: String,
                         pub muted: String, pub accent: String, pub border: String }   // je "#rrggbb"
pub struct StyleData { pub dark: StyleColors, pub light: StyleColors,
                       pub sidebar_image: Option<String>, pub sidebar_opacity: u8,
                       pub content_image: Option<String>, pub content_opacity: u8, pub icon: Option<String> }
pub enum SkinData { Figures(FiguresData), Style(StyleData) }  // serde(tag = "kind", content = "data")
pub struct SkinPack { pub id: String, pub name: String, pub data: SkinData, pub changed_at: String,
                      pub changed_by: Option<String>, pub dir: String }   // dir = absoluter Bildordner
pub struct SkinPackSummary { pub id: String, pub kind: SkinKind, pub name: String, pub changed_at: String,
                             pub changed_by: Option<String>, pub thumb: Option<String>, pub swatches: Vec<String> }
pub enum ImageTarget { Slot { slot: String, second: bool }, SidebarImage, ContentImage, Icon }  // tag = "kind"
pub enum ImageSource { Path { path: String }, Url { url: String }, Bytes { name: String, base64: String } } // tag = "kind"
pub struct ToolUsage { pub tool: String, pub input_prefix: String, pub count: u32, pub slot: Option<String> }
```

- `CustomSlot.id`: `c-` + Kleinbuchstaben/Ziffern/Bindestrich, eindeutig im Paket. `BuiltinSlotLook.slot` kommt je Paket höchstens einmal vor.
- Bilddateinamen: `<slot>.<ext>` bzw. `<slot>-2.<ext>`, `sidebar.<ext>`, `content.<ext>`, `icon.<ext>`; `<ext>` aus dem Dateikopf, nie aus dem Namen.
- Grenzen (Konstanten in `skins/model.rs`): `MAX_CUSTOM_SLOTS = 24`, `MAX_TEXTS = 10`, `MAX_TEXT_CHARS = 160`, `MAX_NAME_CHARS = 40`, `MAX_PATTERN_CHARS = 200`, `MAX_IMAGE_BYTES = 2 * 1024 * 1024`, `MAX_OPACITY = 60`.
- `changed_by`: `None` = Benutzer, sonst `"Session #<Nr> · <Name>"` der Session, deren Agent zuletzt geändert hat.

### Einstellungen (`Settings` und `SettingsChange` in `src-tauri/src/settings/model.rs`)

| Feld | Typ | Standard | `SettingsChange` |
|---|---|---|---|
| `skin_figures` | `Option<String>` (Paket-ID) | `None` | `SkinFigures { value: Option<String> }` |
| `skin_style` | `Option<String>` | `None` | `SkinStyle { value: Option<String> }` |
| `skin_animations` | `Option<bool>` | `None` = folgt `prefers-reduced-motion` | `SkinAnimations { value: bool }` |
| `skin_celebrations` | `bool` | `false` | `SkinCelebrations { value: bool }` |
| `skin_easter_eggs` | `bool` | `false` | `SkinEasterEggs { value: bool }` |
| `skin_agent_tools` | `bool` | `false` | `SkinAgentTools { value: bool }` |

### Commands (`src-tauri/src/commands/skins.rs`, Wrapper gleichen Namens in `src/lib/skins.ts`)

`skins_list() -> Vec<SkinPackSummary>` · `skins_get(id) -> SkinPack` · `skins_create(kind, name, copy_of: Option<String>) -> SkinPack` · `skins_rename(id, name) -> SkinPack` · `skins_save(id, data: SkinData) -> SkinPack` · `skins_set_image(id, target: ImageTarget, source: ImageSource) -> SkinPack` · `skins_remove_image(id, target) -> SkinPack` · `skins_delete(id)` · `skins_undelete(id) -> SkinPack` · `skins_export(id, dest: String) -> String` · `skins_import(path: String) -> SkinPack` · `skins_tool_usage(days: u32) -> Vec<ToolUsage>`. Jede Änderung sendet `skins://changed`. Das App-Symbol setzt der Kern selbst (Phase 5, `skins::icon::apply`).

### Platzhalter in Texten

`{ziel}` = Ziel des Werkzeugs, wie es die Werkzeug-Zeile zeigt (Datei, Suchbegriff, Befehl; leer → Werkzeugname) · `{zeit}` = laufende Dauer `m:ss` (Warten) · `{commit}` = Kurzkennung des Commits (Feier-Moment, sonst leer).

### Agenten-Werkzeuge (Phase 7)

`skin_list`, `skin_get`, `skin_create`, `skin_rename`, `skin_slot_set`, `skin_slot_remove`, `skin_style_set`, `skin_image_set`, `skin_delete`, `skin_export`, `skin_import`, `skin_activate`, `skin_tool_usage` – Eingaben in Phase 7. Sichtbar nur bei `skin_agent_tools = true`.

### ZIP-Format (Phase 6)

`skin.json` (`{ "format": 1, "kind": "figures"|"style", "name": "...", "data": <FiguresData|StyleData> }`) + `bilder/<Dateiname>`. Grenzen: höchstens 64 Einträge, 20 MiB entpackt, je Bild `MAX_IMAGE_BYTES`, keine Pfade mit `..`, `:` oder führendem `/`/`\`.

## Finale AK

1. Ab Werk zeigt der Verwalter keine Figur, keinen Stil und keine Feier-Momente; die Statuszeile nennt das laufende Werkzeug sachlich.
2. Einstellungsseite hat die Kategorie „Skins“ wie im Entwurf: Abschnitte Figuren, Stil, Pakete, Agent; Paket-Editor als Unteransicht mit Zurück-Zeile.
3. Ein Figurenpaket mit eigenem Fach `mcp__github__*` zeigt bei einem GitHub-MCP-Aufruf dessen Figur, Bewegung und Text; das erste passende Fach gewinnt.
4. Figur wechselt höchstens alle 4 s, erscheint erst nach 1 s Arbeit; Denken zeigt Sekunden und wechselt Texte alle 10 s; Feier-Moment höchstens einmal je Antwort.
5. Ein Stilpaket ändert Farben (hell und dunkel), zeigt die zwei Hintergrundbilder mit eingestellter Deckkraft und setzt das Fenster- und Taskleisten-Symbol; „Standard“ stellt alles zurück.
6. Pakete lassen sich als ZIP exportieren und auf einem anderen Rechner importieren; manipulierte ZIPs werden mit einem Satz abgewiesen.
7. Mit „Agent darf Skins bearbeiten“ = an hat ein neu gestarteter Agent die 13 `skin_*`-Werkzeuge, sonst keins; jede Aktion der Seite hat ein Werkzeug.
8. Drei Figurenpakete und drei Stilpakete (Pokémon, Disney, Marvel) liegen als ZIP unter `%USERPROFILE%\.verwalter\skin-pakete\` und lassen sich importieren; im Repository liegt kein fremdes Bild.
9. `pnpm check` grün.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
