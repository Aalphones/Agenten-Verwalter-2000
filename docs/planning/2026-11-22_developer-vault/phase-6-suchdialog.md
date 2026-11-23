# Phase 6 — Suchdialog

**Stufe:** standard · **Ziel:** Der Benutzer durchsucht den Vault selbst: Knopf „Vault“ im Fuß der Sidebar und `Strg+K` öffnen einen Dialog, der beim Tippen sucht und einen Treffer mit dem Standardprogramm öffnet oder im Ordner zeigt.

**Design:** Entwurf zuerst (Entscheidung des Benutzers bei der Freigabe). Die Phase hat drei Stationen: **Entwurf** — Klickdummy des Suchdialogs als HTML nach `mode-design`, Quellen unter `docs/planning/2026-11-22_developer-vault/artifacts/` samt `artifacts/README.md`, Ausgangspunkt ist die Struktur der AK unten und das Muster des Archiv-Dialogs; **Entwurf abnehmen** — durch den Benutzer; **Umsetzung** — gegen den abgenommenen Entwurf. Weicht der Entwurf von einer AK unten ab, gilt der Entwurf; die Entwurfs-Station passt die AK in dieser Datei an.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans (Kontrakt: `vault_find`, `vault_open`, `VaultHit`) und [ADR 068](../../decisions/068-developer-vault.md).
- Muster Dialog mit Suche: `src/features/archive/ArchiveDialog.tsx` + `.css`, `useArchiveSearch.ts` (Entprellung 250 ms, leerer Text ohne Verzögerung), Öffnen in `src/app/App.tsx` (`isArchiveOpen`), Knopf in `src/app/Sidebar.tsx` (`sidebar__footer`, `sidebar__archive`).
- Muster Tastenkürzel: Handler für `Strg+P` in `src/app/App.tsx`.
- Muster Öffnen/Im Ordner zeigen: `src-tauri/src/commands/artifacts.rs` (`open_path`, `reveal_item_in_dir`).
- Einstellungen in der Oberfläche: `src/stores/settings.ts`.
- Konventionen: `docs/conventions/react.md`, `docs/conventions/tailwind.md` (BEM + Tokens), `docs/conventions/typescript.md`.
- Fehlerklassen (Vault `frameworks/css-architecture` → „Fehlerklassen“): **Freiraum per Innenabstand reserviert, Liste quillt aus ihrem Feld** — die Trefferliste ist der Scroll-Container mit `min-height: 0` und `overflow: auto`, ohne großen `padding-bottom`.

## Abnahmekriterien der Phase

1. Knopf „Vault“ (Buch-Symbol, 14 px, Strichstärke 1,5 wie „Archiv“) im Fuß der Sidebar links neben „Archiv“, nur bei `vaultDir !== null && vaultEnabled`. `Strg+K` (ohne Umschalt/Alt) öffnet denselben Dialog unter derselben Bedingung, sonst passiert nichts.
2. Dialog (Titel „Developer Vault“), von oben nach unten: Statuszeile (Text aus `statusText`, neben dem Titel), Suchfeld mit Fokus beim Öffnen und ⓘ (Text: „Sucht in Titeln, Tags, Dateinamen und Texten. Wortanfänge genügen; mehrere Wörter müssen alle vorkommen.“), Trefferliste, Fußzeile „<n> von <total> Treffern“ (bei `isScanning` ergänzt um „Index wird noch aufgebaut“) und rechts die Tastenhilfe. Entwurf: [artifacts/vault-suchdialog.html](artifacts/vault-suchdialog.html), Beschreibung in [artifacts/README.md](artifacts/README.md).
3. Suche über `vault_find` mit `limit = 50`, entprellt 250 ms; leeres Feld zeigt sofort die zuletzt geänderten Artefakte unter der Gruppenzeile „Zuletzt geändert“.
4. Trefferzeile: Titel (fett) und Art als Marke in der ersten Zeile; Pfad (Monospace, gedämpft) in der zweiten; Beschreibung einzeilig mit Auslassung; Ausschnitt mit markierten Fundstellen (`<mark>`), höchstens zwei Zeilen.
5. Bedienung: ↑/↓ wählt die Zeile, Enter öffnet, Strg+Enter zeigt im Ordner, Esc schließt; ab 576 px Breite wählt und öffnet ein Klick auf die Zeile, darunter wählt er nur; in der gewählten Zeile die Knöpfe „Öffnen“ und „Im Ordner zeigen“. Der Dialog bleibt nach dem Öffnen offen, die Fußzeile bestätigt („Geöffnet: <Dateiname>“). Unter 576 px ist der Dialog ein Blatt von unten mit Schließen-Knopf und 44-px-Zielen. Breite 40 rem.
6. Leer: ohne Text und ohne Artefakte „Der Vault ist noch leer.“; mit Text ohne Treffer „Nichts gefunden.“; Fehler als Satz über der Liste.
7. `vault_open(path, reveal)` öffnet nur Pfade, die `vault_get` auch erlauben würde (eingelesene Datei oder Ordner darüber); sonst Fehlersatz wie dort.
8. `pnpm check` grün.

## Checkliste

### Core

- [ ] `commands/vault.rs`: `vault_find(query: VaultQuery) -> VaultSearchResult` (begrenzt `limit` auf 1–50) und `vault_open(path: String, reveal: bool)`; Pfadprüfung aus `vault_get` in eine gemeinsame Funktion `vault::resolve(app, rel) -> Result<PathBuf, String>` ziehen und von beiden nutzen; registrieren.
- [ ] `VaultQuery`, `VaultHit`, `VaultSearchResult` mit `derive(TS)`, in `gen-bindings.rs`, `pnpm bindings`.

### Oberfläche

- [ ] `src/lib/vault.ts`: `findInVault(query)`, `openVaultPath(path, reveal)`.
- [ ] `src/features/vault/useVaultSearch.ts` nach AK 3 (Muster `useArchiveSearch`).
- [ ] `src/features/vault/snippetSegments.ts`: zerlegt einen Ausschnitt an ``/`` in `{ text, isMatch }[]`.
- [ ] `src/features/vault/VaultHitRow.tsx` nach AK 4–5, `src/features/vault/VaultSearchDialog.tsx` + `VaultSearchDialog.css` (BEM `vault-search__…`) nach AK 2, 5, 6.
- [ ] `src/app/Sidebar.tsx`: Prop `onOpenVault`, Knopf `sidebar__vault` nach AK 1; `src/app/App.tsx`: `isVaultOpen`, Kürzel nach AK 1, Dialog einhängen.

### Doku

- [ ] `docs/code-map.md`: Dialog, Hooks und Sidebar-Knopf in der Zeile „Developer Vault“.
- [ ] `docs/glossary.md`: „Vault-Suche“ (Dialog, `Strg+K`).

## Report-Back
