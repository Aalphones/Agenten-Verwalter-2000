# Phase 2 — Core: Skills und Befehle

**Status:** complete · **Rating:** standard (Dateien lesen und einen kleinen Frontmatter-Leser schreiben; keine offene Entscheidung)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ → „Skills und Befehle“ und „Kontrakt“ (Typen `SkillOrigin`, `SkillKind`, `SkillInfo`, `SkillRef`; Commands Phase 2)
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitt „Skills per Nachricht“
- [docs/conventions/rust.md](../../conventions/rust.md)
- Bestand:
  - `src-tauri/src/repositories/mod.rs` (`count_skills` — Muster für das Lesen von `.claude\skills`)
  - `src-tauri/src/db/repositories.rs` bzw. `repository_rows::get_many` in `registry.rs` (Name und Pfad bekannter Repositories)
  - `src-tauri/src/worktrees/` (`SessionRepository`: `name`, `folder`)
  - `src-tauri/src/sessions/registry.rs`: `send`, `create`, `push_user` (Stand nach Phase 1), `repositories_of`
  - Beispiele echter Dateien: `%USERPROFILE%\.claude\skills\*\SKILL.md` und `%USERPROFILE%\.claude\commands\*.md` auf dieser Maschine (Frontmatter mit `name`, `description`, teils mehrzeilig)
- Fehlerklassen: keine Vault-Entity für Rust vorhanden; `werkzeuge/claude-code.md` gelesen — nicht einschlägig. Projekteigen:
  - **Mehrzeilige YAML-Werte:** `description: >` bzw. `|` bzw. `>-` mit eingerückten Folgezeilen kommen in echten Skills vor. Ein Leser, der nur die erste Zeile nimmt, zeigt „>“ als Beschreibung. Prüfen per AK 3.
  - **Große oder kaputte Dateien:** Nur die ersten 64 KiB lesen, ungültiges UTF-8 verlustbehaftet ersetzen (`String::from_utf8_lossy`); eine unlesbare Datei überspringen, nie die ganze Liste scheitern lassen.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt `SkillInfo.ts`, `SkillOrigin.ts`, `SkillKind.ts`, `SkillRef.ts`, und `ChatEntry.ts` enthält `skill` an `user`.
2. `skill_list_for_session` für eine Session ohne Repository liefert die Skills aus `~\.claude\skills` (Herkunft `user`, Art `skill`) und die Befehle aus `~\.claude\commands` (Art `command`), je nach Name sortiert, Skills vor Befehlen.
3. Ein Skill mit mehrzeiliger `description: >`-Beschreibung liefert den zusammengefügten Text ohne `>`; Anführungszeichen um einen einzeiligen Wert sind entfernt.
4. Für eine Session mit einem Repository, das `.claude\skills\<x>\SKILL.md` hat, steht `<x>` mit Herkunft `{ kind: 'repository', name: <Repository> }` hinter den Benutzer-Einträgen; `skill_list_for_repositories([id])` liefert dieselben Repository-Einträge aus dem Haupt-Checkout.
5. `chat_send` mit Text `/plan bitte` speichert am `user`-Eintrag `skill: { name: 'plan', origin: { kind: 'user' } }`; Text `/gibtsnicht` oder `Hallo /plan` speichert `skill: null`.

## Checkliste

### Modul `src-tauri/src/skills/` (neu; in `lib.rs` als `mod skills;`)

- [x] `model.rs`: Typen nach Kontrakt; in `gen-bindings.rs` eintragen.
- [x] `frontmatter.rs`: `pub fn parse(text: &str) -> (HashMap<String, String>, &str)` — gibt Schlüssel/Werte und den Rest nach dem Frontmatter zurück. Regeln:
  - Frontmatter nur, wenn die erste Zeile (ohne BOM `\u{feff}`, ohne `\r`) genau `---` ist; Ende bei der nächsten Zeile `---`. Kein Frontmatter → leere Map, ganzer Text als Rest.
  - Zeile `schlüssel: wert` auf oberster Ebene (keine Einrückung). Der Wert wird getrimmt; umschließende `"…"` oder `'…'` werden entfernt.
  - Wert `>`, `>-`, `|` oder `|-` oder leer: die folgenden **eingerückten** Zeilen gehören dazu, getrimmt und mit einem Leerzeichen verbunden (auch bei `|`, weil die Anzeige einzeilig ist).
  - Alles andere (Listen, verschachtelte Objekte) wird ignoriert.
