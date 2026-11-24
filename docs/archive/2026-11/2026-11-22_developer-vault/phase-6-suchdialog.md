# Phase 6 — Suchdialog

**Stufe:** standard · **Ziel:** Der Benutzer durchsucht den Vault selbst: Knopf „Vault“ im Fuß der Sidebar und `Strg+K` öffnen einen Dialog, der beim Tippen sucht und einen Treffer mit dem Standardprogramm öffnet oder im Ordner zeigt.

**Design:** Entwurf zuerst (Entscheidung des Benutzers bei der Freigabe). Die Phase hat drei Stationen: **Entwurf** — Klickdummy des Suchdialogs als HTML nach `mode-design`, Quellen unter `artifacts/` des Plans samt `artifacts/README.md`, Ausgangspunkt ist die Struktur der AK unten und das Muster des Archiv-Dialogs; **Entwurf abnehmen** — durch den Benutzer; **Umsetzung** — gegen den abgenommenen Entwurf. Weicht der Entwurf von einer AK unten ab, gilt der Entwurf; die Entwurfs-Station passt die AK in dieser Datei an.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans (Kontrakt: `vault_find`, `vault_open`, `VaultHit`) und [ADR 068](../../../decisions/068-developer-vault.md).
- Muster Dialog mit Suche: `src/features/archive/ArchiveDialog.tsx` + `.css`, `useArchiveSearch.ts` (Entprellung 250 ms, leerer Text ohne Verzögerung), Öffnen in `src/app/App.tsx` (`isArchiveOpen`), Knopf in `src/app/Sidebar.tsx` (`sidebar__footer`, `sidebar__archive`).
- Muster Tastenkürzel: Handler für `Strg+P` in `src/app/App.tsx`.
- Muster Öffnen/Im Ordner zeigen: `src-tauri/src/commands/artifacts.rs` (`open_path`, `reveal_item_in_dir`).
- Einstellungen in der Oberfläche: `src/stores/settings.ts`.
- Konventionen: `docs/conventions/react.md`, `docs/conventions/tailwind.md` (BEM + Tokens), `docs/conventions/typescript.md`.
- Fehlerklassen (Vault `frameworks/css-architecture` → „Fehlerklassen“): **Freiraum per Innenabstand reserviert, Liste quillt aus ihrem Feld** — die Trefferliste ist der Scroll-Container mit `min-height: 0` und `overflow: auto`, ohne großen `padding-bottom`.

## Abnahmekriterien der Phase

0. **Abgenommen 2026-11-23:** gegliederter Dialog mit Vorschau rechts (Gruppen links, Liste, Vorschau) und Einstieg 3 „Symbolleiste“ mit dem Kontingent darunter; siehe [artifacts/README.md](artifacts/README.md). In Phase 6 gibt es nur die Gruppe Wissen mit einer Untergruppe je Ordner der ersten Ebene.
1. Fuß der Sidebar in zwei Zeilen: oben eine Symbolleiste aus drei gleich breiten Knöpfen (je 44 px hoch, Symbol 14 px mit Strichstärke 1,5 über der Beschriftung 11 px) „Vault“, „Archiv“, „Einstellungen“; darunter die Zeile „Kontingent“ (`UsageButton` unverändert). „Vault“ trägt `Ctrl K` im Tooltip; fehlt er, teilen sich Archiv und Einstellungen die Zeile zu gleichen Teilen. Der aktive Bereich (Einstellungen offen) ist wie heute hinterlegt. „Vault“ nur bei `vaultDir !== null && vaultEnabled`. `Strg+K` (ohne Umschalt/Alt) öffnet denselben Dialog unter derselben Bedingung, sonst passiert nichts.
2. Dialog (Titel „Developer Vault“), Kopf: Titel, Suchfeld mit Fokus beim Öffnen und ⓘ (Text: „Sucht in Titeln, Tags, Dateinamen und Texten. Wortanfänge genügen; mehrere Wörter müssen alle vorkommen.“), Statuszeile rechts (Text aus `statusText`). Darunter drei Spalten: links Gruppen („Überblick“ bzw. „Alle Treffer“, darunter je Ordner der ersten Ebene mit Anzahl; während einer Suche Trefferzahl, leere fallen weg), Mitte Liste, rechts Vorschau. Unten Fußzeile „<n> von <total> Treffern“ (bei `isScanning` ergänzt um „Index wird noch aufgebaut“) und rechts die Tastenhilfe. Entwurf: [artifacts/vault-suchdialog.html](artifacts/vault-suchdialog.html), Beschreibung in [artifacts/README.md](artifacts/README.md).
3. Suche über `vault_find` mit `limit = 50`, entprellt 250 ms; leeres Feld zeigt sofort die zuletzt geänderten Artefakte unter der Gruppenzeile „Zuletzt geändert“.
4. Liste: je Eintrag Symbol der Art, Titel, Beschreibung einzeilig, Fundstellen markiert (`<mark>`); kein Pfad, keine Art-Marke in der Zeile. Mit Suche Abschnitte je Untergruppe mit Kopf „Wissen › <Ordner>“; unter „Alle Treffer“ höchstens vier je Abschnitt plus „alle n zeigen“ (wechselt die Gruppe). Vorschau: Ort „Wissen › <Ordner>“, Titel, Beschreibung, Knöpfe, darunter Ausschnitt mit Abschnitt und Zeile oder das Vorschaubild bei Bildern, zuletzt der Pfad (Monospace).
5. Bedienung: ↑/↓ wählt, Enter öffnet, Ctrl Enter zeigt im Ordner, Ctrl 0–n wechselt die Gruppe, Esc schließt; Klick wählt, Doppelklick öffnet, der Dialog bleibt nach dem Öffnen offen und bestätigt in der Fußzeile; Suchfeld mit Leeren-Knopf; die letzte Suche bleibt beim erneuten Öffnen markiert stehen; „Öffnen“ (primär) und „Im Ordner zeigen“ stehen fest oben in der Vorschau, beim Wählen springt das Layout nicht. Unter 1180 px Breite öffnet die Vorschau als zweite Stufe mit Zurück-Knopf; unter 768 px ersetzen Chips die linke Spalte; unter 576 px ist der Dialog ein Blatt von unten mit Schließen-Knopf, 44-px-Zielen und Tippen = wählen.
6. Leer: ohne Text und ohne Artefakte „Der Vault ist noch leer.“; mit Text ohne Treffer „Nichts gefunden.“; Fehler als Satz über der Liste.
7. `vault_open(path, reveal)` öffnet nur Pfade, die `vault_get` auch erlauben würde (eingelesene Datei oder Ordner darüber); sonst Fehlersatz wie dort.
8. `pnpm check` grün.

