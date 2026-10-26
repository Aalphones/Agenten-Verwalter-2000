# Automatisch weiter: Einstiegszeilen selbst senden, mehrere Einstiegszeilen

Ziel: (1) Eine Antwort darf mehrere Einstiegszeilen tragen — jede „Weiter: …“-Zeile bekommt ihren eigenen Knopf „In neuer Session weiter“, und eine Zeile „Neues Vorhaben … : …“ bekommt „In neuem Vorhaben starten“, der den Dialog „Neues Vorhaben“ vorbelegt öffnet. (2) Je Vorhaben lässt sich „Automatisch weiter“ einschalten: endet eine Antwort mit genau einer „Weiter:“-Zeile und keinem Haltegrund, startet der Verwalter nach 10 Sekunden Countdown die Folgesession selbst — Modell aus der Zeile, Zeile als erste Nachricht. Er hält an bei 🔴, einer Frage, dem Wort „Merge“, mehreren „Weiter:“-Zeilen und nach 6 automatischen Starts in Folge. Grundlage: [ADR 027](../../decisions/027-session-uebergabe.md) (Einstiegszeile, Knopf) und das Zielbild „Entwickeln in Sessions statt mit Unteragenten“ (Abschnitt 7: „die Einstiegszeile wird auf Wunsch automatisch gesendet“). Entwurf: [artifacts/entwurf-automatisch-weiter.html](artifacts/entwurf-automatisch-weiter.html).

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md) (Zeilen „Sessions“, „Chat“, „Vorhaben“, „Persistenz“), [docs/glossary.md](../../glossary.md), [docs/conventions/](../../conventions/), [ADR 027](../../decisions/027-session-uebergabe.md), [ADR 011](../../decisions/011-vorhaben-und-sessions.md), [ADR 032](../../decisions/032-wartet-auf-skript.md) (abgeschlossen, aber Skript läuft noch). Fehlerklassen geprüft (Vault: TypeScript, React): keine einschlägig — sie betreffen `fetch` und automatisierte Tests; für Rust und Tauri gibt es keine Einträge.

| # | Phase | Rating | Wave | Status |
|---|---|---|---|---|
| 1 | Mehrere Einstiegszeilen und „Neues Vorhaben“: Erkennung im Core, Knopf-Reihen, vorbelegter Dialog; ADR 040 | standard | 1 | complete |
| 2 | Schalter „Automatisch weiter“ je Vorhaben: Migration 14, Command, Schalter in Übersicht und unter der Antwort | standard | 2 | complete |
| 3 | Automatischer Start: Haltegründe, Countdown, Start, Abbrechen, Kettenbremse, Ansicht folgt; Doku | heikel | 3 | pending |
| 4 | Fehlerbehebung Changes: Arbeitsbäume über die geschriebenen Dateien finden (Struktur statt Name und Lage); Plan-Abschluss, Release | standard | 4 | pending |

**Rahmen:** strikt 1 → 2 → 3 → 4 (Phase 4 ist ein eigener Fehler in der Changes-Ansicht, kein Teil der Automatik; sie trägt den Plan-Abschluss, damit nur ein Release entsteht) — jede Phase schreibt in `sessions/model.rs`, `sessions/registry.rs` und die Knopf-Leiste unter der Antwort, keine zwei Phasen haben disjunkte Dateien. Direkt auf `main`, ein Commit pro Phase. `pnpm check` grün vor jedem Commit; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine neuen Abhängigkeiten (`regex` ist schon da). Bindings (`pnpm bindings`) mitcommitten. Keine automatisierten Tests, keine Smoke-Checkliste (Projektstand). Phase 3 läuft auf Opus (heikel: Thread, Sperren, Ablauf am Umschaltpunkt), 1 und 2 auf Sonnet. Planabschluss mit Versions-Tag (Minor-Version, [releases.md](../../conventions/releases.md)).

**Schätzung:** ~7,5 h (Phase 1 ~2 h, Phase 2 ~1 h, Phase 3 ~3 h, Phase 4 ~1,5 h).

## Scope

