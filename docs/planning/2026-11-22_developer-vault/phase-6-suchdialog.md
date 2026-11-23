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

0. **Offen bis zur Abnahme:** Der Benutzer wählt einen Einstieg (1 Suchzeile oben, 2 Paar im Fuß, 3 Symbolleiste); siehe [artifacts/README.md](artifacts/README.md). Die Abnahme legt AK 1 auf diese Wahl fest; bis dahin gilt Einstieg 1. Der Dialog ist gegliedert (Gruppen links, Liste, Vorschau); in Phase 6 gibt es nur die Gruppe Wissen mit einer Untergruppe je Ordner der ersten Ebene.
1. Knopf „Vault“ (14 px, Strichstärke 1,5 wie „Archiv“) mit `Ctrl K` rechts (wie `Ctrl N`), angeordnet nach dem gewählten Einstieg; der Fuß mit Kontingent wächst nicht über drei Zeilen. Nur bei `vaultDir !== null && vaultEnabled`. `Strg+K` (ohne Umschalt/Alt) öffnet denselben Dialog unter derselben Bedingung, sonst passiert nichts.
2. Dialog (Titel „Developer Vault“), Kopf: Titel, Suchfeld mit Fokus beim Öffnen und ⓘ (Text: „Sucht in Titeln, Tags, Dateinamen und Texten. Wortanfänge genügen; mehrere Wörter müssen alle vorkommen.“), Statuszeile rechts (Text aus `statusText`). Darunter drei Spalten: links Gruppen („Überblick“ bzw. „Alle Treffer“, darunter je Ordner der ersten Ebene mit Anzahl; während einer Suche Trefferzahl, leere fallen weg), Mitte Liste, rechts Vorschau. Unten Fußzeile „<n> von <total> Treffern“ (bei `isScanning` ergänzt um „Index wird noch aufgebaut“) und rechts die Tastenhilfe. Entwurf: [artifacts/vault-suchdialog.html](artifacts/vault-suchdialog.html), Beschreibung in [artifacts/README.md](artifacts/README.md).
3. Suche über `vault_find` mit `limit = 50`, entprellt 250 ms; leeres Feld zeigt sofort die zuletzt geänderten Artefakte unter der Gruppenzeile „Zuletzt geändert“.
4. Liste: je Eintrag Symbol der Art, Titel, Beschreibung einzeilig, Fundstellen markiert (`<mark>`); kein Pfad, keine Art-Marke in der Zeile. Mit Suche Abschnitte je Untergruppe mit Kopf „Wissen › <Ordner>“; unter „Alle Treffer“ höchstens vier je Abschnitt plus „alle n zeigen“ (wechselt die Gruppe). Vorschau: Ort „Wissen › <Ordner>“, Titel, Beschreibung, Knöpfe, darunter Ausschnitt mit Abschnitt und Zeile oder das Vorschaubild bei Bildern, zuletzt der Pfad (Monospace).
5. Bedienung: ↑/↓ wählt, Enter öffnet, Ctrl Enter zeigt im Ordner, Ctrl 0–n wechselt die Gruppe, Esc schließt; Klick wählt, Doppelklick öffnet, der Dialog bleibt nach dem Öffnen offen und bestätigt in der Fußzeile; Suchfeld mit Leeren-Knopf; die letzte Suche bleibt beim erneuten Öffnen markiert stehen; „Öffnen“ (primär) und „Im Ordner zeigen“ stehen fest oben in der Vorschau, beim Wählen springt das Layout nicht. Unter 1180 px Breite öffnet die Vorschau als zweite Stufe mit Zurück-Knopf; unter 768 px ersetzen Chips die linke Spalte; unter 576 px ist der Dialog ein Blatt von unten mit Schließen-Knopf, 44-px-Zielen und Tippen = wählen.
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
