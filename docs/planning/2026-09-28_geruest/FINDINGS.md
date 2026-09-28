# Findings — Meilenstein 1 Gerüst

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [x] → Phase 2: `rustc 1.98.1` (stable-x86_64-pc-windows-msvc, `48a229cea 2026-09-01`), `pnpm 12.6.0` — diese Versionen pinnen.
- [x] → Phase 2: Das PowerShell-Tool cached PATH beim ersten Aufruf der Session; `rustup`/`cargo`/`rustc` aus frisch per winget installiertem Rustup sind darin nicht sichtbar, `pnpm` (npm-global) schon. Workaround: `$env:Path += ";$env:USERPROFILE\.cargo\bin"` voranstellen oder volle Exe-Pfade nutzen. Gilt für jede Phase, die Cargo-Befehle aus derselben Session heraus ruft.
- [x] → Phase 2: `pnpm install` nach dem Entfernen einer Dependency aus `package.json` meldete „Already up to date“ und ließ sie in `pnpm-lock.yaml`/`node_modules` stehen (getestet mit `@tauri-apps/plugin-opener`, auch mit `--no-frozen-lockfile`). Erst `node_modules` + `pnpm-lock.yaml` löschen und neu installieren hat sie entfernt. Bei künftigen Dependency-Entfernungen gegenprüfen (`pnpm why <paket>`), nicht auf die Install-Meldung verlassen.
- [x] → Phase 2 (Abweichungen, eingearbeitet): `eslint-plugin-react-hooks` 7.1.1 → Flat-Config heißt `reactHooks.configs.flat.recommended`. Vorlage hat `tsconfig.json` (App) + `tsconfig.node.json` (nur `vite.config.ts`, `composite`) → `typecheck` prüft beide. `@types/node` ergänzt, damit `vite.config.ts` `node:url`/`node:process` ohne `@ts-expect-error` importiert. Vorlagen-Skript `preview` entfernt (in Tauri ohne Nutzen). `main.tsx`: `as HTMLElement` durch Null-Prüfung ersetzt.
- [x] → Phase 2 (Abweichung, eingearbeitet): Tailwind erzeugte Utility-Klassen (`.px-8`, `.text-sm`, `.font-mono`) aus dem Anti-Pattern-Beispiel in `docs/conventions/tailwind.md` — die automatische Quellen-Erkennung durchsucht alle nicht ignorierten Dateien, auch Markdown. Fix: `@import 'tailwindcss' source(none);`. Danach enthält das gebaute CSS nur `.app-shell` und die Tokens. In tailwind.md festgehalten.
- [ ] → Phase 3: Der Satz im Plan „der Tauri-Build prüft beim Kompilieren, dass `dist/` existiert“ gilt nur für Release-Builds. Belegt: `gen-bindings` (Debug-Profil) baut und läuft ohne `dist/`. Für Clippy analog anzunehmen, nicht separat geprüft. Die Reihenfolge `build` vor `rust:clippy` schadet nicht, ist aber für CI keine Pflicht; `pnpm bindings` braucht in CI kein vorheriges `pnpm build`.
- [ ] → Phase 3: Doku-Stellen, die noch „wird beim Gerüst festgelegt“ sagen: `rust.md` → „Typen für die UI“, `react.md` → Stack-Tabelle „Listen“, `PROJECT.md` → offene Frage Typ-Generator. Alle drei auf ADR 002 verweisen lassen.
- [ ] → Phase 3: `typescript-eslint` 8.70.1 verlangt `typescript <6.1.0`; `typescript` steht auf `~6.0.3`. Ein Sprung auf TS 6.1 bricht den Lint, bis typescript-eslint nachzieht — `~` nicht auf `^` lockern.
- [ ] → Phase 3: `cargo build` meldet beim Linken der `cdylib` `warning: linker stdout: Bibliothek … verwalter_lib.dll.lib … werden erstellt` (Lint `linker_messages`). Clippy linkt nicht und ist davon nicht betroffen; setzt CI `RUSTFLAGS=-D warnings` für einen echten Build, wird genau diese Meldung rot.
- [ ] → Vault: frameworks/tailwind — Symptom: gebautes CSS enthält Utility-Klassen, die im Code nirgends vorkommen · Ursache: v4-Quellen-Erkennung scannt alle nicht per `.gitignore` ausgeschlossenen Dateien, auch Doku-Markdown mit Beispiel-Klassen · Fix: `@import "tailwindcss" source(none)` (Tailwind nur als Token-Pipeline) bzw. `source("../src")` / `@source not`.
