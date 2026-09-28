# 002 — Typ-Generierung Rust → TypeScript und virtualisierte Listen

**Status:** angenommen · **Datum:** 2026-09-28

## Kontext

Typen, die zwischen Core und Oberfläche wandern, sollen im Rust-Core definiert und nach TypeScript generiert werden ([ADR 001](001-stack-und-plattform.md), [rust.md](../conventions/rust.md)). Das Werkzeug dafür war offen ([PROJECT.md](../PROJECT.md) → offene Fragen). Ebenso offen war die Bibliothek für virtualisierte Listen ([react.md](../conventions/react.md) → „Bibliothek beim Gerüst festlegen“). Das Projekt hat bewusst keine automatisierten Tests.

## Optionen

- **`ts-rs` 12.0.1** — stabile Version, erzeugt nur die Typen. Export entweder über `#[ts(export)]` (läuft als Test über `cargo test`) oder programmatisch über `TS::export_all`.
- **`tauri-specta`** — erzeugt Typen und die Aufruf-Wrapper für Tauri Commands in einem Schritt, steht aber seit Jahren auf `2.0.0-rc.25` ohne stabile Version.

## Entscheidung

- **`ts-rs` 12.0.1, exakt gepinnt.** Export über das Hilfsprogramm `src-tauri/src/bin/gen-bindings.rs` (`pnpm bindings`), das `TS::export_all` für jeden Grenz-Typ aufruft. Kein `#[ts(export)]`, weil das über `cargo test` läuft und es keine Tests gibt. Ziel: `src/lib/bindings/`, im Repo eingecheckt.
- **Aufruf-Wrapper von Hand**, eine Datei pro Feature in `src/lib/<feature>.ts`, die `invoke` mit den generierten Typen kapselt.
- **Virtualisierte Listen: `@tanstack/react-virtual`** — ohne eigenes Styling, passt zu BEM. Installiert wird sie mit der ersten virtualisierten Liste.

## Konsequenzen

- Der Command-Name steht im Wrapper als handgepflegter String. Wrapper und `generate_handler!` in `lib.rs` werden deshalb immer im selben Commit geändert.
- Jeder neue Typ, der die Tauri-Grenze überquert, wird in `gen-bindings.rs` eingetragen; danach `pnpm bindings` und die erzeugten Dateien mit committen.
- CI prüft, dass die eingecheckten Bindings dem Stand des Codes entsprechen.
- Ein späterer Wechsel auf `tauri-specta` bleibt möglich, sobald es stabil ist; die Wrapper-Dateien wären dann das, was wegfällt.
