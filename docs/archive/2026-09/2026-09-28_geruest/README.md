# Meilenstein 1 — Gerüst

Ziel: eine startfähige Tauri-2-App (React + TypeScript, Rust-Core) mit vollständiger Prüfkette lokal und in GitHub Actions. Fachlich tut die App noch nichts außer ihre Version aus dem Core anzuzeigen — dieser eine Befehl beweist die ganze Kette Rust-Typ → generierter TS-Typ → typisierter Wrapper → Oberfläche.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 001](../../decisions/001-stack-und-plattform.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Toolchain & App startet | [phase-1-toolchain-und-app.md](phase-1-toolchain-und-app.md) | standard | complete |
| 2 | Prüfkette, Tokens & Typ-Pipeline | [phase-2-pruefkette-und-typen.md](phase-2-pruefkette-und-typen.md) | heikel | complete |
| 3 | CI & Doku | [phase-3-ci-und-doku.md](phase-3-ci-und-doku.md) | mechanisch | complete |

Umsetzung direkt auf `main`, ein Commit pro Phase. Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

- **Typen Rust → TypeScript: `ts-rs` 12.0.1 (exakt gepinnt).** Export über ein eigenes Hilfsprogramm `src-tauri/src/bin/gen-bindings.rs` mit `TS::export_all(&Config)`, nicht über `#[ts(export)]` (das läuft über `cargo test`, und dieses Projekt hat keine Tests). Wrapper für Tauri Commands werden von Hand geschrieben, eine Datei pro Feature in `src/lib/`. Verworfen: `tauri-specta` — erzeugt die Wrapper mit, steht aber seit Jahren auf `2.0.0-rc.25`. Festgehalten in ADR 002 (Phase 2).
- **Virtualisierte Listen: `@tanstack/react-virtual`** — ohne eigenes Styling, passt zu BEM. Nur im ADR 002 festgehalten; installiert wird sie mit der ersten virtualisierten Liste.
- **App-Kennung** `com.aalphones.verwalter`, Produktname „Agenten Verwalter 2000“, Crate `verwalter`, Bibliothek `verwalter_lib`.
- **Installer:** nur NSIS (`bundle.targets: ["nsis"]`), kein WiX.
- **CSP:** `default-src 'self'; connect-src ipc: http://ipc.localhost; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:`.
- **Platzhalter-Hülle statt Layout:** Die Oberfläche in diesem Meilenstein ist bewusst nur ein Titel plus Versionsanzeige. Den App-Rahmen (Sidebar, Header, Ansichten) besitzt der Design-Meilenstein 1b bzw. M6 — hier wird nichts gebaut, woran später angebaut wird.
- **Token-Werte aus dem Design:** Phase 2 übernimmt Farben, Schriften, Abstände und Radien unverändert aus [docs/design/2026-09-28_hauptansichten/README.md](../../design/2026-09-28_hauptansichten/README.md) → „Tokens“. Schriften sind die Windows-Systemschriften Segoe UI Variable und Cascadia Code; es wird keine Schrift ausgeliefert.

## Finale Abnahmekriterien

1. `pnpm check` läuft lokal von vorn bis hinten grün.
2. Der Workflow `check` in GitHub Actions ist auf `main` grün.
3. `pnpm tauri build` erzeugt einen NSIS-Installer; die installierte App startet und zeigt „Agenten Verwalter 2000“ und ihre Versionsnummer aus dem Core.
4. AGENTS.md, README, Code-Map, Konventionen und PROJECT.md beschreiben den tatsächlichen Stand (Befehle, Ordner, Generator).

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

Alle sechs am 2026-09-28 vom Agenten geprüft (Sascha hat das ausdrücklich verlangt), nicht von Hand:

- [x] **Installierte App (nicht Dev-Modus) zeigt die Versionsnummer** — NSIS-Installer still installiert, gestartet, Fenster fotografiert: Titel „Agenten Verwalter 2000“ und „Version 0.1.0“ sichtbar, CSP blockiert `invoke` nicht. Danach wieder deinstalliert.
- [x] **CI-Lauf grün** — Lauf zu `3e3aa95` mit `conclusion: success` (GitHub Actions, Workflow `check`).
- [x] **`pnpm tauri dev` startet ohne Linker-Fehler** — Log: Vite bereit, `cargo run` baut in 17 s, `Running target\debug\verwalter.exe`, Fenster „Agenten Verwalter 2000“ war da. Nur die bekannte `linker_messages`-Warnung. Fensterinhalt im Dev-Modus **nicht** fotografiert (Fokus lag bei VS Code).
- [x] Dunkelmodus: laufende App auf „Hell“ gestellt (Registry plus `WM_SETTINGCHANGE`) → Fenster und Titelleiste werden hell ohne Neustart; danach zurück auf Dunkel. Ein reines Registry-Schreiben ohne Broadcast reicht dafür nicht — das ist Windows, nicht die App.
- [x] Eine absichtlich eingebaute Lint-Verletzung (`export const probe: any = 1;`) → `pnpm lint` Exit 1 (`no-explicit-any`); Datei entfernt → Exit 0.
- [x] `pnpm bindings` erzeugt keine Änderung an `src/lib/bindings/` — `git status --porcelain` leer, lokal und im CI-Schritt.

## Summary

Startfähige Tauri-2-App (React 19, TypeScript strict, Rust-Core) mit vollständiger Prüfkette: `pnpm check` lokal, derselbe Ablauf plus Bindings-Prüfung in GitHub Actions. Der Befehl `app_info` beweist die Kette Rust-Typ → generierter TS-Typ → Wrapper → Oberfläche. Design-Tokens aus dem Entwurf sind übernommen, ADR 002 hält Typ-Generator und Listen-Bibliothek fest, die Doku beschreibt den tatsächlichen Stand.

## Files touched

- App und Toolchain: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig*.json`, `rust-toolchain.toml`, `src/`, `src-tauri/`
- Prüfkette: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.github/workflows/check.yml`
- Doku: `AGENTS.md`, `README.md`, `docs/code-map.md`, `docs/PROJECT.md`, `docs/conventions/{linting,rust,react,tailwind}.md`, `docs/decisions/002-typgenerierung-und-listen.md`

## Commits

- Phase 1: `eaa8e78` build(setup): scaffold tauri 2 app with react and typescript
- Phase 2: `48cbd74` build(setup): add check chain, design tokens and rust-to-ts bindings
- Phase 3: `ci(setup): add windows check workflow and document commands`

## Deviations from plan

- `build` vor `rust:clippy` ist Vorsicht, keine Pflicht: der Debug-Build braucht `dist/` nicht (belegt für `gen-bindings`, für Clippy angenommen).
- Tailwind mit `source(none)`, weil die automatische Quellen-Erkennung Utility-Klassen aus dem Markdown der Konventionen erzeugte.
- `typescript` auf `~6.0.3` gepinnt, weil `typescript-eslint` 8.70.1 `<6.1.0` verlangt.
- Vorlagen-Skript `preview` entfernt; `tsconfig.node.json` zusätzlich im Typecheck.

## Follow-ups

- **`gen-bindings.exe` landet im Installer.** Tauri bündelt jedes Programm aus `src-tauri/src/bin/`; im Installationsordner lag neben `verwalter.exe` auch das Entwicklerwerkzeug. Harmlos, aber Ballast. Kandidat: `required-features` an der Bin-Definition, `pnpm bindings` ruft dann mit `--features`. Entscheidung offen.
- Dev-Modus: Fensterinhalt nicht fotografiert, nur Start per Log belegt.
- Linker-Warnung `linker_messages` beim `cargo build` der `cdylib`: harmlos, wird rot, sobald ein Build mit `RUSTFLAGS=-D warnings` läuft.
- `→ Vault: frameworks/tailwind` (FINDINGS) wartet auf `session-review`.