## Checkliste

### Core

- [x] `commands/vault.rs`: `vault_find(query: VaultQuery) -> VaultSearchResult` (begrenzt `limit` auf 1–50) und `vault_open(path: String, reveal: bool)`; Pfadprüfung aus `vault_get` in eine gemeinsame Funktion `vault::resolve(app, rel) -> Result<PathBuf, String>` ziehen und von beiden nutzen; registrieren.
- [x] `VaultQuery`, `VaultHit`, `VaultSearchResult` mit `derive(TS)`, in `gen-bindings.rs`, `pnpm bindings`.

### Oberfläche

- [x] `src/lib/vault.ts`: `findInVault(query)`, `openVaultPath(path, reveal)`.
- [x] `src/features/vault/useVaultSearch.ts` nach AK 3 (Muster `useArchiveSearch`).
- [x] `src/features/vault/snippetSegments.ts`: zerlegt einen Ausschnitt an ``/`` in `{ text, isMatch }[]`.
- [x] `src/features/vault/VaultHitRow.tsx` nach AK 4–5, `src/features/vault/VaultSearchDialog.tsx` + `VaultSearchDialog.css` (BEM `vault-search__…`) nach AK 2, 5, 6.
- [x] `src/app/Sidebar.tsx` + `Sidebar.css`: Fuß nach AK 1 umbauen — Symbolleiste `sidebar__toolbar` mit `sidebar__tool` (Vault, Archiv, Einstellungen; ersetzt die bisherigen Zeilen Archiv und Einstellungen), `UsageButton` darunter; Prop `onOpenVault`; `src/app/App.tsx`: `isVaultOpen`, Kürzel nach AK 1, Dialog einhängen.

### Doku

- [x] `docs/code-map.md`: Dialog, Hooks und Sidebar-Knopf in der Zeile „Developer Vault“.
- [x] `docs/glossary.md`: „Vault-Suche“ (Dialog, `Strg+K`).

## Report-Back

**Status:** complete (2026-11-24). `pnpm check` grün; nicht in der echten App gelaufen.

- Core: `vault_find`, `vault_open`, `vault_preview` (zusätzlich zum Kontrakt: liefert ein Bild des Vault als `data:`-Adresse, weil der Asset-Bereich der App den Vault-Ordner nicht umfasst und nicht erweitert wurde). Gemeinsame Pfadprüfung `vault/resolve.rs` (`locate`, `resolve`) für `vault_get`, `vault_open` und `vault_preview`.
- Oberfläche: `src/features/vault/VaultSearchDialog.tsx` und Zubehör; Fuß der Seitenleiste als Symbolleiste (`sidebar__toolbar`); `Strg+K` in `App.tsx`.
- Abweichungen vom Entwurf: Vorschau zeigt kein „Anfang“ ohne Suche (der Core liefert dort keinen Text); Untergruppen und Zahlen links zählen nur die geladenen höchstens 50 Treffer (Fuß zeigt bei gekürzter Untergruppe „n+“); Haltepunkte der Breiten gelten für die Fensterbreite, nicht für eine Container-Breite; Bilder zeigen nur Artefakte der Art `image` (das `preview`-Feld aus dem Manifest wird noch nicht geladen); Öffnen und Im Ordner zeigen gelten für die Datei des besten Abschnitts (`file`).