- **Drin:** mehrere Einstiegszeilen je Antwort (Art „Session“ und „Neues Vorhaben“), Modell aus der Zeile im Core erkannt; Knopf-Reihen unter der letzten Antwort; „In neuem Vorhaben starten“ mit vorbelegtem Auftrag, Modell und Repositories; Schalter je Vorhaben (gespeichert, Standard aus) in der Übersicht und unter der Antwort; Haltegründe, Countdown 10 s, Abbrechen, automatischer Start, Kettenbremse 6; Ansicht wechselt mit, wenn man auf die alte Session schaut; ADR 040, Code-Map, Glossar.
- **Draußen:** automatisches Starten eines neuen Vorhabens (braucht immer deine Repo-Auswahl); paralleles Starten mehrerer „Weiter:“-Zeilen; Countdown über einen Neustart der App hinweg; eigene Einstellung für Countdown-Dauer oder Kettenlänge; Kontext- oder Kontingent-Bremse (Zielbild Abschnitt 8, eigener Plan); Rolle „ohne TL;DR starten“ aus der Zeile; Änderungen an den Skills, die die Zeilen schreiben.

## Festgelegte Entscheidungen

Daraus entsteht in Phase 1 [ADR 040](../../decisions/040-automatisch-weiter.md) „Automatisch weiter und mehrere Einstiegszeilen“. Vergeben: bis 039 auf der Platte, 034 (`mitgelieferte-befehle`), 037 (`parallele-sessions`) und 038 (`umgebung`) reserviert — dieser Plan schreibt 040. Migration: 013 ist die letzte, dieser Plan schreibt 014; die geparkten Pläne brauchen keine.

- **Zwei Arten von Einstiegszeilen, erkannt im Core.** Art „Session“: Zeile beginnt mit `Weiter:` (wie ADR 027). Art „Vorhaben“: Zeile beginnt mit `Neues Vorhaben`, danach höchstens 80 Zeichen ohne Doppelpunkt, dann `:` und Text. Gesucht wird wie bisher von hinten, Code-Zaun-Zeilen und leere Zeilen zählen nicht, Bereinigung wie bisher (Zitat-Zeichen, `**`, Backticks). **Neu:** Einstiegszeilen zählen nicht gegen das Fenster — gesammelt werden alle Einstiegszeilen, bis fünf andere Zeilen gezählt sind. Reihenfolge = Reihenfolge in der Antwort.
- **Modell aus der Zeile im Core** (`(?i)\bModell\s+(fable|opusplan|opus|sonnet|haiku)\b`), mitgeliefert je Zeile. Die Oberfläche erkennt nichts mehr selbst — `modelOfHandoff` in TypeScript entfällt.
- **Gespeichert in der vorhandenen Spalte `sessions.handoff_line`**, mehrere Zeilen durch `\n` getrennt (eine Einstiegszeile enthält nie einen Zeilenumbruch). Keine Migration dafür; Altbestände mit einer Zeile lesen sich unverändert.
- **„In neuem Vorhaben starten“ startet nie selbst.** Öffnet „Neues Vorhaben“ mit: Auftrag = Text hinter dem ersten Doppelpunkt; Modell aus der Zeile (sonst Standard aus den Einstellungen); vorab angehakt jedes bekannte, vorhandene Repository, dessen Name in der Zeile steht (ohne Groß-/Kleinschreibung, links und rechts kein Buchstabe, keine Ziffer, kein `_` oder `-`). Grund: Repositories wählt der Mensch.
- **Schalter „Automatisch weiter“ je Vorhaben**, Spalte `projects.auto_handoff` (Migration 14), Standard aus. Zu sehen in der Übersicht des Vorhabens und unter einer Antwort mit mindestens einer „Weiter:“-Zeile.
- **Automatik im Core, nicht in der Oberfläche.** Grund: Sessions überleben die UI (Critical Rule 4) — ein geschlossenes Fenster darf den Start nicht verhindern, zwei Fenster dürfen ihn nicht doppelt auslösen. Ausgelöst, wenn eine Antwort mit „abgeschlossen“ endet (`TurnEnd::Completed`), kein Subagent mehr läuft und auf kein Skript gewartet wird (ADR 032); ebenso beim Einschalten des Schalters für jede Session des Vorhabens.
- **Haltegründe** (`HandoffHalt`), geprüft in dieser Reihenfolge: `red` — 🔴 irgendwo in der Antwort außerhalb von Code-Blöcken; `question` — eine der gezählten Nicht-Einstiegszeilen im Fenster endet nach Bereinigung mit `?`; `merge` — eine davon enthält „merge“ (ohne Groß-/Kleinschreibung); `severalLines` — mehr als eine „Weiter:“-Zeile (Zeilen „Neues Vorhaben“ zählen nicht mit); `pendingSession` — im Vorhaben steht schon eine andere Session im Status „Neu“; `chainLimit` — diese Session ist der 6. automatische Start in Folge; `cancelled` — du hast abgebrochen. Rückfragen mit Auswahl (`AskUserQuestion`) brauchen keine Regel: die Session steht dann auf „wartet auf dich“, nicht auf „abgeschlossen“.
- **Veraltete Zeile: still.** Hat im Vorhaben schon eine spätere Session (höhere Nummer, Status nicht „Neu“) begonnen, passiert nichts — wie beim Anzeige-Status „Wiedereinstieg“.
- **Countdown 10 s** (`AUTO_HANDOFF_DELAY`), sichtbar unter der Antwort mit Modell und „Abbrechen“. Gilt als Rohzustand mit Marke (`auto_handoff_token`): der Zeitgeber prüft beim Ablauf die Marke, nie die Uhr. Jede neue Antwort, jede Nachricht von dir, Abbrechen und Ausschalten erhöhen die Marke — ein laufender Zeitgeber verfällt dann still.
- **Start = Knopf ohne Mensch:** `create_in_project`, Modell aus der Zeile umstellen (schlägt das fehl: anhalten, nicht auf dem falschen Modell senden), dann die Zeile über `send` senden. Ein Fehler steht unter der alten Antwort („Automatischer Start gescheitert: …“).
- **Kettenbremse 6** (`AUTO_HANDOFF_CHAIN_LIMIT`): jede Session merkt sich im Speicher, der wievielte automatische Start in Folge sie ist (`auto_chain`); jede Nachricht von dir setzt 0. Grund: eine Schleife zweier Sessions verbrennt sonst unbemerkt das Kontingent; 6 deckt einen Plan mit bis zu sechs Phasen ohne Eingriff.
- **Nur im Speicher:** Countdown, Haltegrund, Marke, Kettenzähler. Nach einem Neustart läuft nichts weiter, der Knopf steht wieder da, die Kette beginnt bei 0.
- **Ansicht folgt:** Schaust du beim Start gerade auf die alte Session (Chat sichtbar, nicht Übersicht, Einstellungen oder „Neues Vorhaben“), wechselt die Auswahl auf die neue. Sonst erscheint sie nur in der Sidebar.

