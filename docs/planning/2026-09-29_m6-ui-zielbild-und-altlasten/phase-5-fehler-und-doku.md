# Phase 5 — Sichtbare Fehler statt Konsole, Doku-Abschluss

Rating: standard. Jede Fehlerstelle hat unten ihren Zielort und ihren Text.

## Kontext

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ → „Sichtbare Fehler“; „Kontrakt“ → `src/stores/sessionErrors.ts`
- `src/lib/errors.ts` (`commandErrorText` — macht aus jedem Fehler einen lesbaren Satz), `src/features/background/useActionError.ts` (Muster: Fehler einer Aktion halten, bis die nächste startet)
- Die Dateien der Tabelle unten; `src/app/App.tsx` (setzt Kopfzeile und Ansicht), `src/features/background/OutputPane.tsx` (`notice`), `src/features/repositories/RepositoryPicker.tsx`, `src/features/chat/ChatView.tsx` + `ChatTimeline.tsx`
- Token für Fehlertext: `--color-status-error`; Schrift 12 px wie `background-group__empty`
- Vault-Fehlerklassen React und TypeScript gelesen: keine einschlägig.

## Abnahmekriterien

1. Jede Zeile der Tabelle „Fehlerstellen“ zeigt ihren Fehler am genannten Ort mit dem genannten Text (`<Grund>` = `commandErrorText(reason)`); das `console.error` bleibt jeweils zusätzlich stehen.
2. Die Zeile unter der Session-Kopfzeile (`SessionActionError`) erscheint nur, wenn für die sichtbare Session ein Fehler vorliegt: volle Breite, 28 px hoch, 20 px seitlich, `border-bottom` `border-subtle`, Text 12 px in Fehlerfarbe, rechts ein ×-Knopf 22 × 22 px (`aria-label="Meldung schließen"`), `role="alert"`. Der Fehler gilt je Session: Er bleibt beim Wechsel zu einer anderen Session gespeichert und erscheint wieder, wenn der Benutzer zurückwechselt. Gelöscht wird er durch × oder durch den nächsten erfolgreichen Aufruf einer Session-Aktion dieser Session.
3. Die Stellen unter „Bleibt Konsole“ sind unverändert und im Code mit einem Kommentar begründet.
4. Doku-Abschluss erledigt (Checkliste unten); `pnpm check` grün.

## Fehlerstellen

| Datei (Zeile heute) | Fehler | Ort in der Oberfläche | Text |
|---|---|---|---|
| `useSessionSummaries.ts` (74) | Sessions laden | Sidebar statt „Noch keine Sessions.“ | Sessions nicht ladbar: <Grund> |
| `useSessionSummaries.ts` (52) | Abo auf Session-Änderungen | Sidebar, Zeile über der Liste | Sessions werden nicht mehr aktualisiert: <Grund> |
| `Sidebar.tsx` (52) | Umbenennen | Sidebar, Zeile über dem Fuß, bis zur nächsten Sidebar-Aktion | Umbenennen fehlgeschlagen: <Grund> |
| `Sidebar.tsx` (63) | Archivieren | wie oben | Archivieren fehlgeschlagen: <Grund> |
| `SessionHeader.tsx` (85) | Pause, Abbrechen, Fortsetzen | `SessionActionError` | Aktion fehlgeschlagen: <Grund> |
| `ChatView.tsx` (29) | Pause per Esc | `SessionActionError` | Pausieren fehlgeschlagen: <Grund> |
| `ChatTimeline.tsx` (199) | Rückfrage beantworten | `SessionActionError` | Antwort nicht gesendet: <Grund> |
| `ErrorBlock.tsx` (47) | Agent neu starten | `SessionActionError` | Agent nicht neu gestartet: <Grund> |
| `ErrorBlock.tsx` (38) | Protokoll laden | im Kasten an Stelle des Protokolls, Stil `error-block__log` | Protokoll nicht ladbar: <Grund> |
| `useChatEntries.ts` (154) | Verlauf laden | Chat-Spalte an Stelle des Verlaufs, zentriert, 12 px Fehlerfarbe | Verlauf nicht ladbar: <Grund> |
| `useChatEntries.ts` (196) | Ältere Einträge laden | oberste Zeile im Verlauf (über dem ältesten geladenen Eintrag); der nächste Versuch startet beim nächsten Hochscrollen | Ältere Einträge nicht ladbar: <Grund> |
| `useChatEntries.ts` (65) | Abo auf neue Einträge | `SessionActionError` | Verlauf wird nicht mehr live aktualisiert: <Grund> |
| `useSessionBackground.ts` (71) | Abo auf Hintergrund-Änderungen | bestehender `error` des Hooks (das Panel zeigt ihn heute schon für Ladefehler) | Hintergrund wird nicht mehr aktualisiert: <Grund> |
| `useItemOutput.ts` (46) | Ausgabe laden | `OutputPane`, Prop `notice` | Ausgabe nicht ladbar: <Grund> |
| `useKnownRepositories.ts` (20, 29) | Repositories laden | `RepositoryPicker` an Stelle der Liste bzw. des Satzes „keine bekannten Repositories“ | Repositories nicht ladbar: <Grund> |

