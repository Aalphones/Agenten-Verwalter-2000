# Plan: Vorhaben-Retro

Ein Knopf „Retro“ in der Übersicht eines Vorhabens schreibt die Verläufe aller Sessions als Textdateien in den Workspace, legt eine neue Session an und setzt `/session-review vorhaben <Ordner>` in ihren Entwurf. Gesendet wird erst auf Klick. Der Skill wertet die Dateien aus: je Session ein Sonnet-Subagent sammelt Rohbefunde, der Hauptagent fasst sie zur Retro des Vorhabens zusammen. Der Skill selbst liegt nicht in diesem Repository; dieser Plan liefert nur Export, Knopf und den Kontrakt, auf den sich der Skill verlässt.

## Übersicht

| Phase | Inhalt | Komplexität | Status |
|---|---|---|---|
| 1 | Core: Verlaufs-Export `retro_prepare`, Retro-Transkript, ADR 028 | standard | pending |
| 2 | Oberfläche: Knopf „Retro“ in der Vorhaben-Übersicht, Doku | standard | pending |

## Kontrakt (Core ↔ Oberfläche ↔ Skill)

- **Command:** `retro_prepare(project_id: String) -> Result<RetroExport, CommandError>` in `src-tauri/src/commands/retro.rs`, `async` wie die TL;DR-Commands (Verläufe werden aus der Datenbank geladen).
- **Typ** (`src-tauri/src/retro/model.rs`, `derive(TS)`, camelCase, in `src-tauri/examples/gen-bindings.rs` eintragen):
  ```rust
  pub struct RetroExport {
      /// Relativ zum Workspace, mit `/` getrennt, z. B. `.retro/lauf-1759830000000`.
      pub folder: String,
      /// Anzahl geschriebener Dateien.
      pub session_count: u32,
  }
  ```
