# Phase 2 — Prüfkette, Tokens & Typ-Pipeline

**Status:** complete · **Rating:** heikel (legt die Muster fest, die jeder spätere Befehl, jede Komponente und jeder CI-Lauf kopiert)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans (Entscheidungen ts-rs / TanStack Virtual)
- [FINDINGS.md](FINDINGS.md) — Rust- und pnpm-Version aus Phase 1
- [docs/conventions/typescript.md](../../conventions/typescript.md) — Strict-Flags, `import type`, Pfad-Alias `@/`, Tauri-Grenze
- [docs/conventions/react.md](../../conventions/react.md) — explizite Rückgabetypen, Effects mit Cleanup
- [docs/conventions/tailwind.md](../../conventions/tailwind.md) — zwei Token-Schichten, Präfixe, BEM
- [docs/conventions/rust.md](../../conventions/rust.md) — Fehlerbehandlung, kein `unwrap()`
- [docs/conventions/linting.md](../../conventions/linting.md) — Prüfkette, Warnungen = Fehler
- Vault-Fehlerklassen `frameworks/tailwind.md` → „Einbau ohne Preflight“: hier **nicht** einschlägig, weil `@import "tailwindcss"` vollständig importiert wird (Preflight inklusive) — nicht auf Teil-Importe umbauen.

Verifizierte ts-rs-12-API (docs.rs, 2026-09-28): `TS::export_all(cfg: &Config) -> Result<(), ExportError>`; `Config::new().with_out_dir(dir)`. `#[ts(export)]` erzeugt einen Test — **nicht verwenden**.

## Abnahmekriterien der Phase

1. `pnpm check` läuft grün (Reihenfolge siehe unten).
2. `pnpm tauri dev` zeigt unter der Überschrift „Version 0.1.0“, geliefert vom Core über `app_info`.
3. `src/lib/bindings/AppInfo.ts` und `src/lib/bindings/CommandError.ts` existieren, erzeugt von `pnpm bindings`, und stehen im Commit.
4. Kein Hex-Farbwert außerhalb von `src/styles/theme.css`; keine Utility-Klasse im JSX.
5. ADR 002 liegt in `docs/decisions/`.

## Checkliste

### Rust

- [x] `rust-toolchain.toml` im **Repo-Wurzelverzeichnis**: `[toolchain]` mit `channel = "<exakte Version aus FINDINGS.md, z.B. 1.xx.y>"` und `components = ["rustfmt", "clippy"]`.
- [x] `src-tauri/Cargo.toml`: Abhängigkeiten `thiserror = "2"` und `ts-rs = "=12.0.1"` ergänzen (serde ist aus der Vorlage da). Abschnitt `[lints.clippy]` mit `unwrap_used = "deny"`.
- [x] `src-tauri/src/error.rs`:

  ```rust
  use serde::Serialize;
  use ts_rs::TS;

  /// Fehler, den ein Tauri Command an die Oberfläche meldet.
  /// Nutzer-relevante Fälle bekommen später eigene Varianten (siehe rust.md).
  #[derive(Debug, thiserror::Error, Serialize, TS)]
  #[serde(tag = "kind", content = "message", rename_all = "camelCase")]
  pub enum CommandError {
      #[error("interner Fehler: {0}")]
      Internal(String),
  }
  ```

- [x] `src-tauri/src/commands/mod.rs` mit `pub mod app;` und `src-tauri/src/commands/app.rs`:

  ```rust
  use serde::Serialize;
  use ts_rs::TS;

  use crate::error::CommandError;

  #[derive(Debug, Clone, Serialize, TS)]
  #[serde(rename_all = "camelCase")]
  pub struct AppInfo {
      pub name: String,
      pub version: String,
  }

  #[tauri::command]
  pub fn app_info(app: tauri::AppHandle) -> Result<AppInfo, CommandError> {
      let package = app.package_info();
      Ok(AppInfo {
          name: package.name.clone(),
          version: package.version.to_string(),
      })
  }
  ```

