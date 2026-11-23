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

0. **Offen bis zur Abnahme:** Der Benutzer wählt einen Vorschlag (A Liste, B Palette, C Vorschau) und einen Einstieg (Fußleiste oder oben); siehe [artifacts/README.md](artifacts/README.md). Die Abnahme legt AK 1, 4 und 5 auf diese Wahl fest. Bis dahin gelten Vorschlag C und der Einstieg „Fußleiste“.
1. Knopf „Vault“ (14 px, Strichstärke 1,5 wie „Archiv“) mit `Ctrl K` rechts (wie `Ctrl N`), Fußleiste: über „Archiv“ in gleicher Bauart; Einstieg oben: Suchzeile „Vault durchsuchen“ unter „Neues Vorhaben“. Nur bei `vaultDir !== null && vaultEnabled`. `Strg+K` (ohne Umschalt/Alt) öffnet denselben Dialog unter derselben Bedingung, sonst passiert nichts.
2. Dialog (Titel „Developer Vault“), von oben nach unten: Statuszeile (Text aus `statusText`, neben dem Titel), Suchfeld mit Fokus beim Öffnen und ⓘ (Text: „Sucht in Titeln, Tags, Dateinamen und Texten. Wortanfänge genügen; mehrere Wörter müssen alle vorkommen.“), Trefferliste, Fußzeile „<n> von <total> Treffern“ (bei `isScanning` ergänzt um „Index wird noch aufgebaut“) und rechts die Tastenhilfe. Entwurf: [artifacts/vault-suchdialog.html](artifacts/vault-suchdialog.html), Beschreibung in [artifacts/README.md](artifacts/README.md).
3. Suche über `vault_find` mit `limit = 50`, entprellt 250 ms; leeres Feld zeigt sofort die zuletzt geänderten Artefakte unter der Gruppenzeile „Zuletzt geändert“.
4. Treffer und Detail nach dem gewählten Vorschlag (Tabelle in artifacts/README.md). Immer: Titel, Art als Wort (mit Symbol in B und C), Pfad (Monospace, von links gekürzt), Beschreibung einzeilig, Ausschnitt mit markierten Fundstellen (`<mark>`). In C zusätzlich Abschnitt und Zeile sowie das Vorschaubild bei Bildern.
5. Bedienung: ↑/↓ wählt, Enter öffnet, Ctrl Enter zeigt im Ordner, Esc schließt; Suchfeld mit Leeren-Knopf; die letzte Suche bleibt beim erneuten Öffnen markiert stehen; „Öffnen“ (primär) und „Im Ordner zeigen“ stehen an fester Stelle, beim Wählen springt das Layout nicht. Klick und Verhalten nach dem Öffnen je nach Vorschlag (README). Unter 576 px ist der Dialog ein Blatt von unten mit Schließen-Knopf, 44-px-Zielen und Tippen = wählen.
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
