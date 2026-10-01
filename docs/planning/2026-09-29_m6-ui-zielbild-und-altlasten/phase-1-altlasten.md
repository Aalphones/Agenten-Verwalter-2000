# Phase 1 — Altlasten: Esc-Zustand, Typ-Erzeugung raus aus dem Installer, Seitengröße des Verlaufs

Rating: mechanisch. Drei unabhängige, kleine Änderungen; alle Entscheidungen stehen unten.

## Kontext

- [README dieses Plans](README.md), Abschnitt „Festgelegte Entscheidungen“ → „Altlasten“
- `src-tauri/src/sessions/registry.rs`: `finish_tool` (setzt den Zustand einer Werkzeug-Zeile beim `ToolFinished`), `pause` und `cancel` (setzen `pause_requested` bzw. `cancel_requested`), `pause_after_interrupt` (setzt `pause_requested` beim `result` zurück), `interrupt_running_tools`
- `src-tauri/src/agents/event.rs`: `ToolState` (Doku-Kommentar zu `Interrupted`)
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitt zur Steueranfrage `interrupt`: nach `interrupt` kommen Werkzeug-Ergebnisse mit `is_error`, dann `user` mit `[Request interrupted by user]`, dann `result`
- Ursprung des Esc-Befunds: [M4-Archiv](../../archive/2026-09/2026-09-28_m4-persistenz-und-wiederherstellung/README.md), „Deviations from plan“
- `src-tauri/src/bin/gen-bindings.rs`, `src-tauri/Cargo.toml`, `package.json` (Skripte `bindings`, `rust:clippy`), `.github/workflows/check.yml` (ruft `pnpm bindings`)
- Ursprung des Installer-Befunds: [Gerüst-Archiv](../../archive/2026-09/2026-09-28_geruest/README.md), „Follow-ups“
- `src/features/chat/useChatEntries.ts` (`PAGE_SIZE`), `src/vite-env.d.ts`
- Vault-Fehlerklassen gelesen (React, Tailwind, TypeScript, SQLite): keine für diese Phase einschlägig.

## Abnahmekriterien

1. Kommt ein `ToolFinished { failed: true }`, während `pause_requested` oder `cancel_requested` gesetzt ist, wird die Zeile `ToolState::Interrupted`; ohne angeforderte Pause bzw. Abbruch bleibt es `Failed`; `failed: false` bleibt `Done`.
2. `src-tauri/src/bin/` existiert nicht mehr; `src-tauri/examples/gen-bindings.rs` hat denselben Inhalt (nur der Doku-Kommentar in Zeile 1 nennt den neuen Aufruf). `pnpm bindings` erzeugt byte-gleiche Dateien unter `src/lib/bindings/` (nach dem Lauf zeigt `git status -- src/lib/bindings` nichts).
3. `cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --format-version 1` listet `gen-bindings` mit `"kind":["example"]`, kein Ziel mit `"kind":["bin"]` außer `verwalter`.
4. `pnpm rust:clippy` prüft das Beispiel weiter (`--all-targets` enthält Beispiele — keine Änderung am Skript nötig).
5. Im Entwicklungsmodus mit `VITE_VERWALTER_CHAT_PAGE_SIZE=20` lädt der Verlauf in Seiten zu 20 Einträgen; ohne Variable, mit ungültigem Wert (keine ganze Zahl, < 1, > 500) und im gebauten Programm immer 200.
6. `pnpm check` grün.

## Checkliste

### Esc-Zustand (Commit 1: `fix(sessions): mark tools cut off by pause or cancel as interrupted`)

- [x] `registry.rs`, `finish_tool`: die Zuweisung `*state = if failed { ToolState::Failed } else { ToolState::Done };` ersetzen durch: `failed == false` → `Done`; `failed == true` und (`self.pause_requested || self.cancel_requested`) → `Interrupted`; sonst `Failed`. Doku-Kommentar über der Funktion: „Ein Fehlergebnis, das nach einer angeforderten Pause oder einem Abbruch eintrifft, ist der abgewürgte Aufruf selbst — deshalb „unterbrochen“, nicht „fehlgeschlagen“.“
- [x] Prüfen, dass `finish_tool` auf `SessionState` arbeitet, das `pause_requested`/`cancel_requested` trägt (beide Felder stehen in derselben Struktur, `registry.rs` um Zeile 123). Liegt `finish_tool` auf einer anderen Struktur → Befund nach FINDINGS, die Felder als Parameter durchreichen.
- [x] Doku: im Entwurfs-README, Abschnitt „Abweichungen vom Entwurf“, Punkt „Werkzeug-Zeile „unterbrochen““ um den Halbsatz ergänzen: „auch bei Esc auf einen bereits laufenden Aufruf“.

