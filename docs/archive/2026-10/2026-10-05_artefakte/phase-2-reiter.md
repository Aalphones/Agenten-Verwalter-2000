# Phase 2 — Reiter „Artefakte“ mit Liste und Vorschau

**Rating:** standard.

## Kontext

- [README des Plans](README.md), Abschnitt „Kontrakt“ (Typen, Commands, `artifactUrl`, Sandbox, Abfrage alle 2 s).
- Design (verbindlich): [docs/design/2026-10-05_artefakte/README.md](../../../design/2026-10-05_artefakte/README.md) und [artefakte.html](../../../design/2026-10-05_artefakte/artefakte.html) — Maße und Texte unten sind daraus übernommen.
- `src/stores/sessions.ts` (`SESSION_VIEWS`, `PROJECT_VIEWS`, `showView`, `showProjectView`), `src/app/App.tsx` (`isChangesView`, `renderOverview`, `renderMain`), `src/app/SessionHeader.tsx` und `src/app/ProjectHeader.tsx` (Reiter, `VIEW_LABEL`, Zähler `session-header__tab-count`), `src/features/background/mention.ts` (`mentionInChat`), `src/stores/sessionErrors.ts` (`useSessionErrorsStore`, Aktion `report`), `src/components/FileLink.tsx` (Fehler einer Öffnen-Aktion melden), `src/features/context/formatTokens.ts` (`formatClock`), `src/features/changes/ChangesView.css` (BEM-Muster), `src/styles/theme.css` (Tokens).
- `src/lib/fileLinks.ts` (Muster für einen Wrapper mit `@throws`-Kommentar).
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md`.

## Abnahmekriterien der Phase

1. Session-Kopfzeile: Reiter „Chat · Changes · Artefakte“; „Changes“ wie bisher nur mit Repository, „Artefakte“ nur, wenn die Liste des Vorhabens mindestens ein Artefakt hat; Zahl am Reiter wie bei „Changes“. Vorhaben-Übersicht: „Übersicht · Changes · Artefakte“ nach derselben Regel.
2. Ist „Artefakte“ gewählt und die Liste leer (oder das Vorhaben gewechselt zu einem ohne Artefakt), zeigt die App Chat bzw. Übersicht — wie heute bei „Changes“ ohne Repository.
3. Ansicht nach Design: Liste 300 px mit rechter Linie `--color-border-subtle`, Innenabstand 12 px 8 px; Überschrift „Artefakte des Vorhabens, neueste zuerst“ (12 px, `--color-fg-muted`) mit ?-Erklärung (Tooltip-Text unten); Eintrag: Symbol 28 × 28 px auf `--color-accent-subtle`, Titel (500, eine Zeile mit Auslassung), darunter „diese Session · HH:MM“ (in `--color-accent-text`) bzw. „#N Name · HH:MM“ bzw. nur „HH:MM“ ohne Session; gewählt mit `--color-bg-selected`, Radius 6 px.
4. Kopf der Vorschau 44 px: Titel (600), „Dateiname · HH:MM“ (12 px, muted; 2,5 s lang „gerade aktualisiert“ in `--color-status-completed`, nachdem sich `modifiedAt` des gezeigten Artefakts geändert hat), rechts Knöpfe 28 px hoch: Neu laden (Symbol, `title` „Neu laden“), „Im Chat besprechen“ (nur in einer Session), „Im Browser öffnen“ mit Pfeil-Symbol. Der Knopf „Vollbild“ kommt in Phase 3.
5. Vorschau: 20 px Rand, Rahmen 1 px `--color-border`, Radius 8 px, weißer Grund; darin das iframe mit `src = artifactUrl(...)` und der Sandbox aus dem Kontrakt; Klicks, Tasten und Formulare der Seite funktionieren.
6. Ändert sich `modifiedAt` des gezeigten Artefakts, lädt das iframe von selbst neu; „Neu laden“ lädt es neu, ohne dass sich `modifiedAt` ändern muss.
7. Die Auswahl bleibt je Vorhaben stehen (Session-Wechsel innerhalb des Vorhabens behält das gewählte Artefakt); verschwindet das gewählte Artefakt, ist das neueste gewählt.
8. Die Abfrage läuft nur, solange eine Session oder Übersicht sichtbar ist, pausiert bei verstecktem Fenster (`document.hidden`) und löst ohne Änderung kein neues Rendern aus.

## Checkliste

### Wrapper und Zustand

- [x] `src/lib/artifacts.ts`: `artifactUrl(baseUrl, file, modifiedAt)` wörtlich aus dem Kontrakt; `listArtifacts(sessionId): Promise<ArtifactList>` (`invoke('artifacts_list', { sessionId })`), `openArtifactInBrowser(sessionId, file): Promise<void>` (`invoke('artifact_open_in_browser', { sessionId, file })`); `@throws`-Kommentare wie in `fileLinks.ts` (`sessionNotFound`, `fileNotFound`, `fileNotAllowed`, `io`).
- [x] `src/stores/artifacts.ts` (Zustand, nur flüchtig): `selected: Record<string, string>` (Vorhaben-ID → Dateiname), `select(projectId, file)`.
- [x] `src/stores/sessions.ts`: `SESSION_VIEWS = ['chat', 'changes', 'artifacts']`, `PROJECT_VIEWS = ['overview', 'changes', 'artifacts']`.

### Laden

- [x] `src/features/artifacts/useProjectArtifacts.ts`: `useProjectArtifacts(sessionId: string | null): { list: ArtifactList | null; error: string | null }`. Bei `sessionId === null`: `list` null, keine Abfrage. Sonst sofort laden, dann `window.setInterval` alle `POLL_MS = 2000`; im Intervall nichts tun, solange `document.hidden`. Neues Ergebnis nur übernehmen, wenn `listKey(neu) !== listKey(alt)`; `listKey` = `dir` + `baseUrl` + je Eintrag `file|modifiedAt|title|sessionId|sessionName` verbunden mit `\n`. Fehler: `error = commandErrorText(reason)`, `list` bleibt beim letzten Stand. Wechselt `sessionId` zu einem anderen Vorhaben, startet die Liste bei `null`.
- [x] `src/app/App.tsx`: `const { list: artifacts } = useProjectArtifacts(isMainReplaced ? null : (currentSession?.id ?? null));` (in der Übersicht ist `currentSession` die neueste Session des Vorhabens — derselbe Weg wie für die Changes). `const artifactCount: number = artifacts?.items.length ?? 0;`.
- [x] `isArtifactsView` in `App.tsx`: Übersicht → `projectView === 'artifacts' && artifactCount > 0`; Session → `!isMainReplaced && activeView === 'artifacts' && artifactCount > 0`. `isChangesView` bleibt, wie es ist. `activeView` an die Kopfzeilen: `isArtifactsView ? 'artifacts' : isChangesView ? 'changes' : 'chat'` (Übersicht: `'overview'` statt `'chat'`). Inhalt: bei `isArtifactsView` `<ArtifactsView … />` statt `ChangesView`/`ChatView`/`ProjectOverview`.

### Kopfzeilen

- [x] `SessionHeader.tsx`: Prop `artifactCount: number`; `views` = `SESSION_VIEWS.filter(view => view === 'chat' || (view === 'changes' && session.repositoryCount > 0) || (view === 'artifacts' && artifactCount > 0))`; `VIEW_LABEL.artifacts = 'Artefakte'`; Zähler am Reiter „Artefakte“ wie bei „Changes“ (`session-header__tab-count`, `formatCount(artifactCount)`). Den Kommentar „„Changes“ gibt es nur mit mindestens einem Repository.“ auf beide Regeln erweitern.
- [x] `ProjectHeader.tsx`: dasselbe mit `PROJECT_VIEWS`, `overview` immer, `changes` bei `project.repositoryNames.length > 0`, `artifacts` bei `artifactCount > 0`.

### Ansicht

- [x] `src/features/artifacts/ArtifactsView.tsx` + `ArtifactsView.css` (BEM-Block `artifacts`). Props: `sessionId: string` (für Commands und Adresse; in der Übersicht die neueste Session), `projectId: string`, `currentSessionId: string | null` (`null` in der Übersicht → kein „diese Session“, kein „Im Chat besprechen“), `list: ArtifactList`. Auswahl: `useArtifactsStore().selected[projectId]`, fehlt sie oder ist die Datei nicht mehr in `list.items` → `list.items[0]`.
- [x] Liste: `<nav className="artifacts__list" aria-label="Artefakte">`, Überschrift-Zeile mit `<span className="artifacts__info" title={ARTIFACTS_INFO}>?</span>` (16 px Kreis, Rahmen 1 px `--color-border`, `cursor: help`); Einträge als `<button type="button" aria-current={gewählt ? 'true' : undefined}>`. Seiten-Symbol (SVG, 14 px im 28-px-Kasten): `<rect x="1.5" y="2" width="11" height="10" rx="1.5"/><path d="M1.5 5h11M4 7.5h3M4 9.5h5"/>` in `viewBox="0 0 14 14"`, `stroke="currentColor"`, `stroke-width="1.3"`, `fill="none"`.
- [x] `src/features/artifacts/artifactTexts.ts`: `ARTIFACTS_HEADING = 'Artefakte des Vorhabens, neueste zuerst'`, `ARTIFACTS_INFO = 'Seiten, die ein Agent dieses Vorhabens als HTML abgelegt hat – Bericht, Präsentation, Entwurf. Sie liegen im Ordner .artefakte des Vorhabens und aktualisieren sich, sobald der Agent sie neu speichert.'`, `JUST_UPDATED = 'gerade aktualisiert'`, `ownerLabel(item, currentSessionId)` → `'diese Session'` | `` `#${n} ${name}` `` | `null`, `metaLine(item, currentSessionId)` → `[ownerLabel, formatClock(item.modifiedAt)]` ohne `null`, mit ` · ` verbunden. Liegt `modifiedAt` nicht am heutigen Tag, steht vor der Uhrzeit das Datum `TT.MM.` (`toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })`).
- [x] `src/features/artifacts/ArtifactFrame.tsx`: Props `baseUrl` (aus `list.baseUrl`), `item: Artifact`, `reloadToken: number`. `<iframe key={`${item.file}:${String(reloadToken)}`} src={artifactUrl(baseUrl, item.file, item.modifiedAt)} sandbox="allow-scripts allow-forms allow-modals" allow="fullscreen" title={item.title} className="artifacts__frame" />`. Kein `srcdoc`, kein `allow-same-origin`.
- [x] Kopf der Vorschau in `ArtifactsView`: „Neu laden“ erhöht einen lokalen `reloadToken` (`useState`); „gerade aktualisiert“: `useRef` mit dem letzten `modifiedAt` je Datei — ändert er sich bei gleicher Auswahl, 2500 ms lang `JUST_UPDATED` statt `Dateiname · HH:MM` (Timer im Effekt aufräumen). Symbol „Neu laden“: `<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5V5h-2.5"/>` in `viewBox="0 0 16 16"`, `stroke-width="1.5"`, `stroke-linecap="round"`.
- [x] „Im Chat besprechen“: `mentionInChat(currentSessionId, `Artefakt „${item.title}“ (${list.dir}\\${item.file})`)`.
- [x] „Im Browser öffnen“: `openArtifactInBrowser(sessionId, item.file)`; Fehler → `useSessionErrorsStore`-Aktion `report(sessionId, `Artefakt nicht geöffnet: ${commandErrorText(reason)}`)` (Muster `FileLink.tsx`). Pfeil-Symbol aus dem Design: `<path d="M5.5 2.5h6v6M11.5 2.5 4 10"/>`, `viewBox="0 0 14 14"`, 11 px.
- [x] Hell- und Dunkelmodus nur über Tokens; die Vorschau-Fläche ist in beiden Modi weiß (`#fff` als eigene CSS-Variable `--artifact-stage-bg` im Block, nicht als neues Theme-Token).