- [x] `src-tauri/src/lib.rs`: `pub mod commands;` und `pub mod error;` deklarieren; im Builder `.invoke_handler(tauri::generate_handler![commands::app::app_info])` vor `.run(...)`.
- [x] `src-tauri/src/bin/gen-bindings.rs` — exportiert jeden Typ, der die Tauri-Grenze überquert; neue Typen werden hier ergänzt:

  ```rust
  //! Erzeugt die TypeScript-Typen in src/lib/bindings/. Aufruf: `pnpm bindings`.
  use ts_rs::{Config, TS};
  use verwalter_lib::{commands::app::AppInfo, error::CommandError};

  fn main() -> Result<(), ts_rs::ExportError> {
      let cfg = Config::new().with_out_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings"));
      AppInfo::export_all(&cfg)?;
      CommandError::export_all(&cfg)?;
      Ok(())
  }
  ```

  Schlägt der Build an der API fehl (Signatur weicht ab), in docs.rs/ts-rs/12.0.1 nachsehen und in FINDINGS.md festhalten — nicht auf `#[ts(export)]` ausweichen.
- [x] `pnpm bindings` ausführen (Skript unten); Dateien in `src/lib/bindings/` prüfen: `AppInfo` hat `name: string; version: string`.

### TypeScript-Konfiguration

- [x] `tsconfig.json` (App-Code): zusätzlich zu dem, was die Vorlage setzt, sicherstellen: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, `noImplicitOverride` — alle `true`. `paths: { "@/*": ["./src/*"] }`.
- [x] `vite.config.ts`: Alias `'@'` → `fileURLToPath(new URL('./src', import.meta.url))`; Plugin `tailwindcss()` aus `@tailwindcss/vite` in die `plugins`-Liste neben `react()`.

### Styles & Tokens

- [x] devDependencies: `tailwindcss@^4`, `@tailwindcss/vite@^4`.
- [x] `src/styles/theme.css` anlegen. Aufbau: `@import "tailwindcss";`, dann **`@theme static { … }`** mit den rohen Tokens (`static`, damit alle Variablen ausgegeben werden — die Komponenten-CSS-Dateien lesen sie per `var()`, ohne dass Tailwind Utility-Nutzung sieht), dann `:root { … }` mit den semantischen Tokens, dann die Dunkel-Blöcke. **Alle Werte kommen exakt aus [docs/design/2026-09-28_hauptansichten/README.md](../../design/2026-09-28_hauptansichten/README.md) → „Tokens“** — dort ist die einzige Quelle, hier werden keine Werte wiederholt:
  - In `@theme static`: jede Zeile aus „Rohe Farben“ und „Weitere Tokens“ (Schriften, Schriftgrößen, Abstände, Radien, `--shadow-popover-dark`/`-light`, Dauer, Z-Ebenen).
  - `:root { … }`: jedes Token aus „Semantische Farben“ mit dem Wert der Spalte **Hell** (Verweis als `var(--color-<roh>)`; `x @ n %` als `color-mix(in srgb, var(--color-x) n%, transparent)`), dazu `--shadow-popover: var(--shadow-popover-light)`.
  - Dunkel: dieselben Namen mit der Spalte **Dunkel** und `--shadow-popover: var(--shadow-popover-dark)`. Dieser Block steht zweimal: in `@media (prefers-color-scheme: dark) { :root:not(.light) { … } }` und in `:root.dark { … }`.
  - Global: `body { margin: 0; background: var(--color-bg-base); color: var(--color-fg-primary); font-family: var(--font-sans); font-size: var(--font-size-md); line-height: 1.45; }`
  - Prüfen: Zahl der Tokens in `theme.css` = Zahl der Zeilen in den drei Token-Tabellen der Design-README (Schriftgrößen, Abstände, Radien, Z-Ebenen zählen einzeln).
- [x] `src/main.tsx` importiert `@/styles/theme.css` vor `App`.

### Typisierter Wrapper & Anzeige

- [x] `src/lib/app.ts`:

  ```ts
  import { invoke } from '@tauri-apps/api/core';
  import type { AppInfo } from '@/lib/bindings/AppInfo';

  /** Liest Name und Version der App aus dem Core.
   *  @throws {import('@/lib/bindings/CommandError').CommandError} wenn der Core ablehnt */
  export function getAppInfo(): Promise<AppInfo> {
    return invoke<AppInfo>('app_info');
  }
  ```

- [x] `src/app/App.tsx`: State `info: AppInfo | null` und `error: string | null`; `useEffect` mit `AbortController` ruft `getAppInfo()`, setzt State nur, wenn `!controller.signal.aborted`, Cleanup `controller.abort()`. Unter dem Titel: `<p className="app-shell__version">Version {info.version}</p>` wenn geladen, `<p className="app-shell__error">…</p>` bei Fehler, sonst nichts. Bedingte Anzeige mit mehr als einer Zeile → Render-Funktion `renderVersion()` (react.md).
- [x] `src/app/App.css`: BEM-Klassen `.app-shell`, `&__title`, `&__version`, `&__error` nur mit semantischen Tokens (`--color-fg-muted` für die Version, `--color-status-error` für den Fehler, Abstände über `--space-*`).

