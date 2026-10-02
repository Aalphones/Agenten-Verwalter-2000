# Design-Entwurf: MCP-Dialog

**Status:** umgesetzt am 2026-10-02 (Plan [MCP-Dialog](../../archive/2026-10/2026-10-01_mcp-dialog/README.md)); abgenommen am 2026-10-01 als Grundlage dieses Plans. Für den Dialog „MCP-Server“, den Hinweis „MCP · N Problem(e)“ in der Eingabeleiste und die Zeile `/mcp` im `/`-Menü ist dieser Entwurf verbindlich; alles andere regelt weiter der Entwurf [Hauptansichten](../2026-09-28_hauptansichten/README.md). Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

## Ansehen

- **Veröffentlichte Fassung (klickbar):** https://claude.ai/artifact/FfQFLxiZfwmsfMQvPUYd7Q — privat, nur für den Eigentümer sichtbar.
- **Quellen:** [canvas/](canvas/). `Main.dc.html` ist der klickbare Dialog über einer vereinfachten Chat-Ansicht, `Slash.dc.html` zeigt den Einstieg über `/mcp`. `canvas.json` ordnet die Tafeln an. Beide Tafeln haben den Tweak `theme` (`dunkel` · `hell`).
- Die Quellen laufen nur in der Design-Zeichenfläche von claude.ai (Laufzeit `support.js`); im Browser direkt geöffnet zeigen sie nichts. Es gibt keine erzeugten Abzüge.
- Farbwerte der Tafeln sind die Hex-Werte der semantischen Tokens aus `src/styles/theme.css` (Stand 2026-10-01), fest eingetragen, weil die Zeichenfläche die App-CSS nicht lädt.
- Änderungen: auf der Zeichenfläche bearbeiten, geänderte Dateien nach `canvas/` zurückkopieren, diese README im selben Commit nachziehen.

## Tafeln

| Datei | Zeigt | Gebaut in Phase |
|---|---|---|
| `Main.dc.html` | Dialog „MCP-Server“: Filter, Gruppen nach Herkunft, Zeile je Server mit Status, Neu verbinden und Schalter, aufgeklappte Details mit Werkzeugliste, Fehlerkasten, Fußzeile mit Zählung; darunter die Eingabeleiste mit „MCP · 1 Problem“ | 2, 3 |
| `Slash.dc.html` | `/mcp` im Slash-Menü, Abschnitt „Session“, mit „1 Problem“ in Fehlerfarbe | 3 |

## Gestaltung

- Dialog mittig über einer abgedunkelten App, 640 px breit, höchstens 780 px hoch; Kopf, Filter und Fußzeile stehen, nur die Liste scrollt.
- Je Server eine umrandete Karte; aufgeklappt mit Hover-Hintergrund und kräftigerem Rand. Status als Punkt plus Wort in der Statusfarbe: Verbunden grün, Verbindet blau, Fehlgeschlagen rot, Anmeldung nötig gelb, Aus grau.
- Schalter in Akzentfarbe (an) bzw. gedämpft (aus); ein ausgeschalteter Server zeigt Name und Text gedämpft.
- Der Hinweis in der Eingabeleiste erscheint nur, wenn ein Server ein Problem hat.

## Platzhalter im Entwurf

- Server und Werkzeuglisten sind echt (Abfrage `mcp_status` am 2026-10-01); **„claude.ai FMP“ als fehlgeschlagen und „claude.ai Google Drive“ als ausgeschaltet sind gestellt**, damit jeder Zustand einmal zu sehen ist.
- Der Fehlertext im roten Kasten ist ein Platzhalter; die App zeigt das Feld `error` aus der Antwort der Kommandozeile (gemessen: `Connection closed`).
- Neu verbinden simuliert 1,4 s Wartezeit und endet immer mit „Verbunden“.
- Die Chat-Ansicht dahinter, Sidebar und Eingabeleiste sind vereinfacht; die App zeigt ihre echten Bausteine.
- Der Entwurf öffnet mit aufgeklapptem `comfy`; die App öffnet mit allen Zeilen zugeklappt.

## Abweichungen vom Entwurf

- **Zweite Zeile im Kopf:** „Session #N Name“ statt nur des Namens.
- **Fußzeile:** zusätzlich der Satz „Ausgeschaltete Server bleiben für alle Sessions dieses Vorhabens aus.“ (Messung 2026-10-01: die Kommandozeile speichert das Ausschalten pro Arbeitsordner, und der ist der Workspace des Vorhabens.)
- **Zustände ohne Liste** (Agent nie gestartet, Agent ruht, keine Server eingerichtet, Liste lädt) zeigt der Entwurf nicht; ihre Texte stehen in Phase 2 des Plans.
- **Fehler einer Aktion** (Neu verbinden oder Umschalten schlägt fehl) erscheint als Zeile in Fehlerfarbe unter dem Filter; der Entwurf zeigt nur den Fehlerkasten eines fehlgeschlagenen Servers.
