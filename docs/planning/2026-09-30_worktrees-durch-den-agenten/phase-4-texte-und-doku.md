# Phase 4 — Texte in der Oberfläche und Doku

Rating: **mechanisch** (Wortlaute stehen hier fest).

## Kontext — vorher lesen

- [README.md](README.md) dieses Plans, [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (aus Phase 1)
- [docs/glossary.md](../../glossary.md), [docs/code-map.md](../../code-map.md), [docs/PROJECT.md](../../PROJECT.md), [AGENTS.md](../../../AGENTS.md)
- Fehlerklassen: keine einschlägig (nur Text).

## Abnahmekriterien

- Kein Text in `src/` behauptet mehr, dass die App je Repository einen Worktree anlegt. Probe per Grep-Werkzeug auf `Worktree` in `src/` ohne `src/lib/bindings/`: Übrig bleiben nur die neuen Wortlaute.
- Glossar, Code-Map, PROJECT.md und AGENTS.md beschreiben das Modell aus ADR 010.
- `pnpm check` grün.

## Checkliste

**Oberfläche** (Wortlaute exakt so)

- [x] `src/features/sessions/EmptyState.tsx`, Absatz `empty-state__text`: „Eine Session ist eine Aufgabe für einen Agenten, über ein oder mehrere Repositories. Ob der Agent direkt im Repository arbeitet oder einen Worktree für sein Ticket anlegt, bestimmen seine Anweisungen."
- [x] `src/features/sessions/NewSession.tsx`: `'Worktrees werden angelegt …'` → `'Session wird angelegt …'`. In `describeStartError` wird `case 'git'` zu `` `Repository konnte nicht gelesen werden — ${reason.message}` ``.
- [x] `src/features/repositories/RepositoryPicker.tsx`, Hinweis unter der Liste: „Der Agent arbeitet in den gewählten Repositories. Ihre Skills stehen in der Session zur Verfügung."
- [x] `src/app/SidebarItem.tsx`, `title` des Archivieren-Knopfs: „Blendet die Session aus der Liste aus. Der Verlauf bleibt erhalten. Repositories und Worktrees bleiben, wie sie sind."
- [x] `src/lib/sessions.ts`: Im Doc-Kommentar von Anlegen wird „— pro Repository einen Worktree mit Session-Branch —" zu „— liest die Basis jedes Repositorys, legt keine Worktrees an —". Im Doc-Kommentar von Archivieren wird „Worktrees ohne offene Änderungen räumt der Core danach weg, Branches bleiben" zu „Repositories und Worktrees bleiben unberührt (bei Sessions vor ADR 010 räumt der Core saubere App-Worktrees weg)".

**Doku**

- [x] `AGENTS.md`: Einleitungssatz „eine Session = eine Aufgabe über mehrere Git-Repositories mit je eigenem Worktree" → „eine Session = eine Aufgabe über mehrere Git-Repositories; ob der Agent im Haupt-Checkout oder in einem Ticket-Worktree arbeitet, bestimmen seine Anweisungen". Critical Rule 5 → „**Der Session-Workspace ist die Sicherheitsgrenze** — Agenten bekommen den Session-Ordner als Arbeitsverzeichnis, je Repository den Haupt-Checkout per `--add-dir` und Lese-/Schreibfreigabe für dessen Ticket-Worktrees `<repo>-wt-*` (Sessions vor ADR 010: ihre App-Worktrees), nicht das Benutzerverzeichnis."
- [x] `docs/glossary.md`:
  - Neuer Eintrag **Haupt-Checkout**: „Der Ordner, in dem ein Repository auf dem Rechner liegt, mit seinem ausgecheckten Branch — im Gegensatz zu einem Worktree."
  - Neuer Eintrag **Ticket-Worktree**: „Ein Worktree, den der Agent nach seinen Anweisungen neben dem Haupt-Checkout anlegt, Ordner `<repo>-wt-<Name>`. Er gehört zu jeder Session, deren Agent ihn benutzt hat, und erscheint in ihren Changes gegen den Standard-Branch (ADR 010)."
  - **RepositoryWorkspace**: „Die Verbindung eines Repositorys mit einer Session: Haupt-Checkout und Basis; bei Sessions vor ADR 010 ein eigener App-Worktree mit Branch."
  - **Worktree**: den Satz „Pro Session und Repository genau einer." ersetzen durch „Seit ADR 010 legt ihn der Agent an (→ Ticket-Worktree); Sessions davor haben je Repository einen von der App angelegten."
  - **Workspace**: „in dem die Worktrees aller ihrer Repositories nebeneinander liegen" → „in dem Anhänge liegen (bei Sessions vor ADR 010 auch die App-Worktrees)".
  - **Archivieren**: „Worktrees ohne offene Änderungen entfernt die App, Branches bleiben." → „Bei Sessions vor ADR 010 entfernt die App App-Worktrees ohne offene Änderungen; Haupt-Checkouts und Ticket-Worktrees bleiben immer."
- [x] `docs/PROJECT.md`: Im ersten Absatz „jedes in einem eigenen Worktree" → „wahlweise direkt im Haupt-Checkout oder in einem Ticket-Worktree, den der Agent nach seinen Anweisungen anlegt". Scope-Zeile „Workspace:" → „mehrere Repositories pro Session; der Agent arbeitet im Haupt-Checkout oder in Ticket-Worktrees daneben, die App zeigt beides in den Changes, Ticket-Worktrees gegen den Standard-Branch ([ADR 010](decisions/010-worktrees-durch-den-agenten.md)); Skills der beteiligten Repositories stehen in der Session zur Verfügung".
- [x] `docs/code-map.md`: Zeile „Worktrees anlegen/aufräumen" wird zu „Repositories einer Session, Worktrees" mit Core `src-tauri/src/worktrees/` (`RepositoryCheckout` Haupt-Checkout oder App-Worktree, `main_checkouts` beim Anlegen, `ensure` vor jedem Agent-Start, `permission_rules` Freigabe der Ticket-Worktrees, `ticket_roots`/`mentioned_ticket_worktrees` Zuordnung, `ticket_worktrees`/`ticket_base` für die Changes, `remove_clean` nur für App-Worktrees). Zeile „Changes": `RepositoryChanges.key`, Ticket-Worktrees als eigene Einträge gegen den Standard-Branch. Zeile „Agent-Provider": „Prozess mit `--add-dir` je Repository-Ordner und `--allowedTools` für Ticket-Worktrees". Zeile „Git-Aufrufe": `worktree list`, `merge-base`, `symbolic-ref` zu den lesenden Befehlen.

**Prüfen**

- [x] `pnpm check` grün.

## Report-Back

Alle Wortlaute wie vorgegeben. Zusätzlich das Finding umgesetzt: Titel in `ChangesToolbar.tsx` (Basis und „Committed“) passen jetzt zu Ticket-Worktrees. Der Code-Map-Eintrag „Git-Aufrufe“ stand seit Phase 3 schon richtig.
