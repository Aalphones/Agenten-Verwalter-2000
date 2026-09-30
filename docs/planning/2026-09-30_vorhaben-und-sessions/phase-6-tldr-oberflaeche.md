# Phase 6 — Oberfläche: TL;DR-Karten, Doku-Abschluss

Rating: standard · Commit-Scope: `tldr`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: Abnahmekriterien 9–13, „Kontrakt“ (TL;DR-Typen, Commands, `tldr://changed`, `src/stores/tldr.ts`).
- **Entwurf (verbindlich):** [docs/design/2026-09-30_vorhaben-und-tldr/](../../design/2026-09-30_vorhaben-und-tldr/README.md), Tafeln `Main` (Karte aktuell), `NoTldr` (noch keins), `Stale` (veraltet), `Collapsed` (eingeklappt), `Loading` (wird erstellt), `Vorhaben` (TL;DR des Vorhabens, Kurzfassungen an den Karten), `VorhabenNoTldr` (Karte ohne TL;DR), `NewSession` (Haken in der Einstiegsansicht).
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md).
- Code: `src/features/chat/ChatView.tsx`, `src/features/chat/useChatEntries.ts` (geladene Einträge; die höchste `seq` + 1 ist die Zahl der Einträge), `src/features/projects/ProjectOverview.tsx`, `ProjectSessionCard.tsx`, `NewSessionIntro.tsx` (Phase 4), `src/features/context/formatTokens.ts` (`formatClock`, aus dem Plan „Kontext und Kontingent“), `src/lib/background.ts` + `src/features/background/useSessionBackground.ts` (Muster Wrapper + Hook mit Abo), `src/lib/errors.ts` (`commandErrorText`).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. **Session-Karte** (`SessionTldrCard`) zwischen Kopfzeile und Verlauf, in der Spalte des Verlaufs (höchstens 780 px, Innenabstand `14px 32px 0`); nicht bei Status „Neu“.
   - **Noch keins:** Leiste, mindestens 40 px hoch, Innenabstand `5px 5px 5px 12px`, Rahmen `1px dashed var(--color-border)`, Radius 8 px: „TL;DR“ (11 px, 600, Buchstabenabstand 0.05em, `--color-fg-muted`), Text 12.5 px `--color-fg-muted` mit Auslassung „Noch keins für diese Session. Fasst den bisherigen Verlauf in drei, vier Zeilen zusammen.“, 12 px `--color-fg-muted` „Haiku · im Hintergrund“, Knopf „TL;DR erstellen“ (28 px, Innenabstand `0 10px`, Rahmen `--color-border`, Radius 6 px, 12 px, 500, Symbol Liste-mit-Plus 13 px wie im Entwurf).
   - **Karte:** Rahmen `1px solid var(--color-border-subtle)`, Radius 8 px, `--color-bg-surface`. Kopf 34 px, Innenabstand `0 5px 0 12px`, Abstand 10 px: „TL;DR“, (eingeklappt: `short` 12.5 px `--color-fg-secondary` mit Auslassung), Stand-Text 12 px `--color-fg-muted`, Knopf, Einklapp-Knopf 26 × 26 px (Chevron hoch/runter 12 px, `aria-label` „TL;DR einklappen“/„TL;DR aufklappen“, `aria-expanded`).
   - **Stand-Text:** aktuell „Stand HH:MM · aktuell“; veraltet (Einträge jetzt > `seq`) mit Punkt 6 px `--color-status-waiting` davor „Stand HH:MM · <n> neue Einträge seitdem“ (1 → „1 neuer Eintrag seitdem“); läuft mit Lauf-Symbol 10 px „Wird erstellt …“.
   - **Knopf im Kopf:** aktuell Symbol-Knopf 26 × 26 px (Kreispfeil 13 px, `aria-label`/`title` „TL;DR neu erstellen“); veraltet Text-Knopf „Aktualisieren“ (24 px, Rahmen `--color-border`, Kreispfeil 12 px); läuft keiner.
   - **Inhalt** (aufgeklappt), Innenabstand `0 14px 12px 12px`, Zeilen mit 5 px Abstand, je Zeile Beschriftung 64 px breit `--color-fg-muted` + Wert, 12.5 px, Zeilenhöhe 1.55: „Ziel“ (`goal`), „Erledigt“ (`done`), „Läuft“ (`ongoing`), „Offen“ (`open`, bei `openNeedsUser` in `--color-status-waiting`); leere Felder ohne Zeile.
   - **Wird erstellt ohne bisheriges TL;DR:** Karte mit drei Balken (9 px, Radius 5 px, `--color-bg-hover`, Breiten 92 %/78 %/64 %) und 12 px `--color-fg-muted` „Haiku liest den Verlauf in einer eigenen Session im Hintergrund. Du kannst hier weiterarbeiten.“ Mit bisherigem TL;DR bleibt dessen Inhalt stehen.
   - **Fehler:** Zeile unter Leiste bzw. Karte, 12 px `--color-status-error`: „TL;DR nicht erstellt: <Fehler>“; der Knopf bleibt.
