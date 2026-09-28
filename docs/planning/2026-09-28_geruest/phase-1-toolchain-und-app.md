# Phase 1 — Toolchain & App startet

**Rating:** standard

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans (Entscheidungen, Kennung, CSP)
- [docs/conventions/rust.md](../../conventions/rust.md) — Layout `src-tauri/src/`
- [docs/conventions/react.md](../../conventions/react.md) — Layout `src/`, Komponente + CSS-Datei nebeneinander
- [docs/conventions/tailwind.md](../../conventions/tailwind.md) — BEM, keine Utility-Klassen im JSX
- Vault-Fehlerklassen `werkzeuge/vite.md` → „Unimportierte Komponente verschwindet lautlos“ (einschlägig für die Platzhalter-Hülle)

Stand der Maschine bei Planung (2026-09-28): Node v26.4.0 vorhanden, **kein** Rust/rustup/cargo, **kein** pnpm, **kein** Corepack (Node 26 bringt es nicht mehr mit), `gh` fehlt. Vorhanden: Visual Studio Build Tools 2026 mit C++-Werkzeugen, WebView2 153.

## Abnahmekriterien der Phase

1. `rustc --version` und `pnpm --version` liefern Versionen; beide sind in FINDINGS.md notiert.
2. `pnpm tauri dev` öffnet ein Fenster mit dem Titel „Agenten Verwalter 2000“ und der Überschrift „Agenten Verwalter 2000“ im Inhalt.
3. Im Repo liegt nichts mehr aus der Vorlage, das der App nicht dient: kein `greet`-Befehl, kein Opener-Plugin, keine Beispiel-Logos.
4. `.gitignore`, `.gitattributes`, `README.md`, `LICENSE`, `AGENTS.md`, `docs/` sind unverändert (bis auf ggf. ergänzte Ignore-Zeilen).

## Checkliste

### Toolchain (systemweit — vor dem ersten Befehl einmal Freigabe bei Sascha holen)

- [x] `winget install --id Rustlang.Rustup -e` ausführen; danach in einer **neuen** Shell `rustup default stable-x86_64-pc-windows-msvc`, dann `rustc --version` — Ausgabe in FINDINGS.md notieren (Phase 2 pinnt genau diese Version).
- [x] `npm install -g pnpm@latest`; `pnpm --version` in FINDINGS.md notieren.

### Gerüst erzeugen (im Scratchpad, nicht im Repo)

- [x] `pnpm create tauri-app@latest --help` lesen und die Flag-Namen bestätigen. Dann im Scratchpad-Verzeichnis: `pnpm create tauri-app@latest verwalter --template react-ts --manager pnpm --identifier com.aalphones.verwalter --yes`. Weichen die Flag-Namen ab → die gleichwertigen aus `--help` nehmen, Abweichung in FINDINGS.md. *(keine Abweichung — Flags passten exakt)*
- [x] Alles aus dem erzeugten Ordner ins Repo-Wurzelverzeichnis kopieren **außer** `README.md`, `.gitignore` und `.vscode/`. Einträge aus der Vorlagen-`.gitignore`, die in der Repo-`.gitignore` fehlen, dort ergänzen (die Repo-Datei deckt `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/schemas/` bereits ab).
- [x] Im Repo `pnpm install`.
- [x] **Linker-Probe:** `cargo build --manifest-path src-tauri/Cargo.toml`. Meldet der Build, dass `link.exe` fehlt oder kein MSVC gefunden wird → `winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` (Freigabe erfragen), neue Shell, Probe wiederholen, Ergebnis in FINDINGS.md. *(grün beim ersten Versuch, keine Nachinstallation nötig)*

### Vorlage anpassen

- [x] `package.json`: `"name": "verwalter"`, `"version": "0.1.0"`, `"private": true`, `"packageManager": "pnpm@<Version aus pnpm --version>"`. Abhängigkeit `@tauri-apps/plugin-opener` entfernen.
- [x] `src-tauri/Cargo.toml`: `[package] name = "verwalter"`, `version = "0.1.0"`, `edition = "2024"`, `default-run = "verwalter"` (nötig, weil Phase 2 ein zweites Programm `gen-bindings` hinzufügt). `[lib] name = "verwalter_lib"`. Abhängigkeit `tauri-plugin-opener` entfernen. `src-tauri/src/main.rs` ruft `verwalter_lib::run()`.
- [x] `src-tauri/src/lib.rs`: `greet` und `.plugin(tauri_plugin_opener::init())` entfernen; `run()` enthält nur noch `tauri::Builder::default().run(tauri::generate_context!()).expect("Tauri-Laufzeit konnte nicht starten");`.
- [x] `src-tauri/capabilities/default.json`: `permissions` nur `["core:default"]`.
- [x] `src-tauri/tauri.conf.json`: `productName` „Agenten Verwalter 2000“, `version` „0.1.0“, `identifier` `com.aalphones.verwalter`; Fenster: `title` „Agenten Verwalter 2000“, `width` 1280, `height` 800, `minWidth` 900, `minHeight` 600; `app.security.csp` exakt wie in README → „CSP“; `bundle.targets` `["nsis"]`. Die Vorlagen-Icons unter `src-tauri/icons/` bleiben als Platzhalter.
- [x] Beispiel-Dateien löschen: `src/assets/react.svg`, `public/tauri.svg`, `public/vite.svg` (und leere Ordner `src/assets/`, `public/`). Verweise darauf in `index.html` entfernen; `<title>` in `index.html` = „Agenten Verwalter 2000“.
- [x] `src/App.tsx` und `src/App.css` löschen. Neu `src/app/App.tsx`:

  ```tsx
  import type { ReactElement } from 'react';
  import './App.css';

  export function App(): ReactElement {
    return (
      <main className="app-shell">
        <h1 className="app-shell__title">Agenten Verwalter 2000</h1>
      </main>
    );
  }
  ```

  und `src/app/App.css` mit `.app-shell { display: grid; place-content: center; min-height: 100vh; }` (Tokens folgen in Phase 2).
- [x] `src/main.tsx` importiert `{ App }` aus `./app/App` und rendert es in `StrictMode`. Die Vorlage importiert evtl. ein globales CSS — entfernen, Phase 2 bringt `src/styles/theme.css`.
- [x] `pnpm build` grün, `pnpm tauri dev` zeigt das Fenster (AK 2). Fenster schließen.

### Doku

- [x] FINDINGS.md: Rust- und pnpm-Version, Ergebnis der Linker-Probe, abweichende Flag-Namen.

### Commit

- [ ] `git status` lesen: keine `node_modules/`, kein `target/`, kein `dist/`. Commit `build(setup): scaffold tauri 2 app with react and typescript` (Body: warum Vorlage entschlackt, Edition 2024, default-run).

## Report-Back
