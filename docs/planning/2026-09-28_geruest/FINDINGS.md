# Findings — Meilenstein 1 Gerüst

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 2: `rustc 1.98.1` (stable-x86_64-pc-windows-msvc, `48a229cea 2026-09-01`), `pnpm 12.6.0` — diese Versionen pinnen.
- [ ] → Phase 2: Das PowerShell-Tool cached PATH beim ersten Aufruf der Session; `rustup`/`cargo`/`rustc` aus frisch per winget installiertem Rustup sind darin nicht sichtbar, `pnpm` (npm-global) schon. Workaround: `$env:Path += ";$env:USERPROFILE\.cargo\bin"` voranstellen oder volle Exe-Pfade nutzen. Gilt für jede Phase, die Cargo-Befehle aus derselben Session heraus ruft.
- [ ] → Phase 2: `pnpm install` nach dem Entfernen einer Dependency aus `package.json` meldete „Already up to date“ und ließ sie in `pnpm-lock.yaml`/`node_modules` stehen (getestet mit `@tauri-apps/plugin-opener`, auch mit `--no-frozen-lockfile`). Erst `node_modules` + `pnpm-lock.yaml` löschen und neu installieren hat sie entfernt. Bei künftigen Dependency-Entfernungen gegenprüfen (`pnpm why <paket>`), nicht auf die Install-Meldung verlassen.