2. **Einklappen** merkt sich die Karte je Session bis zum Neustart (`src/stores/tldr.ts`).
3. **Vorhaben-Karte** (`ProjectTldrCard`) als erster Block der Übersicht, Aufbau wie AK 1 mit: Kopf 36 px, Innenabstand `0 5px 0 14px`; Stand-Text „aus <k> Session-TL;DRs · Stand HH:MM“, wenn Sessions mit Verlauf ohne TL;DR existieren „aus <k> von <m> Session-TL;DRs · Stand HH:MM“; Symbol-Knopf mit `title` „Fasst die TL;DRs aller Sessions neu zusammen. Fehlende Session-TL;DRs werden dabei mit erstellt.“ (kein Einklappen); Inhalt Innenabstand `0 16px 14px 14px`: `summary` als Absatz 13.5 px, Zeilenhöhe 1.6, darunter Zeilen mit Beschriftung 84 px: „Stand“, „Offen“ (`openNeedsUser` → Wartet-Farbe), „Als Nächstes“. Noch keins: gestrichelte Leiste wie AK 1 mit „Noch keins für dieses Vorhaben. Fasst die TL;DRs seiner Sessions zusammen.“ Wird erstellt: Balken 10 px, Breiten 96 %/88 %/58 %, Text „Liest nur die TL;DRs der Sessions, nicht deren ganze Verläufe. Fehlende Session-TL;DRs werden dabei mit erstellt.“ Fehler wie AK 1.
4. **Session-Karten der Übersicht**, zweite Zeile (Einzug 24 px, 12.5 px, Zeilenhöhe 1.55): Kurzfassung in `--color-fg-secondary`; läuft: Lauf-Symbol 10 px + „TL;DR wird erstellt …“ in `--color-fg-muted`; keins und Status nicht „Neu“: „Noch kein TL;DR.“ in `--color-fg-muted` + Knopf „TL;DR erstellen“ (24 px, Innenabstand `0 8px`, Rahmen `--color-border`, 12 px, Symbol 12 px); Status „Neu“: „Noch kein Verlauf.“
5. **Einstiegsansicht einer neuen Session:** Hat das Vorhaben ein TL;DR, folgt unter dem Text ein beschrifteter Kasten (`label`, Innenabstand `10px 12px`, Rahmen `--color-border-subtle`, Radius 8 px, `--color-bg-surface`) mit Kontrollkästchen (14 px, `accent-color: var(--color-accent)`) „TL;DR des Vorhabens mit der ersten Nachricht schicken“ (500) und darunter `summary` des Vorhabens (12.5 px, `--color-fg-secondary`). Das Kästchen spiegelt `carriesProjectTldr` und schaltet über `setCarryProjectTldr`. Ohne TL;DR des Vorhabens kein Kasten.
6. Alles lädt beim Öffnen und nach jedem passenden `tldr://changed` neu (Session-Karte: gleiche `sessionId`; Vorhaben-Karte und Session-Karten der Übersicht: gleiche `projectId`); der Stand-Text der Session-Karte folgt neuen Chat-Einträgen ohne Neuladen.
7. Doku beschreibt den Endstand (Checkliste „Doku-Abschluss“); `pnpm check` grün.

## Checkliste

### Wrapper, Zustand, Hooks

