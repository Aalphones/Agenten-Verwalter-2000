# Phase 2 — Einstellung „Terminal“ (mechanisch)

## Kontext

- [README](README.md): Entscheidungen, Kontrakt (Teil `TerminalPlacement`), finale AK 4.
- Muster 1:1: `ColorScheme` und `color_scheme` in `src-tauri/src/settings/model.rs` und `src-tauri/src/settings/mod.rs` (`KEY_COLOR_SCHEME`, `DEFAULT_SETTINGS`, `stored_or`, Zweig in `update`); Oberfläche `src/features/settings/ColorSchemeSegment.tsx` und die Zeile „Farbschema“ im Abschnitt „Darstellung“ in `src/features/settings/SettingsView.tsx`.
- `src-tauri/examples/gen-bindings.rs`, [ADR 012](../../decisions/012-einstellungen-farbschema-und-listen.md).

## AK der Phase

- Finale AK 4 erfüllt; ohne gespeicherten Wert lädt `bottom`; `pnpm check` grün; `TerminalPlacement.ts` generiert, `Settings.ts`/`SettingsChange.ts` tragen das neue Feld bzw. den neuen Fall.

## Checkliste

- [ ] `src-tauri/src/settings/model.rs`: `pub enum TerminalPlacement { Bottom, Right }` mit denselben Derives und `serde`-Attributen wie `ColorScheme`, Doc-Kommentar „Wo das Terminal-Dock sitzt (ADR 052): unter der Hauptfläche oder als Spalte rechts.“; Feld `pub terminal_placement: TerminalPlacement` am Ende von `Settings`; Fall `TerminalPlacement { value: TerminalPlacement }` am Ende von `SettingsChange`.
- [ ] `src-tauri/src/settings/mod.rs`: `const KEY_TERMINAL_PLACEMENT: &str = "terminal_placement";`, `terminal_placement: TerminalPlacement::Bottom` in `DEFAULT_SETTINGS`, Laden über `stored_or` wie `color_scheme`, Schreiben im `update`-Zweig wie `ColorScheme`.
- [ ] `src-tauri/examples/gen-bindings.rs`: `TerminalPlacement` exportieren; `pnpm bindings`.
- [ ] `src/features/settings/TerminalPlacementSegment.tsx` als Kopie des Musters `ColorSchemeSegment.tsx` (gleiche CSS-Klassen, keine eigene CSS-Datei), Optionen `bottom` → „Unten“, `right` → „Rechts“.
- [ ] `src/features/settings/SettingsView.tsx`: im Abschnitt „Darstellung“ nach „Farbschema“ eine `SettingRow` mit `label="Terminal"`, `info="Wo das Terminal neben dem Chat erscheint: unten unter der Ansicht oder als Spalte rechts. Ein- und ausblenden mit dem Knopf >_ oder Strg+Ö."`, darin `TerminalPlacementSegment` mit `save({ kind: 'terminalPlacement', value }).catch(() => undefined)`.
- [ ] Commit `feat(settings): Platz des Terminals wählbar`.

## Report-Back
