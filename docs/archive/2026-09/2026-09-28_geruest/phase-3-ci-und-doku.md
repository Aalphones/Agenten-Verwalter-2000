# Phase 3 — CI & Doku

**Rating:** mechanisch

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans
- [phase-2-pruefkette-und-typen.md](phase-2-pruefkette-und-typen.md) → Skript-Tabelle (Namen und Reihenfolge)
- [FINDINGS.md](FINDINGS.md)
- [AGENTS.md](../../../AGENTS.md), [README.md](../../../README.md), [docs/code-map.md](../../code-map.md), [docs/PROJECT.md](../../PROJECT.md), [docs/conventions/linting.md](../../conventions/linting.md), [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/react.md](../../conventions/react.md)

## Abnahmekriterien der Phase

1. `.github/workflows/check.yml` läuft auf `windows-latest` bei Push auf `main` und bei Pull Requests und ist nach dem Push grün.
2. Der Workflow schlägt fehl, wenn `src/lib/bindings/` nicht zum Rust-Stand passt.
3. `pnpm tauri build` erzeugt einen NSIS-Installer unter `src-tauri/target/release/bundle/nsis/`.
4. Kein Doku-Satz behauptet mehr „Gerüst noch nicht angelegt“ oder „Werkzeug wird beim Gerüst festgelegt“.

## Checkliste

### CI

- [x] `.github/workflows/check.yml`, Name `check`, Trigger `push` auf `main` und `pull_request`, ein Job `check` auf `windows-latest`. Für jede Action die aktuelle Major-Version von ihrer GitHub-Seite ablesen und eintragen. Schritte in genau dieser Reihenfolge:
  1. `actions/checkout`
  2. `pnpm/action-setup` (ohne `version` — liest `packageManager` aus `package.json`)
  3. `actions/setup-node` mit `node-version: 24` und `cache: pnpm`
  4. `run: rustup show` (installiert die Version aus `rust-toolchain.toml` samt rustfmt/clippy)
  5. `Swatinem/rust-cache` mit `workspaces: src-tauri`
  6. `run: pnpm install --frozen-lockfile`
  7. `run: pnpm lint`
  8. `run: pnpm typecheck`
  9. `run: pnpm format:check`
  10. `run: pnpm build` — **vor** Clippy, weil der Tauri-Build `dist/` beim Kompilieren verlangt
  11. `run: pnpm rust:fmt`
  12. `run: pnpm rust:clippy`
  13. Bindings-Prüfung, `shell: bash`: `pnpm bindings` und danach `test -z "$(git status --porcelain -- src/lib/bindings)" || { git status --porcelain -- src/lib/bindings; echo "src/lib/bindings ist veraltet - pnpm bindings ausführen und committen"; exit 1; }`
- [x] Lokal gegenprobe: `pnpm check` grün, `pnpm bindings` ändert nichts.

### Installer

- [x] `pnpm tauri build`; Installer aus `src-tauri/target/release/bundle/nsis/` einmal installieren und starten: Titel und Versionsnummer sichtbar (Wackelstelle CSP). Ergebnis: sichtbar, siehe Plan-README → Smoke-Checkliste.

### Doku

- [x] `AGENTS.md` → Abschnitt „Befehle“: Platzhalter-Satz ersetzen durch eine Tabelle `pnpm tauri dev` (App im Entwicklungsmodus), `pnpm check` (gesamte Prüfkette), `pnpm bindings` (TS-Typen aus Rust neu erzeugen — nach jeder Änderung an Typen, die die Tauri-Grenze überqueren), `pnpm format`, `pnpm tauri build` (NSIS-Installer).
- [x] `README.md`: „Status“ → „Gerüst steht, als Nächstes Design-Entwurf (1b) und Agent-Anbindung“; Quickstart-Block mit den echten Befehlen (`pnpm install`, `pnpm tauri dev`, `pnpm check`); Voraussetzungen um „pnpm per `npm install -g pnpm` — Node 25+ bringt kein Corepack mehr mit“ ergänzen.
- [x] `docs/code-map.md`: „Stand“-Satz aktualisieren (Gerüst angelegt, Features folgen). Zeilen ergänzen: App-Info/Version (`src/app/`, `src/lib/app.ts` · `src-tauri/src/commands/app.rs`), Fehlertyp am Command-Rand (— · `src-tauri/src/error.rs`), Design-Tokens (`src/styles/theme.css` · —), Typ-Generator (Ausgabe `src/lib/bindings/` · `src-tauri/src/bin/gen-bindings.rs`). Faustregel ergänzen: „Neuer Typ über die Tauri-Grenze? → `derive(TS)` im Core, in `gen-bindings.rs` eintragen, `pnpm bindings`.“
- [x] `docs/conventions/linting.md`: Block „Prüfkette“ durch die tatsächlichen Skriptnamen aus Phase 2 ersetzen, Reihenfolge `build` vor `rust:clippy` mit Grund; Satz „Die genauen Skriptnamen werden beim Gerüst … angelegt“ streichen; CI-Datei `.github/workflows/check.yml` nennen.
- [x] `docs/conventions/rust.md` → „Typen für die UI“: „Werkzeug wird beim Gerüst festgelegt“ ersetzen durch: ts-rs, Export über `src/bin/gen-bindings.rs`, kein `#[ts(export)]`, `default-run = "verwalter"` in `Cargo.toml` wegen des zweiten Programms, Verweis auf ADR 002.
- [x] `docs/conventions/react.md`: Stack-Zeile „Listen“ → `@tanstack/react-virtual` (ADR 002).
- [x] `docs/PROJECT.md`: Stack-Zeile „Gemeinsame Typen“ → „ts-rs, siehe ADR 002“; offene Frage „Womit werden die Typen … generiert“ streichen.
- [x] Plan-README: Summary, Files touched, Commits, Deviations, Follow-ups füllen; Status aller Phasen `complete`.

### Commit

- [x] Commit `ci(setup): add windows check workflow and document commands`, pushen, CI-Ergebnis auf GitHub → Actions ablesen. Ergebnis: `3e3aa95`, Lauf grün.

## Report-Back

- `pnpm check` lokal grün (Exit 0); `pnpm bindings` lässt `src/lib/bindings/` unverändert (`git status --porcelain` leer).
- Action-Versionen von den GitHub-Releases gelesen: `actions/checkout@v7` (v7.0.1), `pnpm/action-setup@v6` (v6.1.0), `actions/setup-node@v7` (v7.0.0), `Swatinem/rust-cache@v2` (v2.9.2).
- `pnpm tauri build` grün (6 min 17 s Release-Kompilierung), Installer `Agenten Verwalter 2000_0.1.0_x64-setup.exe`, 1,4 MiB.
- Installer still installiert und gestartet: „Agenten Verwalter 2000“ und „Version 0.1.0“ sichtbar; CI-Lauf zu `3e3aa95` grün. Rest der Smoke-Checkliste ebenfalls belegt (Plan-README).
- **Nebenbefund:** `gen-bindings.exe` liegt im Installationsordner (Plan-README → Follow-ups).
- Abweichung: `build` vor `rust:clippy` ist nur Vorsicht, keine Pflicht (FINDINGS) — linting.md sagt das so.