- [x] `mod.rs`:
  - `const MAX_READ_BYTES: usize = 65_536; const MAX_DESCRIPTION_CHARS: usize = 160;`
  - `fn read_head(path: &Path) -> Option<String>`: höchstens `MAX_READ_BYTES` lesen (`File::open` + `take`), `from_utf8_lossy`.
  - `fn shorten(text: &str) -> String`: mehr als 160 Zeichen → die ersten 159 + `…`.
  - `fn skills_in(root: &Path, origin: &SkillOrigin) -> Vec<SkillInfo>`: jeder Unterordner von `root\.claude\skills` mit `SKILL.md`; Name = `name` aus dem Frontmatter, sonst Ordnername; Beschreibung = `description` oder leer. Nach Name sortiert (`to_lowercase`).
  - `fn commands_in(root: &Path, origin: &SkillOrigin) -> Vec<SkillInfo>`: jede Datei `root\.claude\commands\*.md` (keine Unterordner); Name = Dateiname ohne `.md`; Beschreibung = `description`, sonst die erste nicht leere Zeile des Rests ohne führende `#` und Leerzeichen. Nach Name sortiert.
  - `pub fn collect(home: &Path, repositories: &[(String, PathBuf)]) -> Vec<SkillInfo>`: `skills_in(home, User)`, `commands_in(home, User)`, dann je Repository in gegebener Reihenfolge `skills_in(root, Repository{name})` und `commands_in(root, Repository{name})`. `home` ist der Benutzerordner (darunter liegt `.claude`).
  - `pub fn match_invocation(text: &str, skills: &[SkillInfo]) -> Option<SkillRef>`: `text.trim_start()` muss mit `/` beginnen; der Name reicht bis zum ersten Leerzeichen oder zum Ende; der erste `SkillInfo` mit genau diesem Namen ergibt `SkillRef { name, origin }`.
- [x] Benutzerordner: `app.path().home_dir()` (Fehler → `CommandError::Io`), wie `data_dir` in `filesystem/workspace.rs`.

### Registry und Chat-Eintrag

- [x] `src-tauri/src/agents/event.rs`: `ChatEntry::User` bekommt `#[serde(default)] skill: Option<SkillRef>` (Import aus `crate::skills::model`).
- [x] `registry.rs`: `pub fn skill_roots(&self, session_id: &str) -> Result<Vec<(String, PathBuf)>, CommandError>` = je `SessionRepository` `(name, workspace.join(folder))` (über `get`, ohne den Verlauf zu laden).
- [x] `registry.rs` `send` und `create`: die Skill-Liste **vor** `update` einsammeln (Dateizugriffe nicht unter der Sperre): `skills::collect(&home, &roots)`; `create` nimmt als Wurzeln die Haupt-Checkouts der gewählten Repositories (`rows` aus `repository_rows::get_many`: Name und Pfad). `match_invocation(text, &skills)` ergibt den `SkillRef`, der an `push_user(outbox, text, attachments, skill)` geht (Signatur um `skill: Option<SkillRef>` erweitern, übrige Aufrufer `None`). In `send` gilt das auch für eine Antwort auf eine offene Rückfrage (dort `push_user` mit `Vec::new()` und dem ermittelten Skill).

### Commands

- [x] `src-tauri/src/commands/skills.rs` (neu, in `commands/mod.rs`, registriert in `lib.rs`):
  - `skill_list_for_session(app, registry, session_id) -> Result<Vec<SkillInfo>, CommandError>` = `collect(home, registry.skill_roots(&session_id)?)`.
  - `skill_list_for_repositories(app, database: tauri::State<'_, Arc<Database>>, repository_ids: Vec<String>) -> Result<Vec<SkillInfo>, CommandError>`: `database.with(|connection| crate::db::repositories::get_many(connection, &repository_ids))` liefert `RepositoryRow { name, path, … }`; Wurzeln = `(row.name, PathBuf::from(row.path))`. Alle `async`.
- [x] `src/lib/skills.ts` (neu): `listSessionSkills(sessionId: string): Promise<SkillInfo[]>`, `listRepositorySkills(repositoryIds: string[]): Promise<SkillInfo[]>` mit JSDoc.

### Doku

- [x] `docs/code-map.md`: Zeile „Skills und Befehle“ (`src/lib/skills.ts` · `src-tauri/src/skills/` mit `frontmatter.rs`, `src-tauri/src/commands/skills.rs`); Feature-Liste im Namensschema um `skills` ergänzen.
- [x] `docs/glossary.md`: „Skill“ präzisieren: „Aufgerufen als Nachricht, die mit `/name` beginnt. Das `/`-Menü zeigt Skills und Befehle aus `~\.claude\skills`, `~\.claude\commands` und denselben Ordnern der Repositories einer Session; Plugin- und eingebaute Skills der Kommandozeile nicht.“ Neuer Begriff **Befehl** (Command): „Eine Markdown-Datei in `.claude\commands`, aufgerufen wie ein Skill mit `/name`.“

## Report-Back

`pnpm check` grün. AK 2–5 nur am Code geprüft, nicht gegen echte Skill-Dateien gelaufen (keine automatisierten Tests im Projekt); erste Sichtprüfung beim Bau des `/`-Menüs in Phase 4. Abweichung: `home_dir` als eigene Funktion in `filesystem/workspace.rs` herausgezogen (`data_dir` nutzt sie), damit Registry und Commands denselben Benutzerordner-Zugriff teilen.