## Kontrakt

### Rust: Typen in `src-tauri/src/sessions/model.rs` (camelCase, `derive(TS)`)

```rust
/// Art einer Einstiegszeile (ADR 040).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum HandoffKind {
    /// „Weiter: …“ — nächste Session im selben Vorhaben.
    Session,
    /// „Neues Vorhaben … : …“ — Auftrag für ein neues Vorhaben.
    Project,
}

/// Eine Einstiegszeile am Ende einer Antwort (ADR 027, ADR 040).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HandoffLine {
    pub kind: HandoffKind,
    /// Die bereinigte Zeile, wie sie gesendet bzw. als Auftrag übernommen wird.
    pub text: String,
    /// `Modell <name>` aus der Zeile; `None` ohne Angabe.
    pub model: Option<ModelId>,
}

// Phase 3:
/// Warum eine Einstiegszeile nicht automatisch gesendet wird (ADR 040).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum HandoffHalt { Red, Question, Merge, SeveralLines, PendingSession, ChainLimit, Cancelled }

/// Stand der Automatik unter der letzten Antwort; nur im Speicher.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AutoHandoff {
    /// Startet zum Zeitpunkt `starts_at` (Millisekunden seit Epoche) auf `model` (`None` = übernommen).
    #[serde(rename_all = "camelCase")]
    Countdown { starts_at: f64, model: Option<ModelId> },
    #[serde(rename_all = "camelCase")]
    Halted { reason: HandoffHalt },
    #[serde(rename_all = "camelCase")]
    Failed { message: String },
}

/// Gesendet als `session://handoff-started`, nachdem eine Folgesession automatisch gestartet ist.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HandoffStartedEvent { pub from_session_id: String, pub to_session_id: String }
```

`SessionSummary`: `handoff_line: Option<String>` wird zu `pub handoff_lines: Vec<HandoffLine>` (Phase 1); dazu `pub auto_handoff: Option<AutoHandoff>` (Phase 3). `ProjectSummary` (`src-tauri/src/projects/model.rs`): `pub auto_handoff: bool` (Phase 2).

### Rust: Funktionen

- `src-tauri/src/sessions/handoff.rs` (Phase 1): `pub fn handoff_lines(text: &str) -> Vec<HandoffLine>`, `pub fn parse_line(cleaned: &str) -> Option<HandoffLine>`, `pub fn join(lines: &[HandoffLine]) -> Option<String>`, `pub fn split(stored: Option<&str>) -> Vec<HandoffLine>`; Phase 3: `pub fn stop_reason(text: &str) -> Option<HandoffHalt>`.
- Commands (Phase 2 / 3): `project_set_auto_handoff(project_id: String, enabled: bool) -> Result<(), CommandError>` in `commands/projects.rs`; `session_cancel_auto_handoff(session_id: String) -> Result<(), CommandError>` in `commands/sessions.rs`. Beide in `src-tauri/src/lib.rs` registrieren (neben `commands::projects::project_rename`).
- Ereignis (Phase 3): `HANDOFF_STARTED_EVENT = "session://handoff-started"` mit `HandoffStartedEvent`.

### TS (Oberfläche)

- `src/lib/projects.ts`: `setProjectAutoHandoff(projectId: string, enabled: boolean): Promise<void>` (Phase 2).
- `src/lib/sessions.ts`: `cancelAutoHandoff(sessionId: string): Promise<void>`, `onHandoffStarted(callback: (event: HandoffStartedEvent) => void): Promise<UnlistenFn>` (Phase 3).
- `src/stores/sessions.ts`: `NewSessionPrefill { task: string; model: ModelId | null; repositoryIds: string[] }`, Zustand `newSessionPrefill`, Aktion `openNewSessionWith(prefill)` (Phase 1).
- `src/features/chat/HandoffBar.tsx`: Props `projectId`, `lines: HandoffLine[]`, `onSessionCreated`; Phase 2 + `autoHandoff: boolean`; Phase 3 + `autoState: AutoHandoff | null`, `sessionId`.

## Finale AK

1. Eine Antwort mit zwei „Weiter:“-Zeilen und einer Zeile „Neues Vorhaben im X: …“ zeigt drei Knopf-Reihen in Antwort-Reihenfolge; jeder „Weiter:“-Knopf legt eine Session mit seiner Zeile im Entwurf an, „In neuem Vorhaben starten“ öffnet den vorbelegten Dialog.
2. Mit eingeschaltetem Schalter startet nach einer Antwort mit genau einer „Weiter:“-Zeile ohne Haltegrund nach 10 s eine neue Session auf dem Modell der Zeile, mit der Zeile als erster Nachricht; die Ansicht wechselt mit, wenn die alte Session offen war.
3. Bei jedem Haltegrund startet nichts, und die Zeile unter der Antwort nennt den Grund.
4. Ausgeschaltet (Standard) verhält sich alles wie bisher, abgesehen von den Knopf-Reihen.
5. `pnpm check` grün.

## Risiken und Konfidenz

- 🟡 **Haltegrund „merge“ greift auch bei „Merge-Gate“ in der TL;DR-Zeile.** Gewollt vorsichtig: lieber einmal von Hand klicken als ungewollt in den Merge laufen. Zeigt der Betrieb zu viele Fehlhalte, ist die Regel eine Zeile in `stop_reason`.
- 🟡 **Unsicher: der Zeitgeber-Thread und die Sperren** (Phase 3). `fire` ruft `create_in_project`, `set_model` und `send` — jede nimmt eigene Sperren. Check: in Phase 3 vor dem Commit per Grep belegen, dass `consider` und `fire` nie unter einer Session- oder Vorhaben-Sperre aufgerufen werden (`consider` steht in `update` hinter dem Block mit `lock_loaded`, `fire` läuft im eigenen Thread), und den Ablauf einmal in einem Test-Vorhaben fahren: Schalter an, Agent antworten lassen mit `Weiter: Test – Modell haiku`, Countdown abwarten.
- 🟡 **Unsicher: ob `send` aus einem fremden Thread alles auslöst, was der Klick auslöst** (Auto-Titel, TL;DR des Vorhabens). Check in Phase 3: nach dem automatischen Start trägt die neue Session in der Sidebar binnen Sekunden einen eigenen Namen, und der erste Eintrag ihres Verlaufs enthält den Stand des Vorhabens, wenn die alte Session einen hatte — Vergleich mit einem Klick auf den Knopf.
- 🟡 **Parallele geparkte Pläne:** „Parallele Sessions“ (ADR 037) fasst `send` an (Satz an den Agenten). Wer zuerst umgesetzt wird, ist egal; der zweite liest `send` neu, statt Zeilennummern aus dem Plan zu trauen.

## Report-Back

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
