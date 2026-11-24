# Phase 3 — Suchdialog mit Anweisungen, Skills und Wissen

**Stufe:** standard · **Wave:** 3 · **Status:** complete · **Sichtabnahme:** Suchdialog „Bibliothek“ (Strg K) und Knopf „Bibliothek“ in der Symbolleiste der Seitenleiste

Der Suchdialog gliedert die Treffer nach den Gruppen aus Phase 1 (`VaultHit.group`, `VaultHit.subgroup`) so, wie der abgenommene Entwurf es in der Stufe „Bibliothek“ zeigt. Titel und Knopf heißen „Bibliothek“.

## Kontext (vor dem Start lesen)

- Plan-README: „Kontrakt“ (Tabelle von `place`: Gruppen- und Untergruppen-Ids).
- Entwurf: [artifacts/README.md](artifacts/README.md) → Suchdialog; Quelle `docs/archive/2026-11/2026-11-22_developer-vault/artifacts/vault-suchdialog.html` mit Entwurfsleiste „Ausbau: Bibliothek“ (Konstante `GROUPS`, Funktionen für Liste, Navigation und Vorschau) und deren `README.md` (Tabellen „Aufbau“ und „Gruppen und Untergruppen“, Abschnitt Bedienung).
- `src/features/vault/vaultGroups.ts`, `VaultSearchDialog.tsx`, `VaultSearchDialog.css`, `VaultHitRow.tsx`, `VaultPreview.tsx`, `VaultIcons.tsx`, `useVaultSearch.ts`; `src/app/Sidebar.tsx` (Knopf „Vault“, um Zeile 525–541); `src/styles/theme.css` (Blöcke `:root`, `@media (prefers-color-scheme: dark) :root:not(.light)`, `:root.dark`).
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`, `docs/code-map.md`.
- Fehlerklassen geprüft (`sprachen/typescript`, `frameworks/react`): keine einschlägig.

## Abnahmekriterien der Phase

1. Dialogtitel „Bibliothek“; Suchfeld `aria-label` „Bibliothek durchsuchen“; Knopf in der Seitenleiste beschriftet „Bibliothek“, `title` „Bibliothek durchsuchen (Ctrl K)“.
2. Linke Spalte: „Überblick“ bzw. „Alle Treffer“ mit Zahl, darunter die Gruppen in der Reihenfolge Anweisungen, Skills, Wissen — je Kopf mit Symbol, Name, Zahl und den Untergruppen mit Zahl. Gruppen und Untergruppen ohne Einträge im aktuellen Treffersatz fehlen.
3. Untergruppen von Anweisungen in der Reihenfolge Grundregeln, Ausgabestile, Gedächtnis; von Skills: Arbeitsweise, Sprachen, Frameworks, Werkzeuge, Befehle; von Wissen: Ordnernamen alphabetisch, „Hauptordner“ zuletzt.
4. Mit Suche und „Alle“: Abschnitte je Untergruppe in derselben Reihenfolge, je höchstens vier Einträge plus „alle n zeigen“; Klick darauf wählt die Untergruppe. Ohne Suche und ohne Gruppenwahl: „Zuletzt geändert“ (10) wie bisher.
5. Ctrl 0 wählt „Alle“, Ctrl 1–3 die erste bis dritte **vorhandene** Gruppe; die Tastenhilfe im Fuß zeigt „Ctrl 0–n“ mit n = Zahl der vorhandenen Gruppen.
6. Vorschau rechts: Ort „Gruppe › Untergruppe“ (Wissen ohne Ordner: „Wissen › Hauptordner“).
7. Gruppenfarben: Symbol im Gruppenkopf in `--color-group-rules`, `--color-group-skills`, `--color-group-knowledge`; hell `#3d6fa8`, `#7c3aed`, `#16803c`, dunkel `#8ab8ea`, `#a78bfa`, `#4cc38a`.
8. Trefferzeilen: Art `skill` und `command` mit Stern-Symbol, `rules`, `style` und `memory` mit Dokument-Symbol (Pfade aus `GROUPS` im Entwurf); übrige Arten wie bisher.
9. Bei einem reinen Vault gibt es nur die Gruppe Wissen, Untergruppe = erster Ordner im Pfad — Verhalten wie vor dem Plan.
10. Breakpoints wie bisher: unter 1180 px Vorschau als zweite Stufe; unter 768 px Chips „Alle, Anweisungen, Skills, Wissen“ (nur vorhandene) statt der linken Spalte; unter 576 px Blatt von unten.
11. `pnpm check` grün.

## Checkliste

### `vaultGroups.ts`

- [ ] `VAULT_GROUPS` ersetzen durch `LIBRARY_GROUPS` (`as const`): `{ id: 'anweisungen', label: 'Anweisungen', subs: [['grundregeln', 'Grundregeln'], ['ausgabestile', 'Ausgabestile'], ['gedaechtnis', 'Gedächtnis']] }`, `{ id: 'skills', label: 'Skills', subs: [['arbeitsweise', 'Arbeitsweise'], ['sprachen', 'Sprachen'], ['frameworks', 'Frameworks'], ['werkzeuge', 'Werkzeuge'], ['befehle', 'Befehle']] }`, `{ id: 'wissen', label: 'Wissen', subs: [] }` (Wissen-Untergruppen kommen aus den Treffern).
- [ ] Scope-Format: `all` · `<group>` · `<group>/<subgroup>` (Untergruppe darf leer sein: `wissen/`). Funktionen: `scopeOfGroup(group)`, `scopeOfSubgroup(group, subgroup)`, `parseScope(scope): { group: string | null; subgroup: string | null }`, `inScope(hit, scope)` (vergleicht `hit.group`/`hit.subgroup`).
- [ ] `subgroupLabel(group, subgroup)`: Label aus `LIBRARY_GROUPS`; für `wissen` der Ordnername, leer → „Hauptordner“.
- [ ] `groupCounts(hits): GroupCount[]` mit `GroupCount = { group: string; label: string; count: number; subs: { subgroup: string; label: string; count: number }[] }` — Gruppen in `LIBRARY_GROUPS`-Reihenfolge, nur mit Zahl > 0; Untergruppen nach AK 3. Ersetzt `folderCounts` und `VaultFolderCount`.
- [ ] `buildSections(hits, scope, hasQuery)`: Verhalten wie bisher, Abschnitte aber je `(group, subgroup)` in der Reihenfolge von `groupCounts`; `key` = `<group>/<subgroup>`; `label` = `subgroupLabel` (in einer gewählten Untergruppe `null`). `folderOf`, `folderLabel`, `scopeOfFolder`, `scopeFolder` entfallen, sofern sie danach unbenutzt sind.