### Lint & Format

- [x] devDependencies: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `globals`, `prettier`.
- [x] `eslint.config.js` (Flat Config): `ignores: ['dist', 'src-tauri', 'src/lib/bindings']`; `js.configs.recommended`; `tseslint.configs.strictTypeChecked` mit `languageOptions.parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }`; die Flat-Config-Variante von `eslint-plugin-react-hooks` (Namen in der README der installierten Version nachlesen, z.B. `reactHooks.configs['recommended-latest']` oder `reactHooks.configs.flat.recommended`); Regeln `@typescript-eslint/explicit-function-return-type: 'error'`, `@typescript-eslint/consistent-type-imports: 'error'`; `eslintConfigPrettier` als letzter Eintrag. `vite.config.ts` und `eslint.config.js` dürfen per `tseslint.configs.disableTypeChecked` ausgenommen werden, falls sie nicht in einem tsconfig liegen.
- [x] `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }`. `.prettierignore`: `src/lib/bindings`.
- [x] `package.json` Skripte (exakt diese Namen):

  | Skript | Befehl |
  |---|---|
  | `dev` | `vite` |
  | `build` | `tsc -p tsconfig.json --noEmit && vite build` |
  | `lint` | `eslint . --max-warnings 0` |
  | `typecheck` | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit` (zweiter Teil nur, wenn die Vorlage `tsconfig.node.json` hat) |
  | `format` | `prettier --write src` |
  | `format:check` | `prettier --check src` |
  | `bindings` | `cargo run --manifest-path src-tauri/Cargo.toml --bin gen-bindings` |
  | `rust:fmt` | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` |
  | `rust:clippy` | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` |
  | `check` | `pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm rust:fmt && pnpm rust:clippy` |
  | `tauri` | `tauri` (aus der Vorlage) |

  **`build` steht in `check` vor `rust:clippy`** — der Tauri-Build prüft beim Kompilieren, dass `dist/` existiert.
- [x] `pnpm format` und `cargo fmt --manifest-path src-tauri/Cargo.toml` einmal laufen lassen, dann `pnpm check` bis grün. Regelverstöße beheben, nicht abschalten (linting.md).

### Doku

- [x] `docs/decisions/002-typgenerierung-und-listen.md` (Format wie ADR 001, Status angenommen, Datum Umsetzungstag): Kontext (PROJECT.md offene Frage Typ-Generator; react.md „Bibliothek beim Gerüst festlegen“), Optionen (ts-rs 12.0.1 stabil vs. tauri-specta 2.0.0-rc.25), Entscheidung (ts-rs über `gen-bindings`, handgeschriebene Wrapper in `src/lib/<feature>.ts`; `@tanstack/react-virtual` für Listen), Konsequenzen (Command-Namen im Wrapper sind handgepflegt → Wrapper und `generate_handler!` im selben Commit ändern; neue Grenz-Typen in `gen-bindings.rs` eintragen; CI prüft, dass die Bindings aktuell sind).
- [x] FINDINGS.md: Abweichungen (react-hooks-Config-Name, tsconfig-Aufteilung der Vorlage).

### Commit

- [x] Commit `build(setup): add check chain, design tokens and rust-to-ts bindings` inkl. `src/lib/bindings/` und ADR 002.

## Report-Back

- `pnpm check` grün (Exit 0); Gegenprobe: eine `any`-Annotation macht `pnpm lint` rot.
- Tokens gegen die Design-README per Skript verglichen: 38 Rohfarben + 35 weitere + 29 semantische (Hell, Dunkel-Media, `:root.dark` je vollständig), 0 Abweichungen, keine Hex-Werte außerhalb `theme.css`. Gebautes CSS enthält nur `.app-shell` und die Tokens.
- `src/lib/bindings/AppInfo.ts` (`{ name: string, version: string }`) und `CommandError.ts` (`{ kind: "internal", message: string }`) erzeugt. ts-rs-12-API wie im Plan, keine Abweichung.
- **Nicht geprüft:** AK 2 (`pnpm tauri dev` zeigt „Version 0.1.0“) — Fenster nicht gesehen, nur Kompilieren und Generator-Lauf belegt. Deckt die Smoke-Checkliste am Plan-Ende.
- Abweichungen und Folgen für Phase 3: [FINDINGS.md](FINDINGS.md).
