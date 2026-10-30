# Linting Conventions — verwalter

> **Stack** (für dieses Projekt festgelegt):
> | Layer | Choice |
> |---|---|
> | TS/React | ESLint (Flat Config) + `typescript-eslint` (strict, type-checked) + `eslint-plugin-react-hooks` |
> | Formatierung TS | Prettier |
> | Rust | `cargo clippy -- -D warnings`, `rustfmt` |
> | Typecheck | `tsc --noEmit` |
>
> Projektentscheidungen in dieser Datei haben Vorrang.

## Prüfkette

Lint, Typecheck und Build sind die Qualitätsschranke dieses Projekts — es gibt keine automatisierten Tests. `pnpm check` fährt die Kette lokal, [.github/workflows/check.yml](../../.github/workflows/check.yml) identisch in GitHub Actions (plus die Bindings-Prüfung, siehe unten):

```text
pnpm lint          ESLint
pnpm typecheck     tsc für App und Vite-Konfiguration
pnpm format:check  Prettier
pnpm build         tsc + Vite-Build
pnpm rust:fmt      cargo fmt --check
pnpm rust:clippy   cargo clippy --all-targets -- -D warnings
```

`pnpm build` steht vor Clippy, weil ein Release-Build des Tauri-Kerns `dist/` erwartet; im Debug-Profil (Clippy, `pnpm bindings`) ist das nicht nötig — die Reihenfolge ist Vorsicht, keine Pflicht.

In CI folgt als letzter Schritt `pnpm bindings` und die Prüfung, dass `src/lib/bindings/` dadurch unverändert bleibt — ein Typ im Core ohne nachgezogene Bindings lässt den Lauf rot werden.

## Voraussetzungen

Kein CMake, kein LLVM. Zusätzlich zu Rust braucht der Bau unter Windows:

- **Ein aktuelles v143-Werkzeugset** (VS 2022 Build Tools mit MSVC ab 14.4x, gebaut mit `VsDevCmd.bat -arch=amd64`). Das Diktieren ([ADR 049](../decisions/049-sprachdiktat-parakeet.md)) linkt eine fertige ONNX-Runtime-Bibliothek, die neuere STL-Funktionen verlangt; mit VS 2019 und mit Toolset 14.38 scheitert der Link mit LNK2019.
- **Netz zu `cdn.pyke.io`** beim ersten Bau: `ort-sys` lädt die Bibliothek dort herunter (Ausweg: `ORT_LIB_PATH`).

## Regeln

- Warnungen sind Fehler — in ESLint (`--max-warnings 0`) wie in Clippy (`-D warnings`)
- Regel-Ausnahmen nur zeilengenau (`// eslint-disable-next-line <regel> -- <grund>`, `#[allow(clippy::…)]` mit Kommentar), nie datei- oder projektweit ohne ADR

## Critical Rules

1. **Die Prüfkette muss vor jedem Commit grün sein** — sie ist das einzige automatische Sicherheitsnetz.
2. **Keine pauschalen Ausnahmen** — jede abgeschaltete Regel braucht einen Grund an der Stelle.
