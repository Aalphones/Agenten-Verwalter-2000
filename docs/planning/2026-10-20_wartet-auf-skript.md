# Wartet auf Skript: Sessions mit laufendem Hintergrund-Befehl nicht als fertig zeigen

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | Core: `SessionSummary.awaitedScript` ermitteln und bei jeder Änderung melden | standard | pending |
| 2 | Oberfläche: Anzeige-Status „wartet auf Skript“ mit eigenem Symbol, eigener Farbe und laufender Uhr | standard | pending |

## Ziel

Hat der Agent seine Antwort abgegeben, läuft aber noch ein Hintergrund-Befehl, auf dessen Ende er wartet (Test-Suite, Build, Skript, `Monitor`-Aufruf), zeigt die Sidebar die Session heute mit grünem Haken als abgeschlossen. Künftig zeigt sie „wartet auf Skript“ mit Sanduhr in Violett und der Laufzeit des Befehls, die jede Sekunde weiterzählt.

## Entscheidungen (mit dem User am 2026-10-20 festgelegt)

- **Fortschritt:** nur laufende Uhr („läuft seit 2:14“). Kein Balken, keine Restzeit, kein Auslesen der Ausgabe.
- **Was zählt als „wartet auf Skript“:** Session-Status `completed` und mindestens ein Hintergrund-Eintrag der Art `Process` mit Zustand `Running` **ohne** erkannte lokale Adresse (`url` leer). Ein Dev-Server, der eine `localhost`-Adresse ausgibt, zählt nicht — sonst stünde der Chat dauerhaft auf „wartet“.
- **Monitor-Aufrufe:** brauchen keinen eigenen Zweig. Live-Probe am 2026-10-20 (`claude -p … --output-format stream-json`, Werkzeug `Monitor`): die Kommandozeile meldet ihn als `task_started` mit `task_type: "local_bash"`, `is_backgrounded: true` — der Verwalter legt ihn damit schon heute als `BackgroundKind::Process` an (`translate.rs`, `TASK_TYPE_BASH`).
- **Vom Agenten in den Hintergrund geschobene Vordergrund-Befehle** (Kommandozeile schiebt lange Bash-Aufrufe selbst weg) kommen ebenfalls als `task_started`/`local_bash` und zählen damit mit.
- **Subagent hat Vorrang:** wartet die Session auf einen Subagenten (`awaiting_subagent`, Status wird dort `Running`), bleibt alles wie bisher; `awaitedScript` ist dann `None`.
- **Nur `completed`:** in `paused`, `waiting`, `error` usw. bleibt die Anzeige unverändert.
- **Neues Farb-Token** `--color-status-script` in Violett (hell `#7c3aed`, dunkel `#a78bfa`) — unterscheidet sich von Blau (läuft), Bernstein (wartet auf dich), Grün (fertig), Orange (Wiedereinstieg).
- **Symbol:** Sanduhr (Umriss), analog zu den übrigen 12×12-Symbolen in `StatusIcon`.
- **Texte:** Sidebar-Meta/Kopfzeile „wartet auf Skript · 2:14“, bei mehreren „wartet auf 2 Skripte · 2:14“ (Uhr = ältester laufender Befehl). Tooltip (`title`) am Status: der Befehl des ältesten Eintrags.
- **ADR 032** (031 ist von Codex reserviert).

## Kontrakt (Core → Oberfläche)

```rust
// src-tauri/src/sessions/model.rs
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AwaitedScript {
    /// Befehl des ältesten laufenden Eintrags.
    pub title: String,
    /// `started_at` des ältesten laufenden Eintrags, ms seit der Epoche.
    pub started_at: f64,
    /// Zahl der laufenden Einträge, ab 1.
    pub count: u32,
}

pub struct SessionSummary {
    // … bestehende Felder …
    /// Antwort abgegeben, ein Hintergrund-Befehl ohne lokale Adresse läuft noch (ADR 032); `status` bleibt `Completed`.
    pub awaited_script: Option<AwaitedScript>,
}
```