**Bleibt Konsole** (Kommentar am `console.error` ergänzen): `ExternalLink.tsx` (31) — ein Link, der nicht aufgeht, fällt dem Benutzer selbst auf, ohne Session-Bezug gibt es keinen Ort; `useAttachmentInput.ts` (89) — Hineinziehen nicht verfügbar, `+` und Strg+V gehen weiter; `useCopyFeedback.ts` (41) — der Knopf zeigt schon „Fehlgeschlagen“; `useSettings.ts` Titelleiste (Phase 3) — kosmetisch.

## Checkliste

### Session-Fehler

- [ ] `src/stores/sessionErrors.ts` nach Kontrakt (`errors`, `report`, `clear`).
- [ ] `src/app/SessionActionError.tsx` + `.css` (Block `session-action-error`) nach AK 2; Prop `sessionId`; liest `errors[sessionId]`.
- [ ] `App.tsx`: `<SessionActionError sessionId={currentSession.id} />` direkt nach `<SessionHeader … />`.
- [ ] Die fünf `SessionActionError`-Stellen der Tabelle: im `catch` `report(sessionId, '<Text>')`, im Erfolgsfall `clear(sessionId)` (`.then(() => clear(sessionId))`).

### Übrige Stellen

- [ ] `useSessionSummaries`: Rückgabe um `error: string | null` erweitern (Ladefehler gewinnt über Abo-Fehler); `App.tsx` reicht ihn an `Sidebar` (Prop `loadError`), die ihn nach Tabelle zeigt (Klasse `sidebar__error`, 12 px Fehlerfarbe, Rand wie `sidebar__empty`).
- [ ] `Sidebar.tsx`: `useActionError` aus `src/features/background/` nach `src/lib/useActionError.ts` verschieben (Import in `ProcessesTab`, `SubagentsTab`, `ScratchpadTab` anpassen) und für Umbenennen und Archivieren nutzen (`scopeKey` = `'sidebar'`); Zeile über dem Fuß, Klasse `sidebar__error`. Die Texte der Tabelle als Präfix: `run` bekommt dafür einen zweiten Parameter `prefix: string` und setzt `message` auf `${prefix}: ${commandErrorText(reason)}`; die bestehenden Aufrufer im Hintergrund-Panel übergeben `''` und behalten den Text ohne Präfix (bei leerem Präfix kein Doppelpunkt).
- [ ] `ErrorBlock.tsx`: Zustand `logError: string | null`; `renderLog` zeigt ihn an Stelle des Protokolls.
- [ ] `useChatEntries`: Rückgabe um `loadError: string | null` und `olderError: string | null` erweitern (`olderError` wird beim nächsten `loadOlder` zurückgesetzt); `ChatView` zeigt `loadError` an Stelle der `ChatTimeline`, `ChatTimeline` bekommt `olderError` als Prop und rendert ihn als erste Zeile (außerhalb der virtualisierten Zeilen, oberhalb des Zeilen-Containers).
- [ ] `useSessionBackground`: im `catch` des Abos den Zustand wie beim Ladefehler setzen, Text nach Tabelle.
- [ ] `useItemOutput`: Rückgabe `{ preview: TextPreview | null; error: string | null }`; Aufrufer (`ProcessesTab`) gibt `error` als `notice` an `OutputPane`, wenn gesetzt (vor `outputNotice`).
- [ ] `useKnownRepositories`: Rückgabe um `error: string | null` erweitern; `RepositoryPicker` zeigt ihn.

### Doku-Abschluss

- [ ] PROJECT.md, Meilenstein 6: „— gebaut am <Datum>“ nach dem Muster von 2b; Satz zu Einstellungen (Farbschema, Standardwerte, Branch-Präfix) und zu den virtualisierten Listen.
- [ ] Code-Map: Kopfsatz „Stand: Meilenstein 6 …“; Zeilen für `SessionActionError`, `src/stores/sessionErrors.ts`, `src/lib/useActionError.ts`.
- [ ] Entwurfs-README, „Abweichungen vom Entwurf“: neuer Punkt „Fehlersätze“ — Zeile unter der Session-Kopfzeile, Sätze an Stelle von Liste/Verlauf/Ausgabe, keine Toasts; Maße aus AK 2.
- [ ] Glossar: nichts Neues, außer ein Begriff aus dieser Phase ist im Code als Name sichtbar geworden (dann eintragen).
- [ ] README dieses Plans: Bottom-Sektionen füllen (Summary, Files touched, Commits, Deviations, Follow-ups); STATE.md auf den Stand „Smoke durch Sascha“ setzen.

## Report-Back