- [ ] `src/lib/tldr.ts`: `loadSessionTldr`, `createSessionTldr`, `loadProjectTldr`, `createProjectTldr`, `setCarryProjectTldr`, `onTldrChanged(callback)` (`tldr://changed`, Nutzlast `TldrChangedEvent`) — JSDoc mit `@throws` nach dem Muster von `src/lib/background.ts`.
- [ ] `src/stores/tldr.ts` nach dem Kontrakt.
- [ ] `src/features/tldr/useSessionTldr.ts`: `useSessionTldr(sessionId: string): { view: SessionTldrView | null; error: string | null }` nach AK 6 (Muster `useSessionBackground`: erst abonnieren, dann laden; Lade-Fehler über `commandErrorText`).
- [ ] `src/features/tldr/useProjectTldr.ts`: dasselbe für `projectId` → `ProjectTldrView`.
- [ ] `src/features/tldr/tldrTexts.ts`: `stampText(view, entryCount: number): string` nach AK 1 (mit `formatClock`), `projectStampText(view, sessionsWithHistory: number): string` nach AK 3.

### Komponenten

- [ ] `src/features/tldr/SessionTldrCard.tsx` + `.css` (Block `session-tldr`): Props `session: SessionSummary`, `entryCount: number`. Zustände nach AK 1; Aktionen `createSessionTldr(session.id)` (Fehler des Aufrufs selbst als Fehlerzeile).
- [ ] `src/features/tldr/ProjectTldrCard.tsx` + `.css` (Block `project-tldr`): Props `projectId`, `view: ProjectTldrView | null`, `sessionsWithHistory: number`. Zustände nach AK 3.
- [ ] `ChatView.tsx`: `SessionTldrCard` über `ChatTimeline`, außer bei Status „Neu“; `entryCount` = höchste `seq` in `entries` + 1 (0 ohne Einträge).
- [ ] `ProjectOverview.tsx`: `useProjectTldr(project.id)` einmal aufrufen; `ProjectTldrCard` als ersten Block; an jede `ProjectSessionCard` den passenden Eintrag aus `view.sessions` geben.
- [ ] `ProjectSessionCard.tsx`: Prop `tldr: ProjectSessionTldr | null`; zweite Zeile nach AK 4 (`createSessionTldr`).
- [ ] `NewSessionIntro.tsx`: Props `sessionId`, `projectId`; `useSessionTldr(sessionId)` für `carriesProjectTldr`, `useProjectTldr(projectId)` für `summary`; Kasten nach AK 5. `ChatView` reicht die IDs durch.

### Doku-Abschluss

- [ ] Entwurfs-README [docs/design/2026-09-30_vorhaben-und-tldr/README.md](../../design/2026-09-30_vorhaben-und-tldr/README.md): Status „umgesetzt“, Tafel-Zuordnung mit „Gebaut in Phase N“, Abschnitt „Abweichungen vom Entwurf“ mit allem, was anders gebaut wurde (mindestens: Name einer neuen Session „Session N“ bis zur ersten Nachricht; Kopfzeile der Übersicht ohne Pause/Abbrechen). Im Entwurf [Hauptansichten](../../design/2026-09-28_hauptansichten/README.md) unter „Layout-Maße“ bei Sidebar, Sidebar-Gruppen und Session-Kopfzeile je ein Satz „Seit Plan Vorhaben und Sessions: siehe 2026-09-30_vorhaben-und-tldr.“
- [ ] `AGENTS.md`: Einleitung „eine Session = eine Aufgabe“ → „ein Vorhaben = eine Aufgabe über mehrere Git-Repositories; darin nacheinander eine oder mehrere Sessions mit frischem Kontext“; Critical Rules 4 und 5 auf Vorhaben/Session prüfen (Workspace gehört dem Vorhaben).
- [ ] `docs/PROJECT.md`: Scope und Meilensteine um Vorhaben und TL;DR ergänzen, offene Fragen abgleichen.
- [ ] `docs/code-map.md`: Zeile „TL;DR“ Oberfläche (`src/features/tldr/`, `src/stores/tldr.ts`, Wrapper `src/lib/tldr.ts`); Stand-Satz am Kopf der Datei aktualisieren.
- [ ] `docs/glossary.md`: Einträge Vorhaben, Session, TL;DR, Übersicht gegen den gebauten Stand prüfen.
- [ ] README dieses Plans: alle Phasen `complete`, Summary / Files touched / Commits / Deviations füllen; STATE.md auf die Smoke-Checkliste zeigen lassen.

## Report-Back