- **Ordner:** `<Workspace>\.retro\lauf-<now_ms()>\` — jeder Lauf ein neuer Ordner, nie überschreiben, nie aufräumen.
- **Datei je Session:** `session-<Nummer>.md`, Nummer ohne führende Nullen. Inhalt:
  ```text
  # Session #<Nummer> – <Name>
  Status: <Status-Bezeichnung wie status_label in tldr/transcript.rs>
  Modell: <Modell-Bezeichnung>
  Werkzeug-Aufrufe: <alle Tool-Einträge>, davon fehlgeschlagen: <Failed>, abgebrochen: <Interrupted>
  Gekürzt: <ja|nein>

  <Retro-Transkript>
  ```
- **Welche Sessions:** alle des Vorhabens nach Nummer (`project_members`), außer (a) Status `New`, (b) Sessions, deren erste Nutzernachricht den Skill `session-review` aufruft (`ChatEntry::User.skill.name == "session-review"`) — frühere Retros fließen nicht in die nächste ein. Bleibt keine übrig → `CommandError::Internal("Noch keine Session mit Verlauf.")`, kein Ordner wird angelegt.
- **Entwurf der neuen Session:** genau `/session-review vorhaben <folder>` (der `folder`-Wert aus `RetroExport`). Der Skill erkennt den Vorhaben-Lauf am ersten Argument `vorhaben` und liest den Ordner per Pfad (nicht per Suche: Suchwerkzeuge überspringen Punkt-Ordner stumm).

## Finale Abnahmekriterien

1. In der Übersicht eines Vorhabens steht zentriert direkt unter der TL;DR-Karte (über den Repositories) ein Knopf „Retro“ mit Tooltip; ohne Sessions fehlt er.
2. Der Knopf ist gesperrt, solange eine Session des Vorhabens startet, läuft oder auf eine Antwort wartet, oder keine Session einen Verlauf hat; der Tooltip nennt dann den Grund.
3. Ein Klick legt `<Workspace>\.retro\lauf-<Zahl>\session-<N>.md` für jede Session mit Verlauf an (ohne frühere Retro-Sessions), legt eine neue Session an, wählt sie aus und setzt `/session-review vorhaben .retro/lauf-<Zahl>` in ihren Entwurf. Nichts wird gesendet.
4. Jede Datei trägt die Kopfzeilen aus dem Kontrakt; das Transkript enthält Nachrichten, Antworten, Rückfragen, Fehler und fehlgeschlagene/abgebrochene Werkzeug-Aufrufe, keine Gedankengänge.
5. Eine zweite Retro nimmt die Session der ersten Retro nicht mit auf.
6. `pnpm check` grün.

## Smoke-Checkliste (Abnahme durch den Nutzer)

Wackelstellen zuerst:

1. **Skill-Aufruf mit Argumenten:** Entwurf aus dem Knopf senden → die Marke `session-review` erscheint an der Nachricht, und der Agent liest die Dateien aus dem genannten Ordner (nicht die aktuelle Session).
2. **Ausschluss früherer Retros:** nach Smoke 1 ein zweites Mal „Retro“ → der neue Ordner enthält keine Datei für die Retro-Session aus Smoke 1.
3. **Großer Verlauf:** Vorhaben mit einer langen Session → deren Datei hat `Gekürzt: ja` und die Marke „[… Beiträge aus der Mitte ausgelassen …]“.

Danach:

4. Während eine Session läuft: Knopf gesperrt, Tooltip nennt den Grund. Nach dem Ende wieder frei.
5. Vorhaben nur mit einer Session im Status „Neu“: Knopf gesperrt.
6. Fehlschlag sichtbar: Workspace-Ordner schreibgeschützt setzen → Fehlertext unter der Kopfzeile der Sessions, keine neue Session angelegt.

## Phase 1 — Core

### Kontext (vor dem Start lesen)

- `docs/code-map.md` (Namensschema), `docs/conventions/rust.md`, `docs/conventions/linting.md`
- `src-tauri/src/tldr/transcript.rs` — `session_transcript`, `entry_block`, `fit`, `status_label` (Muster und wiederverwendete Teile)
- `src-tauri/src/sessions/registry/tldr.rs` — `begin_missing_tldr` (Verlauf laden mit `lock_loaded`, Sperr-Reihenfolge), `project_members`
- `src-tauri/src/sessions/registry/artifacts.rs` — Muster für eine Registry-Erweiterung in eigener Datei, `session.workspace`
- `src-tauri/src/commands/tldr.rs` — Muster für `async`-Commands
- `src-tauri/src/agents/event.rs` — `ChatEntry`, `ToolState`
- `docs/decisions/027-session-uebergabe.md` — Vorbild für das ADR

### Checkliste

- [ ] `tldr/transcript.rs`: `entry_block`, `fit`, `status_label` und `Block` auf `pub(crate)` stellen (keine Verhaltensänderung). `fit` gibt zusätzlich zurück, ob gekürzt wurde: neue Funktion `pub(crate) fn fit_with_flag(blocks: Vec<Block>) -> (String, bool)`, `fit` ruft sie und verwirft das Flag.
- [ ] Neues Modul `src-tauri/src/retro/` mit `mod.rs`, `model.rs` (`RetroExport` laut Kontrakt), `transcript.rs`:
  - `pub fn retro_transcript(entries: &[ChatEntry]) -> (String, bool)` — wie `session_transcript`, aber `ChatEntry::Tool` mit `state` `Failed` oder `Interrupted` wird ein Block `Werkzeug fehlgeschlagen: <tool> <target>` bzw. `Werkzeug abgebrochen: <tool> <target>`; übrige Tool-Einträge, `Thinking`, `Artifact` entfallen; letzte Aufgabenliste wie dort. Kürzen über `fit_with_flag`.
  - `pub fn tool_counts(entries: &[ChatEntry]) -> (u32, u32, u32)` — alle / fehlgeschlagen / abgebrochen.
  - `pub fn is_retro_session(entries: &[ChatEntry]) -> bool` — erste `ChatEntry::User` hat `skill` mit `name == "session-review"`.
  - `pub fn session_file(number: u32, name: &str, status: SessionStatus, model_label: &str, entries: &[ChatEntry]) -> String` — Kopfzeilen + Transkript laut Kontrakt.
- [ ] `src-tauri/src/sessions/registry/retro.rs` (als Untermodul registrieren wie `artifacts`): `pub fn prepare_retro(&self, project_id: &str) -> Result<RetroExport, CommandError>`:
  1. `project_members(project_id)`; Sessions im Status `New` überspringen.
  2. Je Session nacheinander `lock_loaded()`, Dateiinhalt bauen, Sperre freigeben — nie zwei Session-Sperren zugleich, keine Dateisystem-Arbeit unter der Sperre (Inhalt erst als `String` herausziehen).
  3. Retro-Sessions (`is_retro_session`) überspringen. Leer → Fehler laut Kontrakt.
  4. Ordner `<workspace>\.retro\lauf-<now_ms()>` mit `std::fs::create_dir_all`, Dateien mit `std::fs::write` (UTF-8). IO-Fehler → `CommandError::Internal("Retro nicht geschrieben: <Fehler>")`.
  5. `RetroExport { folder: ".retro/lauf-<Zahl>", session_count }`.
  - Modell-Bezeichnung: dieselbe Quelle, die `SessionSummary.model` füllt, als Text über die bestehende Anzeige-Funktion des Core; gibt es keine, den Modell-Wert per `serde` als String (z. B. `sonnet`).
  - Workspace: `session.workspace` der ersten Session des Vorhabens (alle Sessions teilen ihn, AGENTS.md Regel 5).
- [ ] `src-tauri/src/commands/retro.rs` mit `retro_prepare`, in `src-tauri/src/lib.rs` registrieren; `mod retro;` in `src-tauri/src/lib.rs`.
- [ ] `RetroExport` in `src-tauri/examples/gen-bindings.rs`, `pnpm bindings`.
- [ ] ADR `docs/decisions/028-vorhaben-retro.md`: Kontext (Retro je Session zu teuer und zu verstreut), Optionen (a) Sessions wieder aufnehmen und dort die Mini-Retro laufen lassen — schreibt in fremde Verläufe; (b) Verläufe als Dateien in den Workspace, neue Session wertet sie aus — gewählt; Entscheidung: Kontrakt dieses Plans; Konsequenzen: Ordner wachsen ohne Aufräumen, Retro-Sessions werden am Skill-Aufruf erkannt.
- [ ] `pnpm check` grün.

### Report-Back

## Phase 2 — Oberfläche und Doku

### Kontext (vor dem Start lesen)

- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`
- `src/features/chat/HandoffButton.tsx` + `HandoffButton.css` — Vorbild: Session anlegen, Entwurf setzen, Fokus, Fehlerzeile
- `src/features/projects/ProjectOverview.tsx` + `.css` — Einbauort, `RUNNING_STATUSES`, `hasHistory`, Knopf „Neue Session“
- `src/lib/tldr.ts` — Muster für einen Wrapper mit `invoke`
- `src/stores/chat.ts` — `setDraft`