TypeScript (nach `pnpm bindings`): `SessionSummary.awaitedScript: AwaitedScript | null`.

## Finale AK

1. Agent startet einen Hintergrund-Befehl ohne Adresse und gibt ab → Session-Zeile der Sidebar zeigt die violette Sanduhr samt Laufzeit rechts, die jede Sekunde weiterzählt; die Vorhaben-Zeile (eine Session) zeigt „wartet auf Skript · m:ss“; die Kopfzeile der Session zeigt Sanduhr und „Wartet auf Skript · m:ss“.
2. Endet der Befehl und der Agent arbeitet weiter → Anzeige wechselt auf „Läuft“ (blau); gibt er danach ab → Haken.
3. Ein Dev-Server mit erkannter `localhost`-Adresse läuft nach dem Abgeben weiter → Haken, keine Sanduhr. Wird die Adresse erst nach dem Abgeben erkannt, wechselt die Sanduhr auf den Haken, ohne dass der User etwas tut.
4. Hält der User den Befehl im Hintergrund-Panel an → die Sanduhr verschwindet.
5. Vorhaben mit mehreren Sessions: „wartet auf Skript“ steht in der Rangfolge zwischen `running`/`starting` und `paused`; Meta-Zeile „N Sessions · #K wartet auf Skript“.
6. Hell- und Dunkelmodus zeigen das Violett lesbar.

## Smoke-Checkliste (macht der User am Plan-Ende)

Wackelstellen zuerst:

1. **Vom Agenten weggeschobener Vordergrund-Befehl** (Wackelstelle: nicht live geprüft, nur aus `process_title` in `translate.rs` abgeleitet): im Chat „führe `ping -n 200 127.0.0.1` im Vordergrund aus“ schicken, warten, bis die Kommandozeile den Befehl in den Hintergrund schiebt und der Agent abgibt → Sanduhr erscheint. Kommt stattdessen der Haken, ist der Eintrag kein `Process` — Fund in den Plan nachtragen.
2. **Adresse nach dem Abgeben** (Wackelstelle: `summary_dirty` muss beim Setzen von `url` mitkommen): `pnpm tauri dev` einer Test-App im Hintergrund starten lassen, abgeben lassen → kurz Sanduhr, dann Haken, sobald der Server seine Adresse ausgibt.
3. **Uhr läuft ohne Fokus weiter** (Wackelstelle: `useNow` tickt nur, solange die Komponente gerendert ist): Vorhaben einklappen und wieder aufklappen → Zeit springt auf den richtigen Wert, nicht auf 0.
4. AK 1, 2, 4, 5, 6 der Reihe nach.

## Phase 1 — Core

### Kontext

- `src-tauri/src/sessions/model.rs` — `SessionSummary`, `awaiting_subagent` als Vorbild.
- `src-tauri/src/sessions/registry.rs` — `is_awaiting_subagent`, `has_running_background`, `touch_background`, `detect_urls`, `summarize`.
- `src-tauri/src/background/model.rs` — `BackgroundItem`, `BackgroundKind`, `BackgroundState`.
- `docs/conventions/rust.md`.
- Fehlerklassen (Vault) geprüft: `sprachen/typescript`, `frameworks/react` — keine einschlägig; `sprachen/rust`, `frameworks/tauri` gibt es im Vault nicht.

### AK der Phase

- `summarize` liefert `awaited_script: Some(..)` genau dann, wenn `state.status == SessionStatus::Completed`, `!is_awaiting_subagent()` und mindestens ein Eintrag `kind == Process && is_running() && url.is_none()` existiert; `title`/`started_at` vom Eintrag mit dem kleinsten `started_at`, `count` = Zahl der passenden Einträge.
- Jede Änderung an einem `Process`-Eintrag (Start, Ende, Adresse erkannt, angehalten, unterbrochen) setzt `outbox.summary_dirty = true`.
- `pnpm check` grün.

### Checkliste

