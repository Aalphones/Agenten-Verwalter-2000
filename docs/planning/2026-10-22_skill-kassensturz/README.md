# Skill-Kassensturz im `/`-Menü

Ziel: Die Gruppe „Skills“ im `/`-Menü sortiert nach Gebrauch: oft genutzte Skills oben, rechts die Zahl der Aufrufe der letzten 30 Tage. Was seit 30 Tagen niemand aufgerufen hat, liegt eingeklappt am Ende der Gruppe. Beim Filtern wird nichts eingeklappt. Entwurf: [artifacts/entwurf-skill-kassensturz.html](artifacts/entwurf-skill-kassensturz.html), vom User am 2026-10-22 freigegeben.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Skills und Befehle“, „Chat“), [docs/glossary.md](../../glossary.md), [docs/conventions/](../../conventions/), [ADR 007](../../decisions/007-anhaenge-skills-hintergrund.md) (Skills im Menü). **Verhältnis zum geparkten Plan [mitgelieferte-befehle](../2026-10-21_mitgelieferte-befehle/README.md):** der ergänzt `SkillOrigin` um eine Variante für mitgelieferte Befehle und einen eigenen Abschnitt „Mitgeliefert“. Dieser Plan zählt nur Einträge der Gruppe „Skills“; wird er nach jenem umgesetzt, bekommt der Zählschlüssel für die neue Herkunft einen eigenen Fall (siehe Phase 1). Fehlerklassen geprüft (Vault: TypeScript, React): keine einschlägig; für Rust gibt es keine Einträge.

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Core: Aufrufe je Skill aus dem Verlauf zählen, Command; ADR 039 | mechanisch | complete |
| 2 | Oberfläche: Sortierung, Zahl, eingeklappte Gruppe; Doku-Abschluss | standard | pending |

**Rahmen:** strikt 1 → 2, direkt auf `main`, ein Commit pro Phase, Scope `skills`. `pnpm check` grün vor jedem Commit, `cargo` im PATH, keine neuen Abhängigkeiten, Bindings mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste. Planabschluss mit Versions-Tag (Minor-Version).

## Festgelegte Entscheidungen

- **Ein Aufruf** = ein `ChatEntry::User` mit gesetztem `skill` (setzt `send` über `skills::match_invocation`), `sentAt` in den letzten 30 Tagen. Archivierte Sessions zählen mit (ihre Einträge bleiben in `chat_entries`); gelöschte nicht.
- **Schlüssel** = Herkunft + Name: `user:<name>` bzw. `repository:<Repo-Name>:<name>`. Skills gleichen Namens aus verschiedenen Ordnern zählen getrennt.
- **Abfrage ohne Migration** direkt per `json_extract` auf `chat_entries.payload` (wie Migration 008), ein SQL-Aufruf je Menü-Öffnen.
- **Sortierung** nur innerhalb der Gruppe „Skills“: absteigend nach Zahl, bei Gleichstand die heutige Reihenfolge aus `skills::collect` (stabile Sortierung). Kontext, Modell, Session unverändert.
- **Einklappen** nur im Menü über den Knopf `/` ohne Filtertext: Skills mit Zahl 0 stehen hinter der Zeile „Seit 30 Tagen nicht benutzt“ (Zahl rechts), Klick klappt auf und zu (Zustand flüchtig, beim Schließen des Menüs wieder zu). Mit Filtertext oder im Menü über `/` im Feld: alle Treffer in einer Liste, Zahl 0 unten und ausgegraut, Zahl „—“.
- **Tastatur:** ↑/↓ überspringt eingeklappte Skills; die Klapp-Zeile ist selbst wählbar, Enter klappt.

## Kontrakt

```rust
// src-tauri/src/skills/model.rs, camelCase, derive(TS)
pub struct SkillUse { pub key: String, pub count: u32 }
```

Command `skill_uses(database: State<Arc<Database>>) -> Result<Vec<SkillUse>, CommandError>` in `src-tauri/src/commands/skills.rs`; Wrapper `listSkillUses(): Promise<SkillUse[]>` in `src/lib/skills.ts`. Schlüssel in TypeScript über `skillUseKey(skill: SkillInfo): string` in `src/features/skills/skillUses.ts` — dieselbe Bildung wie im Core.

## Phase 1 — Core

Lesen: `src-tauri/src/skills/model.rs` (`SkillInfo`, `SkillOrigin`, `SkillRef`), `src-tauri/src/commands/skills.rs`, `src-tauri/src/db/mod.rs` (`Database::with`), `src-tauri/src/db/chat_entries.rs`, `src-tauri/src/db/migrations/008_session_activity.sql` (Beispiel `json_extract`), [docs/conventions/rust.md](../../conventions/rust.md).

AK:
1. `skill_uses` liefert je Schlüssel die Zahl der Aufrufe der letzten 30 Tage nach Entscheidung; Skills ohne Aufruf fehlen in der Liste.