### `VaultSearchDialog.tsx` und CSS

- [ ] `GROUP_ID` entfällt; `groups = useMemo(() => groupCounts(search.hits), …)`. Ein gewählter Scope, den es im Treffersatz nicht gibt, fällt auf `all` zurück (wie bisher für Ordner).
- [ ] Navigation: je Eintrag aus `groups` ein `vault-search__nav-group` mit Kopf (Symbol nach Gruppe: Anweisungen `RulesIcon`, Skills `SkillIcon`, Wissen `BookIcon`; Klasse `vault-search__nav-head--<group>` für die Farbe) und `vault-search__nav-subs`.
- [ ] `handleKeyDown`: Ctrl 1–n wählt `scopeOfGroup(groups[n-1].group)`, wenn vorhanden. Fuß: `Ctrl 0–{groups.length}`.
- [ ] Titel, `aria-label` und Kommentar nach AK 1; Bereichsbeschriftung der Vorschau nach AK 6 (`VaultPreview.tsx`, Ort aus `hit.group`/`hit.subgroup` über `LIBRARY_GROUPS`-Label und `subgroupLabel`).
- [ ] Schmale Ansicht (Chips unter 768 px): Chips aus `groups` statt der festen Liste.
- [ ] `VaultSearchDialog.css`: `.vault-search__nav-head--anweisungen svg { color: var(--color-group-rules); }`, `--skills` → `--color-group-skills`, `--wissen` → `--color-group-knowledge`.
- [ ] `src/styles/theme.css`: die drei Tokens in `:root` (hell) und in beiden Dunkel-Blöcken mit den Werten aus AK 7.

### Symbole und Seitenleiste

- [ ] `VaultIcons.tsx`: `RulesIcon` (Pfad `M3 1.5h6l2.5 2.5v8.5H3zM5 6h4.5M5 8.5h4.5M5 11h2.5`) und `SkillIcon` (Pfad `M7 1.5 8.4 5l3.6.3-2.8 2.3.9 3.6L7 9.3l-3.1 1.9.9-3.6L2 5.3 5.6 5z`) über `Frame`; `KindIcon`: `skill`, `command` → Stern, `rules`, `style`, `memory` → Dokument.
- [ ] `Sidebar.tsx`: Beschriftung und `title` nach AK 1; das Symbol bleibt.

### Doku

- [ ] `docs/code-map.md`, Zeile Bibliothek: Suchdialog mit Gruppen Anweisungen, Skills, Wissen; `vaultGroups.ts` (`LIBRARY_GROUPS`, `groupCounts`).
- [ ] `docs/konzept-vault.md`: im Abschnitt zum Bestand einen Satz, dass Master-Ordner und Vault seit ADR 069 ein Ordner (Bibliothek) sind, Wissen unter `_vault/`.
- [ ] `docs/decisions/068-developer-vault.md`: Statuszeile „angenommen · teilweise abgelöst durch ADR 069 (Ordner, Erlaubnisliste, Grundgerüst)“.

## Definition of Done

- AK 1–11 erfüllt; Belege im Report-Back.
- **Sichtbares Ergebnis:** Strg K öffnet „Bibliothek“; die Suche nach „Plan“ zeigt links Skills › Arbeitsweise und Befehle sowie Wissen-Treffer, die Vorschau nennt den Ort.
- **Reviewable Artifact:** `artifacts/phase-3-ueberblick.png` (ohne Suche), `artifacts/phase-3-suche-plan.png` (Suche „Plan“, Alle), `artifacts/phase-3-dunkel.png`, `artifacts/phase-3-schmal.png` (unter 768 px).
- Kommandos: `pnpm check` (Zusammenfassungszeile), `pnpm tauri dev` für die Bilder.
- Dateien: Code-Map, Konzept, ADR 068 nachgezogen.
- Sieben Ziele kurz geprüft.

## Report-Back

- Umgesetzt: `vaultGroups.ts` (`LIBRARY_GROUPS`, `groupCounts`, `parseScope`, `inScope`, `subgroupLabel`), Dialog mit Gruppen und Untergruppen links, Chips unter 768 px aus den vorhandenen Gruppen, Ctrl 0–n nach vorhandenen Gruppen, Ort in der Vorschau, Symbole `RulesIcon`/`SkillIcon`/`GroupIcon`, Tokens `--color-group-*` in drei Blöcken, Titel und Knopf „Bibliothek“.
- Belege: `pnpm check` grün (Exit 0). AK 1–10 am Code abgeglichen; Bilder und Lauf in der echten App nicht erstellt (Profil private).
- Findings: das Inbox-Finding betrifft den Dialog nicht (er zeigt keinen Inbox-Status) → Follow-up in der README.
