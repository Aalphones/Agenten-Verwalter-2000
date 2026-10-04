# Design-Entwurf: Changes-Review

**Status:** abgenommen am 2026-10-01 als Grundlage des Plans [Changes-Review](../../archive/2026-10/2026-10-01_changes-review/README.md). Für Syntaxfarben im Diff, das Kommentieren einer Diff-Zeile, die Zahl am Reiter „Chat“, die gesammelten Kommentare über der Eingabe und ihre Darstellung in der gesendeten Nachricht ist dieser Entwurf verbindlich; alles andere regelt weiter der Entwurf [Hauptansichten](../2026-09-28_hauptansichten/README.md). Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

## Ansehen

- **Veröffentlichte Fassung (klickbar):** https://claude.ai/artifact/Vvb1M3AsZTgtq3jMcfrcca — privat, nur für den Eigentümer sichtbar.
- **Quellen:** [canvas/](canvas/). `Main.dc.html` ist eine einzige klickbare Tafel: Reiter „Changes“ mit Diff und Kommentarfeld, Reiter „Chat“ mit gesammelten Kommentaren und Senden — beide teilen denselben Stand, damit der Ablauf durchspielbar ist. `canvas.json` ordnet die Tafel an. Tweak `theme` (`dunkel` · `hell`).
- Die Quellen laufen nur in der Design-Zeichenfläche von claude.ai (Laufzeit `support.js`); im Browser direkt geöffnet zeigen sie nichts. Es gibt keine erzeugten Abzüge.
- Farbwerte der Tafel sind die Hex-Werte der semantischen Tokens aus `src/styles/theme.css` (Stand 2026-10-01), fest eingetragen, weil die Zeichenfläche die App-CSS nicht lädt; die Syntaxfarben sind `--color-code-*` (VS Code Dark+ / Light+).
- Änderungen: auf der Zeichenfläche bearbeiten, geänderte Dateien nach `canvas/` zurückkopieren, diese README im selben Commit nachziehen.

## Was die Tafel zeigt

| Bereich | Zeigt | Gebaut in Phase |
|---|---|---|
| Diff-Zeilen | Syntaxfarben je Sprache auf den Hintergründen für hinzugefügt/gelöscht/unverändert | 1 |
| „+“ am Zeilenrand | erscheint beim Überfahren oder Fokus einer Zeile, 18 × 18 px, Akzentfarbe, links über der alten Nummernspalte | 3 |
| Kommentarfeld | direkt unter der Zeile, eingerückt bis zur Textspalte (116 px), Akzentrand, Kopf „Kommentar zu retry.ts · Zeile 18“, Textfeld, Hinweiszeile, „Abbrechen“ und „Zum Chat hinzufügen“ (beim Bearbeiten „Speichern“) | 3 |
| Gesammelter Kommentar im Diff | Karte unter der Zeile mit „Gesammelt · geht mit deiner nächsten Nachricht im Chat raus“, Text, „Bearbeiten“, Entfernen-×; am Zeilenrand statt „+“ dauerhaft ein Sprechblasen-Symbol | 3 |
| Reiter „Chat“ | Zahl der wartenden Kommentare in Akzentfarbe; Tooltip „N Kommentare warten im Chat“ | 3 |
| Eingabeleiste | Abschnitt „Review-Kommentare · N · gehen mit der nächsten Nachricht raus“ mit „Alle entfernen“, darunter je Kommentar eine Karte (Ort, Codezeile mit Vorzeichen und Syntaxfarben, Kommentar; Bearbeiten-Stift und Entfernen-×), höchstens 300 px hoch, dann scrollt der Abschnitt; Platzhalter „Nachricht zu den Kommentaren (optional) …“ | 4 |
| Gesendete Nachricht | Blase mit dem getippten Text oben, darunter „N Review-Kommentare“ und die Karten ohne Knöpfe | 4 |

## Platzhalter im Entwurf

- Der Code (`src/lib/retry.ts`) ist erfunden; die Tafel färbt ihn mit einem eigenen kleinen Tokenizer, die App mit highlight.js über lowlight.
- Sidebar, Kopfzeile, Werkzeugleiste der Changes und der Dateibaum sind vereinfacht; die App zeigt ihre echten Bausteine.
- Der Diff ist nicht virtualisiert; die App rendert ihn virtualisiert (ADR 006).
- Die Tafel öffnet mit zwei gesammelten Kommentaren und offenem Kommentarfeld an Zeile 18, damit jeder Zustand einmal zu sehen ist.
- Was der Agent als Text bekommt, zeigt die Tafel nicht; das Format steht im Plan (Kontrakt).
