# Meilenstein 1 — Gerüst

Ziel: eine startfähige Tauri-2-App (React + TypeScript, Rust-Core) mit vollständiger Prüfkette lokal und in GitHub Actions. Fachlich tut die App noch nichts außer ihre Version aus dem Core anzuzeigen — dieser eine Befehl beweist die ganze Kette Rust-Typ → generierter TS-Typ → typisierter Wrapper → Oberfläche.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 001](../../decisions/001-stack-und-plattform.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Toolchain & App startet | [phase-1-toolchain-und-app.md](phase-1-toolchain-und-app.md) | standard | pending |
| 2 | Prüfkette, Tokens & Typ-Pipeline | [phase-2-pruefkette-und-typen.md](phase-2-pruefkette-und-typen.md) | heikel | pending |
| 3 | CI & Doku | [phase-3-ci-und-doku.md](phase-3-ci-und-doku.md) | mechanisch | pending |

Umsetzung direkt auf `main`, ein Commit pro Phase. Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

- **Typen Rust → TypeScript: `ts-rs` 12.0.1 (exakt gepinnt).** Export über ein eigenes Hilfsprogramm `src-tauri/src/bin/gen-bindings.rs` mit `TS::export_all(&Config)`, nicht über `#[ts(export)]` (das läuft über `cargo test`, und dieses Projekt hat keine Tests). Wrapper für Tauri Commands werden von Hand geschrieben, eine Datei pro Feature in `src/lib/`. Verworfen: `tauri-specta` — erzeugt die Wrapper mit, steht aber seit Jahren auf `2.0.0-rc.25`. Festgehalten in ADR 002 (Phase 2).
- **Virtualisierte Listen: `@tanstack/react-virtual`** — ohne eigenes Styling, passt zu BEM. Nur im ADR 002 festgehalten; installiert wird sie mit der ersten virtualisierten Liste.
- **App-Kennung** `com.aalphones.verwalter`, Produktname „Agenten Verwalter 2000“, Crate `verwalter`, Bibliothek `verwalter_lib`.
- **Installer:** nur NSIS (`bundle.targets: ["nsis"]`), kein WiX.
- **CSP:** `default-src 'self'; connect-src ipc: http://ipc.localhost; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:`.
- **Platzhalter-Hülle statt Layout:** Die Oberfläche in diesem Meilenstein ist bewusst nur ein Titel plus Versionsanzeige. Den App-Rahmen (Sidebar, Header, Ansichten) besitzt der Design-Meilenstein 1b bzw. M6 — hier wird nichts gebaut, woran später angebaut wird.
- **Token-Werte sind Platzhalter:** Phase 2 legt die Token-*Struktur* fest; die finalen Farben, Abstände und Schriften liefert Meilenstein 1b.

## Finale Abnahmekriterien

1. `pnpm check` läuft lokal von vorn bis hinten grün.
2. Der Workflow `check` in GitHub Actions ist auf `main` grün.
3. `pnpm tauri build` erzeugt einen NSIS-Installer; die installierte App startet und zeigt „Agenten Verwalter 2000“ und ihre Versionsnummer aus dem Core.
4. AGENTS.md, README, Code-Map, Konventionen und PROJECT.md beschreiben den tatsächlichen Stand (Befehle, Ordner, Generator).

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

- [ ] **Installierte App (nicht Dev-Modus) zeigt die Versionsnummer** — prüft CSP gegen den Kanal zum Core. Leer oder Fehlermeldung → CSP blockiert `invoke`.
- [ ] **CI-Lauf grün** — prüft die Reihenfolge `pnpm build` vor Clippy (der Tauri-Build braucht `dist/` beim Kompilieren) und die Rust-Toolchain aus `rust-toolchain.toml` auf dem Runner.
- [ ] **`pnpm tauri dev` startet ohne Linker-Fehler** — prüft Rust mit den installierten VS Build Tools 2026.
- [ ] Dunkelmodus: Windows auf „Dunkel“ stellen → Fenster wird dunkel, ohne Neustart der App.
- [ ] Eine absichtlich eingebaute Lint-Verletzung (z.B. `let x: any`) lässt `pnpm lint` rot werden; danach wieder entfernen.
- [ ] `pnpm bindings` erzeugt keine Änderung an `src/lib/bindings/` (Stand im Repo ist aktuell).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
