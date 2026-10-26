# Phase 1 — Mehrere Einstiegszeilen und „Neues Vorhaben“

Rating: standard · Modell: Sonnet · Commit: `feat(chat): mehrere Einstiegszeilen und Start eines neuen Vorhabens aus der Zeile`

## Kontext

Lesen: [README](README.md) (Entscheidungen, Kontrakt), [Entwurf](artifacts/entwurf-automatisch-weiter.html) Zustände 1 und 5, [ADR 027](../../decisions/027-session-uebergabe.md), [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Sessions“, „Chat“), [docs/conventions/rust.md](../../conventions/rust.md), [react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md). Fehlerklassen: keine einschlägig (README).

Bestand (gelesen 2026-10-26, Zeilen können wandern — per Grep neu finden):

- `src-tauri/src/sessions/handoff.rs` — heute `handoff_line(text) -> Option<String>` mit `clean()`; Konstanten `HANDOFF_PREFIX`, `HANDOFF_WINDOW = 5`, `CODE_FENCE`.
- `src-tauri/src/sessions/registry.rs` — Feld `SessionState.handoff_line` (Deklaration ~221, Initialisierung `None` ~1900, Wiederherstellung `state.handoff_line = row.handoff_line.clone();` ~1963, `push_user` setzt `None` ~2408, `AgentEvent::Text` ~2521, `row_of` ~3218, `summarize` ~3304). Grep `handoff_line` in `src-tauri/src` findet alle Stellen.
- `src-tauri/src/db/sessions.rs` — Spalte `handoff_line` in `SessionRow`/`StoredRow`; bleibt unverändert, nur der Doc-Kommentar des Felds ändert sich.
- `src-tauri/src/sessions/model.rs` — `SessionSummary.handoff_line` (~62); `use crate::agents::event::{ChatEntry, Effort, Mode, ModelId};` ist schon da.
- `regex`-Konstanten im Core: Muster `static NAME: LazyLock<Regex> = LazyLock::new(|| …)` (Beispiel per Grep `LazyLock<Regex>`).
- Oberfläche: `src/features/chat/handoff.ts` (`lastAnswerSeq`, `modelOfHandoff`), `HandoffButton.tsx` + `.css`, `composerDraft.ts` (`setHandoffDraft`, `focusComposer`), `ChatTimeline.tsx` (`showsHandoff` ~136, `case 'text'` ~339), `src/features/sessions/sessionStatus.ts` (`displayStatus`, ~35 `session.handoffLine === null`), `src/stores/sessions.ts`, `src/features/sessions/NewSession.tsx` (Anfangswerte `text`, `model`, `repositoryIds` per `useState`-Initialisierer, ~63–77), `src/lib/repositories.ts` (`listRepositories(): Promise<KnownRepository[]>`), `src/lib/labels.ts`.

## AK

