# Session-Übergabe: „wartet auf Wiedereinstieg“ und „In neuer Session weiter“

Ziel: Endet die letzte Antwort einer Session mit einer Einstiegszeile („Weiter: …“), (1) zeigt die Sidebar die Session und ihr Vorhaben mit einem eigenen Symbol „wartet auf Wiedereinstieg“ statt des grünen Hakens, und (2) steht unter dieser Antwort ein Knopf „In neuer Session weiter“. Ein Klick legt im selben Vorhaben eine neue Session an (Modell, Modus, Denkaufwand und Repositories wie bisher), wechselt dorthin und setzt die Einstiegszeile in deren Eingabefeld. Gesendet wird erst mit dem Klick des Nutzers — er kann vorher Modell oder Denkaufwand ändern (z. B. Sonnet für die Umsetzung). Heute kopiert der Nutzer die Zeile von Hand, und die Sidebar zeigt eine solche Session als „abgeschlossen“.

Kontext für den Umsetzer: [AGENTS.md](../../AGENTS.md), [docs/code-map.md](../code-map.md) (Zeilen „Vorhaben“, „Sessions“, „Chat“, „Persistenz“), [docs/glossary.md](../glossary.md), [ADR 011](../decisions/011-vorhaben-und-sessions.md) (Sessions im Vorhaben), [ADR 019](../decisions/019-letzte-aktivitaet-und-ungelesen.md) (Muster: Spalte an `sessions`, gepflegt im Zustand, gemeldet in `SessionSummary`), [docs/conventions/rust.md](../conventions/rust.md), [docs/conventions/react.md](../conventions/react.md), [docs/conventions/typescript.md](../conventions/typescript.md), [docs/conventions/tailwind.md](../conventions/tailwind.md), [docs/conventions/linting.md](../conventions/linting.md). Vault-Fehlerklassen geprüft (React, TypeScript; für Rust und Tauri gibt es keine Entity): keine einschlägig — alle betreffen automatisierte Tests oder `fetch`, beides kommt hier nicht vor.

## Phasen

| # | Phase | Rating | Wave | Status |
|---|---|---|---|---|
| 1 | Einstiegszeile im Core erkennen, speichern, melden; Sidebar-Symbol „wartet auf Wiedereinstieg“ | standard | 1 | pending |
| 2 | Knopf „In neuer Session weiter“: Anlegen, Modell aus der Zeile, Entwurf, Wechsel; ADR 027, Doku | standard | 2 | pending |

Sequenziell, weil Phase 2 das Feld `handoffLine` aus Phase 1 liest. Phase 1 liefert schon etwas Sichtbares (das Symbol). Umsetzung auf `feature/session-uebergabe` im Arbeitsbaum `Agenten-Verwalter-2000-wt-session-uebergabe`, ein Commit je Phase. Vor jedem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine automatisierten Tests (Projektprofil); geprüft wird mit der Smoke-Checkliste.

**Schätzung:** ~3 h (Phase 1 ~1,5 h, Phase 2 ~1,5 h).

## Scope

- **Drin:** Erkennung der Einstiegszeile im Core, gespeichert je Session (Migration 9), gemeldet in `SessionSummary.handoffLine`; Anzeige-Status „wartet auf Wiedereinstieg“ für Session-Zeile und Vorhaben-Zeile der Sidebar samt Meta-Zeile des Vorhabens; Knopf unter der Antwort; neue Session anlegen, in die Liste aufnehmen, auswählen; Einstiegszeile in den Entwurf; Fokus ins Eingabefeld; Fehlerzeile am Knopf.
- **Draußen:** automatisches Senden; Umbenennen der neuen Session nach dem Titel der Zeile; Beenden oder Archivieren der alten Session; Symbol in den Kopfzeilen (`SessionHeader`, `ProjectHeader`) und in den Session-Karten der Übersicht; Nachtragen für Sessions, deren letzte Antwort vor der Migration kam.

## Belege (gelesen 2026-10-05)

