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

Lint, Typecheck und Build sind die Qualitätsschranke dieses Projekts — es gibt keine automatisierten Tests. Die Kette läuft lokal und identisch in GitHub Actions:

```text
pnpm lint          ESLint
pnpm typecheck     tsc --noEmit
pnpm format:check  Prettier
cargo fmt --check  (in src-tauri/)
cargo clippy -- -D warnings  (in src-tauri/)
pnpm tauri build   bzw. pnpm build + cargo check
```

Die genauen Skriptnamen werden beim Gerüst in `package.json` angelegt und in der [AGENTS.md](../../AGENTS.md) nachgetragen.

## Regeln

- Warnungen sind Fehler — in ESLint (`--max-warnings 0`) wie in Clippy (`-D warnings`)
- Regel-Ausnahmen nur zeilengenau (`// eslint-disable-next-line <regel> -- <grund>`, `#[allow(clippy::…)]` mit Kommentar), nie datei- oder projektweit ohne ADR

## Critical Rules

1. **Die Prüfkette muss vor jedem Commit grün sein** — sie ist das einzige automatische Sicherheitsnetz.
2. **Keine pauschalen Ausnahmen** — jede abgeschaltete Regel braucht einen Grund an der Stelle.