- [ ] `model.rs`: Struct `AwaitedScript` wie im Kontrakt, Feld `awaited_script: Option<AwaitedScript>` hinter `handoff_line` in `SessionSummary`.
- [ ] `registry.rs`: neue Methode an `SessionState` direkt unter `is_awaiting_subagent`:
  ```rust
  /// Antwort abgegeben, ein Hintergrund-Befehl ohne lokale Adresse läuft noch: der Agent setzt
  /// fort, sobald er endet (ADR 032). Ein Dev-Server mit Adresse zählt nicht.
  fn awaited_script(&self) -> Option<AwaitedScript> {
      if self.status != SessionStatus::Completed || self.is_awaiting_subagent() {
          return None;
      }
      let mut waiting = self.background.iter().filter(|item: &&BackgroundItem| {
          item.kind == BackgroundKind::Process && item.is_running() && item.url.is_none()
      });
      let first = waiting.next()?;
      let (oldest, count) = waiting.fold((first, 1_u32), |(oldest, count), item| {
          (if item.started_at < oldest.started_at { item } else { oldest }, count.saturating_add(1))
      });
      Some(AwaitedScript { title: oldest.title.clone(), started_at: oldest.started_at, count })
  }
  ```
  (`is_awaiting_subagent` prüft bereits `Completed`; die doppelte Prüfung ist Absicht für die Lesbarkeit — Clippy-Warnungen dazu nicht unterdrücken, sondern die Prüfung dann weglassen.)
- [ ] `touch_background`: `if item.kind == BackgroundKind::Subagent` → `if matches!(item.kind, BackgroundKind::Subagent | BackgroundKind::Process)`.
- [ ] `summarize`: `awaited_script: state.awaited_script(),` hinter `handoff_line`.
- [ ] Prüfen, dass jede Stelle, die `url`, `state` oder `ended_at` eines `Process` ändert, über `touch_background` läuft (Grep `self.background[` in `registry.rs`); eine Stelle ohne → dort `touch_background(outbox, index)` ergänzen.
- [ ] Alle übrigen Stellen, die `SessionSummary { … }` bauen (Grep `SessionSummary {` in `src-tauri/`), bekommen `awaited_script: None`.
- [ ] `pnpm bindings`, dann `pnpm check`.
- [ ] `docs/decisions/032-wartet-auf-skript.md` (10 Zeilen: Kontext / Optionen „jeder Hintergrund-Befehl“ vs. „ohne Adresse“, Restzeit aus Historie vs. Ausgabe lesen vs. nur Uhr / Entscheidung / Konsequenz: Dev-Server ohne Adressausgabe hält die Sanduhr).
- [ ] `docs/glossary.md`: Eintrag „Wartet auf Skript“ hinter „Waiting“ — Anzeige-Status der Sidebar, kein Session-Status; Regel wie oben, ADR 032.
- [ ] Commit `feat(sessions): Session mit laufendem Hintergrund-Befehl als „wartet auf Skript“ melden`.

## Phase 2 — Oberfläche

### Kontext

- `src/features/sessions/sessionStatus.ts` — `DisplayStatus`, `displayStatus`, `metaLine`, `isMetaHighlighted`, `HANDOFF_LABEL` als Vorbild.
- `src/features/projects/projectStatus.ts` — `URGENCY`, `SHORT_STATUS`, `projectMetaLine`.
- `src/components/StatusIcon.tsx` + `.css`.
- `src/app/SidebarItem.tsx` (+ `.css`), `src/app/SidebarProject.tsx`, `src/app/Sidebar.tsx`, `src/app/SessionHeader.tsx` (+ `.css`), `src/app/ProjectHeader.tsx` (+ `.css`).
- `src/features/background/useNow.ts`, `src/features/background/backgroundLabels.ts` (`formatDuration`).
- `src/styles/theme.css` — Status-Tokens in drei Blöcken (hell, `@media (prefers-color-scheme: dark)`, `[data-theme="dark"]`).
- `docs/conventions/react.md`, `typescript.md`, `tailwind.md`.

### AK der Phase