- [ ] `skills/model.rs`: `SkillUse`; in `gen-bindings.rs` exportieren; `pnpm bindings`.
- [ ] Neue Datei `src-tauri/src/db/skill_uses.rs` (in `db/mod.rs` eintragen): `pub fn count_since(connection: &Connection, since_ms: f64) -> Result<Vec<SkillUse>, CommandError>` mit
  ```sql
  SELECT json_extract(payload, '$.skill.origin.kind') AS origin,
         json_extract(payload, '$.skill.origin.name') AS repo,
         json_extract(payload, '$.skill.name') AS name,
         COUNT(*)
  FROM chat_entries
  WHERE json_extract(payload, '$.kind') = 'user'
    AND json_extract(payload, '$.skill.name') IS NOT NULL
    AND json_extract(payload, '$.sentAt') >= ?1
  GROUP BY origin, repo, name
  ```
  Schlüssel im Rust gebildet: `user` → `user:<name>`, `repository` → `repository:<repo>:<name>`, jede andere Herkunft (z. B. die Variante aus dem Plan „mitgelieferte-befehle“) → `<origin>:<name>`.
- [ ] `commands/skills.rs`: `skill_uses` mit `since_ms = now_ms() - 30 * 24 * 3600 * 1000`; in `lib.rs` registrieren.
- [ ] `docs/decisions/039-skill-kassensturz.md`: Optionen (a) eigener Zähler je Aufruf in einer neuen Tabelle — verworfen, Migration und doppelte Wahrheit; (b) Zählen aus `chat_entries` — gewählt; (c) Statistik-Seite — verworfen, Leitsatz „nichts dauerhaft auf den Schirm, was nicht beim Arbeiten hilft“. Konsequenzen: die Zahl kostet einen Durchlauf über alle Benutzer-Einträge je Menü-Öffnen; gelöschte Sessions fallen aus der Zählung.
- [ ] `pnpm check` grün, Commit `feat(skills): Aufrufe je Skill zählen`.

## Phase 2 — Oberfläche

Lesen: Entwurf (beide Zustände), `src/features/skills/useSkills.ts`, `src/features/chat/commandMenuRows.ts` (`CommandRow`, `buildCommandSections`, `rowText`, `rowKey`, `pickableRows`, `moveHighlight`), `src/features/chat/CommandMenu.tsx` + `.css` (`renderRow`, `rowOrigin`), `src/features/chat/useCommandMenu.ts`, `src/features/chat/Composer.tsx` (Aufruf von `buildCommandSections`), [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md).

AK:
1. Gruppe „Skills“ nach Entscheidung sortiert; jede Zeile zeigt rechts nach der Herkunft die Zahl „<n>×“ (Mono, 11 px, `--color-muted`, rechtsbündig, 34 px breit), bei 0 „—“ (nur sichtbar, wenn die Zeile sichtbar ist).
2. Menü über `/`-Knopf ohne Filter: Klapp-Zeile „▸ Seit 30 Tagen nicht benutzt“ mit Zahl rechts am Ende der Gruppe, nur wenn es solche Skills gibt; aufgeklappt „▾“ und die Skills ausgegraut darunter.
3. Mit Filter oder im `/`-Feldmenü keine Klapp-Zeile; ungenutzte Treffer unten, ausgegraut.
4. Tastaturverhalten nach Entscheidung; die Hervorhebung springt nie auf eine eingeklappte Zeile.
5. Fehlt die Zählung (Fehler oder noch nicht geladen), verhält sich das Menü wie heute (keine Sortierung, keine Zahl, keine Klapp-Zeile).

- [ ] `useSkills.ts`: lädt beim Aktivwerden zusätzlich `listSkillUses()` parallel; Rückgabe um `uses: ReadonlyMap<string, number> | null` erweitern.
- [ ] `src/features/skills/skillUses.ts`: `skillUseKey`, `sortByUse(skills, uses): readonly SkillInfo[]` (stabil), `isUnused(skill, uses): boolean`.
- [ ] `commandMenuRows.ts`: `CommandRow` um `{ kind: 'unusedToggle'; count: number; isOpen: boolean }` erweitern; `buildCommandSections` bekommt die Parameter `uses: ReadonlyMap<string, number> | null` und `isUnusedOpen: boolean` und baut die Gruppe nach AK 1–3 (eingeklappte Skills stehen dann gar nicht in `rows`); `rowText`/`rowKey` für die neue Zeile; `pickableRows` nimmt sie mit auf.
- [ ] `useCommandMenu.ts`: Zustand `isUnusedOpen` (beim Schließen `false`); Pick der Klapp-Zeile schaltet nur um und schließt nicht.
- [ ] `CommandMenu.tsx` + `.css`: vierter Span `command-menu__count`; Klasse `command-menu__row--unused` (Name in `--color-muted`); Klapp-Zeile `command-menu__toggle` mit Rahmenlinie oben.
- [ ] Doc: `docs/code-map.md` Zeile „Skills und Befehle“ um `skill_uses`, `db/skill_uses.rs`, `skillUses.ts` ergänzen; `docs/glossary.md` Eintrag **Skill** um den Satz „Das `/`-Menü sortiert Skills nach Aufrufen der letzten 30 Tage (ADR 039).“
- [ ] Plan-Abschluss: Bottom-Sektionen, Archiv, STATE.md, Versions-Tag.
- [ ] `pnpm check` grün, Commit `feat(skills): Skills im Menü nach Gebrauch sortieren`.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
