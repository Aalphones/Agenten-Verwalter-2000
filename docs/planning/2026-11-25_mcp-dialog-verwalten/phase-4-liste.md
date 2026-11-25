# Phase 4 — Oberfläche: Liste nach Ablageort

## Kontext

- **Entwurf (verbindlich):** [artifacts/mcp-dialog-entwurf.html](artifacts/mcp-dialog-entwurf.html) — Zustände oben in der Entwurfsleiste umschalten; Funktion `listView`, `rowHtml`, `detailHtml`, `undoHtml` zeigen Aufbau und Texte
- [README.md](README.md) — Kontrakt, finale AK 1, 2, 4, 5, 6, 9
- `src/features/mcp/` — `McpDialog.tsx`, `McpDialog.css`, `McpServerRow.tsx`, `McpServerRow.css`, `useSessionMcp.ts`, `mcpTexts.ts`
- `src/lib/mcp.ts` (Wrapper aus Phase 1–3), `src/styles/theme.css` (Tokens), `docs/conventions/react.md`, `docs/conventions/typescript.md`

## AK

1. Kopf: Titel „MCP-Server“, Untertitel Session, darunter Agent-Zeile mit Punkt: „Agent läuft · Stand live“ / „Agent ruht · Stand aus den Konfigurationsdateien“ / „Noch nicht gestartet · Stand aus den Konfigurationsdateien“.
2. Werkzeugzeile: Suchfeld (Filter auf Namen) + primärer Knopf „Server hinzufügen“ (öffnet Phase 5; bis dahin `disabled`). Unter 600 px Containerbreite heißt der Knopf „Server“.
3. Ohne Agent ein leiser Hinweis: „Verbindungszustand erscheint, sobald der Agent läuft. Schalten, Bearbeiten und Werkzeuge ansehen geht schon jetzt.“ Mit `configChanged` und laufendem Agenten: gelber Hinweis „Änderungen wirken ab der nächsten Nachricht – der Agent startet dann neu.“ (ohne Zahl; der Core liefert nur ja/nein).
4. Gruppen wie README AK 2; Gruppenkopf: Symbol, Name, Anzahl, rechts bündig Reichweite + Datei („alle Vorhaben · ~/.claude.json“, „geteilt im Repo · gymid/.mcp.json“, „nicht geteilt · ~/.claude.json je Vorhaben“, „nicht änderbar“).
5. Zuordnung live → Datei: `mergeServers(config, live)` in `mcpTexts.ts`. Live-Server mit gleichem Namen wie ein nicht überdeckter Konfig-Eintrag übernehmen dessen Gruppe; übrige Live-Server → „Fest eingebunden“ mit Herkunftstext (`claudeai` → „claude.ai-Connector“, `enterprise` → „Organisation“, sonst „vom Verwalter“).
6. Zeile (feste Spalten wie Entwurf): Pfeil, Punkt, Name (Mono), Metazeile „Art · Host/Befehl · N Werkzeuge“; rechts Status-Wort (128 px Spalte), Knöpfe Neu verbinden (nur mit Agent aktiv) · Bearbeiten · Entfernen, Kippschalter. Fest eingebunden: statt Bearbeiten/Entfernen ein Schloss „fest“. Status ohne Agent „Startet mit Agent“, ausgeschaltet „Aus“; ein Konfig-Eintrag, den der laufende Agent nicht meldet (neu hinzugefügt), „Ab nächster Nachricht“. Überdeckte Einträge: Metazeile endet mit „überdeckt von <Gruppe>“.
7. Details: „Gespeichert in“, „Art“, „Adresse“/„Befehl“, „Header“/„Umgebung“ (verborgene Werte als „••••••••“ + „gesetzt · ändern unter Bearbeiten“), Fehlerkasten bei `failed`/`needsAuth` wie heute, Knopf „Werkzeuge & Anweisungen ansehen“ (Phase 5 füllt ihn; bis dahin ausgeblendet).
8. Entfernen: Zeile wird sofort zur Rückgängig-Zeile „<Name> entfernt aus <Gruppe>“ (+ „– betrifft alle im Repo“ bei Repository) mit Balken und Knopf „Rückgängig“, Strg+Z wirkt; nach 6 s `removeMcpServer`. Schließen des Dialogs führt eine offene Entfernung sofort aus.
9. Fußzeile: Zusammenfassung (mit Agent wie heute `summaryText`, ohne Agent „N Server · M eingeschaltet“) + „Ausschalten wahlweise nur hier oder überall.“ + „Schließen“.
10. Unter 600 px Containerbreite: Blatt von unten, Statuswort wandert vor die Metazeile, Aktionen in eigener Zeile, Ziele ≥ 40 px.
11. Kippschalter aus → Auswahl direkt am Schalter (unter 600 px als Blatt unten): Titel „<Name> ausschalten“, Knopf „Nur in diesem Vorhaben“ (Zusatz „Neue Sessions hier starten ohne ihn“, Fokus beim Öffnen, Enter wählt) und „Überall“ (Zusatz „Auch in neuen Vorhaben aus, bis du ihn einschaltest“); Esc oder Klick daneben bricht ab. Einschalten ohne Auswahl. Status-Wort für Namen in `disabledEverywhere`: „Aus · überall“; Tooltip des Schalters dann „Einschalten – gilt wieder in allen Vorhaben“. Fußzeile: „Ausschalten wahlweise nur hier oder überall.“
12. `useSessionMcp` lädt zusätzlich `loadMcpConfig` beim Öffnen und bei jedem `mcp://changed`; der Dialog rendert, sobald die Konfiguration da ist, auch wenn `servers` `null` ist.

## Checkliste

- [ ] `mcpTexts.ts`: `groupServers` durch `mergeServers` ersetzen (Typ `McpRowGroup { id, title, where, kind, rows: McpRow[] }`), neue Texte als Konstanten; alte, ungenutzte Konstanten (`NEW_SESSION_TEXT`, `AGENT_IDLE_TEXT`) entfernen.
- [ ] `McpDialog.tsx`/`.css`: Kopf, Werkzeugzeile, Hinweise, Gruppen, Rückgängig-Logik (Zustand `pendingRemoval` + Timer), Fußzeile; Containerabfrage für < 600 px.
- [ ] `McpServerRow.tsx`/`.css`: Spalten, Knöpfe, Schloss, Details nach AK 6–7.
- [ ] `useSessionMcp.ts`: Konfiguration mitladen.
- [ ] Gegen Entwurf prüfen (hell/dunkel, 390/860/1366 px) — Layout, Gruppen, Zeilenspalten.
- [ ] `pnpm check` grün; Code-Map-Zeile aktualisieren.

## Report-Back
