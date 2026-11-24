# Bibliothek: eine Ansicht statt acht Zeilen

Die Zusammenlegung (ADR 069, Plan `docs/archive/2026-11/2026-11-24_bibliothek/`) hat nur die Einstellung vereint (`library_dir`), die Oberfläche nicht: Die Kategorie „Skills & Umgebung“ zeigt weiter acht Zeilen in zwei Abschnitten, und „Benutzer-Skills“ sieht aus wie ein zweiter Pfad. Ziel: ein Pfad (der Ordner der Bibliothek), eine Zeile Abgleich mit einem Knopf, eine Zeile Suche. Entscheidungen des Benutzers (2026-11-24): lokaler Skill-Ordner nur noch als Status, Abgleich und Verknüpfungen in eine Zeile mit einem Knopf, Projekt-Skills raus aus den Einstellungen, Suche auf eine Zeile.

## Overview

| Phase | Titel | Rating | Status |
|---|---|---|---|
| 1 | Abschnitt „Bibliothek“ auf drei Zeilen | standard | pending |

Nur Oberfläche; Core, Bindings und Einstellungsschlüssel bleiben unverändert.

## Finale AK

1. Kategorie in der Leiste heißt „Bibliothek“, Kurzbeschreibung „Ordner · Abgleich · Suche“ (Id bleibt `skills`). Sie hat genau einen Abschnitt „Bibliothek“ mit höchstens drei Zeilen in dieser Reihenfolge: „Ordner“ (immer) · „Abgleich“ (immer) · „Suche“ (nur mit Ordner). Die Zeilen „Benutzer-Skills“, „Projekt-Skills“, „Abgleich der Skills“, „Verknüpfungen“, „Suchindex“ und „Durchsucht“ gibt es nicht mehr.
2. Wählbar ist nur ein Pfad: der Ordner in der Zeile „Ordner“ (unverändert: „Wählen …“ bzw. „Ändern …“ + „Entfernen“).
3. „Abgleich“ zeigt in der ersten Zeile den Zustand und genau einen Knopf: weicht etwas ab → Warnsatz + Knopf „Abgleichen“ (kopiert, löscht nie), sonst „Gleich …“ bzw. der Grund, warum nicht abgeglichen wird, + Knopf „Erneut prüfen“. Darunter eine gedämpfte Zeile „Lokal <Pfad des lokalen Skill-Ordners> · <n> Skills · <Satz zu den Verknüpfungen>“. Kaputte Verknüpfungen stehen darunter einzeln.
4. „Suche“ ist eine Zeile: Schalter; aus → „aus · kein Einstieg, Ctrl K ohne Wirkung“; an → Stand des Suchindex („bereit · 380 Dateien · …“) und daneben „Neu einlesen“ bzw. „Grundgerüst anlegen“ wie bisher. Was durchsucht wird, steht im ⓘ.
5. Jede der drei Zeilen hat ihr ⓘ mit dem Text aus der Checkliste.
6. Die Anzahl der Skills je Repository steht weiter in der Repository-Auswahl beim Anlegen eines Vorhabens (`RepositoryPicker`, unverändert).
7. `pnpm check` grün.

## Phase 1 — Abschnitt „Bibliothek“ auf drei Zeilen

### Kontext (vor dem Start lesen)