1. Antwort endet mit `Weiter: A – Modell sonnet`, `Weiter: B` und `**TL;DR:** …` → unter der Antwort zwei Reihen, je mit Art „Session“, Anfang der Zeile und Knopf „In neuer Session weiter“; Klick auf die erste legt eine Session auf Sonnet mit Zeile A im Entwurf an, Klick auf die zweite (in der alten Session) eine mit Zeile B auf dem übernommenen Modell.
2. Antwort mit nur einer Einstiegszeile → genau ein Knopf ohne Art und Zeilenanfang, Aussehen wie bisher.
3. Antwort mit ```` ```text ````-Block `Neues Vorhaben im Agenten-Verwalter-2000: Plan X … Modell opus` → Reihe „Neues Vorhaben“ mit Knopf „In neuem Vorhaben starten“; Klick öffnet „Neues Vorhaben“ mit Auftrag `Plan X … Modell opus`, Modell Opus, Repository „Agenten-Verwalter-2000“ angehakt (sofern bekannt), nichts gestartet.
4. Repository-Abgleich am ganzen Wort: „Repo facepass,“ hakt das bekannte Repository „facepass“ an; „facepass-Workflow“ hakt es nicht an (`-` gilt als Wortteil).
5. Sidebar: eine abgeschlossene Session mit nur einer Zeile „Neues Vorhaben“ zeigt das Pfeil-Symbol „wartet auf Wiedereinstieg“.
6. Nach einem Neustart der App sind alle Reihen wieder da (Spalte `handoff_line` enthält die Zeilen durch Zeilenumbruch getrennt — `sqlite3` nur auf eine **Kopie** der Datenbank, nie auf `%USERPROFILE%\.verwalter\verwalter.db`).
7. `pnpm check` grün.

## Checkliste

### Core

- [ ] `sessions/model.rs`: `HandoffKind` und `HandoffLine` genau wie im README-Kontrakt; in `SessionSummary` `handoff_line` ersetzen durch

  ```rust
  /// Einstiegszeilen der letzten Antwort in Antwort-Reihenfolge (ADR 027, ADR 040); leer ohne oder nach einer neueren Nutzernachricht.
  pub handoff_lines: Vec<HandoffLine>,
  ```

- [ ] `sessions/handoff.rs` neu schreiben (Modul-Doc: „Einstiegszeilen am Ende einer Agenten-Antwort (ADR 027, ADR 040).“):
  - Konstanten: `HANDOFF_PREFIX = "Weiter:"`, `PROJECT_PREFIX = "Neues Vorhaben"`, `PROJECT_LABEL_MAX: usize = 80`, `HANDOFF_WINDOW: usize = 5`, `CODE_FENCE = "```"`, `static MODEL: LazyLock<Regex>` = `(?i)\bModell\s+(fable|opusplan|opus|sonnet|haiku)\b`.
  - `pub fn handoff_lines(text: &str) -> Vec<HandoffLine>`: `text.lines().rev()`, je Zeile `trim()`; leere Zeilen und Zeilen, die mit `CODE_FENCE` beginnen, überspringen. Sonst `cleaned = clean(line)`; `parse_line(&cleaned)` → `Some` = in die Ergebnisliste, **nicht** zählen; `None` = `counted += 1`, bei `counted == HANDOFF_WINDOW` abbrechen. Ergebnis umdrehen (Antwort-Reihenfolge).
  - `pub fn parse_line(cleaned: &str) -> Option<HandoffLine>`: Art `Session`, wenn `cleaned.starts_with(HANDOFF_PREFIX)` und `cleaned.chars().count() > HANDOFF_PREFIX.len() + 1` (Bedingung von heute). Art `Project`, wenn `cleaned.strip_prefix(PROJECT_PREFIX)` = `rest` gelingt, `rest.find(':')` = `Some(index)`, `rest[..index].chars().count() <= PROJECT_LABEL_MAX` und `rest[index + 1..].trim()` nicht leer. Sonst `None`. `text = cleaned.to_owned()`, `model = model_of(cleaned)`.
  - `fn model_of(line: &str) -> Option<ModelId>`: Treffer von `MODEL`, Gruppe 1 klein geschrieben per `match` auf `"fable" | "opusplan" | "opus" | "sonnet" | "haiku"` → `ModelId::…`, sonst `None`.
  - `pub fn join(lines: &[HandoffLine]) -> Option<String>`: leer → `None`, sonst `text`e mit `"\n"` verbunden.
  - `pub fn split(stored: Option<&str>) -> Vec<HandoffLine>`: `stored.map_or_else(Vec::new, |value| value.lines().filter_map(parse_line).collect())`.
  - `clean` unverändert übernehmen; die alte Funktion `handoff_line` entfällt.
- [ ] `sessions/registry.rs`: `SessionState.handoff_line: Option<String>` → `handoff_lines: Vec<HandoffLine>` (Doc wie in `SessionSummary`); Initialisierung `Vec::new()`; Wiederherstellung `state.handoff_lines = handoff::split(row.handoff_line.as_deref());`; `push_user`: `self.handoff_lines.clear();`; `AgentEvent::Text`: `let lines = handoff::handoff_lines(&text); if self.handoff_lines != lines { self.handoff_lines = lines; outbox.summary_dirty = true; }`; `row_of`: `handoff_line: handoff::join(&state.handoff_lines)`; `summarize`: `handoff_lines: state.handoff_lines.clone()`. Was der Compiler sonst noch meldet, genauso.
- [ ] `db/sessions.rs`: Doc des Felds `handoff_line` in `SessionRow` → „Einstiegszeilen der letzten Antwort, durch `\n` getrennt (ADR 027, ADR 040); `None` ohne“. Keine Migration.
- [ ] `pnpm bindings` (neu: `HandoffKind.ts`, `HandoffLine.ts`; `SessionSummary.ts` bekommt `handoffLines: Array<HandoffLine>`).

### Oberfläche

- [ ] `src/features/sessions/sessionStatus.ts`: `session.handoffLine === null` → `session.handoffLines.length === 0`; Doc von `DisplayStatus` unverändert.
- [ ] `src/features/chat/handoff.ts`: `modelOfHandoff` und `HANDOFF_MODEL_PATTERN` löschen. Neu:

  ```ts
  /** Der Auftrag einer Zeile „Neues Vorhaben … : <Auftrag>“ — alles hinter dem ersten Doppelpunkt. */
  export function taskOfProjectLine(text: string): string;
  /** Die Zeile ohne ihr Kennwort („Weiter:“ bzw. „Neues Vorhaben“) — für die Anzeige in einer Reihe. */
  export function handoffExcerpt(line: HandoffLine): string;
  /** IDs der vorhandenen Repositories, deren Name in `text` als ganzes Wort steht (ohne Groß-/Kleinschreibung). */
  export function matchingRepositoryIds(text: string, repositories: readonly KnownRepository[]): string[];
  ```

  `taskOfProjectLine`: `text.slice(text.indexOf(':') + 1).trim()`. `handoffExcerpt`: `kind === 'session'` → `line.text.slice('Weiter:'.length).trim()`; sonst `line.text.slice('Neues Vorhaben'.length).trim()` (führt den Zusatz vor dem Doppelpunkt mit, z. B. „im Agenten-Verwalter-2000: Plan …“). `matchingRepositoryIds`: nur `!repository.isMissing`; Treffer, wenn `text.toLowerCase()` den `repository.name.toLowerCase()` an einer Stelle enthält, vor der Textanfang oder ein Zeichen außerhalb `[a-z0-9_-]` steht und nach der Textende oder ein solches Zeichen steht (alle Vorkommen prüfen, `indexOf` in einer Schleife; kein aus dem Namen gebauter regulärer Ausdruck).
- [ ] `HandoffButton.tsx`: Prop `line: string` → `line: HandoffLine` (Import aus `@/lib/bindings/HandoffLine`); `modelOfHandoff(line)` → `line.model`; `setHandoffDraft(created.id, line.text)`. Sonst unverändert.
- [ ] `HandoffButton.css`: `margin-top` aus `.handoff` entfernen (den Abstand trägt jetzt `.handoff-bar`).
- [ ] `src/stores/sessions.ts`:

  ```ts
  /** Vorbelegung für „Neues Vorhaben“ aus einer Einstiegszeile (ADR 040). */
  export interface NewSessionPrefill {
    task: string;
    model: ModelId | null;
    repositoryIds: string[];
  }
  ```

  Zustand `newSessionPrefill: NewSessionPrefill | null` (Anfang `null`); neue Aktion `openNewSessionWith: (prefill: NewSessionPrefill) => void` = `set({ showNewSession: true, showSettings: false, showProjectOverview: false, newSessionPrefill: prefill })`. `openNewSession` und `closeNewSession` setzen zusätzlich `newSessionPrefill: null`. `openNewSession` bleibt ohne Parameter (wird als `onClick` weitergereicht).
- [ ] `NewSession.tsx`: am Anfang `const prefill: NewSessionPrefill | null = useSessionsStore.getState().newSessionPrefill;` (einmal je Mount, kein Abo); Initialisierer: `text` → `prefill?.task ?? ''`; `model` → `prefill?.model ?? (Einstellung) ?? 'sonnet'`; `repositoryIds` → `prefill?.repositoryIds ?? []`. Ist `isCodex` oder eine lokale Betriebsart aktiv, bleibt das Modell-Verhalten des Dialogs wie es ist (der Wert wird dort ohnehin nicht benutzt).
- [ ] Neu `src/features/chat/ProjectHandoffButton.tsx` (nutzt die Klassen aus `HandoffButton.css`): Props `{ line: HandoffLine }`. Klick: `isOpening` setzen; `let repositoryIds: string[] = [];` `try { repositoryIds = matchingRepositoryIds(line.text, await listRepositories()); } catch (reason: unknown) { console.error('Repositories für die Vorbelegung nicht ladbar', reason); }` dann `useSessionsStore.getState().openNewSessionWith({ task: taskOfProjectLine(line.text), model: line.model, repositoryIds })`. Markup wie `HandoffButton` (`<div className="handoff"><button className="handoff__button" …>`), Text „In neuem Vorhaben starten“, während des Ladens „Öffne …“, `title` = `'Öffnet „Neues Vorhaben“ mit dieser Zeile als Auftrag, dem Modell aus der Zeile und den Repositories, deren Name in der Zeile steht. Gestartet wird erst mit „Starten“.'`.
- [ ] Neu `src/features/chat/HandoffBar.tsx` + `HandoffBar.css`: Props `{ projectId: string; lines: readonly HandoffLine[]; onSessionCreated: (created: SessionSummary) => void }`. Markup `<div className="handoff-bar">`; je Zeile (Schlüssel = Index) `<div className="handoff-bar__row">`: bei `lines.length > 1` zuerst `<span className="handoff-bar__kind">{line.kind === 'session' ? 'Session' : 'Neues Vorhaben'}</span>` und `<span className="handoff-bar__excerpt" title={line.text}>{handoffExcerpt(line)}</span>`; dann `kind === 'session'` → `<HandoffButton projectId line onSessionCreated />`, sonst `<ProjectHandoffButton line />`. CSS (BEM, nur Tokens): `.handoff-bar` `margin-top: var(--space-lg)`, `display: grid`, `gap: var(--space-sm)`, `min-width: 0` (Breite = Spalte des Verlaufs); `__row` Flex, `align-items: center`, `gap: var(--space-md)`, `min-width: 0`; `__kind` Pille: `background: var(--color-accent-subtle)`, `color: var(--color-accent-text)`, `border-radius: var(--radius-full)` (fehlt das Token: den Radius der Pillen in `SessionHeader.css` übernehmen), `padding: 0 var(--space-sm)`, `font-size: var(--font-size-xs)`, `font-weight: 600`, `white-space: nowrap`; `__excerpt` `flex: 1`, `min-width: 0`, einzeilig mit Auslassung, `color: var(--color-fg-muted)`, `font-size: var(--font-size-sm)`. Aussehen nach Entwurf Zustand 1.
- [ ] `ChatTimeline.tsx`: `showsHandoff` = `session.handoffLines.length > 0 && !HANDOFF_HIDDEN_STATUSES.includes(session.status)`; im `case 'text'` `HandoffButton` durch `<HandoffBar projectId={session.projectId} lines={session.handoffLines} onSessionCreated={onSessionCreated} />` ersetzen (Bedingung `showsHandoff && entry.seq === answerSeq`); Import von `HandoffButton` entfernen.

### Doku

- [ ] [ADR 040](../../decisions/040-automatisch-weiter.md) „Automatisch weiter und mehrere Einstiegszeilen“ schreiben: Kontext (ADR 027, Zielbild Abschnitt 7: Sessions statt Unteragenten, Phasenwechsel ohne Klick) / Optionen (Automatik im Core vs. in der Oberfläche; mehrere „Weiter:“-Zeilen anhalten vs. parallel starten; Countdown + Kettenbremse vs. sofort; Speicher: vorhandene Spalte vs. neue) / Entscheidung (alle Punkte aus „Festgelegte Entscheidungen“ der README, knapp) / Konsequenzen (Haltegrund „merge“ greift auch bei „Merge-Gate“; nach Neustart kein Countdown). Status „angenommen“, Datum des Commits.
- [ ] ADR 027: unter „Status“ ergänzen „teilweise abgelöst durch [ADR 040](040-automatisch-weiter.md) (mehrere Zeilen, Modell im Core, automatisches Senden)“.
- [ ] `docs/code-map.md` Zeile „Chat“: `HandoffBar`, `ProjectHandoffButton` aufnehmen, ADR 040 verlinken; Zeile „Sessions“: `handoff.rs` beschreibt jetzt mehrere Zeilen.
- [ ] `docs/glossary.md` Eintrag „Einstiegszeile“: zwei Arten („Weiter: …“ → nächste Session; „Neues Vorhaben … : …“ → neues Vorhaben, Dialog vorbelegt), eine Antwort darf mehrere tragen; ADR 040 verlinken.
- [ ] `pnpm check` grün, Commit (Bindings mit).

## Report-Back
