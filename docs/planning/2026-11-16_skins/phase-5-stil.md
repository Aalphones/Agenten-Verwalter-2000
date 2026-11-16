# Phase 5 — Stil anwenden: Farben, Hintergründe, App-Symbol

Rating: standard. Ein aktives Stilpaket färbt die App um, legt zwei Hintergrundbilder unter Seitenleiste und Inhalt und setzt das Fenster- und Taskleisten-Symbol. „Standard“ stellt alles zurück.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (`StyleData`), Entwurf `#stil` ([artifacts/entwurf-skins.html](artifacts/entwurf-skins.html)), Funktion `renderStyle`
- `src/styles/theme.css` — Tokens im Block `:root` (Zeile ~113–156), dunkel unter `@media (prefers-color-scheme: dark) { :root:not(.light) {…} }` und `:root.dark {…}`
- `src/lib/colorScheme.ts` (setzt `.light`/`.dark` an `:root`)
- `src/app/App.tsx` (`<main className="app__main">`), `src/app/Sidebar.tsx` (`<nav className="sidebar">`)
- `src-tauri/Cargo.toml` (`tauri` mit `features = ["protocol-asset"]`), Tauri 2.12: `WebviewWindow::set_icon`, `tauri::image::Image::from_bytes` (nur mit Feature `image-png` oder `image-ico`), `AppHandle::default_window_icon`
- Phase 2 (`skins/mod.rs`, `settings/mod.rs`), Phase 3 (`stores/skins.ts`, `useActiveSkins`)

## AK

1. Stilpaket aktiv → ein `<style id="skin-style">` im `<head>` setzt unter `:root.skin-style` (hell) und `@media (prefers-color-scheme: dark) { :root.skin-style:not(.light) }` sowie `:root.skin-style.dark` (dunkel) die Tokens laut Tabelle; `:root` trägt die Klasse `skin-style`. Kein Stilpaket → Klasse und `<style>` weg.
2. Tokens: `--color-bg-base` = base, `--color-bg-sidebar` = sidebar, `--color-bg-surface` und `--color-bg-popover` = surface, `--color-bg-hover` = `color-mix(in srgb, surface 88%, fg)`, `--color-bg-selected` = `color-mix(in srgb, surface 80%, fg)`, `--color-border` = border, `--color-border-subtle` = `color-mix(in srgb, border 55%, base)`, `--color-fg-primary` = fg, `--color-fg-secondary` = `color-mix(in srgb, fg 70%, muted)`, `--color-fg-muted` = muted, `--color-accent`, `--color-accent-text`, `--color-toggle-on`, `--color-status-handoff` = accent, `--color-accent-subtle` = `color-mix(in srgb, accent 16%, transparent)` (dunkel) bzw. `10%` (hell), `--color-fg-on-accent` = `#ffffff` oder `#111111`, je nachdem, welcher Kontrast zu accent höher ist. Alle anderen Tokens bleiben.
3. Hintergrundbilder: in `.sidebar` und `.app__main` je ein `<SkinBackdrop area="sidebar"|"content">` (absolut, `inset: 0`, `z-index: -1`, `background-size: cover`, `background-position: center`, `opacity` = Deckkraft/100, `pointer-events: none`); `.sidebar` und `.app__main` bekommen `position: relative; isolation: isolate`. Ohne Bild wird nichts gerendert.
4. Verdeckt ein direktes Kind von `.app__main` oder `.sidebar` die ganze Fläche mit einer deckenden Hintergrundfarbe (prüfen in den DevTools der Dev-App), bekommt es unter `:root.skin-style.skin-backdrop-on` `background-color: transparent`; die Liste der angepassten Klassen steht im Report-Back. `:root` trägt `skin-backdrop-on`, solange mindestens ein Hintergrundbild aktiv ist.
5. App-Symbol: Core-Funktion `skins::icon::apply(app)` setzt beim Start, nach `SettingsChange::SkinStyle` und nach jeder Änderung am aktiven Stilpaket das Symbol des Hauptfensters per `set_icon(Image::from_bytes(...))`; ohne Symbol oder bei Fehler `app.default_window_icon()`. GIF/WebP als Symbol werden abgelehnt (Phase 2 lässt nur PNG/ICO für `Icon` zu – dort prüfen).
6. Wechsel zwischen hell und dunkel (Einstellung „Farbschema“) nimmt sofort den passenden Farbsatz.

## Checkliste

- [ ] `src/features/skins/applyStyle.ts`: `applyStyle(pack: SkinPack | null)` baut den CSS-Text (AK 1–2) und setzt/entfernt `<style id="skin-style">`, Klassen `skin-style`, `skin-backdrop-on`.
- [ ] `useActiveSkins.ts`: nach jedem Laden `applyStyle(activeStyle)`.
- [ ] `src/features/skins/SkinBackdrop.tsx` + `.css`; in `Sidebar.tsx` und `App.tsx` als erstes Kind einsetzen; Bild-URL über `skinImageUrl`.
- [ ] AK 4 prüfen und umsetzen; Ergebnis in Report-Back.
- [ ] `Cargo.toml`: `tauri = { version = "2", features = ["protocol-asset", "image-png", "image-ico"] }`.
- [ ] `src-tauri/src/skins/icon.rs`: `apply(app: &AppHandle)` (Hauptfenster über `app.get_webview_window("main")` – Label in `tauri.conf.json` prüfen); Aufrufe in `setup` (`lib.rs`), in `settings::update`-Command nach `SkinStyle` (im Command-Modul, nicht in `settings/mod.rs`, weil dort kein `AppHandle` ist) und in `skins/mod.rs` nach `save`/`set_image`/`remove_image`/`delete`/`undelete`, wenn das Paket das aktive Stilpaket ist.
- [ ] Doku: `docs/code-map.md` (applyStyle, Backdrop, icon), ADR 065 Konsequenz zum Symbol bestätigt.

## Report-Back
