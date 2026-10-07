# Phase 3 — Knopf „Retro“ und Doku

## Kontext (vor dem Start lesen)

- `README.md` dieses Plans (Kontrakt, finale AK)
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`
- `src/features/chat/HandoffButton.tsx` + `HandoffButton.css` — Vorbild: Session anlegen, `onSessionCreated`, Entwurf setzen (`setHandoffDraft`), `focusComposer`, Fehlerzeile
- `src/features/projects/ProjectOverview.tsx` + `.css` — Einbauort, `RUNNING_STATUSES`, `hasHistory`, Stil des Knopfs „Neue Session“
- `src/lib/tldr.ts` — Muster für Wrapper mit `invoke` und Ereignis-Abo
- `src/stores/chat.ts` (`setDraft`), `src/stores/tldr.ts` (Muster für einen kleinen Zustand-Slice)
- Fehlerklassen geprüft (TypeScript, React): keine einschlägig — die Phase enthält keine Tests und keine `fetch`-Aufrufe.

## Abnahmekriterien der Phase

1. Finale AK 1–4 der README sind in der Oberfläche erfüllt.
2. Der Laufzustand überlebt das Wechseln der Ansicht (Zustand im Store, nicht im Bauteil).
3. Code-Map und Glossar sind nachgezogen. `pnpm check` grün.

## Checkliste

- [x] Wrapper `src/lib/retro.ts`: `runRetro(projectId: string): Promise<RetroExport>` (`invoke('retro_run', { projectId })`) und `onRetroProgress(handler: (progress: RetroProgress) => void): Promise<UnlistenFn>` für `retro://progress`.
- [x] `src/stores/retro.ts`: `running: Record<string, { done: number; total: number }>`, Aktionen `setProgress(projectId, done, total)` und `clear(projectId)`. Das Abo auf `retro://progress` einmal in `src/app/App.tsx` einrichten (neben den übrigen Abos), es ruft `setProgress`.
- [x] `src/features/retro/RetroButton.tsx` + `RetroButton.css` (BEM-Block `retro`), Props `projectId`, `sessions: readonly SessionSummary[]`, `onSessionCreated: (created: SessionSummary) => void`:
  - Läuft (Eintrag in `running`): Beschriftung `Sammle Befunde ${done}/${total} …` (vor dem ersten Ereignis `Bereite Retro vor …`), gesperrt.
  - Gesperrt, wenn eine Session in `['starting', 'running', 'waiting']` ist oder keine Session `status !== 'new'` hat.
  - Tooltip (`title`) frei: „Lässt für jede Session eine Mini-Retro mit Sonnet erstellen, legt eine neue Session an und setzt den Retro-Aufruf in ihr Eingabefeld. Gesendet wird erst, wenn du auf Senden klickst.“ Gesperrt wegen Lauf einer Session: „Erst möglich, wenn keine Session mehr arbeitet.“ Ohne Verlauf: „Noch keine Session mit Verlauf.“ Während der Retro: „Die Mini-Retros laufen.“
  - Klick: `setProgress(projectId, 0, 0)` → `runRetro` → `createSessionInProject(projectId)` → `onSessionCreated` → Entwurf `/session-review vorhaben ${folder}` (wie `setHandoffDraft`: vorhandenen Entwurf hinten anhängen) → Composer fokussieren wie `focusComposer`. In jedem Ausgang `clear(projectId)`. Fehler eines Schritts als Fehlerzeile unter dem Knopf (`role="alert"`), danach nichts weiter. `failedCount > 0` → nach Erfolg zusätzlich die Zeile „<n> Session(s) ohne Mini-Retro — Grund steht in befunde.md.“ (kein `role="alert"`).
  - Modell und Einstellungen der neuen Session nicht ändern.
- [x] `ProjectOverview.tsx`: Knopf direkt nach `<ProjectTldrCard … />` und vor `renderRepositories()` in einem Element `project-overview__retro` (Flex, `justify-content: center`, Abstände wie zwischen den übrigen Blöcken der Spalte). Stil wie „Neue Session“ (Tokens, keine Hex-Werte); Hinweis- und Fehlerzeile zentriert darunter. Ohne Sessions nicht rendern.
- [x] `docs/code-map.md`: Zeile „Vorhaben-Retro“ (Oberfläche `src/features/retro/`, `src/stores/retro.ts`, `src/lib/retro.ts`, Abo in `src/app/App.tsx`; Core `src-tauri/src/retro/` (`model`, `transcript`, `prompt`, `findings`), `src-tauri/src/commands/retro.rs`, `src-tauri/src/sessions/registry/retro.rs`, `ask_model` in `agents/claude/print.rs`, ADR 028) und `retro` in die Feature-Liste.
- [x] `docs/glossary.md`: **Retro** — Rückblick über alle Sessions eines Vorhabens: der Verwalter sammelt je Session Befunde (Mini-Retro), der Skill wertet sie in einer neuen Session aus. **Mini-Retro** — Rohbefunde einer Session aus einem Einmal-Aufruf mit Sonnet, ohne Bewertung.
- [x] `pnpm check`, Commit `feat(retro): Knopf „Retro“ in der Vorhaben-Übersicht`.

## Report-Back
