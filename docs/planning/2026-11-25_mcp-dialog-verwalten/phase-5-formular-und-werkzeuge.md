# Phase 5 — Oberfläche: Formular, Test, Werkzeug-Ansicht

## Kontext

- **Entwurf (verbindlich):** [artifacts/mcp-dialog-entwurf.html](artifacts/mcp-dialog-entwurf.html) — Funktionen `formView`, `scopeOpt`, `inspectHtml`; in der Entwurfsleiste „Server hinzufügen“ klicken
- [README.md](README.md) — Kontrakt (`McpDraft`, `mcp_probe`, `mcp_inspect`), finale AK 3, 7, 8, 9
- Phase 4: `src/features/mcp/McpDialog.tsx`, `McpServerRow.tsx`, `mcpTexts.ts`
- `src/lib/mcp.ts` (`saveMcpServer`, `probeMcpServer`, `inspectMcpServer`), `src/styles/theme.css`, `docs/conventions/react.md`

## AK

1. „Server hinzufügen“ und „Bearbeiten“ wechseln **im selben Dialog** auf das Formular (kein zweiter Dialog); Kopf mit Zurück-Pfeil, Titel „Server hinzufügen“ / „Server bearbeiten“; Esc und „Abbrechen“ führen zur Liste zurück.
2. „Wo soll der Server gelten?“ als drei Auswahlkarten: Mein Benutzer (In allen Vorhaben · ~/.claude.json) · Projekt (Geteilt mit allen im Repo + Auswahl des Repositories, nur bei ≥ 1 Repository) · Nur ich, im Vorhaben (Nicht geteilt · ~/.claude.json). Vorbelegung: beim Hinzufügen das erste Repository, sonst Benutzer; „Hier hinzufügen“ aus der leeren Gruppe belegt „Nur ich“ vor; beim Bearbeiten die Quelle des Eintrags (Wechsel der Quelle = verschieben: speichern in neuer Quelle, dann entfernen in alter).
3. Umschalter „Felder | JSON einfügen“. Felder: Name (Mono, Hinweis „Unter diesem Namen sieht der Agent die Werkzeuge.“), Art „HTTP(S) | Programm | SSE“, Adresse bzw. „Befehl mit Argumenten“ (Aufteilen an Leerzeichen, Anführungszeichen halten zusammen), Header bzw. Umgebungsvariablen als Zeilen Schlüssel · Wert · „geheim“ · Entfernen, „+ Zeile“. Verborgene vorhandene Werte stehen als leeres Passwortfeld mit Platzhalter „unverändert“ (→ `value: None`).
4. JSON einfügen: Textfeld; akzeptiert `{"mcpServers":{…}}` oder ein einzelnes `{"name":{…}}`; mehrere Server werden nacheinander gespeichert; Parse-Fehler als Satz unter dem Feld.
5. Gelber Hinweis, wenn Ziel „Projekt“ und ein Wert gesetzt ist, der kein `${VARIABLE}` ist und „geheim“ trägt: „Geheimnis landet im Repo. .mcp.json wird mit dem Team geteilt. Als ${VARIABLE} verweisen oder „Nur ich, im Vorhaben“ wählen.“
6. Feldfehler erst nach dem ersten Speicherversuch: „Name fehlt.“, „Name gibt es schon – der Agent würde nur einen sehen.“ (gleiche Quelle), „Adresse fehlt.“/„Befehl fehlt.“; Core-Fehler erscheinen als Zeile über der Fußleiste.
7. Fußleiste: „Verbindung testen“ (sekundär) mit Ergebniszeile („Verbinde …“ / „Verbunden · N Werkzeuge“ / Fehlersatz), „Abbrechen“ (leise), primär „Server hinzufügen“ / „Änderungen speichern“. Nach Speichern zurück zur Liste, der Server aufgeklappt.
8. In den Details jeder Zeile mit Konfig-Eintrag: „Werkzeuge & Anweisungen ansehen“ ruft `inspectMcpServer`; Ergebnis: Block „Server-Anweisungen“ (eingerückt mit Linie; fehlt er: „Keine Anweisungen gemeldet.“) und Liste „Werkzeuge (N)“, je Werkzeug aufklappbar (`<details>`) mit Beschreibung. Fest eingebundene Server zeigen nur die Werkzeugnamen aus `mcp_status`.
9. Unter 600 px: Auswahlkarten untereinander, Schlüssel/Wert-Zeilen umbrechen, Ziele ≥ 40 px.

## Checkliste

- [ ] `src/features/mcp/McpServerForm.tsx` + `.css` (neu); `McpDialog` schaltet zwischen Liste und Formular (`view: 'list' | 'form'`).
- [ ] `src/features/mcp/parseMcpJson.ts` (neu): JSON → `McpDraft[]`, Befehl-Aufteilung `splitCommand`.
- [ ] `src/features/mcp/McpToolInspect.tsx` (neu) für AK 8, eingebunden in `McpServerRow`.
- [ ] Texte in `mcpTexts.ts`.
- [ ] Gegen Entwurf prüfen (hell/dunkel, 390/1366 px), jedes Bedienelement einmal.
- [ ] `pnpm check` grün; Code-Map-Zeile um die neuen Dateien ergänzen.

## Report-Back