- `src-tauri/src/sessions/registry.rs:1939–1942` `AgentEvent::Text(text)` → `push_entry(… ChatEntry::Text { seq, text })` — Textantworten kommen vollständig, nicht gestückelt; einzige Stelle, die `ChatEntry::Text` anlegt (`tldr/transcript.rs` und `agents/event.rs` lesen nur). `push_user` (`registry.rs:1810–1830`) hängt jede Nutzernachricht an und ruft `touch_activity` (setzt `outbox.summary_dirty = true`).
- Muster Spalte + Zustand + Meldung: Migration `008_session_activity.sql`, `SessionState.last_activity_at` (`registry.rs:182`, Initialisierung `:1532`, Wiederherstellung `:1585`), `row_of` (`:2460`), `summarize` (`:2522`), `SessionRow` / `StoredRow` / `upsert` / `load_active` in `src-tauri/src/db/sessions.rs` (Spaltenindex von `seen_at` = 19), Migrationsliste `src-tauri/src/db/migrations.rs:16`.
- `src-tauri/src/sessions/registry.rs:500` `create_in_project`: neue Session im Status `new`, Werte von der Session mit der **höchsten Nummer**; gibt es schon eine Session `new`, kommt **diese** zurück. Der Core meldet den Anfangsstatus nicht — `src/app/App.tsx:143–147` `handleSessionCreated` = `upsertSession` (aus `useSessionSummaries()`, `App.tsx:34`, kein Store) + `selectSession`. `selectSession` setzt `showProjectOverview`, `showNewSession`, `showSettings` auf `false` (`src/stores/sessions.ts:53`).
- Eine Session `new` zeigt `NewSessionIntro` (`src/features/chat/ChatView.tsx:108–116`): Modell/Modus/Denkaufwand übernommen, vor der ersten Nachricht änderbar.
- Entwurf: `src/stores/chat.ts` (`drafts`, `setDraft`), gelesen von `Composer.tsx:60`; Muster „Entwurf setzen + Fokus“: `src/features/background/mention.ts` (`COMPOSER_INPUT_ID = 'composer-input'`, `requestAnimationFrame`).
- Textantworten rendert `ChatTimeline.renderEntry` → `case 'text'` (`ChatTimeline.tsx:264–265`); Muster „nur am letzten Eintrag einer Art“: `findLastErrorSeq` (`:109`, `:375`). Zeilenhöhen misst der Virtualisierer dynamisch (`ref={virtualizer.measureElement}`, `:352`).
- Sidebar: `SidebarItem` zeigt `<StatusIcon status={session.status} size={10} />` (`src/app/SidebarItem.tsx:57`); `SidebarProject` zeigt `<StatusIcon status={urgent === null ? 'completed' : urgent.status} size={12} />` (`SidebarProject.tsx:111`), `urgent = mostUrgent(sessions)`, `isDone` (`:63`), Meta-Zeile `projectMetaLine(sessions)`; Rangfolge `URGENCY` und `SHORT_STATUS` in `src/features/projects/projectStatus.ts`. `Sidebar.tsx` hat alle Sessions als Prop `sessions` und reicht je Vorhaben `projectSessions` an `SidebarProject` (`Sidebar.tsx:177–182`).
- `StatusIcon` (`src/components/StatusIcon.tsx`): Klasse `status-icon--${status}`, Form je Status in `renderShape`; Farben in `StatusIcon.css` über `--color-status-*` aus `src/styles/theme.css` (hell `:129–134`, dunkel `:183–188`).

## Festgelegte Entscheidungen

Daraus entsteht [ADR 027](../decisions/027-session-uebergabe.md) „Session-Übergabe über die Einstiegszeile“. Vergeben: 001–023 auf der Platte, 024–026 in den geparkten Plänen „MCP-Anmeldung“, „Git-Werkzeuge“, „Artefakte“; dieser Plan schreibt 027.

