# Design-Entwurf: Vorhaben und TL;DR

**Status:** umgesetzt am 2026-09-30 (Plan [Vorhaben und Sessions](../../archive/2026-09/2026-09-30_vorhaben-und-sessions/README.md)); abgenommen am 2026-09-30 als Grundlage des Plans [Vorhaben und Sessions](../../archive/2026-09/2026-09-30_vorhaben-und-sessions/README.md). Für Sidebar, Session-Kopfzeile, Übersicht eines Vorhabens, Einstieg einer neuen Session und die TL;DR-Karten ist dieser Entwurf verbindlich; alles andere regelt weiter der Entwurf [Hauptansichten](../2026-09-28_hauptansichten/README.md), dessen Tokens, Schriften und Statussymbole er übernimmt. Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

## Ansehen

- **Veröffentlichte Fassung (klickbar):** https://claude.ai/artifact/QVJDx2sjvb4jgWKAxeW8Ld — privat, nur für den Eigentümer sichtbar.
- **Quellen:** [canvas/](canvas/). `Main.dc.html` ist der vollständige klickbare Prototyp (Sidebar, Session, Übersicht, neue Session, alle TL;DR-Zustände); alle anderen `*.dc.html` sind dünne Rahmen, die `Main` mit festen Startwerten zeigen (`start` = `session` · `vorhaben` · `neu`, `tldr` = `offen` · `eingeklappt` · `veraltet` · `laeuft` · `keins`, `theme` = `dark` · `light`). `canvas.json` ordnet die Tafeln an.
- Die Quellen laufen nur in der Design-Zeichenfläche von claude.ai (Laufzeit `support.js`); im Browser direkt geöffnet zeigen sie nichts. Es gibt keine erzeugten Abzüge.
- Änderungen: auf der Zeichenfläche bearbeiten, geänderte Dateien nach `canvas/` zurückkopieren, diese README im selben Commit nachziehen.

## Tafeln

| Datei | Zeigt | Gebaut in Phase |
|---|---|---|
| `Main.dc.html` | Klickbarer Prototyp, Start: Session `#3` mit aktuellem TL;DR | 3, 6 |
| `NoTldr.dc.html` | Session ohne TL;DR: gestrichelte Leiste mit „TL;DR erstellen“ | 6 |
| `Stale.dc.html` | TL;DR veraltet: „23 neue Einträge seitdem“, Knopf „Aktualisieren“ | 6 |
| `Collapsed.dc.html` | TL;DR eingeklappt: eine Zeile mit der Kurzfassung | 6 |
| `Loading.dc.html` | TL;DR wird erstellt: Platzhalterbalken, Chat bleibt benutzbar | 6 |
| `Vorhaben.dc.html` | Übersicht eines Vorhabens: TL;DR, Repositories, Sessions, „Neue Session“ | 4, 6 |
| `VorhabenNoTldr.dc.html` | Übersicht, eine Session ohne TL;DR: Knopf an der Karte, „aus 2 von 3“ | 6 |
| `NewSession.dc.html` | Neue Session `#4` im Status „Neu“: Einstiegsansicht, Haken „TL;DR mitschicken“ | 4, 6 |

## Gestaltung

- Wie Hauptansichten: ruhig, dunkel als Referenz, Farbe trägt nur der Status, Akzentfarbe nur für Hauptknöpfe („Neue Session“, Senden, Kontrollkästchen).
- **TL;DR-Karte** sitzt über dem Chat in dessen Spalte; „noch keins“ ist eine gestrichelte, flache Leiste — sie zeigt, dass etwas fehlt, ohne wie ein Fehler auszusehen. Eine Antwort, die eine Entscheidung von dir braucht, steht in der Wartet-Farbe.
- **Status „Neu“:** gestrichelter Ring in gedämpfter Farbe.
- Alle Maße der umgesetzten Teile stehen als prüfbare Abnahmekriterien in den Phasen-Dateien des Plans (Phase 3, 4, 6).

## Platzhalter im Entwurf

- Alle Inhalte sind Beispieldaten (Vorhaben „OAuth Login umsetzen“, Sessions, Zusammenfassungen, Uhrzeiten, Zahlen).
- Die Chat-Verläufe sind verkürzt; die App zeigt den echten Verlauf.
- „Aktualisieren“ und „TL;DR erstellen“ simulieren nur eine Wartezeit von rund zwei Sekunden.
- Die Knöpfe Pause, Abbrechen, Modell, Modus, `+`, `/` und die Reiter haben im Prototyp keine Funktion.

## Abweichungen vom Entwurf

- **Name einer neuen Session:** Bis zur ersten Nachricht heißt sie „Session N“; danach trägt sie den Namen aus dem ersten Satz der Nachricht.
- **Kopfzeile der Übersicht:** ohne Pause und Abbrechen, ohne Hintergrund-Knopf; nur Reiter Übersicht/Changes.
- **TL;DR-Stand-Text der Session:** „N neue Einträge seitdem“ rechnet die Oberfläche aus den geladenen Chat-Einträgen; erst wenn der Verlauf geladen ist, erscheint die Zahl.
- **Haken „TL;DR mitschicken“:** Beginnt die erste Nachricht mit `/` (etwa `/implement`), hängt der Core den Stand des Vorhabens hinter die Nachricht statt davor, damit die Kommandozeile den Befehl erkennt. Der Chat zeigt die Nachricht so, wie sie an den Agenten ging.
- **Knopf „TL;DR erstellen“ am Vorhaben:** gesperrt, solange keine Session des Vorhabens einen Verlauf hat.
- **Kosten:** Der Entwurf nennt keine; gemessen sind 1,2 Cent bis 33 Cent je Lauf (ADR 011).
- **Geteilte Bausteine:** Knopf, leere Leiste und Platzhalterbalken der Karten sind eigene Komponenten in `src/features/tldr/` und für Session- und Vorhaben-Karte gleich gebaut.