### Checkliste

- [ ] Wrapper `src/lib/retro.ts`: `prepareRetro(projectId: string): Promise<RetroExport>`.
- [ ] `src/features/retro/RetroButton.tsx` + `RetroButton.css` (BEM-Block `retro`), Props `projectId`, `sessions: readonly SessionSummary[]`, `onSessionCreated`:
  - Gesperrt, wenn eine Session in `['starting', 'running', 'waiting']` ist oder keine Session `status !== 'new'` hat.
  - Tooltip (`title`) frei: „Schreibt die Verläufe aller Sessions in den Arbeitsordner, legt eine neue Session an und setzt den Retro-Aufruf in ihr Eingabefeld. Gesendet wird erst, wenn du auf Senden klickst.“ Gesperrt wegen Lauf: „Erst möglich, wenn keine Session mehr arbeitet.“ Gesperrt ohne Verlauf: „Noch keine Session mit Verlauf.“
  - Klick: `prepareRetro` → `createSessionInProject` → `onSessionCreated` → Entwurf `/session-review vorhaben <folder>` per `useChatStore.getState().setDraft` (vorhandenen Entwurf wie `setHandoffDraft` voranstellen) → Composer fokussieren wie `focusComposer`. Während des Laufs Beschriftung „Bereite Retro vor …“. Fehler aus einem der Schritte als Fehlerzeile unter dem Knopf (`role="alert"`), danach nichts weiter ausführen.
  - Modell und Einstellungen der neuen Session nicht ändern (übernimmt sie wie jede neue Session).
- [ ] In `ProjectOverview.tsx` den Knopf direkt nach `<ProjectTldrCard … />` und vor `renderRepositories()` einsetzen, in einem eigenen Element `project-overview__retro` (Flex, `justify-content: center`, Abstände wie zwischen den übrigen Blöcken der Spalte `project-overview__column`). Knopf-Stil wie „Neue Session“ (Tokens, keine Hex-Werte), die Fehlerzeile zentriert darunter. Ohne Sessions wird der Knopf nicht gerendert.
- [ ] `docs/code-map.md`: Zeile „Vorhaben-Retro“ (Oberfläche `src/features/retro/`, `src/lib/retro.ts`; Core `src-tauri/src/retro/`, `src-tauri/src/commands/retro.rs`, `src-tauri/src/sessions/registry/retro.rs`, ADR 028) und `retro` in die Feature-Liste.
- [ ] `docs/glossary.md`: Begriff **Retro** — Rückblick über alle Sessions eines Vorhabens, ausgelöst über den Knopf „Retro“, ausgewertet vom Skill in einer neuen Session.
- [ ] `pnpm check` grün.

### Report-Back

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