### Typ-Erzeugung (Commit 2: `build(setup): move the bindings generator out of the installer`)

- [x] `git mv src-tauri/src/bin/gen-bindings.rs src-tauri/examples/gen-bindings.rs`; den leeren Ordner `src-tauri/src/bin/` entfernen.
- [x] Zeile 1 des Beispiels: `//! Erzeugt die TypeScript-Typen in src/lib/bindings/. Aufruf: `pnpm bindings` (`cargo run --example gen-bindings`).` — Rest unverändert (`CARGO_MANIFEST_DIR` zeigt weiter auf `src-tauri`, der Pfad `/../src/lib/bindings` bleibt richtig).
- [x] `package.json`: `"bindings": "cargo run --manifest-path src-tauri/Cargo.toml --example gen-bindings"`.
- [x] `src-tauri/Cargo.toml`: nichts eintragen. Cargo findet Beispiele unter `examples/` von selbst; `default-run = "verwalter"` bleibt.
- [x] Prüfen: `pnpm bindings`, danach `git status --porcelain -- src/lib/bindings` leer; `cargo metadata …` wie AK 3.
- [x] Doku: [ADR 002](../../decisions/002-typgenerierung-und-listen.md) Zeile mit `src-tauri/src/bin/gen-bindings.rs` → `src-tauri/examples/gen-bindings.rs` plus Halbsatz „ein Beispielprogramm, damit Tauri es nicht in den Installer bündelt“; [rust.md](../../conventions/rust.md) (Treffer auf `gen-bindings`) und [code-map.md](../../code-map.md) (Zeilen „Generierte Typen Rust → TS“ und Einleitungssatz mit `src-tauri/src/bin/`) auf den neuen Pfad. Die Pläne unter `docs/planning/2026-09-29_m2b-…/` und `docs/archive/` bleiben unverändert (historisch).

### Seitengröße des Verlaufs (im Commit 2, Scope passt als Entwicklungswerkzeug)

- [x] `src/vite-env.d.ts`: unter der bestehenden Referenzzeile ergänzen:
  ```ts
  interface ImportMetaEnv {
    readonly VITE_VERWALTER_CHAT_PAGE_SIZE?: string;
  }
  ```
- [x] `useChatEntries.ts`: `const PAGE_SIZE = 200;` ersetzen durch `const DEFAULT_PAGE_SIZE = 200;`, `const MAX_PAGE_SIZE = 500;` (entspricht `MAX_HISTORY_PAGE` in `registry.rs`) und `const PAGE_SIZE: number = pageSizeFromEnv();` mit einer Funktion `pageSizeFromEnv(): number` am Dateiende: außerhalb von `import.meta.env.DEV` → `DEFAULT_PAGE_SIZE`; sonst `Number.parseInt(import.meta.env.VITE_VERWALTER_CHAT_PAGE_SIZE ?? '', 10)`, gültig bei `Number.isInteger(n) && n >= 1 && n <= MAX_PAGE_SIZE`, sonst `DEFAULT_PAGE_SIZE`. Alle bisherigen Verwendungen von `PAGE_SIZE` bleiben.
- [x] Doku: AGENTS.md, Tabelle „Befehle“, neue Zeile nach `VERWALTER_IDLE_SECONDS`: „`VITE_VERWALTER_CHAT_PAGE_SIZE` (Umgebungsvariable, nur `pnpm tauri dev`) | Seitengröße beim Nachladen des Verlaufs (1–500, Standard 200); klein gesetzt lässt sich das Nachladen beim Hochscrollen mit kurzen Verläufen prüfen“.

## Report-Back

Phase 1 abgeschlossen. Commit 1 `95af818` (Esc-Zustand), Commit 2 (Typ-Erzeugung als Beispielprogramm, Seitengröße per `VITE_VERWALTER_CHAT_PAGE_SIZE`). `pnpm bindings` ohne Diff in `src/lib/bindings/`, `cargo metadata` zeigt `gen-bindings` als `example`, `pnpm check` grün. Keine Abweichungen, keine Findings.