Finale AK 1–6. Uhr-Format über `formatDuration` (unter einer Minute `12,3 s`, sonst `m:ss`, ab einer Stunde `h:mm:ss`).

### Checkliste

- [ ] `theme.css`: Primitive `--color-violet-400: #a78bfa;` und `--color-violet-600: #7c3aed;` neben den Blau-Primitiven; Token `--color-status-script` hinter `--color-status-handoff` in allen drei Blöcken (hell `var(--color-violet-600)`, beide dunklen `var(--color-violet-400)`).
- [ ] `sessionStatus.ts`:
  - `DisplayStatus = SessionStatus | 'handoff' | 'script'`.
  - `displayStatus`: als erste Zeile `if (session.awaitedScript !== null) { return 'script'; }` (der Core liefert das Feld nur bei `completed`).
  - `export function scriptLabel(script: AwaitedScript, now: number): string` → `wartet auf Skript · <Dauer>` bzw. `wartet auf <count> Skripte · <Dauer>`, Dauer = `formatDuration(now - script.startedAt)`.
  - `metaLine` bleibt unverändert (bekommt keine Uhr; die Uhr läuft über `scriptLabel`).
- [ ] `StatusIcon.tsx`: `case 'script'` mit Sanduhr-Pfad, Strich 1.4 wie `handoff`: `<path d="M3.5 1.5h5M3.5 10.5h5M4 1.5c0 2.6 4 2.4 4 4.5S4 7.9 4 10.5M8 1.5c0 2.6-4 2.4-4 4.5s4 1.9 4 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />`. `StatusIcon.css`: `&--script { color: var(--color-status-script); }`.
- [ ] `projectStatus.ts`: `'script'` in `URGENCY` direkt hinter `'starting'`; `SHORT_STATUS.script = 'wartet auf Skript'`; `projectMetaLine(sessions, now)` bekommt den Parameter `now: number`; bei einer Session und `status === 'script'` → `scriptLabel(urgent.awaitedScript, now)` (Nicht-null-Wächter statt `!`).
- [ ] `SidebarProject.tsx`: `const now = useNow(urgentStatus === 'script')` und an `projectMetaLine` geben; `isMetaHighlighted` bleibt beim Session-Status (Meta der Script-Zeile erscheint gedämpft wie bei `running`).
- [ ] `SidebarItem.tsx`: bei `status === 'script'` und `session.awaitedScript !== null` hinter dem Namen `<span className="sidebar-item__clock" title={session.awaitedScript.title}>{formatDuration(now - …startedAt)}</span>`, `now = useNow(status === 'script')`. CSS `sidebar-item__clock`: `margin-left: auto`, Schriftgröße und Farbe wie die gedämpfte Meta-Zeile (`var(--color-fg-muted)`), `font-variant-numeric: tabular-nums`.
- [ ] `SessionHeader.tsx`: liegt `session.awaitedScript` vor → `StatusIcon status="script"`, Text `scriptLabel(...)` mit großem Anfangsbuchstaben („Wartet auf Skript · 2:14“), `title` = Befehl, Klasse `session-header__status--script` (in `SessionHeader.css` unter `&__status` ein Modifier `&--script { color: var(--color-status-script); }` wie `&--waiting`), `now = useNow(session.awaitedScript !== null)`; sonst wie bisher.
- [ ] `ProjectHeader.tsx`: dieselbe Weiche für `urgent` (nutzt die Klassen aus `SessionHeader.css`, kein eigenes CSS); `now = useNow(urgent?.awaitedScript != null)`.
- [ ] `projectMetaLine` hat nur den einen Aufrufer `SidebarProject.tsx` (Stand 2026-10-20) — nach der Signaturänderung Typecheck als Beleg.
- [ ] `pnpm check` grün.
- [ ] `docs/code-map.md`: Zeile „Sessions“ um „Anzeige-Status `script` (ADR 032)“ ergänzen.
- [ ] Commit `feat(sessions): „wartet auf Skript“ mit Sanduhr und laufender Uhr in Sidebar und Kopfzeile`.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
