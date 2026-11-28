# Phase 1 — Reiter „Dateien“ ohne Repository

## Kontext

Lesen vor dem Start:

- `AGENTS.md`, `docs/code-map.md` (Zeilen „Dateien“ und „Session-Dateien“), `docs/conventions/react.md`, `docs/conventions/typescript.md`
- `docs/decisions/071-session-dateien.md`
- `src/app/App.tsx` Z. 280–420 (Ermittlung von `isFilesView`, Changes, `canSearchFiles`) und Z. 620–870 (`renderFiles`, `renderOverview`, `SessionHeader`-Aufruf)
- `src/app/SessionHeader.tsx` Z. 40–131 (Props, Reiterfilter), `src/app/ProjectHeader.tsx` Z. 80–95
- `src/features/files/FilesView.tsx` (ganz), `src/features/files/useSessionFiles.ts`, `src/lib/sessionFiles.ts`
- Vault-Fehlerklassen React/TypeScript geprüft: keine einschlägig.

Heute: Die Sperre `repositoryCount > 0` steht in `SessionHeader.tsx:128`, `App.tsx:337` (Session) und `App.tsx:333` + `ProjectHeader.tsx:90` (Übersicht, `hasProjectRepositories` bzw. `project.repositoryNames.length`). Sie stammt aus der Zeit, als „Dateien“ nur Git zeigte (verstanden: schützt vor einer leeren Git-Ansicht). Die Changes laden ohne Repository fehlerfrei leer (die Übersicht ruft sie heute schon, `App.tsx:373`).

## AK

- Session ohne Repository, ≥1 Session-Datei im Vorhaben (Summe `files.length` über `listing.groups`): Reiter „Dateien“ sichtbar; Session ohne Repository und ohne Session-Datei: kein Reiter.
- Übersicht eines Vorhabens ohne Repository: gleiche Regel. Ansicht einer Umsetzung: unverändert.
- Ohne Repository zeigt `FilesView` keine `FilesToolbar`, keinen Knopf „Übersicht · Verlauf“, keine Kopfzeile `files-view__left-head`; links nur der Baum (enthält dann nur den Knoten „Session-Dateien“), rechts ohne offene Datei `<div className="files-view__hint"><b>Keine Datei geöffnet</b><span>Links eine Datei der Sessions wählen.</span></div>`.
- Schreibt der Agent eine neue Datei, erscheint sie spätestens nach dem nächsten Statuswechsel der Session (Ende des Zuges) im Reiter und — falls es die erste ist — der Reiter selbst.
- Dateilink im Chat einer Session ohne Repository öffnet die Session-Datei.
- Mit Repository: Verhalten und Aussehen unverändert.

## Checkliste

- [x] Neu `src/features/files/useSessionFileCount.ts`: `export function useSessionFileCount(sessionId: string | null, stamp: string): number | null`. `sessionId === null` → kein Aufruf, Rückgabe `null`. Sonst `listSessionFiles(sessionId)` bei jedem Wechsel von `sessionId` oder `stamp`; Ergebnis = Summe von `group.files.length` über `listing.groups`; Fehler → `console.error` und `null` behalten. Veraltete Antworten per Laufnummer verwerfen (Muster: `useSessionFiles.ts` `sequenceRef`). Beim Wechsel der `sessionId` bis zur Antwort `null`.
- [x] `App.tsx`: nach `hasProjectRepositories` (Z. 286) und `currentSession` berechnen:
  - `const fileCountSessionId: string | null = !isMainReplaced && currentSession !== undefined && !isImplementation && (isOverview ? !hasProjectRepositories : currentSession.repositoryCount === 0) ? currentSession.id : null;`
  - `const sessionFileCount = useSessionFileCount(fileCountSessionId, currentSession?.status ?? '');`
  - `const hasSessionFiles: boolean = (sessionFileCount ?? 0) > 0;`
- [x] `App.tsx` `isFilesView` (Z. 332–337) ersetzen: Übersicht → `isImplementation ? implementationView === 'files' && hasProjectRepositories : projectView === 'files' && (hasProjectRepositories || hasSessionFiles)`; Session → `… && (currentSession.repositoryCount > 0 || hasSessionFiles)`. Kommentar Z. 331 anpassen („ohne Repository nur mit Session-Dateien“).
- [x] `SessionHeader.tsx`: Prop `hasSessionFiles: boolean` (mit Doc-Kommentar) ergänzen; Z. 128 → `(view === 'files' && (session.repositoryCount > 0 || hasSessionFiles))`; Kommentar Z. 122 anpassen. In `App.tsx` beim `<SessionHeader` übergeben.
- [x] `ProjectHeader.tsx`: gleiche Prop, Z. 90 → `(view === 'files' && (project.repositoryNames.length > 0 || hasSessionFiles))`, Kommentar anpassen; in `App.tsx` `renderOverview` übergeben.
- [x] `FilesView.tsx`: Props `hasRepositories: boolean` und `activityStamp: string` (Doc-Kommentare). `useSessionFiles(sessionId, \`${stamp}|${activityStamp}\`)`. Bei `!hasRepositories`: `FilesToolbar`, Home-Knopf und `files-view__left-head` nicht rendern; in `renderDetail` bei `selection.open === null` den Hinweis aus der AK statt Übersicht/Git-Seite.
- [x] `App.tsx` `renderFiles`: `hasRepositories={isOverview ? hasProjectRepositories : session.repositoryCount > 0}` und `activityStamp={session.status}` übergeben.
- [x] Docs: `docs/code-map.md` Zeile „Session-Dateien“ um `useSessionFileCount` (Zähler für die Sichtbarkeit des Reiters ohne Repository) ergänzen; `docs/glossary.md` „Session-Datei“: Satz „Ohne Repository zeigt der Reiter ‚Dateien‘ nur diesen Knoten; er erscheint, sobald es eine Session-Datei gibt.“; `docs/decisions/071-session-dateien.md` Abschnitt „Nachtrag 2026-11-27: Sessions ohne Repository“ (3–5 Sätze: Sichtbarkeit, schlanke Ansicht, Nachladen am Status).
- [x] `powershell -File scripts/check.ps1` grün.

## Report-Back

Complete, `scripts/check.ps1` grün; nicht in der laufenden App angesehen. Abweichungen: Der Zähler lädt zusätzlich nach, wenn ein Dateilink auf eine Session-Datei wartet (sonst bliebe der Klick auf die erste Datei mitten im Zug wirkungslos). Der Hinweis ohne offene Datei trägt in schmaler Breite „← Baum“.