- Dieser Plan (Abschnitt oben), [ADR 069](../decisions/069-bibliothek.md), [ADR 038](../decisions/038-umgebung.md), [ADR 054](../decisions/054-einstellungen-kategorien-und-suche.md) (Katalog, Kategorien).
- `src/features/settings/settingsCatalog.ts` (`SETTINGS_CATEGORIES`, `ENTRY_DATA`, `hasLibraryDir`, `isSearchOn`), `src/features/settings/SettingsView.tsx` (`renderRow` Fälle `userSkills`, `projectSkills`, `environmentLinks`, `libraryDir`, `environmentMirror`, `vaultEnabled`, `vaultStatus`, `libraryScope`; `projectSkillsText`, `renderRevealButton`, `skillCountLabel`, `hasProjectSkills`, `useKnownRepositories`), `src/features/settings/SettingRow.tsx`.
- `src/features/environment/EnvironmentMirrorRow.tsx`, `EnvironmentLinksRow.tsx`, `environmentTexts.ts`, `useEnvironment.ts`, `EnvironmentRows.css`.
- `src/features/vault/VaultStatusRow.tsx`, `LibraryScopeRow.tsx`, `LibraryDirRow.tsx` (bleibt), `vaultTexts.ts`, `useVaultStatus.ts`, `VaultRows.css`.
- `src/features/repositories/RepositoryPicker.tsx:164` (zeigt `skillLabel(repository.skillCount)` — deshalb dürfen die Projekt-Skills aus den Einstellungen verschwinden).
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/code-map.md` (Zeile „Bibliothek“), `docs/glossary.md` („Spiegeln“).
- Fehlerklassen geprüft (`sprachen/typescript`, `frameworks/react`): keine einschlägig.

### Verstanden, bevor es wegfällt

- `userSkills`: zeigt `overview.userSkillsDir` (lokaler `~\.claude\skills`) samt Anzahl und Explorer-Knopf — reine Anzeige, keine Einstellung. Wandert als Statuszeile in „Abgleich“; der Explorer-Knopf entfällt.
- `projectSkills`: zählt Skills je bekanntem Repository — reine Anzeige; dieselbe Zahl zeigt die Repository-Auswahl.
- `environmentLinks`: meldet Junctions/Symlinks unter `~\.claude` ohne Ziel; Prüfung lief schon über dasselbe `useEnvironment().check` wie der Abgleich. Wandert in „Abgleich“.
- `vaultStatus`/`libraryScope`: Stand des Index und feste Liste der durchsuchten Teile. Stand wandert in die Zeile „Suche“, die Liste ins ⓘ.

### Checkliste

**Katalog** (`settingsCatalog.ts`)

- [ ] Kategorie `skills`: `label: 'Bibliothek'`, `summary: 'Ordner · Abgleich · Suche'`.
- [ ] Einträge `userSkills`, `projectSkills`, `environmentMirror`, `environmentLinks`, `vaultStatus`, `libraryScope` löschen; `isSearchOn` löschen (danach unbenutzt).
- [ ] Neuer Eintrag `libraryMirror` direkt nach `libraryDir`: `category: 'skills'`, `section: 'Bibliothek'`, `label: 'Abgleich'`, ohne `isShown`, `info:` „Vergleicht Skills, Befehle, Ausgabestile und CLAUDE.md im Ordner der Bibliothek mit ~\\.claude nach Inhalt; die Änderungszeit entscheidet nur, welche Seite neuer ist. „Abgleichen“ kopiert, was im Ordner neuer ist oder lokal fehlt, und löscht nie. Die Zeile darunter zeigt den lokalen Skill-Ordner, den jede Session nutzt, und ob die Verknüpfungen (Junctions und symbolische Links unter ~\\.claude und dessen Unterordnern) ihr Ziel erreichen.“
- [ ] `vaultEnabled` bleibt (`label: 'Suche'`, `isShown: hasLibraryDir`), neuer `info:` „Schaltet Einlesen, Suche (Seitenleiste und Strg+K) und die Werkzeuge der Agenten ein; der Abgleich läuft unabhängig davon. Eingelesen wird beim Start und vor einer Suche, wenn der letzte Abgleich älter als 30 Sekunden ist, und nur, was sich geändert hat. Durchsucht werden bei einer Bibliothek nur CLAUDE.md, AGENTS.md, skills/, commands/, output-styles/, memory/ (nur die Dateien direkt darin) und _vault/; ein Ordner ohne Skills wird ganz durchsucht. hooks/, Logs, settings.json, Dateien mit führendem Punkt und Einträge aus .gitignore oder .vaultignore bleiben draußen. „Grundgerüst anlegen“ schreibt README.md, AGENTS.md und inbox/ nach _vault (bzw. in einen leeren Ordner ohne Skills).“
- [ ] Reihenfolge der Schlüssel im Abschnitt: `libraryDir`, `libraryMirror`, `vaultEnabled`.

**Texte** (`environmentTexts.ts`)

- [ ] `linksSummary` ersetzen durch `export function linksText(links: LinkCheck): string`: `total === 0` → „keine Verknüpfungen“; keine kaputten → „alle ${total} Verknüpfungen erreichbar“; sonst „⚠ ${broken} von ${total} Verknüpfungen zeigen ins Leere“ (bei genau einer kaputten „zeigt“). Einziger bisheriger Nutzer ist `EnvironmentLinksRow` (wird gelöscht).
- [ ] Kommentar an `isPending`: „Spiegeln“ → „Abgleichen“.

**Zeile „Abgleich“** — neue Datei `src/features/environment/LibraryMirrorRow.tsx`

- [ ] `export function LibraryMirrorRow({ userSkillsDir, userSkillCount }: { userSkillsDir: string; userSkillCount: number }): ReactElement`, `SettingRow id="libraryMirror"`, CSS `./EnvironmentRows.css`, Daten aus `useEnvironment()` (`status`, `error`, `mirrorError`, `isChecking`, `isMirroring`, `check`, `mirror`).
- [ ] Erste Zeile (`environment-row__line`) = Zustand + genau ein Knopf, Fälle in dieser Reihenfolge:
  - `status === null` → gedämpft „Lädt …“ (während `isChecking`) bzw. „—“; Knopf „Erneut prüfen“ (`check`, `disabled={isChecking}`).
  - `status.masterDir === null` → gedämpft „Kein Ordner gewählt“; Knopf „Erneut prüfen“.
  - `status.masterError !== null` → gedämpft `Kein Abgleich. ${masterError}`; Knopf „Erneut prüfen“.
  - `mirrorSummary(status.diffs) !== null` → Warnsatz (`environment-row__warn`) + Knopf „Abgleichen“ / „Gleicht ab …“ (`environment-row__primary`, `mirror`, `disabled={isMirroring}`); darunter die Liste aller `diffs` wie `renderList` in `EnvironmentMirrorRow`.
  - sonst → „Gleich“ bzw. `Gleich · ${mirroredText(lastMirror)}` (`environment-row__ok`) + Knopf „Erneut prüfen“; nicht ausstehende Diffs als `<details>` „n Hinweise“ wie bisher.
- [ ] Zweite Zeile, sobald `status !== null`: gedämpft „Lokal “ + Pfad in `environment-row__mono` (`title` = Pfad) + ` · ${skillCountText} · ${linksText(status.links)}`; `skillCountText` = „1 Skill“ / „n Skills“ (aus `skillCountLabel` in `SettingsView.tsx` hierher verschieben). Bei kaputten Verknüpfungen das „⚠ …“ in `environment-row__warn` statt gedämpft.
- [ ] Bei kaputten Verknüpfungen darunter je eine Zeile `environment-row__mono` „Pfad → Ziel“ (bzw. nur Pfad) und gedämpft „Ziel fehlt · zuletzt geprüft HH:MM“ (`formatClock(status.checkedAt)`) — übernommen aus `EnvironmentLinksRow.renderBroken`.
- [ ] Darunter `error` und `mirrorError` als Warnzeilen.
- [ ] `EnvironmentMirrorRow.tsx` und `EnvironmentLinksRow.tsx` löschen.

**Zeile „Suche“** — neue Datei `src/features/vault/LibrarySearchRow.tsx`

- [ ] `export function LibrarySearchRow({ isEnabled, onToggle }: { isEnabled: boolean; onToggle: (checked: boolean) => void }): ReactElement`, `SettingRow id="vaultEnabled"`, CSS `./VaultRows.css`; `Switch` (gleicher Import wie in `SettingsView.tsx`) mit `label="Suche"`.
- [ ] Aus: daneben `vault-row__muted` „aus · kein Einstieg, Ctrl K ohne Wirkung“.
- [ ] An: daneben `statusText(status)` (bzw. „…“ ohne Status) und die Knöpfe „Neu einlesen“ / „Grundgerüst anlegen“ samt Zustand, Bedingungen und Fehlerzeilen 1:1 aus `VaultStatusRow.tsx`.
- [ ] `VaultStatusRow.tsx` und `LibraryScopeRow.tsx` löschen.

**Seite** (`SettingsView.tsx`)

- [ ] Fälle `userSkills`, `projectSkills`, `environmentLinks`, `environmentMirror`, `vaultStatus`, `libraryScope` löschen; neuer Fall `libraryMirror` → `<LibraryMirrorRow userSkillsDir={loaded.userSkillsDir} userSkillCount={loaded.userSkillCount} />`; Fall `vaultEnabled` → `<LibrarySearchRow isEnabled={current.vaultEnabled} onToggle={(checked) => { save({ kind: 'vaultEnabled', value: checked }).catch(() => undefined); }} />`.
- [ ] `projectSkillsText`, `skillCountLabel`, `hasProjectSkills`, `useKnownRepositories`-Aufruf und die dann unbenutzten Importe entfernen. `renderRevealButton` bleibt (Workspaces).

**Doku**

- [ ] `docs/code-map.md` Zeile „Bibliothek“: Kategorie „Bibliothek“ mit den Zeilen Ordner, Abgleich, Suche; Komponenten `LibraryMirrorRow`, `LibrarySearchRow` statt `EnvironmentLinksRow`, `EnvironmentMirrorRow`, `LibraryScopeRow`, `VaultStatusRow`.
- [ ] `docs/glossary.md` „Spiegeln“: Knopf heißt „Abgleichen“.
- [ ] `docs/decisions/069-bibliothek.md` unter Konsequenzen eine Zeile: „Oberfläche (2026-11-24): Kategorie „Bibliothek“ mit drei Zeilen — Ordner, Abgleich (inkl. lokalem Skill-Ordner und Verknüpfungen, ein Knopf), Suche (inkl. Indexstand); Projekt-Skills nur noch in der Repository-Auswahl.“

## Risiken / Konfidenz

- 🟡 Die Seite wurde bisher nur per `pnpm check` belegt, nie in der echten App gesehen; diesmal Sichtprüfung über `pnpm tauri dev`, Einstellungen › Bibliothek.
- 🟡 Die Einstellungssuche findet nach Wörtern wie „Verknüpfungen“ oder „Suchindex“ nur noch über das ⓘ (Anzeige „Im Hilfetext: …“) — gewollt, Check: Suchfeld „Verknüpfungen“ tippen, Zeile „Abgleich“ muss erscheinen.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