### Doku

- [x] `docs/code-map.md`, Zeile „Artefakte“: Oberfläche `src/features/artifacts/` (`ArtifactsView`, `ArtifactFrame`, `useProjectArtifacts` Abfrage alle 2 s, `artifactTexts`), `src/stores/artifacts.ts` (Auswahl je Vorhaben), Wrapper `src/lib/artifacts.ts` (`artifactUrl`), Reiter in `SessionHeader`/`ProjectHeader`, Weiche in `App.tsx`. In den Zeilen „Sessions“ und „App-Rahmen“ die Reiter „Chat/Changes“ um „Artefakte“ ergänzen.
- [x] `docs/glossary.md`: Eintrag „Artefakt“ ersetzen durch: „Eine HTML-Seite, die ein Agent zum Ansehen im Ordner `.artefakte` des Vorhabens ablegt (Bericht, Präsentation, Diagramm, Entwurf). Gehört dem Vorhaben, nicht der Session. Im Reiter „Artefakte“ von Session und Übersicht ([ADR 026](decisions/026-artefakte.md)).“ Neuer Eintrag „Artefakte-Ansicht“ neben „Changes-Ansicht“: „Ansicht eines Vorhabens, erreichbar aus jeder seiner Sessions und der Übersicht: Liste der Artefakte und Vorschau der gewählten Seite; erscheint erst mit dem ersten Artefakt.“

## Report-Back

- Fertig, `pnpm check` grün. Abweichung vom Plan: `useProjectArtifacts` nimmt zusätzlich die Vorhaben-ID (`useProjectArtifacts(sessionId, projectId)`), damit die Liste beim Wechsel in ein anderes Vorhaben bei `null` startet, beim Wechsel zwischen Sessions desselben Vorhabens aber stehen bleibt. Die Verzweigungen in `App.tsx` stehen als Render-Funktionen (`renderSessionBody`, `renderOverviewBody`), nicht als verschachtelter Ternary.
- Nicht in der Oberfläche gesehen (kein Smoke in dieser Phase): Aussehen gegen das Design, Neu-Laden bei geänderter Datei, „gerade aktualisiert“.