- **Erkennung am Text, im Core, an einer Stelle.** Die Einstiegszeile ist eine Textzeile, die mit `Weiter:` beginnt — so geben die Umsetzungs-Skills sie heute aus. Der Core prüft jede neue Textantwort und merkt sich das Ergebnis je Session (`handoff_line`); die Oberfläche liest nur das Feld. Grund: die Sidebar kennt keine Chat-Einträge, und zwei Erkennungen (Rust + TS) liefen auseinander. Verworfen: eigenes Werkzeug oder Steuerzeichen des Agenten (Änderung in jedem Skill, kein Mehrwert); Erkennung nur in der Oberfläche (Sidebar hätte keine Daten).
- **Regel der Erkennung:** in den **letzten fünf nicht leeren Zeilen** der Antwort (Code-Zaun-Zeilen ```` ``` ```` zählen nicht), damit ein „Weiter:“ mitten in einer langen Antwort nichts auslöst; eine TL;DR-Zeile danach ist erlaubt.
- **Lebensdauer:** jede neue Textantwort überschreibt `handoff_line` (Treffer oder `None`); jede Nutzernachricht setzt es auf `None`. Gespeichert in Spalte `sessions.handoff_line` (Migration 9), ohne Nachtragen für Altbestände.
- **Anzeige-Status „Wiedereinstieg“ (`'handoff'`) nur in der Oberfläche,** kein neuer `SessionStatus` im Core. Eine Session zeigt ihn genau dann, wenn: `status === 'completed'` **und** `handoffLine !== null` **und** keine Session desselben Vorhabens mit höherer Nummer einen anderen Status als `new` hat. Sobald die Folgesession gestartet ist, zeigt die alte wieder den grünen Haken — ohne dass der Core etwas zurücksetzt.
- **Rangfolge im Vorhaben:** `waiting, error, running, starting, paused, handoff, new, completed, cancelled` — eine laufende oder wartende Session ist dringender als ein offener Wiedereinstieg.
- **Symbol:** Kreis mit Pfeil nach rechts („weiter“), Farbe neues Token `--color-status-handoff` = Akzentfarbe (`var(--color-accent)`), hell und dunkel. Anders als Haken (grün) und „wartet auf dich“ (Ring mit Punkt, Bernstein). Text: „wartet auf Wiedereinstieg“.
- **Knopf: Entwurf statt Senden.** Setzt die Zeile in den Entwurf der neuen Session; gesendet wird mit dem normalen Senden. Grund: vor der ersten Nachricht lassen sich Modell und Denkaufwand ändern — das ist der Sparhebel. Vorhandener Entwurf der Ziel-Session: leer → Zeile; enthält die Zeile schon → unverändert; sonst Zeile + Leerzeile + alter Entwurf.
- **Modell aus der Zeile.** Die Umsetzungs-Skills schreiben die Modell-Empfehlung für die nächste Phase in die Einstiegszeile (`… Modell sonnet …`). Nennt die Zeile `Modell <fable|opus|sonnet|haiku>` (Groß-/Kleinschreibung egal) und weicht das vom übernommenen Modell ab, stellt der Knopf die neue Session darauf um, bevor der Entwurf gesetzt wird. Ohne Angabe bleibt das übernommene Modell. Denkaufwand und Modus bleiben immer übernommen. Schlägt das Umstellen fehl, bleiben Session und Entwurf, die Fehlerzeile sagt „Modell nicht umgestellt: …“.
- **Knopf nur unter der letzten Textantwort,** nur wenn `session.handoffLine !== null` und Status nicht `starting`/`running`/`new`. Steht im Vorhaben schon eine Session `new`, wird sie wiederverwendet (Verhalten von `create_in_project`).

## Kontrakt

### Rust: `src-tauri/src/sessions/handoff.rs` (neu, in `sessions/mod.rs` als `pub mod handoff;`)

```rust
/// Die Einstiegszeile am Ende einer Antwort (ADR 027); `None`, wenn keine der letzten fünf nicht
/// leeren Zeilen mit „Weiter:“ beginnt.
pub fn handoff_line(text: &str) -> Option<String>;
```

Genau so: `text.lines().rev()`; Zeilen, die nach `trim()` leer sind oder mit ```` ``` ```` beginnen, überspringen und nicht zählen. Jede gezählte Zeile bereinigen: `trim()`, führendes `>` und danach Leerraum entfernen, alle `**` entfernen, führende und abschließende `` ` `` entfernen (`trim_matches('`')`), erneut `trim()`. Beginnt sie mit `"Weiter:"` und ist `chars().count() > "Weiter:".len() + 1` → `Some(bereinigt)`. Nach fünf gezählten Zeilen ohne Treffer → `None`. Konstanten `HANDOFF_PREFIX = "Weiter:"`, `HANDOFF_WINDOW = 5`.

### Rust: Zustand, Speicher, Meldung

- `src-tauri/src/db/migrations/009_session_handoff.sql`: `ALTER TABLE sessions ADD COLUMN handoff_line TEXT;` — eintragen in `src-tauri/src/db/migrations.rs` hinter `008`.
- `src-tauri/src/db/sessions.rs`: `SessionRow` und `StoredRow` bekommen `pub handoff_line: Option<String>` (Doc: „Einstiegszeile der letzten Antwort (ADR 027); `None` ohne“). `StoredRow::read`: `handoff_line: row.get(20)?`; `into_row` reicht durch. `upsert`: Spalte `handoff_line` als 18. Wert (`?18`) in `INSERT`, `handoff_line = excluded.handoff_line` im `UPDATE`, `row.handoff_line` in `params!`. `load_active`: `, handoff_line` hinter `seen_at` im `SELECT`. Weitere `SELECT`s auf `sessions` mit `StoredRow::read` (per Grep `StoredRow::read` belegen) bekommen dieselbe Spalte an derselben Stelle.
- `src-tauri/src/sessions/registry.rs`:
  - `SessionState`: Feld `handoff_line: Option<String>` (neben `last_activity_at`), Initialisierung `None` in `SessionState::new`, Wiederherstellung `state.handoff_line = row.handoff_line.clone();` neben `state.last_activity_at = row.last_activity_at;`.
  - `AgentEvent::Text(text)`: vor `push_entry` `let handoff = handoff::handoff_line(&text); if self.handoff_line != handoff { self.handoff_line = handoff; outbox.summary_dirty = true; }`.
  - `push_user`: `self.handoff_line = None;` (`summary_dirty` setzt `touch_activity` schon).
  - `row_of`: `handoff_line: state.handoff_line.clone()`; `summarize`: `handoff_line: state.handoff_line.clone()`.
- `src-tauri/src/sessions/model.rs` `SessionSummary`: `/// Einstiegszeile der letzten Antwort („Weiter: …“, ADR 027); `None` ohne oder nach einer neueren Nutzernachricht.` `pub handoff_line: Option<String>,` hinter `unread`. Danach `pnpm bindings` (`SessionSummary.ts` bekommt `handoffLine: string | null`).
- Weitere Stellen, die `SessionSummary { … }` oder `SessionRow { … }` vollständig aufbauen, meldet der Compiler; dort das Feld ergänzen (`None` bzw. aus dem Zustand).

### TS: Anzeige-Status (Phase 1)

`src/features/sessions/sessionStatus.ts`:

```ts
/** Status, wie die Sidebar ihn zeigt: `handoff` = abgeschlossen mit Einstiegszeile, Folgesession noch nicht gestartet (ADR 027). */
export type DisplayStatus = SessionStatus | 'handoff';

/** `sessions`: alle bekannten Sessions (oder die des Vorhabens). */
export function displayStatus(session: SessionSummary, sessions: readonly SessionSummary[]): DisplayStatus;

export const HANDOFF_LABEL = 'wartet auf Wiedereinstieg';
```

`displayStatus`: `session.status === 'completed' && session.handoffLine !== null && !sessions.some((other) => other.projectId === session.projectId && other.number > session.number && other.status !== 'new')` → `'handoff'`, sonst `session.status`.

`src/components/StatusIcon.tsx`: Prop `status: DisplayStatus` (Import aus `sessionStatus.ts`); `renderShape` Fall `'handoff'`:

```tsx
<>
  <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
  <path d="M4 6h3.6M5.9 4.2 7.7 6 5.9 7.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
</>
```

`StatusIcon.css`: `&--handoff { color: var(--color-status-handoff); }`. `src/styles/theme.css`: `--color-status-handoff: var(--color-accent);` im hellen und im dunklen Block, jeweils hinter `--color-status-completed`.

`src/features/projects/projectStatus.ts`:

- `URGENCY: readonly DisplayStatus[]` = `['waiting', 'error', 'running', 'starting', 'paused', 'handoff', 'new', 'completed', 'cancelled']`.
- `SHORT_STATUS: Record<DisplayStatus, string>`, neu `handoff: HANDOFF_LABEL`.
- `mostUrgent(sessions)`: vergleicht `URGENCY.indexOf(displayStatus(session, sessions))` statt `session.status`; Rückgabe bleibt die Session.
- `projectMetaLine(sessions)`: `const status = displayStatus(urgent, sessions);` — bei einer Session: `status === 'handoff' ? HANDOFF_LABEL : metaLine(urgent)`; sonst wie bisher, nur mit `status` statt `urgent.status` (bei `'handoff'` also `„N Sessions · #K wartet auf Wiedereinstieg“`).

`src/app/SidebarProject.tsx`: `const urgentStatus: DisplayStatus = urgent === null ? 'completed' : displayStatus(urgent, sessions);` → `<StatusIcon status={urgentStatus} size={12} />`; `isDone` = `urgentStatus === 'completed' || urgentStatus === 'cancelled'` (ein offener Wiedereinstieg ist nicht „erledigt“); `isMetaHighlighted(urgent.status)` bleibt.

`src/app/SidebarItem.tsx`: neue Prop `status: DisplayStatus` → `<StatusIcon status={status} size={10} />`; `src/app/Sidebar.tsx` `renderSession`: `status={displayStatus(session, sessions)}` (`sessions` = Prop der Sidebar).

### TS: Knopf (Phase 2)

- `src/features/chat/handoff.ts` (neu): `/** `seq` der letzten Textantwort, wenn nach ihr keine Nutzernachricht steht; sonst `null`. */ export function lastAnswerSeq(entries: readonly ChatEntry[]): number | null;` — von hinten: `user` → `null`, `text` → `entry.seq`, sonst weiter; Ende → `null`. Dazu `/** Das Modell, das die Einstiegszeile empfiehlt (`Modell sonnet`); `null` ohne Angabe. */ export function modelOfHandoff(line: string): ModelId | null;` — Muster `/\bModell\s+(fable|opus|sonnet|haiku)\b/i`, Treffer klein geschrieben als `ModelId`.
- Modell umstellen: `setSessionModel(sessionId, model)` aus `src/lib/sessions.ts` wirkt auch bei einer Session `new` ohne Agent (`send_control` kehrt ohne Prozess mit `Ok` zurück, `registry.rs:1920–1923`; `set_model` setzt `summary_dirty`, `registry.rs:1039–1058`) — der Composer nutzt denselben Aufruf (`Composer.tsx:160`).
- `src/features/background/mention.ts`: `const COMPOSER_INPUT_ID` → `export const COMPOSER_INPUT_ID`.
- `src/features/chat/HandoffButton.tsx` + `HandoffButton.css` (neu):

  ```tsx
  interface HandoffButtonProps {
    projectId: string;
    /** Die Einstiegszeile, die in den Entwurf der neuen Session kommt. */
    line: string;
    /** Nimmt die angelegte Session in die Liste und wählt sie aus (`handleSessionCreated` in `App`). */
    onSessionCreated: (created: SessionSummary) => void;
  }
  ```

  Zustand `isCreating`, `errorMessage` (Muster `ProjectOverview.createSession`, `ProjectOverview.tsx:60–70`). Klick als `async`-Ablauf: `created = await createSessionInProject(projectId)` (Fehler → `setErrorMessage(commandErrorText(reason))`, Ende); `onSessionCreated(created)`; `model = modelOfHandoff(line)`; ist `model !== null && model !== created.model` → `await setSessionModel(created.id, model)`, Fehler → `setErrorMessage(`Modell nicht umgestellt: ${commandErrorText(reason)}`)` und trotzdem weiter; dann `setHandoffDraft(created.id, line)`; `focusComposer()`; zuletzt `setIsCreating(false)`. `setHandoffDraft` (lokal): `current = useChatStore.getState().drafts[id] ?? ''`; leer → `line`; `current.includes(line)` → nichts; sonst `` `${line}\n\n${current}` ``. `focusComposer`: `window.requestAnimationFrame(() => { document.getElementById(COMPOSER_INPUT_ID)?.focus(); })`. Markup `<div className="handoff">` + `<button type="button" className="handoff__button" title={HANDOFF_TITLE} disabled={isCreating}>{isCreating ? 'Lege Session an …' : 'In neuer Session weiter'}</button>` + bei Fehler `<p className="handoff__error" role="alert">`. `HANDOFF_TITLE = 'Legt im Vorhaben eine neue Session an – Modell, Modus und Repositories wie bisher – und setzt diese Zeile in ihr Eingabefeld. Gesendet wird erst, wenn du auf Senden klickst.'`. CSS BEM, nur Tokens: Textknopf wie `mcp-server__reconnect` (`src/features/mcp/McpServerRow.css`), aber in `--color-status-handoff`; Fehlerzeile wie `new-session-intro__error` (`src/features/projects/NewSessionIntro.css`); `.handoff` Abstand nach oben wie zwischen zwei Absätzen.
- Anschluss: `App.tsx` `<ChatView … onSessionCreated={handleSessionCreated} />`; `ChatView.tsx` Prop `onSessionCreated` in `ChatViewProps`, weiter an `ChatTimeline`; `ChatTimeline.tsx` Prop `onSessionCreated`, neben `lastErrorSeq`: `const answerSeq = useMemo(() => lastAnswerSeq(entries), [entries]);` und `const showsHandoff = session.handoffLine !== null && !['starting', 'running', 'new'].includes(session.status);`. `case 'text'`:

  ```tsx
  case 'text':
    return (
      <>
        <TextBlock text={entry.text} />
        {showsHandoff && session.handoffLine !== null && entry.seq === answerSeq && (
          <HandoffButton projectId={session.projectId} line={session.handoffLine} onSessionCreated={onSessionCreated} />
        )}
      </>
    );
  ```

## AK Phase 1

1. Endet die letzte Antwort mit „Weiter: …“ — auch in Backticks, fett, in einem Code-Block oder mit einer TL;DR-Zeile danach — und ist die Session abgeschlossen, zeigt ihre Sidebar-Zeile das Pfeil-Symbol in Akzentfarbe statt des grünen Hakens.
2. Ohne Einstiegszeile, mit „Weiter:“ nur vor den letzten fünf nicht leeren Zeilen, nach einer weiteren Nutzernachricht oder während der Agent läuft: kein Pfeil.
3. Die Vorhaben-Zeile zeigt den Pfeil, wenn keine Session dringender ist (Rangfolge oben); ihre Meta-Zeile lautet „N Sessions · #K wartet auf Wiedereinstieg“, bei einer einzigen Session „wartet auf Wiedereinstieg“; der Name des Vorhabens ist nicht als „erledigt“ gedämpft.
4. Wird eine Folgesession im Vorhaben gestartet (erste Nachricht gesendet), zeigt die alte wieder den grünen Haken.
5. Nach einem Neustart der App ist der Pfeil wieder da (Spalte `handoff_line` gefüllt — `sqlite3` auf eine **Kopie** der Datenbank, nie auf `%USERPROFILE%\.verwalter\verwalter.db`).
6. `pnpm check` grün.

## AK Phase 2

1. Unter genau der letzten Antwort einer Session mit Pfeil steht der Knopf „In neuer Session weiter“; unter keiner anderen Antwort; nicht während der Agent läuft.
2. Klick: in der Sidebar erscheint eine neue Session (Nummer +1), sie ist ausgewählt, zeigt „Neue Session im Vorhaben …“, das Eingabefeld enthält die Einstiegszeile mit Fokus; nichts wurde gesendet. Die alte Session zeigt weiter den Pfeil (die neue ist noch `new`).
3. Nennt die Zeile `Modell sonnet` (bzw. ein anderes Modell), steht die neue Session nach dem Klick auf diesem Modell; ohne Angabe auf dem übernommenen. Modell und Denkaufwand lassen sich vor dem Senden ändern; Senden startet sie mit der Zeile als erster Nachricht; danach zeigt die alte den grünen Haken.
4. Gibt es im Vorhaben schon eine Session „Neu“, wählt der Klick diese aus; ihr Entwurf bleibt hinter der Zeile erhalten.
5. Schlägt das Anlegen fehl, steht die Meldung unter dem Knopf; der Knopf ist wieder klickbar.
6. Der Knopf erklärt sich per Tooltip (`title`).
7. `pnpm check` grün.

## Checkliste

Phase 1:

- [ ] Arbeitsbaum + Branch `feature/session-uebergabe` von `origin/main`
- [ ] Rust: `handoff.rs`, Migration 9, `db/sessions.rs`, Zustand/Ereignis/`push_user`/`row_of`/`summarize`, `SessionSummary` (Kontrakt oben)
- [ ] `pnpm bindings`
- [ ] TS: `DisplayStatus`/`displayStatus`/`HANDOFF_LABEL`, `StatusIcon` + CSS + Token, `projectStatus.ts`, `SidebarProject`, `SidebarItem`, `Sidebar`
- [ ] `docs/code-map.md`: Zeile „Sessions“ um `handoff.rs` und `displayStatus`, Zeile „Persistenz“ um Migration 9
- [ ] Smoke 1, 2, 5 (unten), Ergebnis in „Report-Back“
- [ ] `pnpm check` grün, Commit `feat(sessions): abgeschlossene Session mit Einstiegszeile in der Sidebar als „wartet auf Wiedereinstieg“ zeigen`

Phase 2:

- [ ] `handoff.ts`, `HandoffButton.tsx` + `.css`, `COMPOSER_INPUT_ID` exportieren, Props durch `App` → `ChatView` → `ChatTimeline`
- [ ] ADR 027 (Kontext / Optionen / Entscheidung / Konsequenzen aus „Festgelegte Entscheidungen“)
- [ ] `docs/code-map.md` Zeile „Chat“: `handoff` und `HandoffButton` aufnehmen, ADR 027 verlinken
- [ ] `docs/glossary.md`: Eintrag „Einstiegszeile“ — Zeile „Weiter: …“ am Ende einer Agenten-Antwort; die Sidebar zeigt die Session dann als „wartet auf Wiedereinstieg“, „In neuer Session weiter“ startet daraus die nächste Session des Vorhabens
- [ ] Smoke 3, 4, 6 (unten), Ergebnis in „Report-Back“
- [ ] `pnpm check` grün, Commit `feat(chat): aus der Einstiegszeile in einer neuen Session weiterarbeiten`, Push des Branches

## Smoke-Checkliste (Wackelstellen zuerst)

1. **Formen der Zeile** (P1 AK 1, 2): den Agenten nacheinander antworten lassen mit der Zeile in Backticks, fett (`**Weiter:** …`), in einem Code-Block und mit `**TL;DR:** …` danach → jedes Mal Pfeil in der Sidebar; eine Antwort mit „Weiter:“ als erster Zeile und sechs Absätzen danach → Haken. Wackelt, weil die Agenten die Zeile unterschiedlich setzen.
2. **Vorhaben-Zeile** (P1 AK 3, 4): Vorhaben mit zwei Sessions, die neuere endet mit Einstiegszeile → Vorhaben zeigt Pfeil und „2 Sessions · #2 wartet auf Wiedereinstieg“; eine dritte Session anlegen und senden → #2 zeigt Haken, das Vorhaben den Zustand von #3. Wackelt, weil die Rangfolge jetzt einen Anzeige-Status kennt, den der Core nicht hat.
3. **Zeilenhöhe im Verlauf** (P2 AK 1): Knopf erscheint unter der Antwort, nichts überlappt, der Verlauf springt nicht; eine weitere Nachricht senden → Knopf weg. Wackelt, weil die Zeile ihre Höhe nachträglich ändert.
4. **Übergabe** (P2 AK 2, 3): Opus-Session mit Zeile `Weiter: Test — Modell sonnet, Phase 2, nächster Schritt: Smoke` → Klick → neue Session ausgewählt, Modell-Menü zeigt Sonnet, Eingabefeld mit Zeile und Fokus; senden → startet auf Sonnet mit der Zeile als erster Nachricht; alte Session zeigt Haken. Gegenprobe: Zeile ohne „Modell“ → neue Session auf Opus.
5. **Neustart** (P1 AK 5): App beenden und starten → Pfeil wieder da.
6. **Wiederverwendung** (P2 AK 4): in der Übersicht des Vorhabens eine Session anlegen, nicht senden, etwas eintippen; zurück, Knopf → dieselbe Session, Zeile vor dem getippten Text.

## Risiken

- 🟡 Die Erkennung hängt am Wortlaut „Weiter:“. Gibt ein Skill die Zeile anders aus, bleibt der Haken und kein Knopf erscheint — schlimmstenfalls bleibt es beim Kopieren von Hand.
- 🟡 Sessions, deren letzte Antwort vor der Migration kam, zeigen erst nach ihrer nächsten Antwort den Pfeil.
- 🟡 Die neue Session übernimmt die Werte der Session mit der höchsten Nummer, nicht zwingend die der Session, in der geklickt wurde; beim Übergeben vom neuesten Stand ist es dieselbe.

## Report-Back

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
